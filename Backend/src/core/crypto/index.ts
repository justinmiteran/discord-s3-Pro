/**
 * Crypto Module - Encryption and key management
 * 
 * This module provides a clean separation of concerns:
 * - Cipher: Low-level cryptographic operations
 * - KeyManager: Encryption key management
 * - EncryptionService: High-level encryption orchestration
 */

export { Cipher } from './cipher.js';
export type { EncryptedComponents } from './cipher.js';
export { KeyManager, keyManager } from './keyManager.js';
export type { EncryptionKeyEntry } from './keyManager.js';
export { EncryptionService, encryptionService } from './encryptionService.js';
