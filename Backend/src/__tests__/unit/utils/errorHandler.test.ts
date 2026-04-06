import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'mongodb', mongoUri: null, jsonPath: '' },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test', channels: [] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
}));

vi.mock('../../../utils/logger.js');

import { errorHandler, notFoundHandler } from '../../../api/middlewares/errorHandler.js';
import { AppError, ValidationError } from '../../../utils/errors/AppError.js';
import logger from '../../../utils/logger.js';
import { HTTP_STATUS } from '../../../constants/index.js';

describe('errorHandler', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let jsonMock: ReturnType<typeof vi.fn>;
    let statusMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        jsonMock = vi.fn();
        statusMock = vi.fn().mockReturnValue({ json: jsonMock });

        req = {
            path: '/test',
            method: 'GET',
        } as Request;

        res = {
            status: statusMock,
            json: jsonMock,
        };

        next = vi.fn();
    });

    describe('AppError handling', () => {
        it('handles AppError with correct status and message', () => {
            const error = new ValidationError('Invalid input');

            errorHandler(error, req as Request, res as Response, next);

            expect(logger.error).toHaveBeenCalledWith(
                'Invalid input',
                error,
                expect.objectContaining({
                    path: '/test',
                    method: 'GET',
                    statusCode: 400,
                }),
            );
            expect(statusMock).toHaveBeenCalledWith(400);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                error: { message: 'Invalid input', statusCode: 400 },
            });
        });

        it('never calls next() - terminal middleware', () => {
            const error = new ValidationError('Invalid input');
            errorHandler(error, req as Request, res as Response, next);
            expect(next).not.toHaveBeenCalled();
        });
    });

    describe('generic Error handling', () => {
        it('handles generic Error as internal server error', () => {
            const error = new Error('Something went wrong');

            errorHandler(error, req as Request, res as Response, next);

            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Unhandled error'),
                error,
                expect.objectContaining({
                    path: '/test',
                    method: 'GET',
                }),
            );
            expect(statusMock).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_ERROR);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                error: { message: 'Internal server error', statusCode: HTTP_STATUS.INTERNAL_ERROR },
            });
        });

        it('masks error details in production', () => {
            const error = new Error('Database connection failed with password: secret123');

            errorHandler(error, req as Request, res as Response, next);

            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                error: { message: 'Internal server error', statusCode: 500 },
            });
            // Should NOT expose internal error message
            expect(jsonMock).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    error: expect.objectContaining({
                        message: expect.stringContaining('password'),
                    }),
                }),
            );
        });
    });

    describe('non-Error handling', () => {
        it('handles string errors', () => {
            const error = 'string error';

            errorHandler(error, req as Request, res as Response, next);

            expect(statusMock).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_ERROR);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                error: { message: 'Internal server error', statusCode: HTTP_STATUS.INTERNAL_ERROR },
            });
        });

        it('handles null error', () => {
            errorHandler(null, req as Request, res as Response, next);

            expect(statusMock).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_ERROR);
            expect(jsonMock).toHaveBeenCalledWith({
                success: false,
                error: { message: 'Internal server error', statusCode: HTTP_STATUS.INTERNAL_ERROR },
            });
        });

        it('handles undefined error', () => {
            errorHandler(undefined, req as Request, res as Response, next);

            expect(statusMock).toHaveBeenCalledWith(HTTP_STATUS.INTERNAL_ERROR);
        });
    });
});

describe('notFoundHandler', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let jsonMock: ReturnType<typeof vi.fn>;
    let statusMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        jsonMock = vi.fn();
        statusMock = vi.fn().mockReturnValue({ json: jsonMock });

        req = {
            path: '/unknown',
            method: 'POST',
        };

        res = {
            status: statusMock,
            json: jsonMock,
        };
    });

    it('returns 404 with correct message', () => {
        notFoundHandler(req as Request, res as Response);

        expect(logger.warn).toHaveBeenCalledWith('Route not found: POST /unknown');
        expect(statusMock).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
        expect(jsonMock).toHaveBeenCalledWith({
            success: false,
            error: {
                message: 'Route POST /unknown not found',
                statusCode: HTTP_STATUS.NOT_FOUND,
            },
        });
    });

    it('handles different HTTP methods', () => {
        req = {
            method: 'DELETE',
            path: '/api/users/123',
        } as Request;

        notFoundHandler(req as Request, res as Response);

        expect(logger.warn).toHaveBeenCalledWith('Route not found: DELETE /api/users/123');
        expect(jsonMock).toHaveBeenCalledWith({
            success: false,
            error: {
                message: 'Route DELETE /api/users/123 not found',
                statusCode: 404,
            },
        });
    });
});
