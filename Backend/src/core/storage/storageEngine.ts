import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import { Client } from 'discord.js';
import { Response } from 'express';
import { server, queue as queueConfig } from '../../config/index.js';
import { encryptionService } from '../crypto/index.js';
import { ChunkSplitter } from '../../pipeline/chunker.js';
import { TaskPriority } from '../queueManager.js';
import * as hasher from '../../utils/hasher.js';
import { getRepository } from '../database.js';
import { FileData, ChunkMetadata, ChunkRegistry } from '../../types/models/file.model.js';
import logger, { startTimer } from '../../utils/logger.js';
import { getCompressionLevel } from '../../utils/compressionPolicy.js';
import { pipeline, Writable } from 'stream';
import { promisify } from 'util';
import { NotFoundError, FileTooLargeError, toError } from '../../utils/errors/AppError.js';
import { reencryptionScheduler } from '../reencryption/reencryptionScheduler.js';
import { DiscordChunkManager } from '../discord/discordChunkManager.js';

const pipelinePromise = promisify(pipeline);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validates file size against configured maximum
 * @param filePath - Path to file
 * @param fileName - Original filename for logging
 * @throws FileTooLargeError if file exceeds maximum size
 */
const validateFileSize = (filePath: string, fileName: string): void => {
    if (server.maxFileSize === 0) return;

    const stats = fs.statSync(filePath);
    if (stats.size > server.maxFileSize) {
        logger.warn('File size exceeds maximum allowed', {
            fileName,
            fileSize: stats.size,
            maxSize: server.maxFileSize,
            fileSizeMB: (stats.size / 1024 / 1024).toFixed(2),
            maxSizeMB: (server.maxFileSize / 1024 / 1024).toFixed(2),
        });
        throw new FileTooLargeError(stats.size, server.maxFileSize);
    }
};

/**
 * Generates unique identifier for files and registries
 * @returns Random hex string (8 characters)
 */
const generateId = (): string => crypto.randomBytes(4).toString('hex');

/**
 * Handles deduplicated upload by reusing existing chunk registry
 * @param existingRegistry - Existing chunk registry to reuse
 * @param originalName - Original filename
 * @param fileSize - File size in bytes
 * @param fileHash - SHA-256 hash of file
 * @param client - Discord client for re-encryption scheduling
 * @returns File identifier
 */
const handleDeduplicatedUpload = async (
    existingRegistry: ChunkRegistry,
    originalName: string,
    fileSize: number,
    fileHash: string,
    client: Client,
): Promise<string> => {
    logger.info('File already exists in chunk registry (deduplication)', {
        hash: fileHash,
        registryId: existingRegistry.id,
        currentRefCount: existingRegistry.refCount,
        encryptionKeyId: existingRegistry.encryptionKeyId,
    });

    reencryptionScheduler.scheduleIfNeeded(client, existingRegistry, 'dedup-upload');

    const fileId = generateId();
    const fileData: FileData = {
        id: fileId,
        name: originalName,
        hash: fileHash,
        chunkRegistryId: existingRegistry.id,
        size: fileSize,
        uploadedAt: new Date().toISOString(),
    };

    const repo = getRepository();
    await repo.saveFile(fileData);
    await repo.incrementChunkRegistryRefCount(existingRegistry.id);

    logger.success('File upload completed (deduplicated)', {
        fileId,
        fileName: originalName,
        registryId: existingRegistry.id,
        reusedChunks: existingRegistry.chunks.length,
        hash: fileHash,
    });

    return fileId;
};

/**
 * Creates writable stream that encrypts and uploads chunks to Discord
 * @param client - Discord client
 * @param originalName - Original filename for logging
 * @param chunksMetadata - Array to store chunk metadata
 * @param encryptionKeyIdRef - Object to store encryption key ID
 * @returns Writable stream for chunk processing
 */
const createChunkUploadStream = (
    client: Client,
    originalName: string,
    chunksMetadata: ChunkMetadata[],
): Writable => {
    const chunkManager = new DiscordChunkManager(client);
    let chunkSequence = 0;
    const pendingUploads: Promise<void>[] = [];
    const orderedResults: { index: number; metadata: ChunkMetadata }[] = [];

    return new Writable({
        objectMode: true,
        write(chunk: Buffer, _encoding, callback) {
            chunkSequence++;
            const currentIndex = chunkSequence;

            const upload = chunkManager
                .uploadChunk(chunk, currentIndex, TaskPriority.HIGH, 'chunk')
                .then((metadata) => {
                    orderedResults.push({ index: currentIndex, metadata });
                })
                .catch((err) => {
                    logger.error('Chunk upload failed', toError(err), {
                        chunkIndex: currentIndex,
                        fileName: originalName,
                    });
                    throw toError(err);
                });

            pendingUploads.push(upload);
            callback();
        },
        final(callback) {
            Promise.all(pendingUploads)
                .then(() => {
                    orderedResults
                        .sort((a, b) => a.index - b.index)
                        .forEach(({ metadata }) => chunksMetadata.push(metadata));
                    callback();
                })
                .catch(callback);
        },
    });
};

/**
 * Saves chunk registry and file metadata to database
 * @param fileHash - SHA-256 hash of file
 * @param chunksMetadata - Array of chunk metadata
 * @param encryptionKeyId - Encryption key ID used
 * @param originalName - Original filename
 * @param fileSize - File size in bytes
 * @returns File identifier
 */
const saveFileMetadata = async (
    fileHash: string,
    chunksMetadata: ChunkMetadata[],
    encryptionKeyId: string | undefined,
    originalName: string,
    fileSize: number,
    compressed: boolean,
): Promise<string> => {
    const repo = getRepository();

    const registryId = generateId();
    const chunkRegistry: ChunkRegistry = {
        id: registryId,
        hash: fileHash,
        chunks: chunksMetadata,
        refCount: 1,
        compressed,
        encryptionKeyId,
        createdAt: new Date().toISOString(),
    };
    await repo.saveChunkRegistry(chunkRegistry);

    const fileId = generateId();
    const fileData: FileData = {
        id: fileId,
        name: originalName,
        hash: fileHash,
        chunkRegistryId: registryId,
        size: fileSize,
        uploadedAt: new Date().toISOString(),
    };
    await repo.saveFile(fileData);

    logger.success('File upload completed', {
        fileId,
        fileName: originalName,
        registryId,
        chunks: chunksMetadata.length,
        size: fileSize,
    });

    return fileId;
};

/**
 * Retrieves file and chunk registry metadata from database
 * @param fileId - File identifier
 * @returns File data and chunk registry
 * @throws NotFoundError if file or registry not found
 */
const getFileMetadata = async (
    fileId: string,
): Promise<{ file: FileData; registry: ChunkRegistry }> => {
    const repo = getRepository();
    const file = await repo.getFile(fileId);

    if (!file) {
        logger.warn('File not found for download', { fileId });
        throw new NotFoundError('File');
    }

    const registry = await repo.getChunkRegistry(file.chunkRegistryId);
    if (!registry) {
        const error = new NotFoundError('Chunk registry');
        logger.error('Chunk registry not found for download', error, {
            fileId,
            chunkRegistryId: file.chunkRegistryId,
        });
        throw error;
    }

    return { file, registry };
};

/**
 * Downloads and decrypts all chunks from Discord using a sliding window
 * to bound memory usage: at most downloadConcurrency chunks in RAM at once.
 * @param client - Discord client
 * @param registry - Chunk registry containing chunk metadata
 * @param output - Writable stream to write decrypted data into
 */
const downloadAndDecryptChunks = async (
    client: Client,
    registry: ChunkRegistry,
    output: NodeJS.WritableStream,
): Promise<void> => {
    const chunkManager = new DiscordChunkManager(client);
    const chunks = registry.chunks;
    const windowSize = queueConfig.downloadConcurrency;
    const results: Buffer[] = new Array(chunks.length);

    for (let start = 0; start < chunks.length; start += windowSize) {
        const batch = chunks.slice(start, start + windowSize);

        const downloaded = await Promise.all(
            batch.map((chunk, i) =>
                chunkManager.downloadChunk(
                    chunk,
                    registry.encryptionKeyId,
                    TaskPriority.HIGH,
                    start + i + 1,
                ),
            ),
        );

        for (let i = 0; i < downloaded.length; i++) {
            results[start + i] = downloaded[i];
        }
    }

    for (const [index, decrypted] of results.entries()) {
        logger.debug('Chunk recovered', {
            chunkIndex: index + 1,
            totalChunks: chunks.length,
            chunkSize: `${(decrypted.length / 1024 / 1024).toFixed(2)} MB`,
            progress: `${(((index + 1) / chunks.length) * 100).toFixed(1)}%`,
        });

        const canContinue = (output as any).write(decrypted);
        if (!canContinue) {
            await new Promise((resolve) => (output as any).once('drain', resolve));
        }
    }

    (output as any).end();
};

// ============================================================================
// PUBLIC API
// ============================================================================

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
    const elapsed = startTimer();

    validateFileSize(filePath, originalName);

    const stats = fs.statSync(filePath);
    logger.info('Starting file upload', {
        fileName: originalName,
        size: stats.size,
        sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
    });

    const fileHash = await hasher.calculateHash(filePath);
    logger.debug('File hash calculated', { hash: fileHash });

    const existingRegistry = await getRepository().getChunkRegistryByHash(fileHash);

    if (existingRegistry) {
        const fileId = await handleDeduplicatedUpload(
            existingRegistry,
            originalName,
            stats.size,
            fileHash,
            client,
        );
        const duration = elapsed();
        logger.debug('Upload duration', { duration, deduplicated: true });
        return fileId;
    }

    const chunksMetadata: ChunkMetadata[] = [];

    const encryptionKeyId = encryptionService.getActiveKeyId();
    const compressionLevel = getCompressionLevel(originalName);
    const compressed = compressionLevel > 0;

    logger.debug('Compression policy applied', {
        fileName: originalName,
        compressionLevel,
        compressed,
    });

    const readStream = fs.createReadStream(filePath);
    const splitter = new ChunkSplitter(server.chunkSize);
    const uploadDestination = createChunkUploadStream(
        client,
        originalName,
        chunksMetadata,
    );

    try {
        if (compressed) {
            const compressor = zlib.createGzip({ level: compressionLevel });
            await pipelinePromise(readStream, compressor, splitter, uploadDestination);
        } else {
            await pipelinePromise(readStream, splitter, uploadDestination);
        }

        const fileId = await saveFileMetadata(
            fileHash,
            chunksMetadata,
            encryptionKeyId,
            originalName,
            stats.size,
            compressed,
        );

        const duration = elapsed();
        logger.debug('Upload duration', { duration, deduplicated: false });
        return fileId;
    } catch (err) {
        const duration = elapsed();
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
    const elapsed = startTimer();

    const { file, registry } = await getFileMetadata(fileId);

    logger.info('Starting file download', {
        fileId,
        fileName: file.name,
        registryId: registry.id,
        chunks: registry.chunks.length,
        size: file.size,
        sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        encryptionKeyId: registry.encryptionKeyId,
    });

    reencryptionScheduler.scheduleIfNeeded(client, registry, fileId);

    res.setHeader(
        'Content-Disposition',
        `attachment; filename="${file.name.replace(/["\\\r\n]/g, '_')}"`,
    );
    res.setHeader('Content-Type', 'application/octet-stream');

    const verificationStream = hasher.createVerificationStream(file.hash, file.name);
    verificationStream.pipe(res);

    const output = registry.compressed
        ? (() => {
              const gunzip = zlib.createGunzip();
              gunzip.on('error', (err) => {
                  logger.error('Decompression failed', toError(err), { fileId, fileName: file.name });
                  if (!res.headersSent) res.status(500).send('Stream decompression error.');
              });
              gunzip.pipe(verificationStream);
              return gunzip;
          })()
        : verificationStream;

    try {
        await downloadAndDecryptChunks(client, registry, output);

        const duration = elapsed();
        logger.success('File download completed', {
            fileId,
            fileName: file.name,
            chunks: registry.chunks.length,
            duration,
        });
    } catch (err) {
        const duration = elapsed();
        logger.error('Download pipeline aborted', toError(err), {
            fileId,
            fileName: file.name,
            duration,
        });
        if (output !== verificationStream) (output as zlib.Gunzip).destroy();
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed during chunk recovery.' });
        }
    }
};
