import crypto from 'crypto';
import logger from '../utils/logger.js';
import { encryptionKey } from '../config.js';

export const encryptBuffer = (buffer: Buffer): Buffer => {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]);
    } catch (err: any) {
        logger.error(`Encryption failed: ${err.message}`);
        throw err;
    }
};

export const decryptBuffer = (fullBuffer: Buffer): Buffer => {
    try {
        const iv = fullBuffer.subarray(0, 16);
        const tag = fullBuffer.subarray(16, 32);
        const data = fullBuffer.subarray(32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]);
    } catch (err: any) {
        logger.error(`Decryption failed: ${err.message}`);
        throw err;
    }
};
