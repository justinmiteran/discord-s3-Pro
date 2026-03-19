// CRITICAL: Load .env FIRST before any other imports
import './env.js';
import client from './core/discord/bot.js';
import { server, discord } from './config/index.js';
import { initDatabase } from './core/database.js';
import logger from './utils/logger.js';
import { createServer } from './server.js';

/**
 * Initializes and starts the Discord S3 Pro system
 * - Connects to the database
 * - Authenticates Discord bot
 * - Starts the Express API server
 */
const startSystem = async (): Promise<void> => {
    const startTime = Date.now();
    
    try {
        logger.info('Discord S3 Pro - Starting System');

        await initDatabase();
        
        logger.info('Authenticating Discord bot...');
        await client.login(discord.token);

        logger.info('Starting HTTP server...');
        const app = createServer(client);
        app.listen(server.port, () => {
            const duration = Date.now() - startTime;
            logger.success('System Ready', {
                port: server.port,
                startupTime: duration,
                environment: process.env.NODE_ENV || 'development'
            });
        });
    } catch (err: any) {
        const duration = Date.now() - startTime;
        logger.fatal('System startup failed', err, {
            duration,
            error: err.message
        });
        process.exit(1);
    }
};

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
    logger.fatal('Uncaught exception', err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
    logger.fatal('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)));
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.warn('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.warn('SIGINT received, shutting down gracefully');
    process.exit(0);
});

startSystem();
