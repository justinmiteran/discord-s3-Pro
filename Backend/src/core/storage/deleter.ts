import { Client, TextChannel } from 'discord.js';
import queue from '../queueManager.js';
import logger from '../../utils/logger.js';
import { getRepository } from '../database.js';
import { DISCORD_ERROR_CODES } from '../../constants/index.js';
import { NotFoundError } from '../../utils/errors/AppError.js';

/**
 * Deletes a file completely from Discord and the registry
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

    logger.info('Starting file deletion', {
        fileId,
        fileName: file.name,
        chunks: file.chunks.length
    });

    let deletedChunks = 0;
    let failedChunks = 0;

    for (const chunk of file.chunks) {
        await queue.add(async () => {
            try {
                const channel = (await client.channels.fetch(chunk.cId)) as TextChannel;
                if (!channel) {
                    logger.warn('Channel not found for chunk deletion', {
                        channelId: chunk.cId,
                        messageId: chunk.mId
                    });
                    failedChunks++;
                    return;
                }

                const msg = await channel.messages.fetch(chunk.mId);
                await msg.delete();
                deletedChunks++;
                
                logger.debug('Chunk deleted', {
                    messageId: chunk.mId,
                    channelId: chunk.cId,
                    progress: `${deletedChunks}/${file.chunks.length}`
                });
            } catch (err: any) {
                if (err.code === DISCORD_ERROR_CODES.MESSAGE_NOT_FOUND) {
                    logger.debug('Chunk already deleted', {
                        messageId: chunk.mId
                    });
                    deletedChunks++;
                } else {
                    logger.warn('Chunk deletion failed', {
                        messageId: chunk.mId,
                        error: err.message
                    });
                    failedChunks++;
                }
            }
        });
    }

    await repo.deleteFile(fileId);
    
    const duration = Date.now() - startTime;
    logger.success('File deletion completed', {
        fileId,
        fileName: file.name,
        deletedChunks,
        failedChunks,
        totalChunks: file.chunks.length,
        duration
    });

    return file.name;
};
