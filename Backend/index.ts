import client from './src/bot.js';
import { port, token } from './src/config.js';
import { initDatabase } from './src/core/database.js';
import logger from './src/utils/logger.js';
import createServer from './src/server.js';

const startSystem = async (): Promise<void> => {
    try {
        logger.info('Initializing Discord S3 Pro [TS-STRICT]...');

        await initDatabase();
        await client.login(token);

        const server = createServer(client);
        server.listen(port, () => {
            logger.success(`System Ready on port ${port}`);
        });
    } catch (err: any) {
        logger.error(`Bootstrap Failure: ${err.message}`);
        process.exit(1);
    }
};

startSystem();
