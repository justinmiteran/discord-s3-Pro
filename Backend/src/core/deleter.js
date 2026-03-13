const queue = require('./queueManager');
const logger = require('../utils/logger');
const { getRepository } = require('./database');

/**
 * Service to handle complete file deletion from Discord and Registry.
 */
exports.deleteFile = async (client, fileId) => {
    const repo = getRepository();

    const file = await repo.getFile(fileId);

    if (!file) throw new Error('FILE_NOT_FOUND');

    logger.info(`Deleter: Processing ${file.name} (${file.chunks.length} chunks)`);

    // Discord Cleanup logic
    for (const chunk of file.chunks) {
        await queue.add(async () => {
            try {
                const channel = await client.channels.fetch(chunk.cId);
                const msg = await channel.messages.fetch(chunk.mId);
                await msg.delete();
            } catch (err) {
                if (err.code !== 10008) {
                    logger.warn(`Non-critical error during chunk deletion: ${err.message}`);
                }
            }
        });
    }

    // Registry Cleanup
    if (repo.deleteFile) {
        await repo.deleteFile(fileId);
    } else {
        logger.error(`Repository ${repo.name} does not implement deleteFile!`);
    }

    return file.name;
};
