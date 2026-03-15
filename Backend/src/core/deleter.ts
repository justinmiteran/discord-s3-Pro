import { Client, TextChannel } from 'discord.js';
import queue from './queueManager.js';
import logger from '../utils/logger.js';
import { getRepository } from './database.js';

/**
 * Service to handle complete file deletion from Discord and Registry.
 */
export const deleteFile = async (client: Client, fileId: string): Promise<string> => {
    const repo = getRepository();
    const file = await repo.getFile(fileId);

    if (!file) throw new Error('FILE_NOT_FOUND');

    logger.info(`Deleter: Processing cleanup for ${file.name} (${file.chunks.length} chunks)`);

    // Discord Cleanup logic
    for (const chunk of file.chunks) {
        await queue.add(async () => {
            try {
                const channel = (await client.channels.fetch(chunk.cId)) as TextChannel;
                if (!channel) return;

                const msg = await channel.messages.fetch(chunk.mId);
                await msg.delete();
            } catch (err: any) {
                // Ignore if message already deleted (Code 10008)
                if (err.code !== 10008) {
                    logger.warn(`Non-critical error during chunk deletion: ${err.message}`);
                }
            }
        });
    }

    // Registry Cleanup
    await repo.deleteFile(fileId);

    return file.name;
};
