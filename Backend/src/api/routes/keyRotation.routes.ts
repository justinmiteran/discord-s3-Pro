import { Router, Request, Response, NextFunction } from 'express';
import { keyRotationManager } from '../../core/keyRotation.js';

export const createKeyRotationRoutes = (): Router => {
    const router = Router();

    /**
     * @openapi
     * /admin/keys:
     *   get:
     *     tags:
     *       - Admin
     *     summary: List encryption keys
     *     description: Lists all available encryption keys (IDs only, not the actual keys)
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: List of encryption keys
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 keys:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       id:
     *                         type: string
     *                         example: current
     *                       active:
     *                         type: boolean
     *                         example: true
     *                       createdAt:
     *                         type: string
     *                         format: date-time
     *       401:
     *         description: Unauthorized
     */
    router.get('/admin/keys', (req: Request, res: Response, next: NextFunction) => {
        try {
            const keys = keyRotationManager.listKeys();
            res.json({ keys });
        } catch (err) {
            next(err);
        }
    });

    return router;
};
