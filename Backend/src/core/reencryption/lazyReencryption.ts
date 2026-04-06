import { Client } from 'discord.js';
import { getRepository } from '../database.js';
import { encryptionService } from '../crypto/index.js';
import { TaskPriority } from '../queueManager.js';
import logger, { startTimer } from '../../utils/logger.js';
import { ChunkRegistry } from '../../types/models/file.model.js';
import { DiscordChunkManager } from '../discord/discordChunkManager.js';

/**
 * Lazy re-encryption service
 * Re-encrypts chunks with the active key when accessed
 * Handles deduplication correctly by modifying ChunkRegistry in place
 */
export class LazyReencryptionService {
    private chunkManager: DiscordChunkManager | null = null;

    /**
     * Initializes the chunk manager with Discord client
     * @param client - Discord bot client
     */
    initialize(client: Client): void {
        this.chunkManager = new DiscordChunkManager(client);
    }
    /**
     * Checks if a ChunkRegistry needs re-encryption
     * Delegates to EncryptionService for centralized key logic
     */
    needsReencryption(registry: ChunkRegistry): boolean {
        return encryptionService.needsReencryption(registry.encryptionKeyId);
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
        context: string,
    ): Promise<string> {
        if (!this.chunkManager) {
            this.initialize(client);
        }

        const elapsed = startTimer();
        const activeKeyId = encryptionService.getActiveKeyId();

        logger.info('Starting lazy re-encryption', {
            registryId: registry.id,
            oldKeyId: registry.encryptionKeyId || 'unknown',
            newKeyId: activeKeyId,
            chunks: registry.chunks.length,
            refCount: registry.refCount,
            context,
        });

        const oldChunks = [...registry.chunks];

        try {
            // Step 1: Download and decrypt all chunks
            logger.info('Downloading and decrypting chunks', {
                registryId: registry.id,
                totalChunks: registry.chunks.length,
            });

            const decryptedChunks = await this.chunkManager!.downloadChunks(
                registry.chunks,
                registry.encryptionKeyId,
                TaskPriority.LOW,
            );

            logger.info('All chunks decrypted, starting re-encryption', {
                registryId: registry.id,
                totalChunks: decryptedChunks.length,
            });

            // Step 2: Re-encrypt and upload all chunks
            const newChunksMetadata = await this.chunkManager!.uploadChunks(
                decryptedChunks,
                TaskPriority.LOW,
                'chunk_reenc',
            );

            logger.info('All chunks re-encrypted and uploaded', {
                registryId: registry.id,
                totalChunks: newChunksMetadata.length,
            });

            // Step 3: Update registry with new chunks and encryption key (preserves refCount atomically)
            const repo = getRepository();
            await repo.updateChunkRegistryData(registry.id, newChunksMetadata, activeKeyId);

            logger.info('Registry updated successfully, deleting old chunks from Discord', {
                registryId: registry.id,
                oldChunksCount: oldChunks.length,
            });

            // Step 4: Delete old chunks from Discord
            const { deleted, failed } = await this.chunkManager!.deleteChunks(
                oldChunks,
                TaskPriority.LOW,
            );

            const duration = elapsed();
            logger.success('Lazy re-encryption completed', {
                registryId: registry.id,
                chunks: newChunksMetadata.length,
                refCount: registry.refCount,
                oldChunksDeleted: deleted,
                oldChunksFailed: failed,
                duration,
                durationFormatted: `${(duration / 1000).toFixed(1)}s`,
                context,
            });

            return registry.id;
        } catch (err: any) {
            const duration = elapsed();
            logger.error('Lazy re-encryption failed', err, {
                registryId: registry.id,
                context,
                duration,
            });
            throw err;
        }
    }
}

export const lazyReencryptionService = new LazyReencryptionService();
