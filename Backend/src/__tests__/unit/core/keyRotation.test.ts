import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

let KeyRotationManager: any;

describe('KeyRotationManager - id:key Format', () => {
    beforeEach(async () => {
        vi.resetModules();
        delete process.env.ENCRYPTION_KEY_ACTIVE;
        delete process.env.ENCRYPTION_KEY_LEGACY;
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should load single active key', async () => {
        process.env.ENCRYPTION_KEY_ACTIVE = 'v1:test_key_32_characters_long_v1!!';

        const module = await import('../../../core/keyRotation.js');
        KeyRotationManager = module.KeyRotationManager;
        const manager = new KeyRotationManager();
        const activeKey = manager.getActiveKey();

        expect(activeKey.id).toBe('v1');
        expect(manager.listKeys()).toHaveLength(1);
    });

    it('should load active key and multiple legacy keys', async () => {
        process.env.ENCRYPTION_KEY_ACTIVE = 'v3:test_key_32_characters_long_v3!!';
        process.env.ENCRYPTION_KEY_LEGACY = 'v1:test_key_32_characters_long_v1!!,v2:test_key_32_characters_long_v2!!';

        const module = await import('../../../core/keyRotation.js');
        KeyRotationManager = module.KeyRotationManager;
        const manager = new KeyRotationManager();
        const activeKey = manager.getActiveKey();

        expect(activeKey.id).toBe('v3');
        expect(manager.listKeys()).toHaveLength(3);
        
        const keys = manager.listKeys();
        expect(keys.find((k: any) => k.id === 'v1')?.active).toBe(false);
        expect(keys.find((k: any) => k.id === 'v2')?.active).toBe(false);
        expect(keys.find((k: any) => k.id === 'v3')?.active).toBe(true);
    });

    it('should encrypt with active key and decrypt with any key', async () => {
        process.env.ENCRYPTION_KEY_ACTIVE = 'v2:test_key_32_characters_long_v2!!';
        process.env.ENCRYPTION_KEY_LEGACY = 'v1:test_key_32_characters_long_v1!!';

        const module = await import('../../../core/keyRotation.js');
        KeyRotationManager = module.KeyRotationManager;
        const manager = new KeyRotationManager();
        const testData = Buffer.from('test data');

        const { encrypted, keyId } = manager.encryptWithActiveKey(testData);
        expect(keyId).toBe('v2');

        const { data, keyId: decryptedKeyId } = manager.tryDecryptWithAllKeys(encrypted);
        expect(data.toString()).toBe('test data');
        expect(decryptedKeyId).toBe('v2');
    });

    it('should decrypt old data encrypted with legacy key', async () => {
        process.env.ENCRYPTION_KEY_ACTIVE = 'v1:test_key_32_characters_long_v1!!';
        
        const module1 = await import('../../../core/keyRotation.js');
        const manager1 = new module1.KeyRotationManager();
        const testData = Buffer.from('old data');
        const { encrypted } = manager1.encryptWithActiveKey(testData);

        vi.resetModules();
        process.env.ENCRYPTION_KEY_ACTIVE = 'v2:test_key_32_characters_long_v2!!';
        process.env.ENCRYPTION_KEY_LEGACY = 'v1:test_key_32_characters_long_v1!!';

        const module2 = await import('../../../core/keyRotation.js');
        const manager2 = new module2.KeyRotationManager();
        const { data, keyId } = manager2.tryDecryptWithAllKeys(encrypted);
        
        expect(data.toString()).toBe('old data');
        expect(keyId).toBe('v1');
    });

    it('should skip invalid legacy key entries', async () => {
        process.env.ENCRYPTION_KEY_ACTIVE = 'v2:test_key_32_characters_long_v2!!';
        process.env.ENCRYPTION_KEY_LEGACY = 'v1:test_key_32_characters_long_v1!!,invalid_format,v3:test_key_32_characters_long_v3!!';

        const module = await import('../../../core/keyRotation.js');
        KeyRotationManager = module.KeyRotationManager;
        const manager = new KeyRotationManager();

        expect(manager.listKeys()).toHaveLength(3);
    });
});
