import { channels } from '../config.js';

class ChannelPool {
    private channels: string[];
    private currentIndex: number;

    constructor() {
        this.channels = channels;
        this.currentIndex = 0;
    }

    /**
     * Round-robin selection of the next available Discord channel ID.
     */
    public next(): string {
        if (this.channels.length === 0) {
            throw new Error('No Discord channels configured in config.cfg');
        }
        const id = this.channels[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.channels.length;
        return id;
    }
}

export default new ChannelPool();
