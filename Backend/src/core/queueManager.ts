import logger, { startTimer } from '../utils/logger.js';
import { toError } from '../utils/errors/AppError.js';
import { QUEUE } from '../constants/index.js';
import { queue as queueConfig } from '../config/index.js';

export enum TaskPriority {
    HIGH = 0,      // User-facing operations (upload, download)
    NORMAL = 1,    // Regular operations
    LOW = 2,       // Background tasks (re-encryption)
}

interface QueueTask<T = any> {
    task: () => Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
    priority: TaskPriority;
    addedAt: number;
}

/**
 * Manages concurrent task execution with rate limiting
 * Supports configurable concurrency for parallel Discord API calls
 */
class QueueManager {
    private queue: QueueTask[] = [];
    private activeWorkers: number = 0;
    private readonly concurrency: number;
    private totalTasksHandled: number = 0;
    private rateLimitHits: number = 0;

    constructor(concurrency: number = QUEUE.UPLOAD_CONCURRENCY) {
        this.concurrency = concurrency;
    }

    /**
     * Adds a new task to the execution queue
     * @param task - Async function to execute
     * @param priority - Task priority (HIGH for user operations, LOW for background)
     * @returns Promise that resolves with the task result
     */
    async add<T>(task: () => Promise<T>, priority: TaskPriority = TaskPriority.NORMAL): Promise<T> {
        return new Promise((resolve, reject) => {
            const queueTask: QueueTask<T> = {
                task,
                resolve,
                reject,
                priority,
                addedAt: Date.now(),
            };

            this.queue.push(queueTask);

            // Sort queue by priority (lower number = higher priority)
            this.queue.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }
                // Same priority: FIFO (first in, first out)
                return a.addedAt - b.addedAt;
            });

            if (this.queue.length > 10) {
                logger.warn('Queue size growing', {
                    queueSize: this.queue.length,
                    totalHandled: this.totalTasksHandled,
                    priority: TaskPriority[priority],
                });
            } else {
                logger.debug('Task added to queue', {
                    queueSize: this.queue.length,
                    priority: TaskPriority[priority],
                });
            }

            this.process();
        });
    }

    /**
     * Spawns a worker to process the next task in the queue
     */
    private process(): void {
        if (this.activeWorkers >= this.concurrency || this.queue.length === 0) return;

        const item = this.queue.shift();
        if (!item) return;

        this.activeWorkers++;
        this.runTask(item);
    }

    /**
     * Executes a single task with rate limit handling
     */
    private async runTask(item: QueueTask): Promise<void> {
        const { task, resolve, reject } = item;
        const elapsed = startTimer();

        try {
            const result = await task();
            this.totalTasksHandled++;
            const duration = elapsed();

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
            this.activeWorkers--;

            if (this.queue.length === 0 && this.activeWorkers === 0 && this.totalTasksHandled > 0) {
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
            isProcessing: this.activeWorkers > 0,
            activeWorkers: this.activeWorkers,
            concurrency: this.concurrency,
        };
    }
}

export default new QueueManager(queueConfig.uploadConcurrency);
