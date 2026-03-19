import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/errors/AppError.js';
import logger from '../../utils/logger.js';
import { HTTP_STATUS } from '../../constants/index.js';

/**
 * Centralized error handling middleware
 * Catches all errors and formats them consistently
 */
export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    if (err instanceof AppError) {
        logger.error(`${err.message}`, err, {
            path: req.path,
            method: req.method,
            statusCode: err.statusCode,
        });
        
        res.status(err.statusCode).json({
            success: false,
            error: {
                message: err.message,
                statusCode: err.statusCode,
            },
        });
    } else {
        logger.error(`Unhandled error: ${err.message}`, err, {
            path: req.path,
            method: req.method,
        });

        res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            success: false,
            error: {
                message: 'Internal server error',
                statusCode: HTTP_STATUS.INTERNAL_ERROR,
            },
        });
    }
};

/**
 * Handles 404 errors for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
    logger.warn(`Route not found: ${req.method} ${req.path}`);
    
    res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            statusCode: HTTP_STATUS.NOT_FOUND,
        },
    });
};
