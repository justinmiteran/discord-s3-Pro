import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthError } from '../../utils/errors/AppError.js';
import { security } from '../../config/index.js';

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
        return next(new AuthError('Missing or invalid authorization header'));

    const token = header.slice(7);
    try {
        jwt.verify(token, security.jwtSecret, { algorithms: ['HS256'] });
        next();
    } catch {
        next(new AuthError('Invalid or expired token'));
    }
};
