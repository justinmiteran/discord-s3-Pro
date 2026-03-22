import { Router } from 'express';
import { Client } from 'discord.js';
import { createHealthRoutes } from './health.routes.js';
import { createFileRoutes } from './file.routes.js';
import { createAuthRoutes } from './auth.routes.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { authLimiter, uploadLimiter } from '../middlewares/rateLimiter.js';

export const createRoutes = (client: Client): Router => {
    const router = Router();

    router.use('/auth/login', authLimiter);
    router.use('/auth/refresh', authLimiter);
    router.use('/upload', uploadLimiter);

    router.use('/', createAuthRoutes());
    router.use('/', createHealthRoutes(client));
    router.use('/', authMiddleware, createFileRoutes(client));

    return router;
};
