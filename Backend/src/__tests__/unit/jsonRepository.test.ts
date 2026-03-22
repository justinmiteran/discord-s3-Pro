import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';

vi.mock('../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'json', mongoUri: null, jsonPath: './data/test-registry.json' },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test', channels: ['123', '456'] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
    channels: ['123', '456'],
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

        const module = await import('../../repositories/jsonRepository.js');
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
});
