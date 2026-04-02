import crypto from 'crypto';
import logger from '../utils/logger.js';
import { keyRotationManager } from '../core/keyRotation.js';
import { ENCRYPTION } from '../constants/index.js';
import { EncryptionError } from '../utils/errors/AppError.js';

/**
 * Encrypts a buffer using AES-256-GCM with the active encryption key
 * @param buffer - Data to encrypt
 * @returns Object with encrypted buffer and key ID
 * @throws EncryptionError if encryption fails
 */
export const encryptBuffer = (buffer: Buffer): { encrypted: Buffer; keyId: string } => {
    try {
        return keyRotationManager.encryptWithActiveKey(buffer);
    } catch (err: any) {
        logger.error(`Encryption failed: ${err.message}`);
        throw new EncryptionError(err.message);
    }
};

/**
 * Decrypts a buffer encrypted with AES-256-GCM
 * Automatically tries all available keys if the primary key fails
 * @param fullBuffer - Encrypted buffer with IV and auth tag
 * @param keyId - Optional key ID hint for faster decryption
 * @returns Object with decrypted buffer and key ID used
 * @throws EncryptionError if decryption fails with all keys
 */
export const decryptBuffer = (
    fullBuffer: Buffer,
    keyId?: string,
): { decrypted: Buffer; keyId: string } => {
    try {
        if (keyId) {
            // Try with specified key first
            try {
                const key = keyRotationManager.getKeyById(keyId);
                const iv = fullBuffer.subarray(0, ENCRYPTION.IV_LENGTH);
                const tag = fullBuffer.subarray(
                    ENCRYPTION.IV_LENGTH,
                    ENCRYPTION.IV_LENGTH + ENCRYPTION.AUTH_TAG_LENGTH,
                );
                const data = fullBuffer.subarray(ENCRYPTION.IV_LENGTH + ENCRYPTION.AUTH_TAG_LENGTH);
                const decipher = crypto.createDecipheriv(ENCRYPTION.ALGORITHM, key, iv);
                decipher.setAuthTag(tag);
                const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
                return { decrypted, keyId };
            } catch (err: any) {
                logger.warn(`Decryption with key ${keyId} failed, trying all keys`, {
                    error: err.message,
                });
            }
        }

        // Try all available keys
        const result = keyRotationManager.tryDecryptWithAllKeys(fullBuffer);
        return { decrypted: result.data, keyId: result.keyId };
    } catch (err: any) {
        logger.error(`Decryption failed: ${err.message}`);
        throw new EncryptionError(err.message);
    }
};
