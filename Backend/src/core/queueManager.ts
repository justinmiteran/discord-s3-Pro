import logger from '../utils/logger.js';
import { toError } from '../utils/errors/AppError.js';
import { QUEUE } from '../constants/index.js';

interface QueueTask<T = any> {
    task: () => Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
}

/**
 * Manages sequential task execution with rate limiting
 * Ensures Discord API calls are properly queued and rate limits are respected
 */
class QueueManager {
    private queue: QueueTask[] = [];
    private processing: boolean = false;
    private totalTasksHandled: number = 0;
    private rateLimitHits: number = 0;

    /**
     * Adds a new task to the execution queue
     * @param task - Async function to execute
     * @returns Promise that resolves with the task result
     */
    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });

            if (this.queue.length > 10) {
                logger.warn('Queue size growing', {
                    queueSize: this.queue.length,
                    totalHandled: this.totalTasksHandled,
                });
            } else {
                logger.debug('Task added to queue', {
                    queueSize: this.queue.length,
                });
            }

            this.process();
        });
    }

    /**
     * Processes the next task in the queue with rate limit handling
     */
    private async process(): Promise<void> {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const item = this.queue.shift();
        if (!item) {
            this.processing = false;
            return;
        }

        const { task, resolve, reject } = item;
        const startTime = Date.now();

        try {
            const result = await task();
            this.totalTasksHandled++;
            const duration = Date.now() - startTime;

            if (result && (result as any).headers) {
                const remaining = (result as any).headers['x-ratelimit-remaining'];
                const limit = (result as any).headers['x-ratelimit-limit'];

                if (remaining === '0') {
                    this.rateLimitHits++;
                    const resetAfter =
                        (parseInt((result as any).headers['x-ratelimit-reset-after']) || 1) * 1000;

                    logger.warn('Rate limit hit', {
                        resetAfter,
                        totalHits: this.rateLimitHits,
                        queueSize: this.queue.length,
                    });

                    await new Promise((r) => setTimeout(r, resetAfter));
                } else if (parseInt(remaining) < 5) {
                    logger.debug('Rate limit approaching', {
                        remaining,
                        limit,
                    });
                }
            }

            logger.debug('Task completed', {
                duration,
                queueSize: this.queue.length,
                totalHandled: this.totalTasksHandled,
            });

            resolve(result);
        } catch (error: unknown) {
            logger.error('Queue task failed', toError(error), {
                queueSize: this.queue.length,
                totalHandled: this.totalTasksHandled,
            });
            reject(toError(error));
        } finally {
            this.processing = false;

            if (this.queue.length === 0 && this.totalTasksHandled > 0) {
                logger.debug('Queue emptied', {
                    totalHandled: this.totalTasksHandled,
                    rateLimitHits: this.rateLimitHits,
                });
            }

            setTimeout(() => this.process(), QUEUE.RATE_LIMIT_DELAY);
        }
    }

    /**
     * Returns the current queue size
     */
    public get length(): number {
        return this.queue.length;
    }

    /**
     * Returns queue statistics
     */
    public getStats() {
        return {
            queueSize: this.queue.length,
            totalHandled: this.totalTasksHandled,
            rateLimitHits: this.rateLimitHits,
            isProcessing: this.processing,
        };
    }
}

export default new QueueManager();
