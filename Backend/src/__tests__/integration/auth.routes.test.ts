import { vi, describe, it, expect, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';

const mockLogin = vi.fn();
const mockRefresh = vi.fn();
const mockLogout = vi.fn();

vi.mock('../../core/auth/authService.js', () => ({
    login: (...args: any[]) => mockLogin(...args),
    refresh: (...args: any[]) => mockRefresh(...args),
    logout: (...args: any[]) => mockLogout(...args),
}));

vi.mock('../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'mongodb', mongoUri: null, jsonPath: '' },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test', channels: [] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
}));

vi.mock('../../utils/logger.js', () => ({
    default: {
        debug: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        http: vi.fn(),
    },
}));

import { createAuthRoutes } from '../../api/routes/auth.routes.js';
import { errorHandler } from '../../api/middlewares/errorHandler.js';

describe('auth.routes', () => {
    let app: Express;

    beforeEach(() => {
        vi.clearAllMocks();
        app = express();
        app.use(createAuthRoutes());
        app.use(errorHandler);
    });

    describe('POST /auth/login', () => {
        it('returns tokens on successful login', async () => {
            const mockTokens = {
                accessToken: 'access-token-123',
                refreshToken: 'refresh-token-123',
            };
            mockLogin.mockResolvedValue(mockTokens);

            const res = await request(app)
                .post('/auth/login')
                .send({ username: 'admin', password: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockTokens);
            expect(mockLogin).toHaveBeenCalledWith('admin', 'password123');
        });

        it('returns 400 when username is missing', async () => {
            const res = await request(app).post('/auth/login').send({ password: 'password123' });

            expect(res.status).toBe(400);
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('returns 400 when password is missing', async () => {
            const res = await request(app).post('/auth/login').send({ username: 'admin' });

            expect(res.status).toBe(400);
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('returns 400 when password is too short', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({ username: 'admin', password: 'short' });

            expect(res.status).toBe(400);
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('returns 400 when username exceeds max length', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({ username: 'a'.repeat(65), password: 'password123' });

            expect(res.status).toBe(400);
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('returns 400 when password exceeds max length', async () => {
            const res = await request(app)
                .post('/auth/login')
                .send({ username: 'admin', password: 'a'.repeat(129) });

            expect(res.status).toBe(400);
            expect(mockLogin).not.toHaveBeenCalled();
        });

        it('handles invalid credentials error', async () => {
            mockLogin.mockRejectedValue(new Error('Invalid credentials'));

            const res = await request(app)
                .post('/auth/login')
                .send({ username: 'admin', password: 'wrong' });

            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('POST /auth/refresh', () => {
        it('returns new tokens on successful refresh', async () => {
            const mockTokens = {
                accessToken: 'new-access-token',
                refreshToken: 'new-refresh-token',
            };
            mockRefresh.mockResolvedValue(mockTokens);

            const res = await request(app)
                .post('/auth/refresh')
                .send({ refreshToken: 'old-refresh-token' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockTokens);
            expect(mockRefresh).toHaveBeenCalledWith('old-refresh-token');
        });

        it('returns 400 when refreshToken is missing', async () => {
            const res = await request(app).post('/auth/refresh').send({});

            expect(res.status).toBe(400);
            expect(mockRefresh).not.toHaveBeenCalled();
        });

        it('returns 500 on invalid refresh token', async () => {
            mockRefresh.mockRejectedValue(new Error('Invalid or expired refresh token'));

            const res = await request(app)
                .post('/auth/refresh')
                .send({ refreshToken: 'invalid-token' });

            expect(res.status).toBe(500);
        });
    });

    describe('POST /auth/logout', () => {
        it('logs out successfully', async () => {
            mockLogout.mockResolvedValue(undefined);

            const res = await request(app)
                .post('/auth/logout')
                .send({ refreshToken: 'refresh-token-123' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ success: true });
            expect(mockLogout).toHaveBeenCalledWith('refresh-token-123');
        });

        it('returns 400 when refreshToken is missing', async () => {
            const res = await request(app).post('/auth/logout').send({});

            expect(res.status).toBe(400);
            expect(mockLogout).not.toHaveBeenCalled();
        });
    });
});
