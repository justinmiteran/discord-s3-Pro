import fs from 'fs';
import crypto from 'crypto';
import zlib from 'zlib';
import axios from 'axios';
import { Client, TextChannel, AttachmentBuilder } from 'discord.js';
import { Response } from 'express';
import { chunkSize } from '../config.js';
import { encryptBuffer, decryptBuffer } from '../pipeline/encryptStream.js';
import { ChunkSplitter } from '../pipeline/chunker.js';
import queue from './queueManager.js';
import pool from './channelPool.js';
import * as hasher from '../utils/hasher.js';
import { getRepository } from './database.js';
import { FileData, ChunkMetadata } from '../types/index.js';
import logger from '../utils/logger.js';

export const processUpload = async (
    client: Client,
    filePath: string,
    originalName: string,
): Promise<string> => {
    const stats = fs.statSync(filePath);
    const fileHash = await hasher.calculateHash(filePath);
    const chunksMetadata: ChunkMetadata[] = [];

    const splitter = new ChunkSplitter(chunkSize);
    const readStream = fs.createReadStream(filePath).pipe(zlib.createGzip());

    return new Promise((resolve, reject) => {
        readStream
            .pipe(splitter)
            .on('data', async (chunk: Buffer) => {
                splitter.pause();
                try {
                    const currentChunkIndex = splitter.processedChunks; // Get current index from splitter
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

                    // Log the upload success for this specific chunk
                    logger.success(
                        `StorageEngine: Uploaded chunk #${currentChunkIndex} to channel ${channelId} (MsgID: ${result.id})`,
                    );

                    chunksMetadata.push({ mId: result.id, cId: channelId });
                    splitter.resume();
                } catch (err) {
                    reject(err);
                }
            })
            .on('finish', async () => {
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
                logger.success(
                    `StorageEngine: File ${originalName} fully processed and indexed with ID: ${fileId}`,
                );
                resolve(fileId);
            })
            .on('error', reject);
    });
};

export const downloadFile = async (
    client: Client,
    fileId: string,
    res: Response,
): Promise<void> => {
    const file = await getRepository().getFile(fileId);
    if (!file) throw new Error('FILE_NOT_FOUND');

    logger.info(`StorageEngine: Starting download for ${file.name} (${file.chunks.length} chunks)`);

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    const gunzip = zlib.createGunzip();

    // --- CRITICAL: Error Handling for the decompression stream ---
    gunzip.on('error', (err: any) => {
        logger.error(
            `StorageEngine: Decompression failed (Z_BUF_ERROR). The file might be corrupted or incomplete.`,
        );
        if (!res.headersSent) {
            res.status(500).send('Stream decompression error.');
        }
    });

    // Pipeline: Decompression -> Integrity Check -> Express Response
    gunzip.pipe(hasher.createVerificationStream(file.hash, file.name)).pipe(res);

    try {
        let downloadedChunks = 0;

        for (const chunk of file.chunks) {
            downloadedChunks++;

            // Fetch message from Discord
            const msg = await queue.add(async () => {
                const channel = (await client.channels.fetch(chunk.cId)) as TextChannel;
                return await channel.messages.fetch(chunk.mId);
            });

            const attachment = msg.attachments.first();
            if (!attachment) {
                throw new Error(
                    `CHUNK_LOST: Chunk #${downloadedChunks} missing from Discord message.`,
                );
            }

            // Download binary data
            const { data } = await axios.get(attachment.url, { responseType: 'arraybuffer' });

            // Decrypt
            const decrypted = decryptBuffer(Buffer.from(data));

            logger.info(
                `StorageEngine: Recovered chunk #${downloadedChunks}/${file.chunks.length} (${(decrypted.length / 1024 / 1024).toFixed(2)} MB)`,
            );

            // Write to gunzip
            const canContinue = gunzip.write(decrypted);

            // Handle backpressure if necessary
            if (!canContinue) {
                await new Promise((resolve) => gunzip.once('drain', resolve));
            }
        }

        gunzip.end();
        logger.success(`StorageEngine: All chunks processed for ${file.name}`);
    } catch (err: any) {
        logger.error(`StorageEngine: Download pipeline aborted: ${err.message}`);
        gunzip.destroy(); // Stop the gunzip stream if loop fails
        if (!res.headersSent) {
            res.status(500).json({ error: 'Download failed during chunk recovery.' });
        }
    }
};
