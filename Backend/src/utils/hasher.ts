import crypto from 'crypto';
import fs from 'fs';
import { Transform, TransformCallback } from 'stream';
import logger from './logger.js';

export const calculateHash = (filePath: string): Promise<string> =>
    new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(filePath);

        input.on('error', reject);
        input.on('data', (chunk) => hash.update(chunk));
        input.on('end', () => resolve(hash.digest('hex')));
    });

export const createVerificationStream = (storedHash: string, fileName: string): Transform => {
    const hash = crypto.createHash('sha256');
    return new Transform({
        transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {
            hash.update(chunk);
            callback(null, chunk);
        },
        flush(callback: TransformCallback) {
            const finalHash = hash.digest('hex');
            if (finalHash === storedHash) {
                logger.success(`Integrity verified: ${fileName}`);
            } else {
                logger.error(`CORRUPTION DETECTED: ${fileName}`);
            }
            callback();
        },
    });
};
