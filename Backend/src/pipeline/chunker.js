const fs = require('fs');
const { Transform } = require('stream');
const zlib = require('zlib');

const logger = require('../utils/logger'); // Your Pro Logger

/**
 * Custom Stream Transform to split data into fixed-size buffers.
 */
class ChunkSplitter extends Transform {
    constructor(chunkSize) {
        super();
        this.chunkSize = chunkSize;
        this.buffer = Buffer.alloc(0);
        this.processedChunks = 0;
    }

    _transform(chunk, encoding, callback) {
        // Concatenate incoming stream data to our internal buffer
        this.buffer = Buffer.concat([this.buffer, chunk]);

        // While we have enough data to fill at least one chunk
        while (this.buffer.length >= this.chunkSize) {
            const part = this.buffer.subarray(0, this.chunkSize);
            this.buffer = this.buffer.subarray(this.chunkSize);

            this.processedChunks++;
            this.push(part);
        }
        callback();
    }

    _flush(callback) {
        // Push any remaining data in the buffer as the final chunk
        if (this.buffer.length > 0) {
            this.processedChunks++;
            this.push(this.buffer);
        }

        logger.info(`ChunkSplitter finished. Total chunks generated: ${this.processedChunks}`);
        callback();
    }
}

/**
 * Creates a readable stream from a file, pipes it through GZIP compression,
 * and prepares it for chunking.
 */
exports.createUploadStream = (filePath) => {
    logger.info(`Initializing compression pipeline for: ${filePath}`);

    // Create the read stream
    const fileStream = fs.createReadStream(filePath);

    // Error handling for the file stream (e.g., file locked or deleted mid-process)
    fileStream.on('error', (err) => {
        logger.error(`ReadStream Error: ${err.message}`);
    });

    // Pipe through GZIP with maximum compression level (9)
    return fileStream
        .pipe(
            zlib.createGzip({
                level: zlib.constants.Z_BEST_COMPRESSION,
            }),
        )
        .on('error', (err) => {
            logger.error(`Compression Error: ${err.message}`);
        });
};

exports.ChunkSplitter = ChunkSplitter;
