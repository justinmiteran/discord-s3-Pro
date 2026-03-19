import crypto from 'crypto';
import logger from '../utils/logger.js';
import { security } from '../config/index.js';
import { ENCRYPTION } from '../constants/index.js';
import { EncryptionError } from '../utils/errors/AppError.js';

/**
 * Encrypts a buffer using AES-256-GCM
 * @param buffer - Data to encrypt
 * @returns Encrypted buffer with IV and auth tag prepended
 * @throws EncryptionError if encryption fails
 */
export const encryptBuffer = (buffer: Buffer): Buffer => {
    try {
        const iv = crypto.randomBytes(ENCRYPTION.IV_LENGTH);
        const cipher = crypto.createCipheriv(ENCRYPTION.ALGORITHM, security.encryptionKey, iv);
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]);
    } catch (err: any) {
        logger.error(`Encryption failed: ${err.message}`);
        throw new EncryptionError(err.message);
    }
};

/**
 * Decrypts a buffer encrypted with AES-256-GCM
 * @param fullBuffer - Encrypted buffer with IV and auth tag
 * @returns Decrypted buffer
 * @throws EncryptionError if decryption fails
 */
export const decryptBuffer = (fullBuffer: Buffer): Buffer => {
    try {
        const iv = fullBuffer.subarray(0, ENCRYPTION.IV_LENGTH);
        const tag = fullBuffer.subarray(ENCRYPTION.IV_LENGTH, ENCRYPTION.IV_LENGTH + ENCRYPTION.AUTH_TAG_LENGTH);
        const data = fullBuffer.subarray(ENCRYPTION.IV_LENGTH + ENCRYPTION.AUTH_TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ENCRYPTION.ALGORITHM, security.encryptionKey, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]);
    } catch (err: any) {
        logger.error(`Decryption failed: ${err.message}`);
        throw new EncryptionError(err.message);
    }
};
