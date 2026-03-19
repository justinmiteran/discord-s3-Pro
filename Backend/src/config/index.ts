import fs from 'fs';
import path from 'path';
import ini from 'ini';
import logger from '../utils/logger.js';

const ROOT_DIR = process.cwd();

logger.debug('Environment variables loaded', { rootDir: ROOT_DIR });

const cfgPath = path.join(ROOT_DIR, 'config.cfg');
if (!fs.existsSync(cfgPath)) {
    logger.fatal('Configuration file missing', undefined, { path: cfgPath });
    throw new Error(`CRITICAL: Configuration file missing at ${cfgPath}`);
}

logger.debug('Loading configuration file', { path: cfgPath });
const userConfig = ini.parse(fs.readFileSync(cfgPath, 'utf-8'));

/**
 * Validates that a required configuration value exists
 * @param value - The configuration value to check
 * @param name - The name of the configuration key
 * @returns The validated value
 * @throws Error if value is missing or empty
 */
const required = <T>(value: T | undefined | null, name: string): T => {
    if (value === undefined || value === null || value === '') {
        logger.fatal('Missing required configuration', undefined, { key: name });
        throw new Error(`CONFIG ERROR: Missing mandatory key "${name}" in config.cfg or .env`);
    }
    return value;
};

/**
 * Discord configuration
 */
export const discord = {
    token: required(process.env.DISCORD_TOKEN, 'DISCORD_TOKEN'),
    channels: (() => {
        const rawChannels = userConfig.Discord?.storage_channels;
        const channelList =
            typeof rawChannels === 'string'
                ? rawChannels.split(',').map((id) => id.trim())
                : Array.isArray(rawChannels)
                  ? rawChannels
                  : [];

        if (channelList.length === 0) {
            logger.fatal('No Discord channels configured', undefined, {
                section: 'Discord',
                key: 'storage_channels'
            });
            throw new Error('CRITICAL: No Discord storage channels configured in config.cfg');
        } else {
            logger.debug('Discord channels loaded', { count: channelList.length });
        }
        return channelList;
    })(),
};

/**
 * Server configuration
 */
export const server = {
    port: parseInt(required(userConfig.Server?.port, 'Server.port')),
    chunkSize: parseInt(required(userConfig.Server?.chunk_size, 'Server.chunk_size')),
};

logger.debug('Server configuration loaded', {
    port: server.port,
    chunkSize: server.chunkSize
});

/**
 * Database configuration
 */
export const database = {
    type: required(userConfig.Database?.db_type, 'Database.db_type'),
    mongoUri:
        userConfig.Database?.db_type === 'mongodb'
            ? required(userConfig.Database?.mongo_uri, 'Database.mongo_uri')
            : null,
    jsonPath:
        userConfig.Database?.db_type === 'json'
            ? path.resolve(ROOT_DIR, userConfig.Database?.db_path || 'data/registry.json')
            : '',
};

logger.debug('Database configuration loaded', {
    type: database.type,
    hasMongoUri: !!database.mongoUri,
    jsonPath: database.jsonPath
});

/**
 * Security configuration
 */
export const security = {
    encryptionKey: Buffer.alloc(32, required(process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY')),
};

logger.debug('Security configuration loaded', {
    encryptionKeyLength: security.encryptionKey.length
});

logger.success('Configuration loaded successfully');

/**
 * Legacy exports for backward compatibility
 */
export const token = discord.token;
export const encryptionKey = security.encryptionKey;
export const port = server.port;
export const chunkSize = server.chunkSize;
export const dbType = database.type;
export const mongoUri = database.mongoUri;
export const dbPath = database.jsonPath;
export const channels = discord.channels;
