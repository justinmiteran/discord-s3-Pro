const crypto = require('crypto');
const fs = require('fs');

const logger = require('./logger');

/**
 * Generates a SHA-256 checksum for a file to ensure data integrity.
 * @param {string} path - The absolute path to the file.
 * @returns {Promise<string>} - The hex-encoded hash string.
 */
exports.calculateHash = (path) =>
    new Promise((resolve, reject) => {
        const startTime = Date.now();
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(path);

        logger.info(`Calculating SHA-256 hash for integrity check...`);

        input.on('error', (err) => {
            logger.error(`Hash calculation failed: ${err.message}`);
            reject(err);
        });

        // We use the 'data' event to update the hash chunk by chunk
        input.on('data', (chunk) => {
            hash.update(chunk);
        });

        input.on('end', () => {
            const fileHash = hash.digest('hex');
            const duration = Date.now() - startTime;

            logger.success(`Hash generated: ${fileHash.substring(0, 10)}... (Took ${duration}ms)`);
            resolve(fileHash);
        });
    });
