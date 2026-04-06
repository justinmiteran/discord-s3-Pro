import logger from '../../utils/logger.js';
import { EncryptionError } from '../../utils/errors/AppError.js';
import { Cipher } from './cipher.js';
import { KeyManager, keyManager } from './keyManager.js';

/**
 * Encryption Service - Orchestration of encryption with key management
 * 
 * RESPONSIBILITIES:
 * - Encrypt data with active key
 * - Decrypt data with specific key
 * - Decrypt data with multi-key fallback
 * - Log cryptographic operations
 * - Handle encryption errors
 * 
 * DOES NOT:
 * - Perform low-level crypto operations (→ Cipher)
 * - Manage keys (→ KeyManager)
 * - Handle business logic (→ callers)
 */
export class EncryptionService {
    constructor(private keyManager: KeyManager) {}

    /**
     * Encrypts data with the active encryption key
     * @param data - Data to encrypt
     * @returns Encrypted buffer and key ID used
     * @throws EncryptionError if encryption fails
     */
    encryptWithActiveKey(data: Buffer): { encrypted: Buffer; keyId: string } {
        try {
            const { id, key } = this.keyManager.getActiveKey();
            const encrypted = Cipher.encrypt(data, key);

            return { encrypted, keyId: id };
        } catch (err: any) {
            logger.error('Encryption with active key failed', err);
            throw new EncryptionError(err.message);
        }
    }

    /**
     * Decrypts data with a specific key
     * @param encryptedBuffer - Encrypted buffer with IV and auth tag
     * @param keyId - Key ID to use for decryption
     * @returns Decrypted data
     * @throws EncryptionError if decryption fails
     */
    decryptWithKey(encryptedBuffer: Buffer, keyId: string): Buffer {
        try {
            const key = this.keyManager.getKeyById(keyId);
            return Cipher.decrypt(encryptedBuffer, key);
        } catch (err: any) {
            throw new EncryptionError(`Decryption with key ${keyId} failed: ${err.message}`);
        }
    }

    /**
     * Attempts to decrypt with all available keys (fallback mechanism)
     * Tries active key first, then legacy keys
     * @param encryptedBuffer - Encrypted buffer with IV and auth tag
     * @returns Decrypted data and key ID used
     * @throws EncryptionError if decryption fails with all keys
     */
    tryDecryptWithAllKeys(encryptedBuffer: Buffer): { decrypted: Buffer; keyId: string } {
        const errors: string[] = [];
        const activeKeyId = this.keyManager.getActiveKeyId();

        // Try active key first
        try {
            const decrypted = this.decryptWithKey(encryptedBuffer, activeKeyId);
            return { decrypted, keyId: activeKeyId };
        } catch (err: any) {
            errors.push(`${activeKeyId}: ${err.message}`);
        }

        // Try all other keys
        const availableKeyIds = this.keyManager.getAvailableKeyIds();
        for (const keyId of availableKeyIds) {
            if (keyId === activeKeyId) continue;

            try {
                const decrypted = this.decryptWithKey(encryptedBuffer, keyId);
                logger.warn('Decrypted with legacy key', { keyId });
                return { decrypted, keyId };
            } catch (err: any) {
                errors.push(`${keyId}: ${err.message}`);
            }
        }

        throw new EncryptionError(
            `Failed to decrypt with any available key. Tried: ${errors.join(', ')}`,
        );
    }

    /**
     * Decrypts data with optional key hint
     * If keyId is provided, tries that key first, then falls back to all keys
     * @param encryptedBuffer - Encrypted buffer with IV and auth tag
     * @param keyId - Optional key ID hint for faster decryption
     * @returns Decrypted data and key ID used
     * @throws EncryptionError if decryption fails
     */
    decrypt(
        encryptedBuffer: Buffer,
        keyId?: string,
    ): { decrypted: Buffer; keyId: string } {
        try {
            if (keyId) {
                try {
                    const decrypted = this.decryptWithKey(encryptedBuffer, keyId);
                    return { decrypted, keyId };
                } catch (err: any) {
                    logger.warn(`Decryption with key ${keyId} failed, trying all keys`, {
                        error: err.message,
                    });
                }
            }

            // Try all available keys
            return this.tryDecryptWithAllKeys(encryptedBuffer);
        } catch (err: any) {
            logger.error('Decryption failed', err);
            throw new EncryptionError(err.message);
        }
    }

    /**
     * Checks if data encrypted with given key needs re-encryption
     * @param currentKeyId - The key ID currently used for encryption
     * @returns True if re-encryption is needed, false otherwise
     */
    needsReencryption(currentKeyId?: string): boolean {
        return this.keyManager.needsReencryption(currentKeyId);
    }

    /**
     * Gets the active key ID
     * @returns The active key identifier
     */
    getActiveKeyId(): string {
        return this.keyManager.getActiveKeyId();
    }

    /**
     * Lists all available keys
     * @returns Array of key metadata
     */
    listKeys(): Array<{ id: string; active: boolean; createdAt: string }> {
        return this.keyManager.listKeys();
    }
}

// Singleton instance
export const encryptionService = new EncryptionService(keyManager);
