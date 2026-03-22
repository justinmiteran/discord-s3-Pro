import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../../config/index.js', () => ({
    security: {
        jwtSecret: 'test-secret-key-32-characters!!',
        encryptionKey: Buffer.alloc(32, 'a'),
    },
    database: { type: 'mongodb', mongoUri: 'mongodb://localhost:27017/test', jsonPath: '' },
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

import { encryptBuffer, decryptBuffer } from '../../../pipeline/encryptStream.js';
import { EncryptionError } from '../../../utils/errors/AppError.js';

describe('encryptStream', () => {
    describe('encryptBuffer', () => {
        it('encrypts buffer successfully', () => {
            const testData = Buffer.from('Hello, World!');
            const encrypted = encryptBuffer(testData);

            expect(encrypted).toBeInstanceOf(Buffer);
            expect(encrypted.length).toBeGreaterThan(testData.length);
            expect(encrypted).not.toEqual(testData);
        });

        it('produces different ciphertext for same plaintext due to random IV', () => {
            const testData = Buffer.from('Same data');
            const encrypted1 = encryptBuffer(testData);
            const encrypted2 = encryptBuffer(testData);

            expect(encrypted1).not.toEqual(encrypted2);
        });

        it('handles empty buffer', () => {
            const empty = Buffer.from('');
            const encrypted = encryptBuffer(empty);

            expect(encrypted).toBeInstanceOf(Buffer);
            expect(encrypted.length).toBeGreaterThan(0);
        });
    });

    describe('decryptBuffer', () => {
        it('decrypts encrypted buffer correctly', () => {
            const originalData = Buffer.from('Secret message');
            const encrypted = encryptBuffer(originalData);
            const decrypted = decryptBuffer(encrypted);

            expect(decrypted).toEqual(originalData);
            expect(decrypted.toString()).toBe('Secret message');
        });

        it('throws EncryptionError for invalid encrypted data', () => {
            const invalidData = Buffer.from('not encrypted data');
            expect(() => decryptBuffer(invalidData)).toThrow(EncryptionError);
        });

        it('throws EncryptionError for truncated data', () => {
            const original = Buffer.from('test');
            const encrypted = encryptBuffer(original);
            const truncated = encrypted.subarray(0, 10);

            expect(() => decryptBuffer(truncated)).toThrow(EncryptionError);
        });

        it('throws EncryptionError for tampered ciphertext', () => {
            const original = Buffer.from('test');
            const encrypted = encryptBuffer(original);
            encrypted[20] ^= 0xff;

            expect(() => decryptBuffer(encrypted)).toThrow(EncryptionError);
        });
    });

    describe('encryption/decryption round-trip', () => {
        it('handles various data sizes correctly', () => {
            const testCases = [
                Buffer.from(''),
                Buffer.from('a'),
                Buffer.from('Short text'),
                Buffer.from('a'.repeat(1000)),
                Buffer.from('a'.repeat(10000)),
                Buffer.from(new Uint8Array([0, 1, 2, 255, 254, 253])),
            ];

            testCases.forEach((testData) => {
                const encrypted = encryptBuffer(testData);
                const decrypted = decryptBuffer(encrypted);
                expect(decrypted).toEqual(testData);
            });
        });
    });
});
