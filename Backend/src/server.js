const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');

const express = require('express');
const axios = require('axios');

const { dbPath } = require('./config');
const { decryptBuffer } = require('./pipeline/encryptStream');
const logger = require('./utils/logger');
const queue = require('./core/queueManager'); // Using the queue for rate-limit safety

module.exports = (client) => {
    const app = express();

    // --- REQUEST TRACER MIDDLEWARE ---
    app.use((req, res, next) => {
        const start = Date.now();

        logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);

        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.http(req.method, req.originalUrl, res.statusCode, duration);
        });
        next();
    });

    // --- STREAMING DOWNLOAD LOGIC ---
    app.get('/download/:id', async (req, res) => {
        const fileId = req.params.id;

        try {
            if (!fs.existsSync(dbPath)) {
                logger.error(`Download failed: Registry file missing at ${dbPath}`);
                return res.status(404).send('Registry not found');
            }

            const registry = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            const file = registry[fileId];

            if (!file) {
                logger.warn(`Download attempt for unknown ID: ${fileId}`);
                return res.status(404).send('File not found');
            }

            logger.info(`Streaming started: ${file.name} (${file.chunks.length} chunks)`);

            // Set headers for file download
            res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
            res.setHeader('Content-Type', 'application/octet-stream');

            // Initialize decompression stream
            const gunzip = zlib.createGunzip();
            const hashVerify = crypto.createHash('sha256');

            gunzip.on('data', (chunk) => {
                hashVerify.update(chunk);
            });

            gunzip.on('end', () => {
                const finalHash = hashVerify.digest('hex');

                if (finalHash === file.hash) {
                    logger.success(`Integrity verified for ${file.name} (SHA-256 matched)`);
                } else {
                    logger.error(`INTEGRITY FAILURE: ${file.name} is corrupted!`);
                }
            });

            gunzip.pipe(res);

            // Fetch and process chunks sequentially
            for (let i = 0; i < file.chunks.length; i++) {
                const chunk = file.chunks[i];

                logger.info(`Fetching chunk ${i + 1}/${file.chunks.length} for ID: ${fileId}`);

                // Fetch chunk metadata via Queue to handle Discord Rate Limits
                const msg = await queue.add(async () => {
                    const channel = await client.channels.fetch(chunk.cId);
                    return await channel.messages.fetch(chunk.mId);
                });

                const url = msg.attachments.first().url;

                // Download encrypted chunk from Discord CDN
                const response = await axios.get(url, { responseType: 'arraybuffer' });

                // Decrypt the buffer
                const decrypted = decryptBuffer(Buffer.from(response.data));

                // Write to decompression stream
                gunzip.write(decrypted);
            }

            gunzip.end();
            logger.success(`Download complete: ${file.name}`);
        } catch (err) {
            logger.error(`Stream Error for ID ${fileId}: ${err.message}`);
            if (!res.headersSent) {
                res.status(500).send('Error during file reconstruction');
            }
        }
    });

    // --- API ROUTES BINDING ---
    const apiRoutes = require('./api/routes')(client);
    app.use('/', apiRoutes);

    return app;
};
