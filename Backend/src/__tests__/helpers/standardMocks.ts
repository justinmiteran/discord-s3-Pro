import { vi } from 'vitest';

/**
 * Centralized mock configuration
 * Import this at the TOP of test files BEFORE any other imports
 *
 * Usage:
 * import { mockConfig, mockLogger } from '../helpers/standardMocks.js';
 *
 * vi.mock('../../config/index.js', () => mockConfig);
 * vi.mock('../../utils/logger.js', () => mockLogger);
 */

export const mockConfig = {
    security: {
        jwtSecret: 'test-secret-key-32-characters!!',
        encryptionKey: Buffer.alloc(32),
    },
    database: {
        type: 'mongodb',
        mongoUri: 'mongodb://localhost:27017/test',
        jsonPath: './data/test-registry.json',
    },
    server: {
        port: 3000,
        chunkSize: 8388608,
    },
    discord: {
        token: 'test-token',
        channels: ['ch1', 'ch2', 'ch3'],
    },
    auth: {
        mongoUri: 'mongodb://localhost:27017/test',
    },
    channels: ['ch1', 'ch2', 'ch3'],
};

/**
 * Variant with minimal config for tests that need different settings
 */
export const createMockConfig = (overrides: any = {}) => ({
    ...mockConfig,
    ...overrides,
});
