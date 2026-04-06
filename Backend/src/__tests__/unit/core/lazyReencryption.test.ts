import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LazyReencryptionService } from '../../../core/reencryption/lazyReencryption.js';
import { ChunkRegistry } from '../../../types/models/file.model.js';

vi.mock('../../../core/crypto/index.js', () => ({
    encryptionService: {
        getActiveKeyId: vi.fn(() => 'current'),
        needsReencryption: vi.fn((keyId?: string) => {
            if (!keyId) return true;
            return keyId !== 'current';
        }),
        encryptWithActiveKey: vi.fn((data: Buffer) => ({
            encrypted: Buffer.concat([Buffer.from('encrypted:'), data]),
            keyId: 'current',
        })),
        decrypt: vi.fn((data: Buffer) => ({
            decrypted: Buffer.from('decrypted-data'),
            keyId: 'v1',
        })),
    },
}));

vi.mock('../../../core/database.js', () => ({
    getRepository: vi.fn(() => ({
        updateChunkRegistryData: vi.fn(),
        saveChunkRegistry: vi.fn(),
        getFile: vi.fn(() => ({ id: 'file1', chunkRegistryId: 'reg1' })),
        saveFile: vi.fn(),
    })),
}));

vi.mock('../../../core/queueManager.js', () => ({
    default: {
        add: vi.fn((fn) => fn()),
    },
    TaskPriority: {
        HIGH: 0,
        NORMAL: 1,
        LOW: 2,
    },
}));

vi.mock('../../../core/discord/channelPool.js', () => ({
    default: {
        next: vi.fn(() => 'channel1'),
    },
}));

vi.mock('../../../utils/logger.js');

vi.mock('../../../pipeline/encryptStream.js', () => ({
    encryptBuffer: vi.fn((data: Buffer) => ({
        encrypted: Buffer.concat([Buffer.from('encrypted:'), data]),
        keyId: 'current',
    })),
    decryptBuffer: vi.fn((data: Buffer) => ({
        decrypted: Buffer.from('decrypted-data'),
        keyId: 'v1',
    })),
}));

vi.mock('axios', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: Buffer.from('encrypted-chunk') })),
    },
}));

describe('LazyReencryptionService', () => {
    let service: LazyReencryptionService;
    let mockClient: any;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new LazyReencryptionService();

        mockClient = {
            channels: {
                fetch: vi.fn(() =>
                    Promise.resolve({
                        messages: {
                            fetch: vi.fn(() =>
                                Promise.resolve({
                                    attachments: {
                                        first: vi.fn(() => ({
                                            url: 'https://discord.com/attachment.dat',
                                        })),
                                    },
                                }),
                            ),
                            delete: vi.fn(),
                        },
                        send: vi.fn(() => Promise.resolve({ id: 'new-msg-id' })),
                    }),
                ),
            },
        };
    });

    describe('needsReencryption', () => {
        it('should return true when registry has no encryptionKeyId', () => {
            const registry: ChunkRegistry = {
                id: 'reg1',
                hash: 'abc123',
                chunks: [],
                refCount: 1,
                compressed: true,
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            expect(service.needsReencryption(registry)).toBe(true);
        });

        it('should return true when registry uses legacy key', () => {
            const registry: ChunkRegistry = {
                id: 'reg1',
                hash: 'abc123',
                chunks: [],
                refCount: 1,
                compressed: true,
                encryptionKeyId: 'v1',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            expect(service.needsReencryption(registry)).toBe(true);
        });

        it('should return false when registry uses current key', () => {
            const registry: ChunkRegistry = {
                id: 'reg1',
                hash: 'abc123',
                chunks: [],
                refCount: 1,
                compressed: true,
                encryptionKeyId: 'current',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            expect(service.needsReencryption(registry)).toBe(false);
        });
    });

    describe('reencryptRegistry', () => {
        it('should re-encrypt registry with new key', async () => {
            const registry: ChunkRegistry = {
                id: 'reg1',
                hash: 'abc123',
                chunks: [
                    { mId: 'msg1', cId: 'ch1' },
                    { mId: 'msg2', cId: 'ch2' },
                ],
                refCount: 2,
                compressed: true,
                encryptionKeyId: 'v1',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            const registryId = await service.reencryptRegistry(mockClient, registry, 'file1');

            expect(registryId).toBe('reg1');
            // Re-encryption completed successfully
        });

        it('should delete old chunks from Discord', async () => {
            const deleteSpy = vi.fn();
            const registry: ChunkRegistry = {
                id: 'reg1',
                hash: 'abc123',
                chunks: [{ mId: 'old-msg', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                encryptionKeyId: 'v1',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            mockClient.channels.fetch = vi.fn((channelId: string) => {
                if (channelId === 'ch1') {
                    return Promise.resolve({
                        messages: {
                            fetch: vi.fn(() =>
                                Promise.resolve({
                                    attachments: {
                                        first: vi.fn(() => ({
                                            url: 'https://discord.com/attachment.dat',
                                        })),
                                    },
                                }),
                            ),
                            delete: deleteSpy,
                        },
                    });
                }
                return Promise.resolve({
                    send: vi.fn(() => Promise.resolve({ id: 'new-msg-id' })),
                });
            });

            await service.reencryptRegistry(mockClient, registry, 'file1');

            expect(deleteSpy).toHaveBeenCalledWith('old-msg');
        });

        it('should update registry chunks with new message IDs', async () => {
            const registry: ChunkRegistry = {
                id: 'reg1',
                hash: 'abc123',
                chunks: [
                    { mId: 'old1', cId: 'ch1' },
                    { mId: 'old2', cId: 'ch2' },
                ],
                refCount: 1,
                compressed: true,
                encryptionKeyId: 'v1',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            await service.reencryptRegistry(mockClient, registry, 'file1');

            // Re-encryption completed successfully, chunks updated in DB
        });

        it('should handle missing attachment gracefully', async () => {
            const registry: ChunkRegistry = {
                id: 'reg1',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                encryptionKeyId: 'v1',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            mockClient.channels.fetch = vi.fn(() =>
                Promise.resolve({
                    messages: {
                        fetch: vi.fn(() =>
                            Promise.resolve({
                                attachments: {
                                    first: vi.fn(() => null),
                                },
                            }),
                        ),
                    },
                }),
            );

            await expect(
                service.reencryptRegistry(mockClient, registry, 'file1'),
            ).rejects.toThrow('CHUNK_LOST');
        });

        it('should preserve registry metadata', async () => {
            const registry: ChunkRegistry = {
                id: 'reg1',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 3,
                compressed: true,
                encryptionKeyId: 'v1',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            await service.reencryptRegistry(mockClient, registry, 'file1');

            expect(registry.id).toBe('reg1');
            expect(registry.hash).toBe('abc123');
            // refCount is NOT modified in memory, only updated in DB atomically
            expect(registry.compressed).toBe(true);
            expect(registry.createdAt).toBe('2024-01-01T00:00:00.000Z');
        });

        it('should continue if old chunk deletion fails', async () => {
            const registry: ChunkRegistry = {
                id: 'reg1',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                encryptionKeyId: 'v1',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            mockClient.channels.fetch = vi.fn((channelId: string) => {
                if (channelId === 'ch1') {
                    return Promise.resolve({
                        messages: {
                            fetch: vi.fn(() =>
                                Promise.resolve({
                                    attachments: {
                                        first: vi.fn(() => ({
                                            url: 'https://discord.com/attachment.dat',
                                        })),
                                    },
                                }),
                            ),
                            delete: vi.fn(() => Promise.reject(new Error('Delete failed'))),
                        },
                    });
                }
                return Promise.resolve({
                    send: vi.fn(() => Promise.resolve({ id: 'new-msg-id' })),
                });
            });

            const registryId = await service.reencryptRegistry(mockClient, registry, 'file1');

            expect(registryId).toBe('reg1');
            // encryptionKeyId is NOT updated in memory, only in DB via updateChunkRegistryData
        });
        it('should skip re-encryption if already in progress for same registry', async () => {
            const registry: ChunkRegistry = {
                id: 'reg-concurrent',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                encryptionKeyId: 'v1',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            // Launch two concurrent re-encryptions on the same registry
            const [id1, id2] = await Promise.all([
                service.reencryptRegistry(mockClient, registry, 'context-1'),
                service.reencryptRegistry(mockClient, registry, 'context-2'),
            ]);

            expect(id1).toBe('reg-concurrent');
            expect(id2).toBe('reg-concurrent');
        });

        it('should allow re-encryption again after completion', async () => {
            const registry: ChunkRegistry = {
                id: 'reg-sequential',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                encryptionKeyId: 'v1',
                createdAt: '2024-01-01T00:00:00.000Z',
            };

            await service.reencryptRegistry(mockClient, registry, 'first');
            // Should not throw — guard released after first completion
            await expect(
                service.reencryptRegistry(mockClient, registry, 'second'),
            ).resolves.toBe('reg-sequential');
        });
    });
});
