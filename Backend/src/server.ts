import express, { Express } from 'express';
import { Client } from 'discord.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { requestLogger } from './api/middlewares/requestLogger.js';
import { errorHandler, notFoundHandler } from './api/middlewares/errorHandler.js';
import { createRoutes } from './api/routes/index.js';
import { globalLimiter } from './api/middlewares/rateLimiter.js';

export const createServer = (client: Client): Express => {
    const app = express();

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Discord S3 Pro API Documentation',
    }));

    app.use(globalLimiter);
    app.use(requestLogger);
    app.use('/', createRoutes(client));
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
};
