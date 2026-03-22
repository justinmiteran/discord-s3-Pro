import { vi } from 'vitest';
import { mockConfig, mockLogger } from '../helpers/standardMocks.js';

vi.mock('../../config/index.js', () => mockConfig);
vi.mock('../../utils/logger.js', () => mockLogger);

import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../api/middlewares/authMiddleware.js';
import { AuthError } from '../../utils/errors/AppError.js';
import type { Request, Response, NextFunction } from 'express';

const SECRET = 'test-secret-key-32-characters!!';
const mockReq = (authorization?: string) => ({ headers: { authorization } }) as unknown as Request;
const mockRes = () => ({}) as Response;

describe('authMiddleware', () => {
    let next: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        next = vi.fn();
    });

    it('calls next(AuthError) when no Authorization header', () => {
        authMiddleware(mockReq(), mockRes(), next as NextFunction);
        expect(next.mock.calls[0][0]).toBeInstanceOf(AuthError);
        expect(next.mock.calls[0][0].message).toContain('Missing');
    });

    it('calls next(AuthError) when header does not start with Bearer', () => {
        authMiddleware(mockReq('Basic abc'), mockRes(), next as NextFunction);
        expect(next.mock.calls[0][0]).toBeInstanceOf(AuthError);
    });

    it('calls next(AuthError) when Bearer has no token', () => {
        authMiddleware(mockReq('Bearer '), mockRes(), next as NextFunction);
        expect(next.mock.calls[0][0]).toBeInstanceOf(AuthError);
    });

    it('calls next(AuthError) with malformed token', () => {
        authMiddleware(mockReq('Bearer notavalidtoken'), mockRes(), next as NextFunction);
        expect(next.mock.calls[0][0]).toBeInstanceOf(AuthError);
    });

    it('calls next() with a valid token', () => {
        const token = jwt.sign({ sub: '1', username: 'admin' }, SECRET, { algorithm: 'HS256' });
        authMiddleware(mockReq(`Bearer ${token}`), mockRes(), next as NextFunction);
        expect(next).toHaveBeenCalledWith();
    });

    it('calls next(AuthError) with an expired token', () => {
        const token = jwt.sign({ sub: '1' }, SECRET, { algorithm: 'HS256', expiresIn: -1 });
        authMiddleware(mockReq(`Bearer ${token}`), mockRes(), next as NextFunction);
        expect(next.mock.calls[0][0]).toBeInstanceOf(AuthError);
        expect(next.mock.calls[0][0].message).toContain('expired');
    });

    it('calls next(AuthError) with a token signed with wrong secret', () => {
        const token = jwt.sign({ sub: '1' }, 'wrong-secret', { algorithm: 'HS256' });
        authMiddleware(mockReq(`Bearer ${token}`), mockRes(), next as NextFunction);
        expect(next.mock.calls[0][0]).toBeInstanceOf(AuthError);
    });
});
