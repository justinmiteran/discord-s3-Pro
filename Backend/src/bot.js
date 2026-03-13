const { Client, GatewayIntentBits, Events } = require('discord.js');

const logger = require('./utils/logger');

/**
 * Initialize Discord Client with necessary intents.
 * Guilds: To access channels.
 * GuildMessages: To send/fetch chunks.
 */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// --- CONNECTION EVENTS ---

// Triggered when the bot successfully logs in
client.once(Events.ClientReady, (readyClient) => {
    logger.success(`Discord Bot is online: ${readyClient.user.tag}`);
    logger.info(`Connected to ${readyClient.guilds.cache.size} servers.`);
});

// Error handling for the Discord socket
client.on(Events.Error, (error) => {
    logger.error(`Discord Connection Error: ${error.message}`);
});

// Warning handling (e.g., rate limits approaching)
client.on(Events.Warn, (info) => {
    logger.warn(`Discord Warning: ${info}`);
});

// Handle disconnection
client.on(Events.ShardDisconnect, (event) => {
    logger.warn(`Bot disconnected from Discord. Code: ${event.code}`);
});

module.exports = client;
