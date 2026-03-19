import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger.js';

/**
 * Logs incoming HTTP requests and their response times
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.http(req.method, req.originalUrl, res.statusCode, duration, {
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });
    });

    next();
};
