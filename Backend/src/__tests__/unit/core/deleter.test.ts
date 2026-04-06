import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Client, TextChannel, Message } from 'discord.js';

vi.mock('../../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'mongodb', mongoUri: null, jsonPath: '' },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test', channels: ['ch1', 'ch2'] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
    channels: ['ch1', 'ch2'],
}));

vi.mock('../../../core/crypto/index.js', () => ({
    encryptionService: {
        encryptWithActiveKey: vi.fn((buffer: Buffer) => ({
            encrypted: buffer,
            keyId: 'key1',
        })),
        decrypt: vi.fn((buffer: Buffer) => ({
            decrypted: buffer,
            keyId: 'key1',
        })),
    },
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

import { deleteFile } from '../../../core/storage/deleter.js';
import { NotFoundError } from '../../../utils/errors/AppError.js';
import { DISCORD_ERROR_CODES } from '../../../constants/index.js';
import logger from '../../../utils/logger.js';

describe('deleter', () => {
    let mockClient: Partial<Client>;
    let mockRepository: any;
    let mockChannel: Partial<TextChannel>;
    let mockMessage: Partial<Message>;

    beforeEach(() => {
        vi.clearAllMocks();

        mockMessage = {
            id: 'msg123',
            delete: vi.fn().mockResolvedValue(undefined),
        } as any;

        mockChannel = {
            id: 'ch1',
            messages: {
                fetch: vi.fn().mockResolvedValue(mockMessage),
                delete: vi.fn().mockResolvedValue(undefined),
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
            getChunkRegistry: vi.fn(),
            deleteFile: vi.fn().mockResolvedValue(undefined),
            deleteChunkRegistry: vi.fn().mockResolvedValue(undefined),
            decrementChunkRegistryRefCount: vi.fn(),
        };

        mockGetRepository.mockReturnValue(mockRepository);
        mockQueueAdd.mockImplementation(async (fn) => await fn());
    });

    describe('deleteFile', () => {
        it('throws NotFoundError when file does not exist', async () => {
            mockRepository.getFile.mockResolvedValue(null);

            await expect(deleteFile(mockClient as Client, 'invalid-id')).rejects.toThrow(
                NotFoundError,
            );
            await expect(deleteFile(mockClient as Client, 'invalid-id')).rejects.toThrow(
                'File not found',
            );

            expect(logger.warn).toHaveBeenCalledWith(
                'File not found for deletion',
                expect.objectContaining({ fileId: 'invalid-id' }),
            );
        });

        it('deletes file with all chunks successfully when refCount is 0', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(0);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('test.txt');
            expect(mockChannel.messages!.delete).toHaveBeenCalledTimes(2);
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
            expect(mockRepository.deleteChunkRegistry).toHaveBeenCalledWith('reg123');
        });

        it('skips Discord chunk deletion when refCount > 0', async () => {
            const mockFile = {
                id: 'file123',
                name: 'duplicate.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                refCount: 3,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(2);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('duplicate.txt');
            expect(mockChannel.messages!.delete).not.toHaveBeenCalled();
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
            expect(mockRepository.deleteChunkRegistry).not.toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(
                'Chunk registry retained (other files reference it)',
                expect.objectContaining({
                    registryId: 'reg123',
                    remainingRefs: 2,
                }),
            );
        });

        it('handles channel not found gracefully', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'invalid-channel' }],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(0);
            vi.mocked(mockClient.channels!.fetch as any).mockResolvedValue(null);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('test.txt');
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
        });

        it('handles message already deleted (Discord error 10008)', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(0);

            const discordError = new Error('Unknown Message');
            (discordError as any).code = DISCORD_ERROR_CODES.MESSAGE_NOT_FOUND;
            vi.mocked(mockChannel.messages!.fetch as any).mockRejectedValue(discordError);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('test.txt');
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
        });

        it('handles partial deletion failure', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                    { mId: 'msg3', cId: 'ch1' },
                ],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(0);

            let callCount = 0;
            vi.mocked(mockChannel.messages!.fetch as any).mockImplementation(() => {
                callCount++;
                if (callCount === 2) {
                    throw new Error('Network error');
                }
                return Promise.resolve(mockMessage);
            });

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('test.txt');
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
        });

        it('deletes file from registry even if all chunks fail', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(0);
            vi.mocked(mockChannel.messages!.fetch as any).mockRejectedValue(
                new Error('Discord API error'),
            );

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('test.txt');
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
        });

        it('handles file with no chunks', async () => {
            const mockFile = {
                id: 'file123',
                name: 'empty.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 0,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(0);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('empty.txt');
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
            expect(mockChannel.messages!.delete).not.toHaveBeenCalled();
        });

        it('uses queue for sequential deletion', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(0);

            await deleteFile(mockClient as Client, 'file123');

            expect(mockQueueAdd).toHaveBeenCalledTimes(2);
        });
    });

    describe('deleteFile with deduplication', () => {
        it('deletes Discord chunks when refCount reaches 0 (last reference)', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(0);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('test.txt');
            expect(mockChannel.messages!.delete).toHaveBeenCalledTimes(2);
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
            expect(mockRepository.deleteChunkRegistry).toHaveBeenCalledWith('reg123');
            expect(logger.info).toHaveBeenCalledWith(
                'Deleting Discord chunks (last reference)',
                expect.objectContaining({
                    registryId: 'reg123',
                }),
            );
            expect(logger.success).toHaveBeenCalledWith(
                'File deletion completed',
                expect.objectContaining({
                    chunksDeleted: true,
                }),
            );
        });

        it('skips Discord chunk deletion when refCount > 0 (other references exist)', async () => {
            const mockFile = {
                id: 'file123',
                name: 'duplicate.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                refCount: 3,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(2);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('duplicate.txt');
            expect(mockChannel.messages!.delete).not.toHaveBeenCalled();
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
            expect(mockRepository.decrementChunkRegistryRefCount).toHaveBeenCalledWith('reg123');
            expect(mockRepository.deleteChunkRegistry).not.toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalledWith(
                'Chunk registry retained (other files reference it)',
                expect.objectContaining({
                    registryId: 'reg123',
                    remainingRefs: 2,
                }),
            );
            expect(logger.success).toHaveBeenCalledWith(
                'File deletion completed',
                expect.objectContaining({
                    chunksDeleted: false,
                }),
            );
        });

        it('deletes chunks when refCount is exactly 1', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(0);

            await deleteFile(mockClient as Client, 'file123');

            expect(mockChannel.messages!.delete).toHaveBeenCalledTimes(1);
            expect(logger.info).toHaveBeenCalledWith(
                'Deleting Discord chunks (last reference)',
                expect.any(Object),
            );
        });

        it('logs refCount information during deletion', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                hash: 'abc123',
                chunkRegistryId: 'reg123',
                size: 1024,
                uploadedAt: new Date().toISOString(),
            };

            const mockRegistry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 5,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            mockRepository.getChunkRegistry.mockResolvedValue(mockRegistry);
            mockRepository.decrementChunkRegistryRefCount.mockResolvedValue(4);

            await deleteFile(mockClient as Client, 'file123');

            expect(logger.info).toHaveBeenCalledWith(
                'Starting file deletion',
                expect.objectContaining({
                    registryId: 'reg123',
                    currentRefCount: 5,
                }),
            );
        });
    });
});
