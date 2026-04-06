import fs from 'fs';
import { Transform, TransformCallback } from 'stream';
import logger from '../utils/logger.js';

/**
 * Stream transformer that splits data into fixed-size chunks
 */
export class ChunkSplitter extends Transform {
    private chunkSize: number;
    private buffer: Buffer;
    public processedChunks: number;

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
                
                logger.debug('Chunk created', {
                    chunkIndex: this.processedChunks,
                    chunkSize: part.length,
                    chunkSizeFormatted: `${(part.length / 1024 / 1024).toFixed(2)} MB`
                });

                this.push(part);
            }
            callback();
        } catch (err: any) {
            logger.error('Chunk splitting failed', err);
            callback(err);
        }
    }

    _flush(callback: TransformCallback): void {
        if (this.buffer.length > 0) {
            this.processedChunks++;
            
            logger.debug('Final chunk created', {
                chunkIndex: this.processedChunks,
                chunkSize: this.buffer.length,
                chunkSizeFormatted: `${(this.buffer.length / 1024 / 1024).toFixed(2)} MB`
            });
            
            this.push(this.buffer);
        }
        
        logger.success('Stream splitting complete', {
            totalChunks: this.processedChunks
        });
        
        callback();
    }
}
