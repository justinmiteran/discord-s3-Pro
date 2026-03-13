const express = require('express');

const logger = require('./utils/logger');

module.exports = (client) => {
    const app = express();

    // --- REQUEST TRACER MIDDLEWARE ---
    app.use((req, res, next) => {
        const start = Date.now();

        logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);

        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.http(req.method, req.originalUrl, res.statusCode, duration);
        });
        next();
    });

    // --- API ROUTES BINDING ---
    const apiRoutes = require('./api/routes')(client);
    app.use('/', apiRoutes);

    return app;
};
