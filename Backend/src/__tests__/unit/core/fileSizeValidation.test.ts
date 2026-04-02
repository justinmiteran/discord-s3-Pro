import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileTooLargeError } from '../../../utils/errors/AppError.js';

vi.mock('fs');
vi.mock('../../../core/database.js');
vi.mock('../../../utils/hasher.js');
vi.mock('../../../core/queueManager.js');
vi.mock('../../../core/discord/channelPool.js');
vi.mock('../../../config/index.js', () => ({
    server: {
        port: 3000,
        chunkSize: 8388608,
        maxFileSize: 10485760, // 10 MB for testing
    },
    discord: { token: 'test', channels: ['123'] },
    database: { type: 'json', mongoUri: null, jsonPath: '' },
    auth: { mongoUri: 'mongodb://test' },
    security: { encryptionKey: Buffer.alloc(32), jwtSecret: 'test' },
}));

describe('File Size Validation', () => {
    it('should create FileTooLargeError with correct message', () => {
        const fileSize = 20 * 1024 * 1024; // 20 MB
        const maxSize = 10 * 1024 * 1024; // 10 MB
        
        const error = new FileTooLargeError(fileSize, maxSize);
        
        expect(error.statusCode).toBe(413);
        expect(error.message).toContain('20.00 MB');
        expect(error.message).toContain('10.00 MB');
        expect(error.message).toContain('exceeds maximum allowed size');
    });

    it('should format file sizes correctly', () => {
        const error = new FileTooLargeError(1048576, 524288); // 1 MB vs 0.5 MB
        
        expect(error.message).toContain('1.00 MB');
        expect(error.message).toContain('0.50 MB');
    });
});
