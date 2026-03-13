const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const { dbPath, chunkSize } = require('../config');
const { encryptBuffer } = require('../pipeline/encryptStream');
const { createUploadStream, ChunkSplitter } = require('../pipeline/chunker');
const queue = require('./queueManager');
const pool = require('./channelPool');
const logger = require('../utils/logger');
const hasher = require('../utils/hasher');

/**
 * Saves file metadata to the local JSON database.
 */
const saveToRegistry = (fileData) => {
    try {
        const registry = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : {};
        const fileId = crypto.randomBytes(3).toString('hex');

        registry[fileId] = fileData;
        fs.writeFileSync(dbPath, JSON.stringify(registry, null, 4));

        logger.success(`Metadata indexed. File ID: ${fileId} | Registry: ${path.basename(dbPath)}`);
        return fileId;
    } catch (err) {
        logger.error(`Failed to update registry: ${err.message}`);
        throw err;
    }
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
