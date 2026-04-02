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
     * @openapi
     * /status:
     *   get:
     *     tags:
     *       - Health
     *     summary: Check system health
     *     description: Returns the current status of the API server and Discord bot connection
     *     responses:
     *       200:
     *         description: System is operational
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 status:
     *                   type: string
     *                   example: online
     *                 bot:
     *                   type: string
     *                   description: Discord bot username
     *                   example: StorageBot#1234
     */
    router.get('/status', (req: Request, res: Response) => {
        res.json({ status: 'online', bot: client.user?.tag || 'Ready' });
    });

    return router;
};
