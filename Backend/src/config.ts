import fs from 'fs';
import path from 'path';
import ini from 'ini';
import dotenv from 'dotenv';
import logger from './utils/logger.js';

const ROOT_DIR = process.cwd();

// Load .env
dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const cfgPath = path.join(ROOT_DIR, 'config.cfg');
if (!fs.existsSync(cfgPath)) {
    throw new Error(`CRITICAL: Configuration file missing at ${cfgPath}`);
}

const userConfig = ini.parse(fs.readFileSync(cfgPath, 'utf-8'));

const required = <T>(value: T | undefined | null, name: string): T => {
    if (value === undefined || value === null || value === '') {
        throw new Error(`CONFIG ERROR: Missing mandatory key "${name}" in config.cfg or .env`);
    }
    return value;
};

export const token = required(process.env.DISCORD_TOKEN, 'DISCORD_TOKEN');
export const encryptionKey = Buffer.alloc(
    32,
    required(process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY'),
);

export const port = parseInt(required(userConfig.Server?.port, 'Server.port'));
export const chunkSize = parseInt(required(userConfig.Server?.chunk_size, 'Server.chunk_size'));

export const dbType = required(userConfig.Database?.db_type, 'Database.db_type');
export const mongoUri =
    dbType === 'mongodb' ? required(userConfig.Database?.mongo_uri, 'Database.mongo_uri') : null;
export const dbPath =
    dbType === 'json'
        ? path.resolve(ROOT_DIR, userConfig.Database?.db_path || 'data/registry.json')
        : '';

const rawChannels = userConfig.Discord?.storage_channels;
export const channels: string[] =
    typeof rawChannels === 'string'
        ? rawChannels.split(',').map((id) => id.trim())
        : Array.isArray(rawChannels)
          ? rawChannels
          : [];

if (channels.length === 0) {
    logger.error('CONFIG ERROR: No Discord channels found under [Discord] storage_channels');
}
