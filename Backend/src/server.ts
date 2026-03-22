import express, { Express } from 'express';
import { Client } from 'discord.js';
import { requestLogger } from './api/middlewares/requestLogger.js';
import { errorHandler, notFoundHandler } from './api/middlewares/errorHandler.js';
import { createRoutes } from './api/routes/index.js';
import { globalLimiter } from './api/middlewares/rateLimiter.js';

export const createServer = (client: Client): Express => {
    const app = express();

    app.use(globalLimiter);
    app.use(requestLogger);
    app.use('/', createRoutes(client));
    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
};
