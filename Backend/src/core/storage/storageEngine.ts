import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import { Client } from 'discord.js';
import { Response } from 'express';
import { server } from '../../config/index.js';
import { encryptBuffer } from '../../pipeline/encryptStream.js';
import { ChunkSplitter } from '../../pipeline/chunker.js';
import queue, { TaskPriority } from '../queueManager.js';
import * as hasher from '../../utils/hasher.js';
import { getRepository } from '../database.js';
import { FileData, ChunkMetadata, ChunkRegistry } from '../../types/models/file.model.js';
import logger from '../../utils/logger.js';
import { pipeline, Writable } from 'stream';
import { promisify } from 'util';
import { NotFoundError, FileTooLargeError, toError } from '../../utils/errors/AppError.js';
import { reencryptionScheduler } from '../reencryption/reencryptionScheduler.js';
import { DiscordChunkManager } from '../discord/discordChunkManager.js';

const pipelinePromise = promisify(pipeline);

/**
 * Processes file upload: compression, encryption, chunking, and storage to Discord
 * Implements deduplication: if file hash exists in chunk registry, reuses existing chunks
 * @param client - Discord bot client instance
 * @param filePath - Path to the file to upload
 * @param originalName - Original filename
 * @returns Unique file identifier
 */
export const processUpload = async (
    client: Client,
    filePath: string,
    originalName: string,
): Promise<string> => {
    const startTime = Date.now();
    const stats = fs.statSync(filePath);

    // Validate file size
    if (server.maxFileSize > 0 && stats.size > server.maxFileSize) {
        logger.warn('File size exceeds maximum allowed', {
            fileName: originalName,
            fileSize: stats.size,
            maxSize: server.maxFileSize,
            fileSizeMB: (stats.size / 1024 / 1024).toFixed(2),
            maxSizeMB: (server.maxFileSize / 1024 / 1024).toFixed(2),
        });
        throw new FileTooLargeError(stats.size, server.maxFileSize);
    }

    logger.info('Starting file upload', {
        fileName: originalName,
        size: stats.size,
        sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    });

    const fileHash = await hasher.calculateHash(filePath);
    logger.debug('File hash calculated', { hash: fileHash });

    const repo = getRepository();
    const existingRegistry = await repo.getChunkRegistryByHash(fileHash);

    if (existingRegistry) {
        logger.info('File already exists in chunk registry (deduplication)', {
            hash: fileHash,
            registryId: existingRegistry.id,
            currentRefCount: existingRegistry.refCount,
            encryptionKeyId: existingRegistry.encryptionKeyId,
        });

        // Check if re-encryption is needed and trigger in background
        reencryptionScheduler.scheduleIfNeeded(client, existingRegistry, 'dedup-upload');

        const fileId = crypto.randomBytes(4).toString('hex');
        const fileData: FileData = {
            id: fileId,
            name: originalName,
            hash: fileHash,
            chunkRegistryId: existingRegistry.id,
            size: stats.size,
            uploadedAt: new Date().toISOString(),
        };

        await repo.saveFile(fileData);
        await repo.incrementChunkRegistryRefCount(existingRegistry.id);

        const duration = Date.now() - startTime;
        logger.success('File upload completed (deduplicated)', {
            fileId,
            fileName: originalName,
            registryId: existingRegistry.id,
            reusedChunks: existingRegistry.chunks.length,
            duration,
            hash: fileHash,
        });

        return fileId;
    }

    const chunksMetadata: ChunkMetadata[] = [];
    let encryptionKeyId: string | undefined;
    const chunkManager = new DiscordChunkManager(client);

    const splitter = new ChunkSplitter(server.chunkSize);
    const readStream = fs.createReadStream(filePath);
    const compressor = zlib.createGzip();

    let chunkSequence = 0;

    const uploadDestination = new Writable({
        objectMode: true,
        async write(chunk: Buffer, encoding, callback) {
            try {
                chunkSequence++;
                const currentChunkIndex = chunkSequence;

                const { encrypted, keyId } = encryptBuffer(chunk);
                encryptionKeyId = keyId;

                const metadata = await chunkManager.uploadChunk(
                    chunk,
                    currentChunkIndex,
                    TaskPriority.HIGH,
                    'chunk',
                );

                chunksMetadata.push(metadata);
                callback();
            } catch (err) {
                logger.error('Chunk upload failed', toError(err), {
                    chunkIndex: chunkSequence,
                    fileName: originalName,
                });
                callback(toError(err));
            }
        },
    });

    try {
        await pipelinePromise(readStream, compressor, splitter, uploadDestination);

        const registryId = crypto.randomBytes(4).toString('hex');
        const chunkRegistry: ChunkRegistry = {
            id: registryId,
            hash: fileHash,
            chunks: chunksMetadata,
            refCount: 1,
            compressed: true,
            encryptionKeyId,
            createdAt: new Date().toISOString(),
        };

        await repo.saveChunkRegistry(chunkRegistry);

        const fileId = crypto.randomBytes(4).toString('hex');
        const fileData: FileData = {
            id: fileId,
            name: originalName,
            hash: fileHash,
            chunkRegistryId: registryId,
            size: stats.size,
            uploadedAt: new Date().toISOString(),
        };

        await repo.saveFile(fileData);

        const duration = Date.now() - startTime;
        logger.success('File upload completed', {
            fileId,
            fileName: originalName,
            registryId,
            chunks: chunksMetadata.length,
            size: stats.size,
            duration,
            hash: fileHash,
        });

        return fileId;
    } catch (err) {
        const duration = Date.now() - startTime;
        logger.error('Upload pipeline failed', toError(err), {
            fileName: originalName,
            duration,
            chunksUploaded: chunksMetadata.length,
        });
        throw toError(err);
    }
};

/**
 * Downloads and reconstructs a file from Discord chunks
 * Retrieves chunks from the chunk registry referenced by the file
 * @param client - Discord bot client instance
 * @param fileId - Unique file identifier
 * @param res - Express response object to stream the file to
 */
export const downloadFile = async (
    client: Client,
    fileId: string,
    res: Response,
): Promise<void> => {
    const startTime = Date.now();
    const file = await getRepository().getFile(fileId);

    if (!file) {
        logger.warn('File not found for download', { fileId });
        throw new NotFoundError('File');
    }

    let registry = await getRepository().getChunkRegistry(file.chunkRegistryId);
    if (!registry) {
        const error = new NotFoundError('Chunk registry');
        logger.error('Chunk registry not found for download', error, {
            fileId,
            chunkRegistryId: file.chunkRegistryId,
        });
        throw error;
    }

    logger.info('Starting file download', {
        fileId,
        fileName: file.name,
        registryId: registry.id,
        chunks: registry.chunks.length,
        size: file.size,
        sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        encryptionKeyId: registry.encryptionKeyId,
    });

    // Check if re-encryption is needed and trigger in background
    reencryptionScheduler.scheduleIfNeeded(client, registry, fileId);

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const gunzip = zlib.createGunzip();

    gunzip.on('error', (err) => {
        logger.error('Decompression failed', toError(err), { fileId, fileName: file.name });
        if (!res.headersSent) res.status(500).send('Stream decompression error.');
    });

    gunzip.pipe(hasher.createVerificationStream(file.hash, file.name)).pipe(res);

    const chunkManager = new DiscordChunkManager(client);

    try {
        let downloadedChunks = 0;
        let totalBytes = 0;

        for (const chunk of registry.chunks) {
            downloadedChunks++;

            const decrypted = await chunkManager.downloadChunk(
                chunk,
                registry.encryptionKeyId,
                TaskPriority.HIGH,
                downloadedChunks,
            );

            totalBytes += decrypted.length;

            logger.debug('Chunk recovered', {
                chunkIndex: downloadedChunks,
                totalChunks: registry.chunks.length,
                chunkSize: `${(decrypted.length / 1024 / 1024).toFixed(2)} MB`,
                progress: `${((downloadedChunks / registry.chunks.length) * 100).toFixed(1)}%`,
            });

            const canContinue = gunzip.write(decrypted);

            if (!canContinue) {
                await new Promise((resolve) => gunzip.once('drain', resolve));
            }
        }

        gunzip.end();

        const duration = Date.now() - startTime;
        logger.success('File download completed', {
            fileId,
            fileName: file.name,
            chunks: downloadedChunks,
            totalBytes,
            duration,
            throughput: `${(totalBytes / 1024 / 1024 / (duration / 1000)).toFixed(2)} MB/s`,
        });
    } catch (err) {
        const duration = Date.now() - startTime;
        logger.error('Download pipeline aborted', toError(err), {
            fileId,
            fileName: file.name,
            duration,
        });
        gunzip.destroy();
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed during chunk recovery.' });
        }
    }
};
