const fs = require('fs');

const queue = require('./queueManager');
const { dbPath } = require('../config');
const logger = require('../utils/logger');

/**
 * Service to handle complete file deletion from Discord and Registry.
 */
exports.deleteFile = async (client, fileId) => {
    if (!fs.existsSync(dbPath)) throw new Error('REGISTRY_NOT_FOUND');

    const registry = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const file = registry[fileId];

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
    delete registry[fileId];
    fs.writeFileSync(dbPath, JSON.stringify(registry, null, 4));

    return file.name;
};
