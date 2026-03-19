import { Router } from 'express';
import { Client } from 'discord.js';
import { createHealthRoutes } from './health.routes.js';
import { createFileRoutes } from './file.routes.js';

/**
 * Creates and combines all API routes
 * @param client - Discord bot client instance
 * @returns Configured router with all routes
 */
export const createRoutes = (client: Client): Router => {
    const router = Router();

    router.use('/', createHealthRoutes(client));
    router.use('/', createFileRoutes(client));

    return router;
};
