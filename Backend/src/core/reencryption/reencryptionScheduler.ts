import { Client } from 'discord.js';
import { ChunkRegistry } from '../../types/models/file.model.js';
import { lazyReencryptionService } from './lazyReencryption.js';
import logger from '../../utils/logger.js';
import { toError } from '../../utils/errors/AppError.js';

/**
 * Centralized scheduler for background re-encryption
 * Handles triggering re-encryption without blocking user operations
 */
export class ReencryptionScheduler {
    /**
     * Checks if re-encryption is needed and triggers it in background
     * @param client - Discord bot client
     * @param registry - ChunkRegistry to check and potentially re-encrypt
     * @param context - Context identifier for logging (fileId or 'dedup-upload')
     * @returns True if re-encryption was scheduled, false otherwise
     */
    scheduleIfNeeded(client: Client, registry: ChunkRegistry, context: string): boolean {
        if (!lazyReencryptionService.needsReencryption(registry)) {
            return false;
        }

        logger.info('Registry needs re-encryption, scheduling background re-encryption', {
            registryId: registry.id,
            oldKeyId: registry.encryptionKeyId || 'unknown',
            context,
            refCount: registry.refCount,
        });

        // Trigger re-encryption in background without blocking
        lazyReencryptionService
            .reencryptRegistry(client, registry, context)
            .then((registryId) => {
                logger.success('Background re-encryption completed', {
                    registryId,
                    context,
                });
            })
            .catch((err) => {
                logger.warn('Background re-encryption failed', {
                    error: toError(err),
                    registryId: registry.id,
                    context,
                });
            });

        return true;
    }
}

export const reencryptionScheduler = new ReencryptionScheduler();
