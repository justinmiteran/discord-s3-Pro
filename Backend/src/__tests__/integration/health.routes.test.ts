import { vi, describe, it, expect, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { Client } from 'discord.js';

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

import { createHealthRoutes } from '../../api/routes/health.routes.js';

describe('health.routes', () => {
    let app: Express;
    let mockClient: Partial<Client>;

    beforeEach(() => {
        mockClient = {
            user: {
                tag: 'TestBot#1234',
            } as any,
        };

        app = express();
        app.use(createHealthRoutes(mockClient as Client));
    });

    describe('GET /status', () => {
        it('returns 200 with bot status', async () => {
            const res = await request(app).get('/status');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: 'online', bot: 'TestBot#1234' });
        });

        it('returns Ready when bot user is not initialized', async () => {
            mockClient.user = null as any;
            app = express();
            app.use(createHealthRoutes(mockClient as Client));

            const res = await request(app).get('/status');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ status: 'online', bot: 'Ready' });
        });

        it('returns JSON content-type', async () => {
            const res = await request(app).get('/status');
            expect(res.headers['content-type']).toMatch(/json/);
        });
    });
});
