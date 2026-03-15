import express, { Express, Request, Response, NextFunction } from 'express';
import { Client } from 'discord.js';
import logger from './utils/logger.js';
import createRoutes from './api/routes.js';

export default (client: Client): Express => {
    const app = express();

    // --- REQUEST TRACER MIDDLEWARE ---
    app.use((req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();
        logger.info(`Incoming request: ${req.method} ${req.originalUrl}`);

        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.http(req.method, req.originalUrl, res.statusCode, duration);
        });
        next();
    });

    // --- API ROUTES BINDING ---
    app.use('/', createRoutes(client));

    return app;
};
