import { Client, GatewayIntentBits, Events } from 'discord.js';
import logger from './utils/logger.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once(Events.ClientReady, (readyClient) => {
    logger.success(`Discord Bot is online: ${readyClient.user.tag}`);
    logger.info(`Connected to ${readyClient.guilds.cache.size} servers.`);
});

client.on(Events.Error, (error: Error) => {
    logger.error(`Discord Connection Error: ${error.message}`);
});

export default client;
