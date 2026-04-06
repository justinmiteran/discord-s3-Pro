import crypto from 'crypto';
import fs from 'fs';
import { Transform, TransformCallback } from 'stream';
import logger, { startTimer } from './logger.js';

/**
 * Calculates SHA-256 hash of a file
 * @param filePath - Path to the file
 * @returns Promise resolving to hex-encoded hash
 */
export const calculateHash = (filePath: string): Promise<string> =>
    new Promise((resolve, reject) => {
        const elapsed = startTimer();
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(filePath);
        let bytesProcessed = 0;

        input.on('error', (err) => {
            logger.error('Hash calculation failed', err, { filePath });
            reject(err);
        });
        
        input.on('data', (chunk) => {
            hash.update(chunk);
            bytesProcessed += chunk.length;
        });
        
        input.on('end', () => {
            const finalHash = hash.digest('hex');
            const duration = elapsed();
            
            logger.debug('Hash calculated', {
                filePath,
                hash: finalHash,
                bytesProcessed,
                duration
            });
            
            resolve(finalHash);
        });
    });

/**
 * Creates a transform stream that verifies file integrity during download
 * @param storedHash - Expected SHA-256 hash
 * @param fileName - Name of the file being verified
 * @returns Transform stream that validates hash on completion
 */
export const createVerificationStream = (storedHash: string, fileName: string): Transform => {
    const hash = crypto.createHash('sha256');
    let bytesProcessed = 0;
    
    logger.debug('Starting integrity verification', {
        fileName,
        expectedHash: storedHash
    });
    
    return new Transform({
        transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
            hash.update(chunk);
            bytesProcessed += chunk.length;
            callback(null, chunk);
        },
        flush(callback: TransformCallback) {
            const finalHash = hash.digest('hex');
            const isValid = finalHash === storedHash;
            
            if (isValid) {
                logger.success('Integrity verification passed', {
                    fileName,
                    hash: finalHash,
                    bytesProcessed
                });
            } else {
                logger.error('Integrity verification failed - CORRUPTION DETECTED', undefined, {
                    fileName,
                    expectedHash: storedHash,
                    actualHash: finalHash,
                    bytesProcessed
                });
            }
            
            callback();
        },
    });
};
