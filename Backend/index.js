const client = require('./src/bot');
const { port, token } = require('./src/config');
const { initDatabase } = require('./src/core/database'); // Import the abstraction layer
const logger = require('./src/utils/logger');

const server = require('./src/server')(client);

/**
 * Bootstrap function to ensure Database is ready before
 * the Bot and API start accepting requests.
 */
async function startSystem() {
    try {
        logger.info('Initializing Discord S3 Pro Services...');

        await initDatabase();

        await client.login(token);
        logger.success('Discord Bot connected successfully.');

        server.listen(port, () => {
            logger.success(`System Ready!`);
            logger.info(`Gateway active at: http://localhost:${port}`);
        });
    } catch (err) {
        logger.error('Critical Failure during system bootstrap:');
        logger.error(err.message);
        process.exit(1);
    }
}

process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled Rejection: ${reason}`);
});

startSystem();
