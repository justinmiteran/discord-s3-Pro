const fs = require('fs');
const path = require('path');
const ini = require('ini');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const cfgPath = path.join(__dirname, '../config.cfg');
if (!fs.existsSync(cfgPath)) {
    throw new Error(`CRITICAL: Configuration file missing at ${cfgPath}`);
}

const userConfig = ini.parse(fs.readFileSync(cfgPath, 'utf-8'));

// Validation Helper
const required = (value, name) => {
    if (value === undefined || value === null || value === '') {
        throw new Error(`CONFIG ERROR: Missing mandatory key "${name}" in config.cfg or .env`);
    }
    return value;
};

module.exports = {
    // Secrets from .env (Strict)
    token: required(process.env.DISCORD_TOKEN, 'DISCORD_TOKEN'),
    encryptionKey: Buffer.alloc(32, required(process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY')),

    // Server Settings
    port: parseInt(required(userConfig.Server?.port, 'Server.port')),
    chunkSize: parseInt(required(userConfig.Server?.chunk_size, 'Server.chunk_size')),

    // Database Settings
    dbType: required(userConfig.Database?.db_type, 'Database.db_type'),
    mongoUri:
        userConfig.Database?.db_type === 'mongodb'
            ? required(userConfig.Database?.mongo_uri, 'Database.mongo_uri')
            : null,
    dbPath:
        userConfig.Database?.db_type === 'json'
            ? path.resolve(
                  __dirname,
                  '..',
                  required(userConfig.Database?.db_path, 'Database.db_path'),
              )
            : null,

    // Discord Settings
    channels: required(userConfig.Discord?.storage_channels, 'Discord.storage_channels').split(','),
};
