import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'mongodb', mongoUri: 'mongodb://localhost:27017/test', jsonPath: '' },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test', channels: ['channel1', 'channel2', 'channel3'] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
    channels: ['channel1', 'channel2', 'channel3'],
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

describe('ChannelPool', () => {
    let ChannelPool: any;

    beforeEach(async () => {
        vi.resetModules();
        const module = await import('../../core/discord/channelPool.js');
        ChannelPool = module.default;
        (ChannelPool as any).currentIndex = 0;
    });

    describe('round-robin distribution', () => {
        it('returns channels in sequential order', () => {
            expect(ChannelPool.next()).toBe('channel1');
            expect(ChannelPool.next()).toBe('channel2');
            expect(ChannelPool.next()).toBe('channel3');
            expect(ChannelPool.next()).toBe('channel1');
        });

        it('distributes load evenly across all channels', () => {
            const distribution: Record<string, number> = {};

            for (let i = 0; i < 300; i++) {
                const channel = ChannelPool.next();
                distribution[channel] = (distribution[channel] || 0) + 1;
            }

            expect(distribution['channel1']).toBe(100);
            expect(distribution['channel2']).toBe(100);
            expect(distribution['channel3']).toBe(100);
        });

        it('maintains order across many iterations', () => {
            const results: string[] = [];

            for (let i = 0; i < 10; i++) {
                results.push(ChannelPool.next());
            }

            expect(results[0]).toBe('channel1');
            expect(results[3]).toBe('channel1');
            expect(results[6]).toBe('channel1');
            expect(results[9]).toBe('channel1');
        });
    });
});
