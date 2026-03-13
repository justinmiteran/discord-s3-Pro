require('dotenv').config();
module.exports = {
    token: process.env.DISCORD_TOKEN,
    channels: process.env.STORAGE_CHANNELS ? process.env.STORAGE_CHANNELS.split(',') : [],
    encryptionKey: Buffer.alloc(32, process.env.ENCRYPTION_KEY), // Force 32 bytes pour AES-256
    chunkSize: 7.5 * 1024 * 1024, // 7.5MB
    port: process.env.PORT || 3000,
    dbPath: './data/registry.json'
};