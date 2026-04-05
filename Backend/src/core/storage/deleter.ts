import { Client } from 'discord.js';
import { TaskPriority } from '../queueManager.js';
import logger from '../../utils/logger.js';
import { getRepository } from '../database.js';
import { DISCORD_ERROR_CODES } from '../../constants/index.js';
import { NotFoundError, toError } from '../../utils/errors/AppError.js';
import { DiscordChunkManager } from '../discord/discordChunkManager.js';

/**
 * Deletes a file from the registry
 * Decrements chunk registry refCount and deletes chunks from Discord if refCount reaches 0
 * @param client - Discord bot client instance
 * @param fileId - Unique identifier of the file to delete
 * @returns The name of the deleted file
 * @throws NotFoundError if file is not found
 */
export const deleteFile = async (client: Client, fileId: string): Promise<string> => {
    const startTime = Date.now();
    const repo = getRepository();
    const file = await repo.getFile(fileId);

    if (!file) {
        logger.warn('File not found for deletion', { fileId });
        throw new NotFoundError('File');
    }

    const registry = await repo.getChunkRegistry(file.chunkRegistryId);
    if (!registry) {
        logger.error('Chunk registry not found for deletion', undefined, {
            fileId,
            chunkRegistryId: file.chunkRegistryId,
        });
        throw new NotFoundError('Chunk registry');
    }

    logger.info('Starting file deletion', {
        fileId,
        fileName: file.name,
        registryId: registry.id,
        currentRefCount: registry.refCount,
    });

    await repo.deleteFile(fileId);
    const newRefCount = await repo.decrementChunkRegistryRefCount(registry.id);

    if (newRefCount === 0) {
        logger.info('Deleting Discord chunks (last reference)', {
            registryId: registry.id,
            chunks: registry.chunks.length,
        });

        const chunkManager = new DiscordChunkManager(client);
        const { deleted, failed } = await chunkManager.deleteChunks(
            registry.chunks,
            TaskPriority.NORMAL,
        );

        logger.info('Discord chunks deletion completed', {
            deletedChunks: deleted,
            failedChunks: failed,
            totalChunks: registry.chunks.length,
        });

        await repo.deleteChunkRegistry(registry.id);
        logger.debug('Chunk registry deleted', { registryId: registry.id });
    } else {
        logger.info('Chunk registry retained (other files reference it)', {
            registryId: registry.id,
            remainingRefs: newRefCount,
        });
    }

    const duration = Date.now() - startTime;
    logger.success('File deletion completed', {
        fileId,
        fileName: file.name,
        chunksDeleted: newRefCount === 0,
        duration,
    });

    return file.name;
};
