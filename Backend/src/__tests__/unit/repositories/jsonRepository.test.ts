import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';

vi.mock('../../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'json', mongoUri: null, jsonPath: './data/test-registry.json' },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test', channels: ['123', '456'] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
    channels: ['123', '456'],
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

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
    },
}));

describe('jsonRepository', () => {
    let repository: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        vi.mocked(fs.writeFileSync).mockImplementation(() => {});

        const module = await import('../../../repositories/jsonRepository.js');
        repository = module.default;
    });

    describe('connect', () => {
        it('initializes JSON repository successfully', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            await repository.connect();

            expect(fs.existsSync).toHaveBeenCalled();
        });
    });

    describe('saveFile', () => {
        it('saves file to JSON registry', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

            const fileData = {
                id: 'test123',
                name: 'test.txt',
                hash: 'abc123',
                chunks: [],
                size: 1024,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            await repository.saveFile(fileData);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                './data/test-registry.json',
                expect.stringContaining('test123'),
            );
        });

        it('creates directory if it does not exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

            const fileData = {
                id: 'test123',
                name: 'test.txt',
                hash: 'abc123',
                chunks: [],
                size: 1024,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            await repository.saveFile(fileData);

            expect(fs.mkdirSync).toHaveBeenCalled();
        });

        it('handles corrupted JSON by returning empty registry', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json');

            const fileData = {
                id: 'test123',
                name: 'test.txt',
                hash: 'abc123',
                chunks: [],
                size: 1024,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            await expect(repository.saveFile(fileData)).resolves.not.toThrow();
        });

        it('throws error when write fails', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));
            vi.mocked(fs.writeFileSync).mockImplementation(() => {
                throw new Error('ENOSPC: no space left on device');
            });

            const fileData = {
                id: 'test123',
                name: 'test.txt',
                hash: 'abc123',
                chunks: [],
                size: 1024,
                compressed: true,
                uploadedAt: new Date().toISOString(),
            };

            await expect(repository.saveFile(fileData)).rejects.toThrow('ENOSPC');
        });
    });

    describe('getFile', () => {
        it('retrieves file from JSON registry', async () => {
            const mockRegistry = {
                test123: {
                    name: 'test.txt',
                    hash: 'abc123',
                    chunks: [],
                    size: 1024,
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockRegistry));

            const file = await repository.getFile('test123');

            expect(file).toEqual(
                expect.objectContaining({
                    id: 'test123',
                    name: 'test.txt',
                }),
            );
        });

        it('returns null when file not found', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

            const file = await repository.getFile('nonexistent');

            expect(file).toBeNull();
        });

        it('handles corrupted JSON by returning null', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('corrupted');

            const file = await repository.getFile('test123');
            expect(file).toBeNull();
        });
    });

    describe('listFiles', () => {
        it('lists all files from JSON registry', async () => {
            const mockRegistry = {
                file1: { name: 'test1.txt' },
                file2: { name: 'test2.txt' },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockRegistry));

            const files = await repository.listFiles();

            expect(files).toHaveLength(2);
            expect(files[0].id).toBe('file1');
            expect(files[1].id).toBe('file2');
        });

        it('returns empty array when registry is empty', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({}));

            const files = await repository.listFiles();

            expect(files).toEqual([]);
        });
    });

    describe('deleteFile', () => {
        it('deletes file from JSON registry', async () => {
            const mockRegistry = {
                test123: { name: 'test.txt' },
                test456: { name: 'test2.txt' },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockRegistry));

            await repository.deleteFile('test123');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                './data/test-registry.json',
                expect.not.stringContaining('test123'),
            );
        });

        it('throws error when write fails during delete', async () => {
            const mockRegistry = {
                test123: { name: 'test.txt' },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockRegistry));
            vi.mocked(fs.writeFileSync).mockImplementation(() => {
                throw new Error('ENOSPC: no space left on device');
            });

            await expect(repository.deleteFile('test123')).rejects.toThrow('ENOSPC');
        });

        it('does not fail when deleting non-existent file', async () => {
            const mockRegistry = {
                test456: { name: 'test2.txt' },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockRegistry));

            await expect(repository.deleteFile('nonexistent')).resolves.not.toThrow();
        });
    });

    describe('getChunkRegistryByHash', () => {
        it('retrieves chunk registry by hash from JSON registry', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg1: { hash: 'abc123', chunks: [], refCount: 1, compressed: true, createdAt: '2024-01-01' },
                    reg2: { hash: 'def456', chunks: [], refCount: 1, compressed: true, createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            const registry = await repository.getChunkRegistryByHash('abc123');

            expect(registry).toEqual(
                expect.objectContaining({
                    id: 'reg1',
                    hash: 'abc123',
                }),
            );
        });

        it('returns null when hash not found', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg1: { hash: 'abc123', chunks: [], refCount: 1, compressed: true, createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            const registry = await repository.getChunkRegistryByHash('nonexistent-hash');

            expect(registry).toBeNull();
        });
    });

    describe('incrementChunkRegistryRefCount', () => {
        it('increments refCount for existing chunk registry', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg123: { hash: 'abc123', chunks: [], refCount: 1, compressed: true, createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            await repository.incrementChunkRegistryRefCount('reg123');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                './data/test-registry.json',
                expect.stringContaining('"refCount": 2'),
            );
        });

        it('initializes refCount to 2 when undefined', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg123: { hash: 'abc123', chunks: [], compressed: true, createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            await repository.incrementChunkRegistryRefCount('reg123');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                './data/test-registry.json',
                expect.stringContaining('"refCount": 2'),
            );
        });

        it('throws error when registry not found', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ files: {}, chunkRegistry: {} }));

            await expect(repository.incrementChunkRegistryRefCount('nonexistent')).rejects.toThrow(
                'Chunk registry nonexistent not found',
            );
        });
    });

    describe('decrementChunkRegistryRefCount', () => {
        it('decrements refCount for existing chunk registry', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg123: { hash: 'abc123', chunks: [], refCount: 2, compressed: true, createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            const newRefCount = await repository.decrementChunkRegistryRefCount('reg123');

            expect(newRefCount).toBe(1);
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                './data/test-registry.json',
                expect.stringContaining('"refCount": 1'),
            );
        });

        it('does not go below 0', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg123: { hash: 'abc123', chunks: [], refCount: 0, compressed: true, createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            const newRefCount = await repository.decrementChunkRegistryRefCount('reg123');

            expect(newRefCount).toBe(0);
        });

        it('throws error when registry not found', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ files: {}, chunkRegistry: {} }));

            await expect(repository.decrementChunkRegistryRefCount('nonexistent')).rejects.toThrow(
                'Chunk registry nonexistent not found',
            );
        });
    });

    describe('saveChunkRegistry', () => {
        it('saves chunk registry to JSON', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {},
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            const registry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [{ mId: 'msg1', cId: 'ch1' }],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            await repository.saveChunkRegistry(registry);

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                './data/test-registry.json',
                expect.stringContaining('reg123'),
            );
        });

        it('throws error when write fails', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {},
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));
            vi.mocked(fs.writeFileSync).mockImplementation(() => {
                throw new Error('ENOSPC: no space left on device');
            });

            const registry = {
                id: 'reg123',
                hash: 'abc123',
                chunks: [],
                refCount: 1,
                compressed: true,
                createdAt: new Date().toISOString(),
            };

            await expect(repository.saveChunkRegistry(registry)).rejects.toThrow('ENOSPC');
        });
    });

    describe('updateChunkRegistryData', () => {
        it('updates chunk registry data in JSON', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg123: { hash: 'abc123', chunks: [{ mId: 'old', cId: 'old' }], refCount: 2, compressed: true, encryptionKeyId: 'v1', createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            const newChunks = [{ mId: 'new-msg1', cId: 'new-ch1' }];
            await repository.updateChunkRegistryData('reg123', newChunks, 'v2');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                './data/test-registry.json',
                expect.stringContaining('new-msg1'),
            );
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                './data/test-registry.json',
                expect.stringContaining('"refCount": 2'),
            );
        });

        it('throws error when registry not found', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {},
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            const chunks = [{ mId: 'new-msg1', cId: 'new-ch1' }];
            await expect(
                repository.updateChunkRegistryData('nonexistent', chunks, 'v2'),
            ).rejects.toThrow('Chunk registry nonexistent not found');
        });
    });

    describe('getChunkRegistry', () => {
        it('retrieves chunk registry from JSON', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg123: { hash: 'abc123', chunks: [], refCount: 1, compressed: true, createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            const registry = await repository.getChunkRegistry('reg123');

            expect(registry).toEqual(
                expect.objectContaining({
                    id: 'reg123',
                    hash: 'abc123',
                }),
            );
        });

        it('returns null when registry not found', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {},
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            const registry = await repository.getChunkRegistry('nonexistent');

            expect(registry).toBeNull();
        });

        it('handles corrupted JSON by returning null', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue('corrupted');

            const registry = await repository.getChunkRegistry('reg123');

            expect(registry).toBeNull();
        });
    });

    describe('deleteChunkRegistry', () => {
        it('deletes chunk registry from JSON', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg123: { hash: 'abc123', chunks: [], refCount: 1, compressed: true, createdAt: '2024-01-01' },
                    reg456: { hash: 'def456', chunks: [], refCount: 1, compressed: true, createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            await repository.deleteChunkRegistry('reg123');

            expect(fs.writeFileSync).toHaveBeenCalledWith(
                './data/test-registry.json',
                expect.not.stringContaining('reg123'),
            );
        });

        it('does not fail when deleting non-existent registry', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg456: { hash: 'def456', chunks: [], refCount: 1, compressed: true, createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));

            await expect(repository.deleteChunkRegistry('nonexistent')).resolves.not.toThrow();
        });

        it('throws error when write fails during delete', async () => {
            const mockStore = {
                files: {},
                chunkRegistry: {
                    reg123: { hash: 'abc123', chunks: [], refCount: 1, compressed: true, createdAt: '2024-01-01' },
                },
            };

            vi.mocked(fs.existsSync).mockReturnValue(true);
            vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockStore));
            vi.mocked(fs.writeFileSync).mockImplementation(() => {
                throw new Error('ENOSPC: no space left on device');
            });

            await expect(repository.deleteChunkRegistry('reg123')).rejects.toThrow('ENOSPC');
        });
    });
});
