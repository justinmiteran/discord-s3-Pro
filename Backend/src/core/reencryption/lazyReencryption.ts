import { Client, TextChannel } from 'discord.js';
import axios from 'axios';
import { getRepository } from '../database.js';
import { keyRotationManager } from '../keyRotation.js';
import { encryptBuffer, decryptBuffer } from '../../pipeline/encryptStream.js';
import queue, { TaskPriority } from '../queueManager.js';
import pool from '../discord/channelPool.js';
import logger from '../../utils/logger.js';
import { ChunkRegistry, ChunkMetadata } from '../../types/models/file.model.js';
import { AttachmentBuilder } from 'discord.js';
import crypto from 'crypto';

/**
 * Lazy re-encryption service
 * Re-encrypts chunks with the active key when accessed
 * Handles deduplication correctly by creating new ChunkRegistry
 */
export class LazyReencryptionService {
    /**
     * Checks if a ChunkRegistry needs re-encryption
     */
    needsReencryption(registry: ChunkRegistry): boolean {
        if (!registry.encryptionKeyId) {
            return true;
        }

        const activeKey = keyRotationManager.getActiveKey();
        return registry.encryptionKeyId !== activeKey.id;
    }

    /**
     * Re-encrypts a ChunkRegistry with the active key
     * Modifies the registry IN PLACE (all files referencing it are updated)
     * 
     * Strategy:
     * 1. Download and decrypt all chunks with old key
     * 2. Re-encrypt with new key
     * 3. Upload new chunks to Discord
     * 4. Atomically update ChunkRegistry (chunks + encryptionKeyId only, preserves refCount)
     * 5. Delete old chunks from Discord
     * 
     * Note: All files referencing this registry will use the new chunks
     */
    async reencryptRegistry(
        client: Client,
        registry: ChunkRegistry,
        fileId: string,
    ): Promise<string> {
        const startTime = Date.now();
        const activeKey = keyRotationManager.getActiveKey();

        logger.info('Starting lazy re-encryption', {
            registryId: registry.id,
            oldKeyId: registry.encryptionKeyId || 'unknown',
            newKeyId: activeKey.id,
            chunks: registry.chunks.length,
            refCount: registry.refCount,
            fileId,
        });

        const oldChunks = [...registry.chunks];

        try {
            // Step 1: Download and decrypt all chunks
            logger.info('Downloading and decrypting chunks', {
                registryId: registry.id,
                totalChunks: registry.chunks.length,
            });

            const decryptPromises = registry.chunks.map(async (chunk, index) => {
                const msg = await queue.add(async () => {
                    const channel = (await client.channels.fetch(chunk.cId)) as TextChannel;
                    return await channel.messages.fetch(chunk.mId);
                }, TaskPriority.LOW);

                const attachment = msg.attachments.first();
                if (!attachment) {
                    throw new Error(`Chunk ${index + 1} missing from Discord`);
                }

                const { data } = await axios.get(attachment.url, { responseType: 'arraybuffer' });
                const { decrypted } = decryptBuffer(Buffer.from(data), registry.encryptionKeyId);

                return decrypted;
            });

            const decryptedChunks = await Promise.all(decryptPromises);

            logger.info('All chunks decrypted, starting re-encryption', {
                registryId: registry.id,
                totalChunks: decryptedChunks.length,
            });

            // Step 2: Re-encrypt and upload all chunks
            const uploadPromises = decryptedChunks.map(async (decryptedChunk, index) => {
                const { encrypted } = encryptBuffer(decryptedChunk);

                const channelId = pool.next();
                const result = await queue.add(async () => {
                    const channel = (await client.channels.fetch(channelId)) as TextChannel;
                    const attachment = new AttachmentBuilder(encrypted, {
                        name: `chunk_reenc_${index + 1}.dat`,
                    });
                    return await channel.send({ files: [attachment] });
                }, TaskPriority.LOW);

                return { mId: result.id, cId: channelId };
            });

            const newChunksMetadata = await Promise.all(uploadPromises);

            logger.info('All chunks re-encrypted and uploaded', {
                registryId: registry.id,
                totalChunks: newChunksMetadata.length,
            });

            // Step 3: Update registry with new chunks and encryption key (preserves refCount atomically)
            const repo = getRepository();
            await repo.updateChunkRegistryData(registry.id, newChunksMetadata, activeKey.id);

            logger.info('Registry updated successfully, deleting old chunks from Discord', {
                registryId: registry.id,
                oldChunksCount: oldChunks.length,
            });

            // Step 4: Delete old chunks from Discord
            const deletePromises = oldChunks.map(async (chunk) => {
                try {
                    await queue.add(async () => {
                        const channel = (await client.channels.fetch(chunk.cId)) as TextChannel;
                        await channel.messages.delete(chunk.mId);
                    }, TaskPriority.LOW);
                    return { success: true, chunk };
                } catch (err: any) {
                    return { success: false, chunk, error: err.message };
                }
            });

            const deleteResults = await Promise.all(deletePromises);
            const deletedCount = deleteResults.filter(r => r.success).length;
            const failedCount = deleteResults.filter(r => !r.success).length;

            deleteResults.forEach(result => {
                if (!result.success) {
                    logger.warn('Failed to delete old chunk', {
                        messageId: result.chunk.mId,
                        channelId: result.chunk.cId,
                        error: result.error,
                    });
                }
            });

            const duration = Date.now() - startTime;
            logger.success('Lazy re-encryption completed', {
                registryId: registry.id,
                chunks: newChunksMetadata.length,
                refCount: registry.refCount,
                oldChunksDeleted: deletedCount,
                oldChunksFailed: failedCount,
                duration,
                durationFormatted: `${(duration / 1000).toFixed(1)}s`,
                fileId,
            });

            return registry.id;
        } catch (err: any) {
            const duration = Date.now() - startTime;
            logger.error('Lazy re-encryption failed', err, {
                registryId: registry.id,
                fileId,
                duration,
            });
            throw err;
        }
    }
}

export const lazyReencryptionService = new LazyReencryptionService();
