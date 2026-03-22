import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Client, TextChannel, Message, Collection } from 'discord.js';

vi.mock('../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'mongodb', mongoUri: null, jsonPath: '' },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test', channels: ['ch1', 'ch2'] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
    channels: ['ch1', 'ch2'],
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

const mockGetRepository = vi.fn();
vi.mock('../../core/database.js', () => ({
    getRepository: () => mockGetRepository(),
}));

const mockQueueAdd = vi.fn();
vi.mock('../../core/queueManager.js', () => ({
    default: { add: (fn: any) => mockQueueAdd(fn) },
}));

import { deleteFile } from '../../core/storage/deleter.js';
import { NotFoundError } from '../../utils/errors/AppError.js';
import { DISCORD_ERROR_CODES } from '../../constants/index.js';
import logger from '../../utils/logger.js';

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
            deleteFile: vi.fn().mockResolvedValue(undefined),
        };

        mockGetRepository.mockReturnValue(mockRepository);
        mockQueueAdd.mockImplementation((fn) => fn());
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

        it('deletes file with all chunks successfully', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                hash: 'abc123',
                size: 1024,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('test.txt');
            expect(mockMessage.delete).toHaveBeenCalledTimes(2);
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
            expect(logger.success).toHaveBeenCalledWith(
                'File deletion completed',
                expect.objectContaining({
                    fileId: 'file123',
                    fileName: 'test.txt',
                    deletedChunks: 2,
                    failedChunks: 0,
                    totalChunks: 2,
                }),
            );
        });

        it('handles channel not found gracefully', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                chunks: [{ mId: 'msg1', cId: 'invalid-channel' }],
                hash: 'abc123',
                size: 1024,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            vi.mocked(mockClient.channels!.fetch as any).mockResolvedValue(null);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('test.txt');
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
            expect(logger.warn).toHaveBeenCalledWith(
                'Channel not found for chunk deletion',
                expect.objectContaining({
                    channelId: 'invalid-channel',
                    messageId: 'msg1',
                }),
            );
            expect(logger.success).toHaveBeenCalledWith(
                'File deletion completed',
                expect.objectContaining({
                    deletedChunks: 0,
                    failedChunks: 1,
                }),
            );
        });

        it('handles message already deleted (Discord error 10008)', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                hash: 'abc123',
                size: 1024,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);

            const discordError = new Error('Unknown Message');
            (discordError as any).code = DISCORD_ERROR_CODES.MESSAGE_NOT_FOUND;
            vi.mocked(mockChannel.messages!.fetch as any).mockRejectedValue(discordError);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('test.txt');
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
            expect(logger.debug).toHaveBeenCalledWith(
                'Chunk already deleted',
                expect.objectContaining({ messageId: 'msg1' }),
            );
            expect(logger.success).toHaveBeenCalledWith(
                'File deletion completed',
                expect.objectContaining({
                    deletedChunks: 1,
                    failedChunks: 0,
                }),
            );
        });

        it('handles partial deletion failure', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                    { mId: 'msg3', cId: 'ch1' },
                ],
                hash: 'abc123',
                size: 1024,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);

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
            expect(logger.warn).toHaveBeenCalledWith(
                'Chunk deletion failed',
                expect.objectContaining({
                    messageId: 'msg2',
                    error: 'Network error',
                }),
            );
            expect(logger.success).toHaveBeenCalledWith(
                'File deletion completed',
                expect.objectContaining({
                    deletedChunks: 2,
                    failedChunks: 1,
                    totalChunks: 3,
                }),
            );
        });

        it('deletes file from registry even if all chunks fail', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                hash: 'abc123',
                size: 1024,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);
            vi.mocked(mockChannel.messages!.fetch as any).mockRejectedValue(
                new Error('Discord API error'),
            );

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('test.txt');
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
            expect(logger.success).toHaveBeenCalledWith(
                'File deletion completed',
                expect.objectContaining({
                    deletedChunks: 0,
                    failedChunks: 2,
                }),
            );
        });

        it('handles file with no chunks', async () => {
            const mockFile = {
                id: 'file123',
                name: 'empty.txt',
                chunks: [],
                hash: 'abc123',
                size: 0,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);

            const fileName = await deleteFile(mockClient as Client, 'file123');

            expect(fileName).toBe('empty.txt');
            expect(mockRepository.deleteFile).toHaveBeenCalledWith('file123');
            expect(mockMessage.delete).not.toHaveBeenCalled();
            expect(logger.success).toHaveBeenCalledWith(
                'File deletion completed',
                expect.objectContaining({
                    deletedChunks: 0,
                    failedChunks: 0,
                    totalChunks: 0,
                }),
            );
        });

        it('uses queue for sequential deletion', async () => {
            const mockFile = {
                id: 'file123',
                name: 'test.txt',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                hash: 'abc123',
                size: 1024,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            mockRepository.getFile.mockResolvedValue(mockFile);

            await deleteFile(mockClient as Client, 'file123');

            expect(mockQueueAdd).toHaveBeenCalledTimes(2);
        });
    });
});
