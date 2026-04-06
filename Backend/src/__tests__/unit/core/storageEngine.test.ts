import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Client, TextChannel } from 'discord.js';
import { Response } from 'express';
import { Readable } from 'stream';

vi.mock('../../../core/crypto/index.js', () => ({
    encryptionService: {
        encryptWithActiveKey: vi.fn((data: Buffer) => {
            const iv = Buffer.alloc(16);
            const tag = Buffer.alloc(16);
            return { encrypted: Buffer.concat([iv, tag, data]), keyId: 'test-key' };
        }),
        decrypt: vi.fn((fullBuffer: Buffer) => {
            const data = fullBuffer.subarray(32);
            return { decrypted: data, keyId: 'test-key' };
        }),
        getActiveKeyId: vi.fn(() => 'test-key'),
    },
}));

vi.mock('../../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'mongodb', mongoUri: null, jsonPath: '' },
    server: { port: 3000, chunkSize: 100 },
    discord: { token: 'test', channels: ['ch1', 'ch2'] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
    channels: ['ch1', 'ch2'],
    queue: { uploadConcurrency: 3, downloadConcurrency: 3 },
}));

vi.mock('../../../utils/logger.js');

const mockGetRepository = vi.fn();
vi.mock('../../../core/database.js', () => ({
    getRepository: () => mockGetRepository(),
}));

const mockQueueAdd = vi.fn();
vi.mock('../../../core/queueManager.js', () => ({
    default: { add: (fn: any) => mockQueueAdd(fn) },
    TaskPriority: {
        HIGH: 0,
        NORMAL: 1,
        LOW: 2,
    },
}));

let channelIndex = 0;
vi.mock('../../../core/discord/channelPool.js', () => ({
    default: { next: () => ['ch1', 'ch2'][channelIndex++ % 2] },
}));

import { processUpload, downloadFile } from '../../../core/storage/storageEngine.js';
import { NotFoundError } from '../../../utils/errors/AppError.js';
import fs from 'fs';

vi.mock('fs');

describe('storageEngine', () => {
    let mockClient: Partial<Client>;
    let mockRepository: any;
    let mockChannel: Partial<TextChannel>;

    beforeEach(() => {
        vi.clearAllMocks();
        channelIndex = 0;

        mockChannel = {
            send: vi.fn().mockResolvedValue({ id: 'msg123' }),
            messages: {
                fetch: vi.fn(),
            } as any,
        } as any;

        mockClient = {
            user: { tag: 'TestBot#1234' } as any,
            channels: {
                fetch: vi.fn().mockResolvedValue(mockChannel),
            } as any,
        };

        mockRepository = {
            getFile: vi.fn(),
            saveFile: vi.fn(),
            getChunkRegistry: vi.fn(),
            getChunkRegistryByHash: vi.fn(),
            saveChunkRegistry: vi.fn(),
        };

        mockGetRepository.mockReturnValue(mockRepository);
        mockQueueAdd.mockImplementation((fn) => fn());
    });

    describe('processUpload', () => {
        it('throws error when file does not exist', async () => {
            vi.mocked(fs.statSync).mockImplementation(() => {
                throw new Error('ENOENT: no such file or directory');
            });

            await expect(
                processUpload(mockClient as Client, '/invalid/path.txt', 'test.txt'),
            ).rejects.toThrow();
        });

        it('uploads small file successfully', async () => {
            const testData = Buffer.from('Hello World');

            vi.mocked(fs.statSync).mockReturnValue({ size: testData.length } as any);
            vi.mocked(fs.createReadStream).mockReturnValue(Readable.from([testData]) as any);
            mockRepository.getChunkRegistryByHash = vi.fn().mockResolvedValue(null);

            const fileId = await processUpload(mockClient as Client, '/test.txt', 'test.txt');

            expect(fileId).toBeDefined();
            expect(fileId).toHaveLength(8);
            expect(mockRepository.saveChunkRegistry).toHaveBeenCalledWith(
                expect.objectContaining({
                    refCount: 1,
                    compressed: true,
                }),
            );
            expect(mockRepository.saveFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: fileId,
                    name: 'test.txt',
                    size: testData.length,
                    chunkRegistryId: expect.any(String),
                }),
            );
        });

        it('handles large files with multiple chunks', async () => {
            const largeData = Buffer.alloc(250); // 250 bytes with chunk size 100

            vi.mocked(fs.statSync).mockReturnValue({ size: largeData.length } as any);
            vi.mocked(fs.createReadStream).mockReturnValue(Readable.from([largeData]) as any);
            mockRepository.getChunkRegistryByHash = vi.fn().mockResolvedValue(null);

            const fileId = await processUpload(mockClient as Client, '/large.bin', 'large.bin');

            expect(fileId).toBeDefined();
            expect(mockRepository.saveChunkRegistry).toHaveBeenCalledWith(
                expect.objectContaining({
                    refCount: 1,
                    compressed: true,
                }),
            );
            expect(mockRepository.saveFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: fileId,
                    name: 'large.bin',
                    size: largeData.length,
                    chunkRegistryId: expect.any(String),
                }),
            );
        });
        it('uploads incompressible file without compression', async () => {
            const testData = Buffer.from('fake-jpeg-data');

            vi.mocked(fs.statSync).mockReturnValue({ size: testData.length } as any);
            vi.mocked(fs.createReadStream).mockReturnValue(Readable.from([testData]) as any);
            mockRepository.getChunkRegistryByHash = vi.fn().mockResolvedValue(null);

            const fileId = await processUpload(mockClient as Client, '/photo.jpg', 'photo.jpg');

            expect(fileId).toBeDefined();
            expect(mockRepository.saveChunkRegistry).toHaveBeenCalledWith(
                expect.objectContaining({
                    compressed: false,
                }),
            );
        });
    });

    describe('downloadFile', () => {
        it('throws NotFoundError when file does not exist', async () => {
            mockRepository.getFile.mockResolvedValue(null);

            const mockRes = {
                setHeader: vi.fn(),
                headersSent: false,
            } as unknown as Response;

            await expect(downloadFile(mockClient as Client, 'invalid-id', mockRes)).rejects.toThrow(
                NotFoundError,
            );
        });
    });
});
