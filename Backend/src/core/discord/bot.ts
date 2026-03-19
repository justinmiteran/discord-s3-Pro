import { Client, GatewayIntentBits, Events } from 'discord.js';
import logger from '../../utils/logger.js';

/**
 * Discord bot client instance
 * Configured with necessary intents for guild and message operations
 */
logger.debug('Initializing Discord client', {
    intents: ['Guilds', 'GuildMessages', 'MessageContent']
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once(Events.ClientReady, (readyClient) => {
    logger.success('Discord Bot connected', {
        username: readyClient.user.tag,
        id: readyClient.user.id,
        guilds: readyClient.guilds.cache.size,
        uptime: 0
    });
});

client.on(Events.Error, (error: Error) => {
    logger.error('Discord connection error', error, {
        errorType: 'ConnectionError'
    });
});

client.on(Events.Warn, (warning: string) => {
    logger.warn('Discord warning', { warning });
});

export default client;
