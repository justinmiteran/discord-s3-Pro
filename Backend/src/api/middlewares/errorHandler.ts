import { Request, Response, NextFunction } from 'express';
import { AppError, toError } from '../../utils/errors/AppError.js';
import logger from '../../utils/logger.js';
import { HTTP_STATUS } from '../../constants/index.js';

export const errorHandler = (
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    if (err instanceof AppError) {
        logger.error(err.message, err, {
            path: req.path,
            method: req.method,
            statusCode: err.statusCode,
        });
        res.status(err.statusCode).json({
            success: false,
            error: { message: err.message, statusCode: err.statusCode },
        });
    } else {
        const error = toError(err);
        logger.error(`Unhandled error: ${error.message}`, error, {
            path: req.path,
            method: req.method,
        });
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({
            success: false,
            error: { message: 'Internal server error', statusCode: HTTP_STATUS.INTERNAL_ERROR },
        });
    }
};

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
