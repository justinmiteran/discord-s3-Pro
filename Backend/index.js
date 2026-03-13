const client = require('./src/bot');
const { port, token } = require('./src/config');
const logger = require('./src/utils/logger');

// Inject client into server for Discord channel access
const server = require('./src/server')(client);
client
    .login(token)
    .then(() => {
        server.listen(port, () => {
            logger.success(`System Ready!`);
            logger.info(`Gateway active at: http://localhost:${port}`);
        });
    })
    .catch((err) => logger.error('Bot login failed:', err.message));
