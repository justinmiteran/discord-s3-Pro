const { channels } = require('../config');

class ChannelPool {
    constructor() {
        this.channels = channels;
        this.currentIndex = 0;
    }

    next() {
        const id = this.channels[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.channels.length;
        return id;
    }
}

module.exports = new ChannelPool();
