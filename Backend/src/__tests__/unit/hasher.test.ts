import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import { Readable } from 'stream';
import crypto from 'crypto';

vi.mock('../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'mongodb', mongoUri: 'mongodb://localhost:27017/test', jsonPath: '' },
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
        createReadStream: vi.fn(),
    },
}));

import { calculateHash, createVerificationStream } from '../../utils/hasher.js';
import logger from '../../utils/logger.js';

describe('hasher', () => {
    describe('calculateHash', () => {
        it('calculates SHA-256 hash of file', async () => {
            const testData = 'Hello, World!';
            const mockStream = Readable.from([testData]);
            vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any);

            const hash = await calculateHash('/test/file.txt');

            expect(hash).toBeDefined();
            expect(hash).toHaveLength(64);
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });

        it('produces consistent hash for same data', async () => {
            const testData = 'Consistent data';
            const expectedHash = crypto.createHash('sha256').update(testData).digest('hex');

            const mockStream1 = Readable.from([testData]);
            vi.mocked(fs.createReadStream).mockReturnValueOnce(mockStream1 as any);
            const hash1 = await calculateHash('/test/file1.txt');

            const mockStream2 = Readable.from([testData]);
            vi.mocked(fs.createReadStream).mockReturnValueOnce(mockStream2 as any);
            const hash2 = await calculateHash('/test/file2.txt');

            expect(hash1).toBe(hash2);
            expect(hash1).toBe(expectedHash);
        });

        it('produces different hashes for different data', async () => {
            const mockStream1 = Readable.from(['data1']);
            vi.mocked(fs.createReadStream).mockReturnValueOnce(mockStream1 as any);
            const hash1 = await calculateHash('/test/file1.txt');

            const mockStream2 = Readable.from(['data2']);
            vi.mocked(fs.createReadStream).mockReturnValueOnce(mockStream2 as any);
            const hash2 = await calculateHash('/test/file2.txt');

            expect(hash1).not.toBe(hash2);
        });

        it('rejects on file read error', async () => {
            const mockStream = new Readable({
                read() {
                    this.emit('error', new Error('File not found'));
                },
            });
            vi.mocked(fs.createReadStream).mockReturnValue(mockStream as any);

            await expect(calculateHash('/nonexistent/file.txt')).rejects.toThrow('File not found');
        });
    });

    describe('createVerificationStream', () => {
        it('creates a transform stream', () => {
            const stream = createVerificationStream('abc123', 'test.txt');
            expect(stream).toBeDefined();
            expect(typeof stream.write).toBe('function');
            expect(typeof stream.end).toBe('function');
        });

        it('passes data through unchanged', async () => {
            const testData = Buffer.from('Test data');
            const stream = createVerificationStream('dummy-hash', 'test.txt');
            const chunks: Buffer[] = [];

            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.write(testData);
            stream.end();

            await new Promise((resolve) => stream.on('end', resolve));

            const result = Buffer.concat(chunks);
            expect(result).toEqual(testData);
        });

        it('logs success when hash matches', async () => {
            vi.clearAllMocks();
            const testData = Buffer.from('Test data');
            const expectedHash = crypto.createHash('sha256').update(testData).digest('hex');
            const stream = createVerificationStream(expectedHash, 'test.txt');

            stream.write(testData);
            stream.end();
            await new Promise((resolve) => stream.on('finish', resolve));

            expect(logger.success).toHaveBeenCalledWith(
                'Integrity verification passed',
                expect.objectContaining({
                    fileName: 'test.txt',
                    hash: expectedHash,
                }),
            );
        });

        it('logs error when hash does not match', async () => {
            vi.clearAllMocks();
            const testData = Buffer.from('Test data');
            const wrongHash = 'a'.repeat(64);
            const stream = createVerificationStream(wrongHash, 'test.txt');

            stream.write(testData);
            stream.end();
            await new Promise((resolve) => stream.on('finish', resolve));

            expect(logger.error).toHaveBeenCalledWith(
                'Integrity verification failed - CORRUPTION DETECTED',
                undefined,
                expect.objectContaining({
                    fileName: 'test.txt',
                    expectedHash: wrongHash,
                }),
            );
        });
    });
});
