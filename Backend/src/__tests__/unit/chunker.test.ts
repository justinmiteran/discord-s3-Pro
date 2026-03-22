import { vi, describe, it, expect } from 'vitest';

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

import { ChunkSplitter } from '../../pipeline/chunker.js';
import logger from '../../utils/logger.js';

describe('chunker', () => {
    describe('ChunkSplitter', () => {
        it('splits data into chunks of specified size', async () => {
            const chunkSize = 10;
            const splitter = new ChunkSplitter(chunkSize);
            const chunks: Buffer[] = [];

            splitter.on('data', (chunk: Buffer) => chunks.push(chunk));

            const testData = Buffer.from('a'.repeat(25));
            splitter.write(testData);
            splitter.end();

            await new Promise((resolve) => splitter.on('end', resolve));

            expect(chunks.length).toBe(3);
            expect(chunks[0].length).toBe(10);
            expect(chunks[1].length).toBe(10);
            expect(chunks[2].length).toBe(5);
        });

        it('handles data smaller than chunk size', async () => {
            const chunkSize = 100;
            const splitter = new ChunkSplitter(chunkSize);
            const chunks: Buffer[] = [];

            splitter.on('data', (chunk: Buffer) => chunks.push(chunk));

            const testData = Buffer.from('small data');
            splitter.write(testData);
            splitter.end();

            await new Promise((resolve) => splitter.on('end', resolve));

            expect(chunks.length).toBe(1);
            expect(chunks[0].length).toBe(10);
        });

        it('handles exact chunk size multiples', async () => {
            const chunkSize = 10;
            const splitter = new ChunkSplitter(chunkSize);
            const chunks: Buffer[] = [];

            splitter.on('data', (chunk: Buffer) => chunks.push(chunk));

            const testData = Buffer.from('a'.repeat(20));
            splitter.write(testData);
            splitter.end();

            await new Promise((resolve) => splitter.on('end', resolve));

            expect(chunks.length).toBe(2);
            expect(chunks[0].length).toBe(10);
            expect(chunks[1].length).toBe(10);
        });

        it('handles multiple writes before end', async () => {
            const chunkSize = 10;
            const splitter = new ChunkSplitter(chunkSize);
            const chunks: Buffer[] = [];

            splitter.on('data', (chunk: Buffer) => chunks.push(chunk));

            splitter.write(Buffer.from('12345'));
            splitter.write(Buffer.from('67890'));
            splitter.write(Buffer.from('ABCDE'));
            splitter.end();

            await new Promise((resolve) => splitter.on('end', resolve));

            expect(chunks.length).toBe(2);
            expect(chunks[0].toString()).toBe('1234567890');
            expect(chunks[1].toString()).toBe('ABCDE');
        });

        it('tracks processed chunks count', async () => {
            const chunkSize = 10;
            const splitter = new ChunkSplitter(chunkSize);
            const chunks: Buffer[] = [];

            splitter.on('data', (chunk: Buffer) => chunks.push(chunk));

            const testData = Buffer.from('a'.repeat(25));
            splitter.write(testData);
            splitter.end();

            await new Promise((resolve) => splitter.on('finish', resolve));

            expect(splitter.processedChunks).toBe(3);
        });

        it('handles empty data', async () => {
            const chunkSize = 10;
            const splitter = new ChunkSplitter(chunkSize);
            const chunks: Buffer[] = [];

            splitter.on('data', (chunk: Buffer) => chunks.push(chunk));

            splitter.end();

            await new Promise((resolve) => splitter.on('end', resolve));

            expect(chunks.length).toBe(0);
            expect(splitter.processedChunks).toBe(0);
        });

        it('emits error when transform fails', async () => {
            const chunkSize = 10;
            const splitter = new ChunkSplitter(chunkSize);
            const errorHandler = vi.fn();

            splitter.on('error', errorHandler);

            // Force an error by passing invalid data type
            (splitter as any)._transform(null, 'utf8', (err: Error) => {
                expect(err).toBeDefined();
            });
        });
    });
});
