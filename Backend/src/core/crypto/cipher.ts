import crypto from 'crypto';
import { ENCRYPTION } from '../../constants/index.js';

/**
 * Parsed encrypted buffer components
 */
export interface EncryptedComponents {
    iv: Buffer;
    authTag: Buffer;
    data: Buffer;
}

/**
 * Cipher - Low-level cryptographic operations
 *
 * RESPONSIBILITIES:
 * - Encrypt data using AES-256-GCM
 * - Decrypt data using AES-256-GCM
 * - Parse encrypted buffers (IV, auth tag, data)
 * - Generate random IVs
 *
 * DOES NOT:
 * - Manage keys (→ KeyManager)
 * - Handle multi-key fallback (→ EncryptionService)
 * - Log operations (→ callers)
 */
export class Cipher {
    /**
     * Encrypts data with a specific key using AES-256-GCM
     * @param data - Data to encrypt
     * @param key - 32-byte encryption key
     * @returns Encrypted buffer with IV and auth tag prepended
     */
    static encrypt(data: Buffer, key: Buffer): Buffer {
        const iv = this.generateIV();
        const cipher = crypto.createCipheriv(ENCRYPTION.ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Format: [IV (16 bytes)][Auth Tag (16 bytes)][Encrypted Data]
        return Buffer.concat([iv, authTag, encrypted]);
    }

    /**
     * Decrypts data with a specific key using AES-256-GCM
     * @param encryptedBuffer - Buffer with IV, auth tag, and encrypted data
     * @param key - 32-byte encryption key
     * @returns Decrypted data
     * @throws Error if decryption fails (wrong key, corrupted data)
     */
    static decrypt(encryptedBuffer: Buffer, key: Buffer): Buffer {
        const { iv, authTag, data } = this.parseEncryptedBuffer(encryptedBuffer);

        const decipher = crypto.createDecipheriv(ENCRYPTION.ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        return Buffer.concat([decipher.update(data), decipher.final()]);
    }

    /**
     * Parses an encrypted buffer into its components
     * @param buffer - Encrypted buffer with IV, auth tag, and data
     * @returns Parsed components
     */
    static parseEncryptedBuffer(buffer: Buffer): EncryptedComponents {
        const iv = buffer.subarray(0, ENCRYPTION.IV_LENGTH);
        const authTag = buffer.subarray(
            ENCRYPTION.IV_LENGTH,
            ENCRYPTION.IV_LENGTH + ENCRYPTION.AUTH_TAG_LENGTH,
        );
        const data = buffer.subarray(ENCRYPTION.IV_LENGTH + ENCRYPTION.AUTH_TAG_LENGTH);

        return { iv, authTag, data };
    }

    /**
     * Generates a random initialization vector
     * @returns Random IV buffer
     */
    static generateIV(): Buffer {
        return crypto.randomBytes(ENCRYPTION.IV_LENGTH);
    }
}
