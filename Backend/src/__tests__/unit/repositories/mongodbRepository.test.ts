import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Db, MongoClient } from 'mongodb';

let mockDb: any;
let mockClient: any;

vi.mock('../../../config/index.js', () => ({
    database: {
        type: 'mongodb',
        mongoUri: 'mongodb://localhost:27017/test',
        jsonPath: '',
    },
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test', channels: [] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
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

vi.mock('mongodb', async () => {
    const actual = await vi.importActual<typeof import('mongodb')>('mongodb');
    return {
        ...actual,
        MongoClient: {
            connect: vi.fn(() => Promise.resolve(mockClient)),
        },
    };
});

import mongodbRepository, { getDb } from '../../../repositories/mongodbRepository.js';
import { FileData } from '../../../types/models/file.model.js';
import logger from '../../../utils/logger.js';

describe('mongodbRepository', () => {
    let mockCollection: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockCollection = {
            insertOne: vi.fn().mockResolvedValue({ insertedId: 'test-id' }),
            findOne: vi.fn(),
            find: vi.fn(),
            deleteOne: vi.fn(),
        };

        mockDb = {
            collection: vi.fn(() => mockCollection),
            stats: vi.fn().mockResolvedValue({
                collections: 2,
                dataSize: 1024 * 1024,
            }),
            databaseName: 'test-db',
        };

        mockClient = {
            db: vi.fn(() => mockDb),
            close: vi.fn(),
        };
    });

    afterEach(() => {
        vi.resetModules();
    });

    describe('connect', () => {
        it('connects to MongoDB successfully', async () => {
            await mongodbRepository.connect();

            expect(logger.success).toHaveBeenCalledWith(
                'MongoDB connected',
                expect.objectContaining({
                    database: 'test-db',
                    collections: 2,
                }),
            );
        });

        it('handles connection failure', async () => {
            const error = new Error('Connection refused');
            vi.mocked(MongoClient.connect).mockRejectedValueOnce(error);

            await expect(mongodbRepository.connect()).rejects.toThrow('Connection refused');
            expect(logger.error).toHaveBeenCalledWith(
                'MongoDB connection failed',
                error,
                expect.any(Object),
            );
        });
    });

    describe('saveFile', () => {
        const mockFile: FileData = {
            id: 'file123',
            name: 'test.txt',
            size: 1024,
            hash: 'abc123',
            chunks: [{ mId: 'msg1', cId: 'ch1' }],
            compressed: true,
            uploadedAt: new Date().toISOString(),
        };

        it('saves file successfully', async () => {
            await mongodbRepository.connect();
            await mongodbRepository.saveFile(mockFile);

            expect(mockCollection.insertOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    _id: 'file123',
                    name: 'test.txt',
                }),
            );
            expect(logger.debug).toHaveBeenCalledWith(
                'File saved to MongoDB',
                expect.objectContaining({ fileId: 'file123' }),
            );
        });

        it('handles insertion error', async () => {
            await mongodbRepository.connect();
            const error = new Error('Duplicate key');
            mockCollection.insertOne.mockRejectedValueOnce(error);

            await expect(mongodbRepository.saveFile(mockFile)).rejects.toThrow('Duplicate key');
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to save file to MongoDB',
                error,
                expect.objectContaining({ fileId: 'file123' }),
            );
        });
    });

    describe('getFile', () => {
        it('retrieves file successfully', async () => {
            await mongodbRepository.connect();
            mockCollection.findOne.mockResolvedValue({
                _id: 'file123',
                name: 'test.txt',
                size: 1024,
                hash: 'abc123',
                chunks: [],
                compressed: true,
                uploadedAt: new Date().toISOString(),
            });

            const file = await mongodbRepository.getFile('file123');

            expect(file).toMatchObject({
                id: 'file123',
                name: 'test.txt',
            });
            expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: 'file123' });
        });

        it('returns null when file not found', async () => {
            await mongodbRepository.connect();
            mockCollection.findOne.mockResolvedValue(null);

            const file = await mongodbRepository.getFile('invalid-id');

            expect(file).toBeNull();
            expect(logger.debug).toHaveBeenCalledWith(
                'File not found in MongoDB',
                expect.objectContaining({ fileId: 'invalid-id' }),
            );
        });
    });

    describe('listFiles', () => {
        it('lists all files successfully', async () => {
            await mongodbRepository.connect();
            const mockDocs = [
                {
                    _id: 'file1',
                    name: 'test1.txt',
                    size: 100,
                    hash: 'hash1',
                    chunks: [],
                    compressed: true,
                    uploadedAt: new Date().toISOString(),
                },
                {
                    _id: 'file2',
                    name: 'test2.txt',
                    size: 200,
                    hash: 'hash2',
                    chunks: [],
                    compressed: true,
                    uploadedAt: new Date().toISOString(),
                },
            ];

            mockCollection.find.mockReturnValue({
                toArray: vi.fn().mockResolvedValue(mockDocs),
            });

            const files = await mongodbRepository.listFiles();

            expect(files).toHaveLength(2);
            expect(files[0].id).toBe('file1');
            expect(files[1].id).toBe('file2');
            expect(logger.debug).toHaveBeenCalledWith(
                'Files listed from MongoDB',
                expect.objectContaining({ count: 2 }),
            );
        });

        it('returns empty array when no files exist', async () => {
            await mongodbRepository.connect();
            mockCollection.find.mockReturnValue({
                toArray: vi.fn().mockResolvedValue([]),
            });

            const files = await mongodbRepository.listFiles();

            expect(files).toEqual([]);
        });
    });

    describe('deleteFile', () => {
        it('deletes file successfully', async () => {
            await mongodbRepository.connect();
            mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

            await mongodbRepository.deleteFile('file123');

            expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: 'file123' });
            expect(logger.debug).toHaveBeenCalledWith(
                'File deleted from MongoDB',
                expect.objectContaining({ fileId: 'file123' }),
            );
        });

        it('warns when file not found', async () => {
            await mongodbRepository.connect();
            mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

            await mongodbRepository.deleteFile('invalid-id');

            expect(logger.warn).toHaveBeenCalledWith(
                'File not found in MongoDB for deletion',
                expect.objectContaining({ fileId: 'invalid-id' }),
            );
        });
    });
});
