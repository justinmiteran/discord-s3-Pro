const logger = require('../utils/logger');

class QueueManager {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.totalTasksHandled = 0;
    }

    /**
     * Adds a new task to the execution queue.
     * @param {Function} task - The async function to execute.
     */
    async add(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });

            // Log queue growth if it's getting long
            if (this.queue.length > 5) {
                logger.warn(`Queue pressure increasing: ${this.queue.length} tasks pending.`);
            }

            this.process();
        });
    }

    async process() {
        // Prevent concurrent processing or idling on an empty queue
        if (this.processing || this.queue.length === 0) return;
        this.processing = true;

        const { task, resolve, reject } = this.queue.shift();
        const startTime = Date.now();

        try {
            // Execute the task (Upload chunk or fetch message)
            const result = await task();
            this.totalTasksHandled++;

            // --- RATE LIMIT HANDLING ---
            if (result && result.headers) {
                const remaining = result.headers['x-ratelimit-remaining'];

                if (remaining === '0') {
                    const resetAfter = (result.headers['x-ratelimit-reset-after'] || 1) * 1000;
                    logger.warn(`Discord Rate Limit hit. Sleeping for ${resetAfter}ms...`);
                    await new Promise((r) => setTimeout(r, resetAfter));
                }
            }
            const duration = Date.now() - startTime;
            logger.info(`Task completed in ${duration}ms. (Queue: ${this.queue.length} left)`);

            resolve(result);
        } catch (error) {
            logger.error(`Task execution failed: ${error.message}`);
            reject(error);
        } finally {
            this.processing = false;

            // Anti-spam delay: prevents Discord from flagging the bot for rapid bursts
            // and allows the event loop to breathe.
            setTimeout(() => this.process(), 200);
        }
    }
}

module.exports = new QueueManager();
