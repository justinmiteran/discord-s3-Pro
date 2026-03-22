import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import * as authService from '../../core/auth/authService.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema, refreshSchema, logoutSchema } from '../validation/schemas.js';

export const createAuthRoutes = (): Router => {
    const router = Router();

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
