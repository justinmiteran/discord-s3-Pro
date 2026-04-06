import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { Client } from 'discord.js';

/**
 * End-to-End tests with full application stack
 * Tests real HTTP endpoints with mocked external dependencies (Discord, MongoDB)
 */

vi.mock('../../core/crypto/index.js', () => ({
    encryptionService: {
        encryptWithActiveKey: vi.fn((data: Buffer) => ({
            encrypted: data,
            keyId: 'test-key',
        })),
        decrypt: vi.fn((data: Buffer) => ({
            decrypted: data,
            keyId: 'test-key',
        })),
    },
}));

const mockClient = {
    user: { tag: 'TestBot#1234', id: '123456789' } as any,
    channels: {
        fetch: vi.fn(),
    } as any,
};

const mockRepository = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    listFiles: vi.fn().mockResolvedValue([]),
    getFile: vi.fn(),
    getChunkRegistry: vi.fn(),
    saveFile: vi.fn(),
    deleteFile: vi.fn(),
};

vi.mock('../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'json', mongoUri: null, jsonPath: './data/test-registry.json' },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test-token', channels: ['ch1', 'ch2'] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
    channels: ['ch1', 'ch2'],
}));

vi.mock('../../utils/logger.js');

vi.mock('../../core/database.js', () => ({
    getRepository: () => mockRepository,
}));

import { createHealthRoutes } from '../../api/routes/health.routes.js';
import { createFileRoutes } from '../../api/routes/file.routes.js';
import { createAuthRoutes } from '../../api/routes/auth.routes.js';
import { errorHandler } from '../../api/middlewares/errorHandler.js';

describe('E2E: Full Application Stack', () => {
    let app: Express;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use(createHealthRoutes(mockClient as unknown as Client));
        app.use(createFileRoutes(mockClient as unknown as Client));
        app.use(createAuthRoutes());
        app.use(errorHandler);
    });

    afterAll(() => {
        vi.clearAllMocks();
    });

    describe('Health Check Flow', () => {
        it('GET /status returns system status', async () => {
            const res = await request(app).get('/status');

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('status', 'online');
            expect(res.body).toHaveProperty('bot', 'TestBot#1234');
        });
    });

    describe('File Management Flow', () => {
        it('GET /list returns empty array initially', async () => {
            mockRepository.listFiles.mockResolvedValue([]);

            const res = await request(app).get('/list');

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('GET /list returns files after upload', async () => {
            const mockFiles = [
                {
                    id: 'file1',
                    name: 'test.txt',
                    size: 1024,
                    hash: 'hash1',
                    chunkRegistryId: 'reg1',
                    uploadedAt: new Date().toISOString(),
                },
            ];
            const mockRegistry = {
                id: 'reg1',
                hash: 'hash1',
                chunks: [],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };
            mockRepository.listFiles.mockResolvedValue(mockFiles);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);

            const res = await request(app).get('/list');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toHaveProperty('id', 'file1');
        });
    });

    describe('Error Handling Flow', () => {
        it('returns 404 for unknown routes', async () => {
            const res = await request(app).get('/unknown-route');

            expect(res.status).toBe(404);
        });

        it('handles malformed JSON gracefully', async () => {
            const res = await request(app)
                .post('/upload')
                .set('Content-Type', 'application/json')
                .send('invalid');

            expect([400, 500]).toContain(res.status);
        });
    });

    describe('CORS and Headers', () => {
        it('returns correct content-type for JSON endpoints', async () => {
            const res = await request(app).get('/status');

            expect(res.headers['content-type']).toMatch(/json/);
        });

        it('returns correct content-type for list endpoint', async () => {
            mockRepository.listFiles.mockResolvedValue([]);

            const res = await request(app).get('/list');

            expect(res.headers['content-type']).toMatch(/json/);
        });
    });
});
