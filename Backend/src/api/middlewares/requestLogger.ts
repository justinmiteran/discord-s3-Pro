import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger.js';
import { sanitizeHeaders } from '../../utils/sanitizer.js';

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
            headers: sanitizeHeaders(req.headers),
        });
    });

    next();
};
