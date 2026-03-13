const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');

const axios = require('axios');

const { chunkSize } = require('../config');
const { encryptBuffer } = require('../pipeline/encryptStream');
const { createUploadStream, ChunkSplitter } = require('../pipeline/chunker');
const queue = require('./queueManager');
const pool = require('./channelPool');
const logger = require('../utils/logger');
const hasher = require('../utils/hasher');
const { getRepository } = require('./database');
const { decryptBuffer } = require('../pipeline/encryptStream');

/**
 * Saves file metadata to the local JSON database.
 */
const saveToRegistry = async (fileData) => {
    const repo = getRepository(); // Get the generic interface
    const fileId = crypto.randomBytes(4).toString('hex');

    // Generic method call
    await repo.saveFile(fileId, fileData);

    logger.success(`Metadata indexed via Repository. ID: ${fileId}`);
    return fileId;
};

/**
 * Main pipeline to process, encrypt, and upload files to Discord.
 */
exports.processUpload = async (client, filePath, originalName) => {
    const stats = fs.statSync(filePath);
    const totalSize = stats.size;
    const fileHash = await hasher.calculateHash(filePath);

    const expectedChunks = Math.ceil(totalSize / chunkSize);

    logger.info(`Starting upload: ${originalName} (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
    logger.info(`Pipeline: Compression -> Encryption -> ${expectedChunks} Chunks.`);

    const chunksMetadata = [];
    const splitter = new ChunkSplitter(chunkSize);

    // Setup stream pipeline: File -> GZIP -> Chunker
    const uploadPipeline = createUploadStream(filePath, chunkSize).pipe(splitter);

    let chunkIndex = 0;

    for await (const chunk of uploadPipeline) {
        const currentChunkNum = chunkIndex + 1;
        const progress = ((currentChunkNum / expectedChunks) * 100).toFixed(1);

        // Encrypt the raw chunk buffer
        const encrypted = encryptBuffer(chunk);

        logger.info(`Queueing Chunk ${currentChunkNum}/${expectedChunks} [${progress}%]`);

        try {
            // Add the upload task to the Queue Manager
            const msg = await queue.add(async () => {
                const channelId = pool.next();
                const channel = await client.channels.fetch(channelId);

                return channel.send({
                    files: [
                        {
                            attachment: encrypted,
                            name: `c${chunkIndex}.enc`,
                        },
                    ],
                });
            });

            chunksMetadata.push({
                cId: msg.channelId,
                mId: msg.id,
            });

            chunkIndex++;
        } catch (err) {
            logger.error(`Failed at Chunk ${currentChunkNum}: ${err.message}`);
            throw new Error(`Upload interrupted at chunk ${currentChunkNum}`);
        }
    }

    // Finalize by saving to registry
    const fileId = saveToRegistry({
        name: originalName,
        hash: fileHash,
        chunks: chunksMetadata,
        size: totalSize,
        compressed: true,
        uploadedAt: new Date().toISOString(),
    });

    return fileId;
};

exports.downloadFile = async (client, fileId, res) => {
    const repo = getRepository();
    const file = await repo.getFile(fileId);

    if (!file) throw new Error('FILE_NOT_FOUND');

    logger.info(`Streaming started: ${file.name} (${file.chunks.length} chunks)`);

    // Set headers on the response object
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const gunzip = zlib.createGunzip();
    const integritySpy = hasher.createVerificationStream(file.hash, file.name);

    gunzip.pipe(integritySpy).pipe(res);

    for (let i = 0; i < file.chunks.length; i++) {
        const chunk = file.chunks[i];

        const msg = await queue.add(async () => {
            const channel = await client.channels.fetch(chunk.cId);
            return await channel.messages.fetch(chunk.mId);
        });

        const url = msg.attachments.first().url;
        const response = await axios.get(url, { responseType: 'arraybuffer' });

        const decrypted = decryptBuffer(Buffer.from(response.data));
        gunzip.write(decrypted);
    }

    gunzip.end();
};
