import { Router, Request, Response } from 'express';
import { Client } from 'discord.js';

/**
 * Creates health check routes
 * @param client - Discord bot client instance
 * @returns Configured router
 */
export const createHealthRoutes = (client: Client): Router => {
    const router = Router();

    /**
     * GET /status - Health check endpoint
     */
    router.get('/status', (req: Request, res: Response) => {
        res.json({ status: 'online', bot: client.user?.tag || 'Ready' });
    });

    return router;
};
