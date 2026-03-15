import logger from '../utils/logger.js';

interface QueueTask<T = any> {
    task: () => Promise<T>;
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
}

class QueueManager {
    private queue: QueueTask[] = [];
    private processing: boolean = false;

    async add<T>(task: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }

    private async process(): Promise<void> {
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const item = this.queue.shift();
        if (!item) return;

        const { task, resolve, reject } = item;

        try {
            const result = await task();
            // Basic Discord Rate Limit check if result contains headers (axios/discord.js responses)
            if (result && (result as any).headers) {
                const remaining = (result as any).headers['x-ratelimit-remaining'];
                if (remaining === '0') {
                    const resetAfter =
                        (parseInt((result as any).headers['x-ratelimit-reset-after']) || 1) * 1000;
                    logger.warn(`Rate Limit hit. Sleeping ${resetAfter}ms`);
                    await new Promise((r) => setTimeout(r, resetAfter));
                }
            }
            resolve(result);
        } catch (error: any) {
            logger.error(`Queue Task Failed: ${error.message}`);
            reject(error);
        } finally {
            this.processing = false;
            setTimeout(() => this.process(), 200);
        }
    }
}

export default new QueueManager();
