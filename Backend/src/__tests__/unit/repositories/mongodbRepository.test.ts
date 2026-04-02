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
            replaceOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
            createIndex: vi.fn().mockResolvedValue('hash_1'),
            updateOne: vi.fn(),
            findOneAndUpdate: vi.fn(),
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
            chunkRegistryId: 'reg123',
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
                refCount: 1,
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

    describe('getChunkRegistryByHash', () => {
        it('retrieves chunk registry by hash successfully', async () => {
            await mongodbRepository.connect();
            mockCollection.findOne.mockResolvedValue({
                _id: 'reg123',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            });

            const registry = await mongodbRepository.getChunkRegistryByHash('abc123');

            expect(registry).toMatchObject({
                id: 'reg123',
                hash: 'abc123',
            });
            expect(mockCollection.findOne).toHaveBeenCalledWith({ hash: 'abc123' });
        });

        it('returns null when registry with hash not found', async () => {
            await mongodbRepository.connect();
            mockCollection.findOne.mockResolvedValue(null);

            const registry = await mongodbRepository.getChunkRegistryByHash('nonexistent-hash');

            expect(registry).toBeNull();
            expect(logger.debug).toHaveBeenCalledWith(
                'Chunk registry not found by hash in MongoDB',
                expect.objectContaining({ hash: 'nonexistent-hash' }),
            );
        });
    });

    describe('incrementChunkRegistryRefCount', () => {
        it('increments refCount successfully', async () => {
            await mongodbRepository.connect();
            mockCollection.updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

            await mongodbRepository.incrementChunkRegistryRefCount('reg123');

            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { _id: 'reg123' },
                { $inc: { refCount: 1 } },
            );
            expect(logger.debug).toHaveBeenCalledWith(
                'RefCount incremented',
                expect.objectContaining({ registryId: 'reg123' }),
            );
        });

        it('throws error when registry not found', async () => {
            await mongodbRepository.connect();
            mockCollection.updateOne = vi.fn().mockResolvedValue({ matchedCount: 0 });

            await expect(mongodbRepository.incrementChunkRegistryRefCount('invalid-id')).rejects.toThrow(
                'Chunk registry invalid-id not found',
            );
            expect(logger.error).toHaveBeenCalledWith(
                'Cannot increment refCount: chunk registry not found',
                undefined,
                expect.objectContaining({ registryId: 'invalid-id' }),
            );
        });
    });

    describe('decrementChunkRegistryRefCount', () => {
        it('decrements refCount successfully', async () => {
            await mongodbRepository.connect();
            mockCollection.findOneAndUpdate = vi.fn().mockResolvedValue({
                _id: 'reg123',
                refCount: 1,
            });

            const newRefCount = await mongodbRepository.decrementChunkRegistryRefCount('reg123');

            expect(newRefCount).toBe(1);
            expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
                { _id: 'reg123' },
                { $inc: { refCount: -1 } },
                { returnDocument: 'after' },
            );
        });

        it('returns 0 when refCount goes negative', async () => {
            await mongodbRepository.connect();
            mockCollection.findOneAndUpdate = vi.fn().mockResolvedValue({
                _id: 'reg123',
                refCount: -1,
            });

            const newRefCount = await mongodbRepository.decrementChunkRegistryRefCount('reg123');

            expect(newRefCount).toBe(0);
        });

        it('throws error when registry not found', async () => {
            await mongodbRepository.connect();
            mockCollection.findOneAndUpdate = vi.fn().mockResolvedValue(null);

            await expect(mongodbRepository.decrementChunkRegistryRefCount('invalid-id')).rejects.toThrow(
                'Chunk registry invalid-id not found',
            );
        });
    });

    describe('saveChunkRegistry', () => {
        it('saves chunk registry successfully', async () => {
            await mongodbRepository.connect();
            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            await mongodbRepository.saveChunkRegistry(mockRegistry);

            expect(mockCollection.replaceOne).toHaveBeenCalledWith(
                { _id: 'reg123' },
                expect.objectContaining({
                    _id: 'reg123',
                    hash: 'abc123',
                }),
                { upsert: true },
            );
            expect(logger.debug).toHaveBeenCalledWith(
                'Chunk registry saved to MongoDB',
                expect.objectContaining({ registryId: 'reg123' }),
            );
        });

        it('handles insertion error', async () => {
            await mongodbRepository.connect();
            const error = new Error('Duplicate key');
            mockCollection.replaceOne.mockRejectedValueOnce(error);

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            await expect(mongodbRepository.saveChunkRegistry(mockRegistry)).rejects.toThrow('Duplicate key');
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to save chunk registry to MongoDB',
                error,
                expect.objectContaining({ registryId: 'reg123' }),
            );
        });
    });

    describe('updateChunkRegistryData', () => {
        it('updates chunk registry data successfully', async () => {
            await mongodbRepository.connect();
            mockCollection.updateOne = vi.fn().mockResolvedValue({ matchedCount: 1 });

            const chunks = [{ mId: 'new-msg1', cId: 'new-ch1' }];
            await mongodbRepository.updateChunkRegistryData('reg123', chunks, 'v2');

            expect(mockCollection.updateOne).toHaveBeenCalledWith(
                { _id: 'reg123' },
                { $set: { chunks, encryptionKeyId: 'v2' } },
            );
            expect(logger.debug).toHaveBeenCalledWith(
                'Chunk registry data updated',
                expect.objectContaining({ registryId: 'reg123' }),
            );
        });

        it('throws error when registry not found', async () => {
            await mongodbRepository.connect();
            mockCollection.updateOne = vi.fn().mockResolvedValue({ matchedCount: 0 });

            const chunks = [{ mId: 'new-msg1', cId: 'new-ch1' }];
            await expect(
                mongodbRepository.updateChunkRegistryData('invalid-id', chunks, 'v2'),
            ).rejects.toThrow('Chunk registry invalid-id not found');
            expect(logger.error).toHaveBeenCalledWith(
                'Cannot update chunk registry: not found',
                undefined,
                expect.objectContaining({ registryId: 'invalid-id' }),
            );
        });
    });

    describe('getChunkRegistry', () => {
        it('retrieves chunk registry successfully', async () => {
            await mongodbRepository.connect();
            mockCollection.findOne.mockResolvedValue({
                _id: 'reg123',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            });

            const registry = await mongodbRepository.getChunkRegistry('reg123');

            expect(registry).toMatchObject({
                id: 'reg123',
                hash: 'abc123',
            });
            expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: 'reg123' });
        });

        it('returns null when registry not found', async () => {
            await mongodbRepository.connect();
            mockCollection.findOne.mockResolvedValue(null);

            const registry = await mongodbRepository.getChunkRegistry('invalid-id');

            expect(registry).toBeNull();
            expect(logger.debug).toHaveBeenCalledWith(
                'Chunk registry not found in MongoDB',
                expect.objectContaining({ registryId: 'invalid-id' }),
            );
        });

        it('handles retrieval error', async () => {
            await mongodbRepository.connect();
            const error = new Error('Database error');
            mockCollection.findOne.mockRejectedValueOnce(error);

            await expect(mongodbRepository.getChunkRegistry('reg123')).rejects.toThrow('Database error');
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to retrieve chunk registry from MongoDB',
                error,
                expect.objectContaining({ registryId: 'reg123' }),
            );
        });
    });

    describe('deleteChunkRegistry', () => {
        it('deletes chunk registry successfully', async () => {
            await mongodbRepository.connect();
            mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

            await mongodbRepository.deleteChunkRegistry('reg123');

            expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: 'reg123' });
            expect(logger.debug).toHaveBeenCalledWith(
                'Chunk registry deleted from MongoDB',
                expect.objectContaining({ registryId: 'reg123' }),
            );
        });

        it('warns when registry not found', async () => {
            await mongodbRepository.connect();
            mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

            await mongodbRepository.deleteChunkRegistry('invalid-id');

            expect(logger.warn).toHaveBeenCalledWith(
                'Chunk registry not found in MongoDB for deletion',
                expect.objectContaining({ registryId: 'invalid-id' }),
            );
        });

        it('handles deletion error', async () => {
            await mongodbRepository.connect();
            const error = new Error('Database error');
            mockCollection.deleteOne.mockRejectedValueOnce(error);

            await expect(mongodbRepository.deleteChunkRegistry('reg123')).rejects.toThrow('Database error');
            expect(logger.error).toHaveBeenCalledWith(
                'Failed to delete chunk registry from MongoDB',
                error,
                expect.objectContaining({ registryId: 'reg123' }),
            );
        });
    });
});
