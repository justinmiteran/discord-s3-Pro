import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import * as authService from '../../core/auth/authService.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, refreshSchema, logoutSchema } from '../validation/schemas.js';

export const createAuthRoutes = (): Router => {
    const router = Router();

    /**
     * @openapi
     * /auth/login:
     *   post:
     *     tags:
     *       - Authentication
     *     summary: User login
     *     description: Authenticate user and receive access and refresh tokens
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - username
     *               - password
     *             properties:
     *               username:
     *                 type: string
     *                 example: admin
     *               password:
     *                 type: string
     *                 format: password
     *                 example: password123
     *     responses:
     *       200:
     *         description: Login successful
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/AuthTokens'
     *       401:
     *         description: Invalid credentials
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     *       429:
     *         description: Too many login attempts
     */
    router.post(
        '/auth/login',
        express.json(),
        validate(loginSchema),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const { username, password } = req.body;
                const tokens = await authService.login(username, password);
                res.json(tokens);
            } catch (err) {
                next(err);
            }
        },
    );

    /**
     * @openapi
     * /auth/refresh:
     *   post:
     *     tags:
     *       - Authentication
     *     summary: Refresh access token
     *     description: Exchange a valid refresh token for a new access token and refresh token
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - refreshToken
     *             properties:
     *               refreshToken:
     *                 type: string
     *                 description: Valid refresh token from login
     *     responses:
     *       200:
     *         description: Token refreshed successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/AuthTokens'
     *       401:
     *         description: Invalid or expired refresh token
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.post(
        '/auth/refresh',
        express.json(),
        validate(refreshSchema),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                const tokens = await authService.refresh(req.body.refreshToken);
                res.json(tokens);
            } catch (err) {
                next(err);
            }
        },
    );

    /**
     * @openapi
     * /auth/logout:
     *   post:
     *     tags:
     *       - Authentication
     *     summary: User logout
     *     description: Invalidate refresh token and end user session
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - refreshToken
     *             properties:
     *               refreshToken:
     *                 type: string
     *                 description: Refresh token to invalidate
     *     responses:
     *       200:
     *         description: Logout successful
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                   example: true
     *       400:
     *         description: Invalid request
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Error'
     */
    router.post(
        '/auth/logout',
        express.json(),
        validate(logoutSchema),
        async (req: Request, res: Response, next: NextFunction) => {
            try {
                await authService.logout(req.body.refreshToken);
                res.json({ success: true });
            } catch (err) {
                next(err);
            }
        },
    );

    return router;
};
