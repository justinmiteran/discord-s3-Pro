const crypto = require('crypto');

const logger = require('../utils/logger');
const { encryptionKey } = require('../config');

// Ensure the key is exactly 32 bytes (256 bits) for AES-256
const VALID_KEY = Buffer.alloc(32, encryptionKey, 'utf8');

/**
 * Encrypts a buffer using AES-256-GCM.
 * Structure: [16b IV] + [16b Auth Tag] + [Encrypted Data]
 */
exports.encryptBuffer = (buffer) => {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', VALID_KEY, iv);

        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        const authTag = cipher.getAuthTag(); // GCM provides an authentication tag

        // We bundle IV and Tag with the data so we can decrypt it later without external state
        return Buffer.concat([iv, authTag, encrypted]);
    } catch (err) {
        logger.error(`Encryption failed: ${err.message}`);
        throw err;
    }
};

/**
 * Decrypts a buffer previously encrypted with encryptBuffer.
 */
exports.decryptBuffer = (fullBuffer) => {
    try {
        // Slice the buffer to recover the components
        const iv = fullBuffer.subarray(0, 16);
        const tag = fullBuffer.subarray(16, 32);
        const data = fullBuffer.subarray(32);

        const decipher = crypto.createDecipheriv('aes-256-gcm', VALID_KEY, iv);
        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
        return decrypted;
    } catch (err) {
        // This usually triggers if the key is wrong or the data was tampered with
        logger.error(`Decryption failed (Invalid key or corrupted data): ${err.message}`);
        throw new Error('DECRYPTION_FAILED');
    }
};
