import { vi, describe, it, expect, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { Client } from 'discord.js';

const mockProcessUpload = vi.fn();
const mockDownloadFile = vi.fn();
const mockDeleteFile = vi.fn();
const mockGetRepository = vi.fn();

vi.mock('../../core/storage/storageEngine.js', () => ({
    processUpload: (...args: any[]) => mockProcessUpload(...args),
    downloadFile: (...args: any[]) => mockDownloadFile(...args),
}));

vi.mock('../../core/storage/deleter.js', () => ({
    deleteFile: (...args: any[]) => mockDeleteFile(...args),
}));

vi.mock('../../core/database.js', () => ({
    getRepository: () => mockGetRepository(),
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

import { createFileRoutes } from '../../api/routes/file.routes.js';
import { errorHandler } from '../../api/middlewares/errorHandler.js';

describe('file.routes', () => {
    let app: Express;
    let mockClient: Partial<Client>;
    let mockRepository: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockClient = {
            user: { tag: 'TestBot#1234' } as any,
        };

        mockRepository = {
            listFiles: vi.fn(),
            getFile: vi.fn(),
        };

        mockGetRepository.mockReturnValue(mockRepository);

        app = express();
        app.use(createFileRoutes(mockClient as Client));
        app.use(errorHandler);
    });

    describe('GET /list', () => {
        it('returns list of files', async () => {
            const mockFiles = [
                {
                    id: 'file1',
                    name: 'test1.txt',
                    size: 1024,
                    hash: 'hash1',
                    chunks: [],
                    compressed: true,
                    uploadedAt: new Date().toISOString(),
                },
                {
                    id: 'file2',
                    name: 'test2.txt',
                    size: 2048,
                    hash: 'hash2',
                    chunks: [],
                    compressed: true,
                    uploadedAt: new Date().toISOString(),
                },
            ];
            mockRepository.listFiles.mockResolvedValue(mockFiles);

            const res = await request(app).get('/list');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0]).toHaveProperty('id', 'file1');
            expect(res.body[1]).toHaveProperty('id', 'file2');
        });

        it('returns empty array when no files exist', async () => {
            mockRepository.listFiles.mockResolvedValue([]);

            const res = await request(app).get('/list');

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });
    });

    describe('POST /upload', () => {
        it('uploads file successfully', async () => {
            mockProcessUpload.mockResolvedValue('file123');

            const res = await request(app).post('/upload').send({ filePath: 'C:/test/file.txt' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                success: true,
                id: 'file123',
                url: '/download/file123',
            });
            expect(mockProcessUpload).toHaveBeenCalledWith(
                mockClient,
                'C:/test/file.txt',
                'file.txt',
            );
        });

        it('returns 400 when filePath is missing', async () => {
            const res = await request(app).post('/upload').send({});

            expect(res.status).toBe(400);
            expect(mockProcessUpload).not.toHaveBeenCalled();
        });

        it('returns 400 when filePath is empty string', async () => {
            const res = await request(app).post('/upload').send({ filePath: '' });

            expect(res.status).toBe(400);
            expect(mockProcessUpload).not.toHaveBeenCalled();
        });

        it('returns 400 when filePath exceeds max length', async () => {
            const res = await request(app)
                .post('/upload')
                .send({ filePath: 'a'.repeat(513) });

            expect(res.status).toBe(400);
            expect(mockProcessUpload).not.toHaveBeenCalled();
        });

        it('returns 500 on upload failure', async () => {
            mockProcessUpload.mockRejectedValue(new Error('Upload failed'));

            const res = await request(app).post('/upload').send({ filePath: 'C:/test/file.txt' });

            expect(res.status).toBe(500);
        });
    });

    describe('GET /download/:id', () => {
        it('downloads file successfully', async () => {
            mockDownloadFile.mockImplementation((client, id, res) => {
                res.status(200).send('file content');
                return Promise.resolve();
            });

            const res = await request(app).get('/download/file123');

            expect(mockDownloadFile).toHaveBeenCalledWith(
                mockClient,
                'file123',
                expect.any(Object),
            );
        });

        it('returns 400 for invalid file ID format', async () => {
            const res = await request(app).get('/download/');

            expect(res.status).toBe(404);
            expect(mockDownloadFile).not.toHaveBeenCalled();
        });

        it('returns 404 when file not found', async () => {
            mockDownloadFile.mockRejectedValue(new Error('File not found'));

            const res = await request(app).get('/download/invalid-id');

            expect(res.status).toBe(500);
        });
    });

    describe('DELETE /file/:id', () => {
        it('deletes file successfully', async () => {
            mockDeleteFile.mockResolvedValue('test.txt');

            const res = await request(app).delete('/file/file123');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                success: true,
                message: 'File test.txt removed.',
            });
            expect(mockDeleteFile).toHaveBeenCalledWith(mockClient, 'file123');
        });

        it('returns 400 for invalid file ID format', async () => {
            const res = await request(app).delete('/file/');

            expect(res.status).toBe(404);
            expect(mockDeleteFile).not.toHaveBeenCalled();
        });

        it('returns 404 when file not found', async () => {
            mockDeleteFile.mockRejectedValue(new Error('File not found'));

            const res = await request(app).delete('/file/invalid-id');

            expect(res.status).toBe(500);
        });
    });
});
