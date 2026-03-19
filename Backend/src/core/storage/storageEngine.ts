import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import axios from 'axios';
import { Client, TextChannel, AttachmentBuilder } from 'discord.js';
import { Response } from 'express';
import { server } from '../../config/index.js';
import { encryptBuffer, decryptBuffer } from '../../pipeline/encryptStream.js';
import { ChunkSplitter } from '../../pipeline/chunker.js';
import queue from '../queueManager.js';
import pool from '../discord/channelPool.js';
import * as hasher from '../../utils/hasher.js';
import { getRepository } from '../database.js';
import { FileData, ChunkMetadata } from '../../types/models/file.model.js';
import logger from '../../utils/logger.js';
import { pipeline, Writable } from 'stream';
import { promisify } from 'util';
import { ERROR_CODES } from '../../constants/index.js';
import { NotFoundError, DiscordError } from '../../utils/errors/AppError.js';

const pipelinePromise = promisify(pipeline);

/**
 * Processes file upload: compression, encryption, chunking, and storage to Discord
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
    
    logger.info('Starting file upload', {
        fileName: originalName,
        size: stats.size,
        sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
    });
    
    const fileHash = await hasher.calculateHash(filePath);
    logger.debug('File hash calculated', { hash: fileHash });
    
    const chunksMetadata: ChunkMetadata[] = [];

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

                const encrypted = encryptBuffer(chunk);
                const channelId = pool.next();

                const result = await queue.add(async () => {
                    const channel = (await client.channels.fetch(channelId)) as TextChannel;
                    const attachment = new AttachmentBuilder(encrypted, {
                        name: `chunk_${currentChunkIndex}.dat`,
                    });
                    return await channel.send({
                        content: `**File:** ${originalName} | **Part:** ${currentChunkIndex}`,
                        files: [attachment],
                    });
                });

                logger.debug('Chunk uploaded', {
                    chunkIndex: currentChunkIndex,
                    channelId,
                    messageId: result.id,
                    size: `${(encrypted.length / 1024).toFixed(2)} KB`
                });

                chunksMetadata.push({ mId: result.id, cId: channelId });
                callback();
            } catch (err: any) {
                logger.error('Chunk upload failed', err, {
                    chunkIndex: chunkSequence,
                    fileName: originalName
                });
                callback(new DiscordError(err.message));
            }
        },
    });

    try {
        await pipelinePromise(readStream, compressor, splitter, uploadDestination);

        const fileId = crypto.randomBytes(4).toString('hex');
        const fileData: FileData = {
            id: fileId,
            name: originalName,
            hash: fileHash,
            chunks: chunksMetadata,
            size: stats.size,
            compressed: true,
            uploadedAt: new Date().toISOString(),
        };

        await getRepository().saveFile(fileData);
        
        const duration = Date.now() - startTime;
        logger.success('File upload completed', {
            fileId,
            fileName: originalName,
            chunks: chunksMetadata.length,
            size: stats.size,
            duration,
            hash: fileHash
        });

        return fileId;
    } catch (err: any) {
        const duration = Date.now() - startTime;
        logger.error('Upload pipeline failed', err, {
            fileName: originalName,
            duration,
            chunksUploaded: chunksMetadata.length
        });
        throw err;
    }
};

/**
 * Downloads and reconstructs a file from Discord chunks
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

    logger.info('Starting file download', {
        fileId,
        fileName: file.name,
        chunks: file.chunks.length,
        size: file.size,
        sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`
    });

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const gunzip = zlib.createGunzip();

    gunzip.on('error', (err: any) => {
        logger.error('Decompression failed', err, {
            fileId,
            fileName: file.name
        });
        if (!res.headersSent) {
            res.status(500).send('Stream decompression error.');
        }
    });

    gunzip.pipe(hasher.createVerificationStream(file.hash, file.name)).pipe(res);

    try {
        let downloadedChunks = 0;
        let totalBytes = 0;

        for (const chunk of file.chunks) {
            downloadedChunks++;

            const msg = await queue.add(async () => {
                const channel = (await client.channels.fetch(chunk.cId)) as TextChannel;
                return await channel.messages.fetch(chunk.mId);
            });

            const attachment = msg.attachments.first();
            if (!attachment) {
                logger.error('Chunk missing from Discord', undefined, {
                    fileId,
                    fileName: file.name,
                    chunkIndex: downloadedChunks,
                    messageId: chunk.mId,
                    channelId: chunk.cId
                });
                throw new DiscordError(
                    `${ERROR_CODES.CHUNK_LOST}: Chunk #${downloadedChunks} missing from Discord message.`,
                );
            }

            const { data } = await axios.get(attachment.url, { responseType: 'arraybuffer' });
            const decrypted = decryptBuffer(Buffer.from(data));
            totalBytes += decrypted.length;

            logger.debug('Chunk recovered', {
                chunkIndex: downloadedChunks,
                totalChunks: file.chunks.length,
                chunkSize: `${(decrypted.length / 1024 / 1024).toFixed(2)} MB`,
                progress: `${((downloadedChunks / file.chunks.length) * 100).toFixed(1)}%`
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
            throughput: `${((totalBytes / 1024 / 1024) / (duration / 1000)).toFixed(2)} MB/s`
        });
    } catch (err: any) {
        const duration = Date.now() - startTime;
        logger.error('Download pipeline aborted', err, {
            fileId,
            fileName: file.name,
            duration
        });
        gunzip.destroy();
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed during chunk recovery.' });
        }
    }
};
