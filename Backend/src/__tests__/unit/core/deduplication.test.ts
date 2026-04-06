import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Client } from 'discord.js';
import { Readable } from 'stream';

vi.mock('../../../core/crypto/index.js', () => ({
    encryptionService: {
        getActiveKeyId: vi.fn(() => 'test-key'),
        needsReencryption: vi.fn(() => false),
        encryptWithActiveKey: vi.fn((data: Buffer) => {
            const iv = Buffer.alloc(16);
            const tag = Buffer.alloc(16);
            return { encrypted: Buffer.concat([iv, tag, data]), keyId: 'test-key' };
        }),
        decrypt: vi.fn((fullBuffer: Buffer) => {
            const data = fullBuffer.subarray(32);
            return { decrypted: data, keyId: 'test-key' };
        }),
    },
}));

vi.mock('../../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'mongodb', mongoUri: null, jsonPath: '' },
    server: { port: 3000, chunkSize: 100 },
    discord: { token: 'test', channels: ['ch1', 'ch2'] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
    channels: ['ch1', 'ch2'],
}));

vi.mock('../../../utils/logger.js', () => ({
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

import { processUpload } from '../../../core/storage/storageEngine.js';
import logger from '../../../utils/logger.js';
import fs from 'fs';

vi.mock('fs');

describe('File Deduplication', () => {
    let mockClient: Partial<Client>;
    let mockRepository: any;
    let mockChannel: any;

    beforeEach(() => {
        vi.clearAllMocks();
        channelIndex = 0;

        mockChannel = {
            send: vi.fn().mockResolvedValue({ id: 'msg123' }),
        };

        mockClient = {
            user: { tag: 'TestBot#1234' } as any,
            channels: {
                fetch: vi.fn().mockResolvedValue(mockChannel),
            } as any,
        };

        mockRepository = {
            getFile: vi.fn(),
            getChunkRegistry: vi.fn(),
            getChunkRegistryByHash: vi.fn(),
            saveFile: vi.fn(),
            saveChunkRegistry: vi.fn(),
            incrementChunkRegistryRefCount: vi.fn(),
        };

        mockGetRepository.mockReturnValue(mockRepository);
        mockQueueAdd.mockImplementation((fn) => fn());
    });

    describe('processUpload with deduplication', () => {
        it('uploads new file normally when hash does not exist', async () => {
            const testData = Buffer.from('Hello World');

            vi.mocked(fs.statSync).mockReturnValue({ size: testData.length } as any);
            vi.mocked(fs.createReadStream).mockReturnValue(Readable.from([testData]) as any);
            mockRepository.getChunkRegistryByHash.mockResolvedValue(null);

            const fileId = await processUpload(mockClient as Client, '/test.txt', 'test.txt');

            expect(fileId).toBeDefined();
            expect(mockRepository.getChunkRegistryByHash).toHaveBeenCalled();
            expect(mockRepository.saveChunkRegistry).toHaveBeenCalledWith(
                expect.objectContaining({
                    refCount: 1,
                    compressed: true,
                }),
            );
            expect(mockRepository.saveFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'test.txt',
                    chunkRegistryId: expect.any(String),
                }),
            );
            expect(mockRepository.incrementChunkRegistryRefCount).not.toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith(
                'File upload completed',
                expect.any(Object),
            );
        });

        it('reuses existing chunks when file hash already exists', async () => {
            const testData = Buffer.from('Hello World');
            const existingRegistry = {
                id: 'reg123',
                hash: 'abc123hash',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            vi.mocked(fs.statSync).mockReturnValue({ size: testData.length } as any);
            vi.mocked(fs.createReadStream).mockReturnValue(Readable.from([testData]) as any);
            mockRepository.getChunkRegistryByHash.mockResolvedValue(existingRegistry);

            const fileId = await processUpload(
                mockClient as Client,
                '/duplicate.txt',
                'duplicate.txt',
            );

            expect(fileId).toBeDefined();
            expect(mockRepository.getChunkRegistryByHash).toHaveBeenCalled();
            expect(mockChannel.send).not.toHaveBeenCalled();
            expect(mockRepository.saveFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'duplicate.txt',
                    chunkRegistryId: existingRegistry.id,
                }),
            );
            expect(mockRepository.incrementChunkRegistryRefCount).toHaveBeenCalledWith(existingRegistry.id);
            expect(logger.success).toHaveBeenCalledWith(
                'File upload completed (deduplicated)',
                expect.objectContaining({
                    reusedChunks: 2,
                }),
            );
        });

        it('creates independent metadata for deduplicated files', async () => {
            const testData = Buffer.from('Test content');
            const existingRegistry = {
                id: 'reg1',
                hash: 'samehash',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            vi.mocked(fs.statSync).mockReturnValue({ size: testData.length } as any);
            vi.mocked(fs.createReadStream).mockReturnValue(Readable.from([testData]) as any);
            mockRepository.getChunkRegistryByHash.mockResolvedValue(existingRegistry);

            const fileId = await processUpload(mockClient as Client, '/copy.txt', 'copy.txt');

            expect(mockRepository.saveFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: fileId,
                    name: 'copy.txt',
                    chunkRegistryId: existingRegistry.id,
                }),
            );
            
            const savedFile = mockRepository.saveFile.mock.calls[0][0];
            expect(savedFile.uploadedAt).not.toBe(existingRegistry.createdAt);
        });

        it('logs deduplication information correctly', async () => {
            const testData = Buffer.from('Content');
            const existingRegistry = {
                id: 'reg123',
                hash: 'hash123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 2,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            vi.mocked(fs.statSync).mockReturnValue({ size: testData.length } as any);
            vi.mocked(fs.createReadStream).mockReturnValue(Readable.from([testData]) as any);
            mockRepository.getChunkRegistryByHash.mockResolvedValue(existingRegistry);

            await processUpload(mockClient as Client, '/dup.txt', 'dup.txt');

            expect(logger.info).toHaveBeenCalledWith(
                'File already exists in chunk registry (deduplication)',
                expect.objectContaining({
                    registryId: existingRegistry.id,
                    currentRefCount: existingRegistry.refCount,
                }),
            );
        });
    });
});
