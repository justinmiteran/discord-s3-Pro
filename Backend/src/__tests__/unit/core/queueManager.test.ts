import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../../config/index.js', () => ({
    security: { jwtSecret: 'test-secret-key-32-characters!!', encryptionKey: Buffer.alloc(32) },
    database: { type: 'mongodb', mongoUri: null, jsonPath: '' },
    server: { port: 3000, chunkSize: 8388608 },
    discord: { token: 'test', channels: [] },
    auth: { mongoUri: 'mongodb://localhost:27017/test' },
}));

vi.mock('../../../utils/logger.js');

describe('queueManager', () => {
    let queueManager: any;
    let logger: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        vi.useFakeTimers();

        const loggerModule = await import('../../../utils/logger.js');
        logger = loggerModule.default;

        const module = await import('../../../core/queueManager.js');
        queueManager = module.default;
        (queueManager as any).queue = [];
        (queueManager as any).processing = false;
        (queueManager as any).totalTasksHandled = 0;
        (queueManager as any).rateLimitHits = 0;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('executes a single task successfully', async () => {
        const task = vi.fn().mockResolvedValue('result');

        const promise = queueManager.add(task);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toBe('result');
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('executes multiple tasks sequentially', async () => {
        const results: number[] = [];
        const task1 = vi.fn(async () => {
            results.push(1);
            return 1;
        });
        const task2 = vi.fn(async () => {
            results.push(2);
            return 2;
        });
        const task3 = vi.fn(async () => {
            results.push(3);
            return 3;
        });

        const promises = Promise.all([
            queueManager.add(task1),
            queueManager.add(task2),
            queueManager.add(task3),
        ]);

        await vi.runAllTimersAsync();
        const [r1, r2, r3] = await promises;

        expect(r1).toBe(1);
        expect(r2).toBe(2);
        expect(r3).toBe(3);
        expect(results).toEqual([1, 2, 3]);
    });

    it('handles task rejection correctly', async () => {
        const error = new Error('Task failed');
        const task = vi.fn().mockRejectedValue(error);

        const promise = queueManager.add(task).catch((e: Error) => e);
        await vi.runAllTimersAsync();

        const result = await promise;
        expect(result).toBeInstanceOf(Error);
        expect(result.message).toBe('Task failed');
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('continues processing after a failed task', async () => {
        const task1 = vi.fn().mockRejectedValue(new Error('Fail'));
        const task2 = vi.fn().mockResolvedValue('success');

        const promise1 = queueManager.add(task1).catch((e: Error) => e);
        const promise2 = queueManager.add(task2);

        await vi.runAllTimersAsync();

        const error = await promise1;
        expect(error.message).toBe('Fail');

        const result = await promise2;
        expect(result).toBe('success');
        expect(task2).toHaveBeenCalledTimes(1);
    });

    it('waits RATE_LIMIT_DELAY between tasks', async () => {
        const task1 = vi.fn().mockResolvedValue('first');
        const task2 = vi.fn().mockResolvedValue('second');

        queueManager.add(task1);
        queueManager.add(task2);

        await vi.advanceTimersByTimeAsync(0);
        expect(task1).toHaveBeenCalledTimes(1);
        expect(task2).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(200);
        expect(task2).toHaveBeenCalledTimes(1);
    });

    it('warns when queue size exceeds 10', async () => {
        vi.clearAllMocks();
        const slowTask = vi
            .fn()
            .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 1000)));

        for (let i = 0; i < 12; i++) {
            queueManager.add(slowTask);
        }

        expect(logger.warn).toHaveBeenCalledWith(
            'Queue size growing',
            expect.objectContaining({
                queueSize: expect.any(Number),
            }),
        );
    });

    it('returns queue statistics', () => {
        const stats = queueManager.getStats();

        expect(stats).toHaveProperty('queueSize');
        expect(stats).toHaveProperty('totalHandled');
        expect(stats).toHaveProperty('rateLimitHits');
        expect(stats).toHaveProperty('isProcessing');
        expect(typeof stats.queueSize).toBe('number');
        expect(typeof stats.totalHandled).toBe('number');
    });

    it('handles rate limit response headers', async () => {
        const taskWithRateLimit = vi.fn().mockResolvedValue({
            headers: {
                'x-ratelimit-remaining': '0',
                'x-ratelimit-limit': '50',
                'x-ratelimit-reset-after': '1',
            },
        });

        const promise = queueManager.add(taskWithRateLimit);
        await vi.runAllTimersAsync();
        await promise;

        const stats = queueManager.getStats();
        expect(stats.rateLimitHits).toBe(1);
        expect(logger.warn).toHaveBeenCalledWith(
            'Rate limit hit',
            expect.objectContaining({
                resetAfter: 1000,
            }),
        );
    });

    it('warns when rate limit is approaching', async () => {
        vi.clearAllMocks();
        const taskWithLowRemaining = vi.fn().mockResolvedValue({
            headers: {
                'x-ratelimit-remaining': '3',
                'x-ratelimit-limit': '50',
            },
        });

        const promise = queueManager.add(taskWithLowRemaining);
        await vi.runAllTimersAsync();
        await promise;

        expect(logger.debug).toHaveBeenCalledWith(
            'Rate limit approaching',
            expect.objectContaining({
                remaining: '3',
                limit: '50',
            }),
        );
    });
});
