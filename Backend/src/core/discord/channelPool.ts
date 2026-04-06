import { channels } from '../../config/index.js';
import { ERROR_CODES } from '../../constants/index.js';
import { DiscordError } from '../../utils/errors/AppError.js';

/**
 * Manages round-robin distribution of Discord channels for load balancing
 */
class ChannelPool {
    private channels: string[];
    private currentIndex: number;

    constructor() {
        this.channels = channels;
        this.currentIndex = 0;
    }

    /**
     * Returns the next available Discord channel ID using round-robin selection
     * @returns Discord channel ID
     * @throws Error if no channels are configured
     */
    public next(): string {
        if (this.channels.length === 0) {
            throw new DiscordError(ERROR_CODES.NO_CHANNELS);
        }
        const id = this.channels[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.channels.length;
        return id;
    }
}

export default new ChannelPool();
