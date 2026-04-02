import crypto from 'crypto';
import logger from '../utils/logger.js';
import { ENCRYPTION } from '../constants/index.js';
import { EncryptionError } from '../utils/errors/AppError.js';

/**
 * Encryption key with metadata
 */
export interface EncryptionKeyEntry {
    /** Key identifier (e.g., 'v1', 'v2') */
    id: string;
    /** 32-byte encryption key */
    key: Buffer;
    /** Whether this is the active key for new encryptions */
    active: boolean;
    /** ISO timestamp when key was created */
    createdAt: string;
}

/**
 * Key rotation manager
 * Supports multiple encryption keys for seamless rotation without data loss
 */
export class KeyRotationManager {
    private keys: Map<string, EncryptionKeyEntry> = new Map();
    private activeKeyId: string | null = null;

    /**
     * Initializes the key manager with keys from environment
     */
    constructor() {
        this.loadKeysFromEnv();
    }

    /**
     * Loads encryption keys from environment variables
     * ENCRYPTION_KEY_ACTIVE = active key in format "id:key" (e.g., "v2:actual_key_here")
     * ENCRYPTION_KEY_LEGACY = comma-separated legacy keys in format "id:key,id:key"
     * Example:
     *   ENCRYPTION_KEY_ACTIVE=v3:new_key_32_chars_long_here!!
     *   ENCRYPTION_KEY_LEGACY=v1:old_key_32_chars,v2:mid_key_32_chars
     */
    private loadKeysFromEnv(): void {
        const activeKeyStr = process.env.ENCRYPTION_KEY_ACTIVE;
        if (!activeKeyStr) {
            throw new Error('ENCRYPTION_KEY_ACTIVE is required (format: "id:key")');
        }

        // Parse active key
        const activeKeyParts = activeKeyStr.split(':');
        if (activeKeyParts.length !== 2) {
            throw new Error('ENCRYPTION_KEY_ACTIVE must be in format "id:key" (e.g., "v2:actual_key_here")');
        }

        const [activeId, activeKey] = activeKeyParts;
        this.addKey(activeId, Buffer.alloc(32, activeKey), true);
        this.activeKeyId = activeId;

        logger.info(`Loaded active encryption key: ${activeId}`);

        // Parse legacy keys
        const legacyKeysStr = process.env.ENCRYPTION_KEY_LEGACY;
        if (legacyKeysStr) {
            const legacyKeyEntries = legacyKeysStr.split(',').map(k => k.trim()).filter(k => k);
            
            for (const entry of legacyKeyEntries) {
                const parts = entry.split(':');
                if (parts.length !== 2) {
                    logger.warn(`Skipping invalid legacy key format: ${entry} (expected "id:key")`);
                    continue;
                }

                const [legacyId, legacyKey] = parts;
                this.addKey(legacyId, Buffer.alloc(32, legacyKey), false);
                logger.info(`Loaded legacy encryption key: ${legacyId}`);
            }
        }

        logger.success('Key rotation manager initialized', {
            totalKeys: this.keys.size,
            activeKey: this.activeKeyId,
            availableKeys: Array.from(this.keys.keys()),
        });
    }

    /**
     * Adds a key to the manager
     */
    private addKey(id: string, key: Buffer, active: boolean): void {
        if (key.length !== ENCRYPTION.KEY_LENGTH) {
            throw new Error(`Key ${id} must be exactly ${ENCRYPTION.KEY_LENGTH} bytes`);
        }

        this.keys.set(id, {
            id,
            key,
            active,
            createdAt: new Date().toISOString(),
        });
    }

    /**
     * Gets the active encryption key for new data
     */
    getActiveKey(): { id: string; key: Buffer } {
        if (!this.activeKeyId) {
            throw new EncryptionError('No active encryption key configured');
        }

        const keyEntry = this.keys.get(this.activeKeyId);
        if (!keyEntry) {
            throw new EncryptionError('Active key not found in key store');
        }

        return { id: keyEntry.id, key: keyEntry.key };
    }

    /**
     * Gets a specific key by ID for decryption
     */
    getKeyById(keyId: string): Buffer {
        const keyEntry = this.keys.get(keyId);
        if (!keyEntry) {
            throw new EncryptionError(`Encryption key '${keyId}' not found`);
        }
        return keyEntry.key;
    }

    /**
     * Attempts to decrypt with all available keys (fallback mechanism)
     */
    tryDecryptWithAllKeys(fullBuffer: Buffer): { data: Buffer; keyId: string } {
        const errors: string[] = [];

        // Try active key first
        if (this.activeKeyId) {
            try {
                const data = this.decryptWithKey(fullBuffer, this.activeKeyId);
                return { data, keyId: this.activeKeyId };
            } catch (err: any) {
                errors.push(`${this.activeKeyId}: ${err.message}`);
            }
        }

        // Try all other keys
        for (const [keyId, keyEntry] of this.keys.entries()) {
            if (keyId === this.activeKeyId) continue;

            try {
                const data = this.decryptWithKey(fullBuffer, keyId);
                logger.warn('Decrypted with legacy key', { keyId });
                return { data, keyId };
            } catch (err: any) {
                errors.push(`${keyId}: ${err.message}`);
            }
        }

        throw new EncryptionError(
            `Failed to decrypt with any available key. Tried: ${errors.join(', ')}`,
        );
    }

    /**
     * Decrypts data with a specific key
     */
    private decryptWithKey(fullBuffer: Buffer, keyId: string): Buffer {
        const key = this.getKeyById(keyId);
        const iv = fullBuffer.subarray(0, ENCRYPTION.IV_LENGTH);
        const tag = fullBuffer.subarray(
            ENCRYPTION.IV_LENGTH,
            ENCRYPTION.IV_LENGTH + ENCRYPTION.AUTH_TAG_LENGTH,
        );
        const data = fullBuffer.subarray(ENCRYPTION.IV_LENGTH + ENCRYPTION.AUTH_TAG_LENGTH);

        const decipher = crypto.createDecipheriv(ENCRYPTION.ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(data), decipher.final()]);
    }

    /**
     * Encrypts data with the active key
     */
    encryptWithActiveKey(buffer: Buffer): { encrypted: Buffer; keyId: string } {
        const { id, key } = this.getActiveKey();

        const iv = crypto.randomBytes(ENCRYPTION.IV_LENGTH);
        const cipher = crypto.createCipheriv(ENCRYPTION.ALGORITHM, key, iv);
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        const authTag = cipher.getAuthTag();

        return {
            encrypted: Buffer.concat([iv, authTag, encrypted]),
            keyId: id,
        };
    }

    /**
     * Re-encrypts data from old key to active key
     */
    reencrypt(encryptedBuffer: Buffer, oldKeyId: string): Buffer {
        // Decrypt with old key
        const decrypted = this.decryptWithKey(encryptedBuffer, oldKeyId);

        // Encrypt with active key
        const { encrypted } = this.encryptWithActiveKey(decrypted);

        return encrypted;
    }

    /**
     * Lists all available keys
     */
    listKeys(): Array<{ id: string; active: boolean; createdAt: string }> {
        return Array.from(this.keys.values()).map((entry) => ({
            id: entry.id,
            active: entry.active,
            createdAt: entry.createdAt,
        }));
    }
}

// Singleton instance
export const keyRotationManager = new KeyRotationManager();
