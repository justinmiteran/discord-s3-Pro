import fs from 'fs';
import { Transform, TransformCallback } from 'stream';
import zlib from 'zlib';
import logger from '../utils/logger.js';

export class ChunkSplitter extends Transform {
    private chunkSize: number;
    private buffer: Buffer;
    public processedChunks: number; // Changed to public to allow external access

    constructor(chunkSize: number) {
        super();
        this.chunkSize = chunkSize;
        this.buffer = Buffer.alloc(0);
        this.processedChunks = 0;
    }

    _transform(
        chunk: Buffer | Uint8Array | string,
        encoding: BufferEncoding,
        callback: TransformCallback,
    ): void {
        try {
            const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            this.buffer = Buffer.concat([this.buffer, data]);

            while (this.buffer.length >= this.chunkSize) {
                const part = this.buffer.subarray(0, this.chunkSize);
                this.buffer = this.buffer.subarray(this.chunkSize);

                this.processedChunks++;
                // New informative log per chunk created
                logger.info(
                    `Chunker: Created segment #${this.processedChunks} (${(part.length / 1024 / 1024).toFixed(2)} MB)`,
                );

                this.push(part);
            }
            callback();
        } catch (err: any) {
            callback(err);
        }
    }

    _flush(callback: TransformCallback): void {
        if (this.buffer.length > 0) {
            this.processedChunks++;
            logger.info(
                `Chunker: Created final segment #${this.processedChunks} (${(this.buffer.length / 1024 / 1024).toFixed(2)} MB)`,
            );
            this.push(this.buffer);
        }
        logger.success(
            `Chunker: Stream splitting complete. Total segments: ${this.processedChunks}`,
        );
        callback();
    }
}

/**
 * Type-safe creation of the upload stream.
 * Returns a generic Node.js Readable to allow piping through the transformation layers.
 */
export const createUploadStream = (filePath: string): NodeJS.ReadableStream => {
    logger.info(`Initializing compression pipeline: ${filePath}`);
    const fileStream = fs.createReadStream(filePath);

    fileStream.on('error', (err: Error) => {
        logger.error(`ReadStream Error: ${err.message}`);
    });

    return fileStream.pipe(zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }));
};
