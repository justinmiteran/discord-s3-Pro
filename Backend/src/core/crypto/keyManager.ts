import logger from '../../utils/logger.js';
import { ENCRYPTION } from '../../constants/index.js';
import { EncryptionError } from '../../utils/errors/AppError.js';

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
 * Key Manager - Encryption key management
 * 
 * RESPONSIBILITIES:
 * - Load keys from environment variables
 * - Store keys in memory
 * - Provide access to keys (active, legacy)
 * - Validate keys
 * - Determine if a key needs rotation
 * 
 * DOES NOT:
 * - Encrypt/decrypt data (→ Cipher)
 * - Handle business logic (→ callers)
 * - Manage error handling beyond validation (→ callers)
 */
export class KeyManager {
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
            throw new EncryptionError('ENCRYPTION_KEY_ACTIVE is required (format: "id:key")');
        }

        // Parse active key
        const activeKeyParts = activeKeyStr.split(':');
        if (activeKeyParts.length !== 2) {
            throw new EncryptionError(
                'ENCRYPTION_KEY_ACTIVE must be in format "id:key" (e.g., "v2:actual_key_here")',
            );
        }

        const [activeId, activeKey] = activeKeyParts;
        this.addKey(activeId, this.parseKeyString(activeId, activeKey), true);
        this.activeKeyId = activeId;

        logger.info(`Loaded active encryption key: ${activeId}`);

        // Parse legacy keys
        const legacyKeysStr = process.env.ENCRYPTION_KEY_LEGACY;
        if (legacyKeysStr) {
            const legacyKeyEntries = legacyKeysStr
                .split(',')
                .map((k) => k.trim())
                .filter((k) => k);

            for (const entry of legacyKeyEntries) {
                const parts = entry.split(':');
                if (parts.length !== 2) {
                    logger.warn(`Skipping invalid legacy key format: ${entry} (expected "id:key")`);
                    continue;
                }

                const [legacyId, legacyKey] = parts;
                this.addKey(legacyId, this.parseKeyString(legacyId, legacyKey), false);
                logger.info(`Loaded legacy encryption key: ${legacyId}`);
            }
        }

        logger.success('Key manager initialized', {
            totalKeys: this.keys.size,
            activeKey: this.activeKeyId,
            availableKeys: Array.from(this.keys.keys()),
        });
    }

    /**
     * Parses a key string into a 32-byte Buffer
     * Requires at least 16 characters to prevent weak keys from silent padding
     * @param id - Key identifier for error messages
     * @param keyStr - Raw key string from environment
     * @returns 32-byte Buffer (truncated or zero-padded)
     * @throws EncryptionError if key string is too short
     */
    private parseKeyString(id: string, keyStr: string): Buffer {
        if (keyStr.length < 16) {
            throw new EncryptionError(
                `Key '${id}' is too short (${keyStr.length} chars). Minimum 16 characters required.`,
            );
        }
        const buf = Buffer.alloc(32);
        Buffer.from(keyStr, 'utf8').copy(buf);
        return buf;
    }

    /**
     * Adds a key to the manager
     */
    private addKey(id: string, key: Buffer, active: boolean): void {
        if (key.length !== ENCRYPTION.KEY_LENGTH) {
            throw new EncryptionError(`Key ${id} must be exactly ${ENCRYPTION.KEY_LENGTH} bytes`);
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
     * @returns Active key with ID and buffer
     * @throws EncryptionError if no active key is configured
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
     * Gets the active key ID
     * @returns The active key identifier
     * @throws EncryptionError if no active key is configured
     */
    getActiveKeyId(): string {
        if (!this.activeKeyId) {
            throw new EncryptionError('No active encryption key configured');
        }
        return this.activeKeyId;
    }

    /**
     * Gets a specific key by ID for decryption
     * @param keyId - Key identifier
     * @returns Key buffer
     * @throws EncryptionError if key not found
     */
    getKeyById(keyId: string): Buffer {
        const keyEntry = this.keys.get(keyId);
        if (!keyEntry) {
            throw new EncryptionError(`Encryption key '${keyId}' not found`);
        }
        return keyEntry.key;
    }

    /**
     * Checks if a key exists
     * @param keyId - Key identifier
     * @returns True if key exists
     */
    hasKey(keyId: string): boolean {
        return this.keys.has(keyId);
    }

    /**
     * Gets all available key IDs
     * @returns Array of key IDs
     */
    getAvailableKeyIds(): string[] {
        return Array.from(this.keys.keys());
    }

    /**
     * Checks if data encrypted with given key needs re-encryption
     * @param currentKeyId - The key ID currently used for encryption
     * @returns True if re-encryption is needed, false otherwise
     */
    needsReencryption(currentKeyId?: string): boolean {
        if (!currentKeyId) {
            return true; // No key ID = needs encryption
        }

        if (!this.activeKeyId) {
            return false; // No active key configured
        }

        return currentKeyId !== this.activeKeyId;
    }

    /**
     * Lists all available keys (without exposing actual key data)
     * @returns Array of key metadata
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
export const keyManager = new KeyManager();
