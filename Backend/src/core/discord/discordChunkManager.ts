import { Client, TextChannel, AttachmentBuilder } from 'discord.js';
import axios from 'axios';
import { encryptionService } from '../crypto/index.js';
import queue, { TaskPriority } from '../queueManager.js';
import pool from './channelPool.js';
import logger from '../../utils/logger.js';
import { ChunkMetadata } from '../../types/models/file.model.js';
import { DiscordError, toError } from '../../utils/errors/AppError.js';
import { ERROR_CODES } from '../../constants/index.js';

/**
 * Centralized manager for all Discord chunk operations
 * Handles upload, download, and deletion of encrypted chunks
 */
export class DiscordChunkManager {
    private client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    /**
     * Uploads a plaintext chunk to Discord (encryption handled internally)
     * @param buffer - Plaintext buffer to encrypt and upload
     * @param chunkIndex - Index of the chunk for logging
     * @param priority - Queue priority (HIGH for user ops, LOW for background)
     * @param namePrefix - Prefix for the attachment filename
     * @returns ChunkMetadata with message ID and channel ID
     */
    async uploadChunk(
        buffer: Buffer,
        chunkIndex: number,
        priority: TaskPriority = TaskPriority.HIGH,
        namePrefix: string = 'chunk',
    ): Promise<ChunkMetadata> {
        const { encrypted, keyId } = encryptionService.encryptWithActiveKey(buffer);
        const channelId = pool.next();

        const result = await queue.add(async () => {
            const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
            const attachment = new AttachmentBuilder(encrypted, {
                name: `${namePrefix}_${chunkIndex}.dat`,
            });
            return await channel.send({ files: [attachment] });
        }, priority);

        logger.debug('Chunk uploaded', {
            chunkIndex,
            channelId,
            messageId: result.id,
            size: `${(encrypted.length / 1024).toFixed(2)} KB`,
            priority: TaskPriority[priority],
            keyId,
        });

        return { mId: result.id, cId: channelId };
    }

    /**
     * Downloads and decrypts a chunk from Discord
     * @param chunk - ChunkMetadata with message ID and channel ID
     * @param encryptionKeyId - Optional key ID hint for decryption
     * @param priority - Queue priority (HIGH for user ops, LOW for background)
     * @param chunkIndex - Index of the chunk for error messages
     * @returns Decrypted buffer
     * @throws DiscordError if chunk is missing from Discord
     */
    async downloadChunk(
        chunk: ChunkMetadata,
        encryptionKeyId: string | undefined,
        priority: TaskPriority = TaskPriority.HIGH,
        chunkIndex?: number,
    ): Promise<Buffer> {
        const msg = await queue.add(async () => {
            const channel = (await this.client.channels.fetch(chunk.cId)) as TextChannel;
            return await channel.messages.fetch(chunk.mId);
        }, priority);

        const attachment = msg.attachments.first();
        if (!attachment) {
            const errorMsg = chunkIndex
                ? `Chunk #${chunkIndex} missing from Discord message`
                : `Chunk missing from Discord message`;

            logger.error('Chunk missing from Discord', undefined, {
                chunkIndex,
                messageId: chunk.mId,
                channelId: chunk.cId,
            });

            throw new DiscordError(`${ERROR_CODES.CHUNK_LOST}: ${errorMsg}`);
        }

        const { data } = await axios.get(attachment.url, { responseType: 'arraybuffer' });
        const { decrypted } = encryptionService.decrypt(Buffer.from(data), encryptionKeyId);

        logger.debug('Chunk downloaded', {
            chunkIndex,
            messageId: chunk.mId,
            channelId: chunk.cId,
            size: `${(decrypted.length / 1024 / 1024).toFixed(2)} MB`,
            priority: TaskPriority[priority],
        });

        return decrypted;
    }

    /**
     * Deletes a chunk from Discord
     * @param chunk - ChunkMetadata with message ID and channel ID
     * @param priority - Queue priority (NORMAL for user delete, LOW for cleanup)
     * @returns Success status and error message if failed
     */
    async deleteChunk(
        chunk: ChunkMetadata,
        priority: TaskPriority = TaskPriority.NORMAL,
    ): Promise<{ success: boolean; error?: string }> {
        try {
            await queue.add(async () => {
                const channel = (await this.client.channels.fetch(chunk.cId)) as TextChannel;
                await channel.messages.delete(chunk.mId);
            }, priority);

            logger.debug('Chunk deleted', {
                messageId: chunk.mId,
                channelId: chunk.cId,
                priority: TaskPriority[priority],
            });

            return { success: true };
        } catch (err: any) {
            logger.warn('Failed to delete chunk', {
                messageId: chunk.mId,
                channelId: chunk.cId,
                error: toError(err).message,
            });

            return { success: false, error: toError(err).message };
        }
    }

    /**
     * Deletes multiple chunks from Discord in parallel
     * @param chunks - Array of ChunkMetadata to delete
     * @param priority - Queue priority (NORMAL for user delete, LOW for cleanup)
     * @returns Summary of deletion results
     */
    async deleteChunks(
        chunks: ChunkMetadata[],
        priority: TaskPriority = TaskPriority.NORMAL,
    ): Promise<{ deleted: number; failed: number }> {
        const deletePromises = chunks.map((chunk) => this.deleteChunk(chunk, priority));
        const results = await Promise.all(deletePromises);

        const deleted = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        logger.info('Bulk chunk deletion completed', {
            total: chunks.length,
            deleted,
            failed,
            priority: TaskPriority[priority],
        });

        return { deleted, failed };
    }

    /**
     * Downloads multiple chunks from Discord in parallel
     * @param chunks - Array of ChunkMetadata to download
     * @param encryptionKeyId - Optional key ID hint for decryption
     * @param priority - Queue priority (HIGH for user ops, LOW for background)
     * @returns Array of decrypted buffers in order
     */
    async downloadChunks(
        chunks: ChunkMetadata[],
        encryptionKeyId: string | undefined,
        priority: TaskPriority = TaskPriority.HIGH,
    ): Promise<Buffer[]> {
        const downloadPromises = chunks.map((chunk, index) =>
            this.downloadChunk(chunk, encryptionKeyId, priority, index + 1),
        );

        return await Promise.all(downloadPromises);
    }

    /**
     * Uploads multiple chunks to Discord in parallel
     * @param buffers - Array of decrypted buffers to upload
     * @param priority - Queue priority (HIGH for user ops, LOW for background)
     * @param namePrefix - Prefix for the attachment filenames
     * @returns Array of ChunkMetadata in order
     */
    async uploadChunks(
        buffers: Buffer[],
        priority: TaskPriority = TaskPriority.HIGH,
        namePrefix: string = 'chunk',
    ): Promise<ChunkMetadata[]> {
        const uploadPromises = buffers.map((buffer, index) =>
            this.uploadChunk(buffer, index + 1, priority, namePrefix),
        );

        return await Promise.all(uploadPromises);
    }
}
