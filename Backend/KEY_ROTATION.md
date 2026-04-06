# Encryption Key Rotation

## Overview

The key rotation mechanism allows you to change encryption keys without losing access to existing data. The system supports multiple encryption keys simultaneously and **automatically re-encrypts old data on access** (lazy re-encryption).

## How It Works

### Crypto Architecture

The system uses a modular 3-layer encryption architecture:

1. **Cipher** (`core/crypto/cipher.ts`): Low-level AES-256-GCM operations
2. **KeyManager** (`core/crypto/keyManager.ts`): Key loading, validation, and management
3. **EncryptionService** (`core/crypto/encryptionService.ts`): High-level orchestration

This separation follows SOLID principles and eliminates code duplication.

### Key Storage Format

Keys are stored in environment variables with the format `id:key`:

- **Active Key**: `ENCRYPTION_KEY_ACTIVE=id:key` - Used for all new encryptions
- **Legacy Keys**: `ENCRYPTION_KEY_LEGACY=id1:key1,id2:key2` - Used only for decryption

**Example:**
```env
ENCRYPTION_KEY_ACTIVE=v2:new_key_32_characters_long_here
ENCRYPTION_KEY_LEGACY=v1:old_key_32_characters_long_here
```

### Key Format Requirements

- **ID**: Short identifier (e.g., `v1`, `v2`, `v3`, `current`)
- **Key**: Exactly 32 characters (256 bits)
- **Separator**: Colon `:` between ID and key
- **Multiple Legacy Keys**: Comma-separated

### Lazy Re-encryption with Deduplication

**Strategy**: Modify the `ChunkRegistry` in place when accessed.

**Implementation**: The `EncryptionService` provides methods for checking if re-encryption is needed and performing decryption with fallback to legacy keys.

When a file is downloaded or uploaded (deduplication):

1. **Check**: Does the `ChunkRegistry` use a legacy key?
2. **If yes**:
   - Download and decrypt all chunks with the old key
   - Re-encrypt with the new active key
   - Upload new chunks to Discord
   - **Update the ChunkRegistry** with new chunks and keyId
   - Delete old chunks from Discord
3. **If no**: Download normally

**Example:**
```
Before:
FileA ──┐
        ├──> ChunkRegistry1 (keyId: v1, refCount: 2, chunks: [old1, old2])
FileB ──┘

FileA is downloaded → Re-encryption triggered:

After:
FileA ──┐
        ├──> ChunkRegistry1 (keyId: v2, refCount: 2, chunks: [new1, new2])
FileB ──┘
        Old chunks [old1, old2] deleted from Discord
```

**Benefits**:
- ✅ All files referencing the registry migrate at once
- ✅ No registry duplication
- ✅ Simpler logic
- ✅ Less storage on Discord
- ✅ Preserves deduplication perfectly

## Key Rotation Process

### Step 1: Add New Key

1. Set new `ENCRYPTION_KEY_ACTIVE` in `.env`:
```env
ENCRYPTION_KEY_ACTIVE=v2:new_key_32_characters_long_here
```

2. Move old key to legacy:
```env
ENCRYPTION_KEY_ACTIVE=v2:new_key_32_characters_long_here
ENCRYPTION_KEY_LEGACY=v1:old_key_32_characters_long_here
```

3. Restart the application

### Step 2: Verify

All new uploads will use the new key. Existing files remain accessible using the legacy key.

```bash
curl http://localhost:3000/admin/keys \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "keys": [
    { "id": "v2", "active": true, "createdAt": "2024-01-15T10:00:00.000Z" },
    { "id": "v1", "active": false, "createdAt": "2024-01-01T00:00:00.000Z" }
  ]
}
```

### Step 3: Automatic Re-encryption

Files are automatically re-encrypted when accessed:
- **On download**: Registry re-encrypted in background
- **On duplicate upload**: Registry re-encrypted if using legacy key

No manual intervention required. The system handles migration transparently.

### Step 4: Remove Legacy Key (After Migration)

Once all old data has been re-encrypted (check logs for legacy key usage):

1. Remove legacy key from `.env`:
```env
ENCRYPTION_KEY_ACTIVE=v2:new_key_32_characters_long_here
# ENCRYPTION_KEY_LEGACY removed
```

2. Restart the application

## Security Considerations

### Key Requirements

- Keys must be exactly 32 characters (256 bits)
- Use cryptographically secure random strings
- Never commit keys to version control
- ID should be unique and sequential (v1, v2, v3, etc.)

### Key Generation

**Generate a secure 32-character key:**
```bash
# Method 1: OpenSSL
openssl rand -base64 24 | cut -c1-32

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(24).toString('base64').slice(0, 32))"

# Method 3: PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### Best Practices

1. **Rotate Regularly**: Change keys every 6-12 months
2. **Keep Legacy Keys**: Maintain old keys until all data is migrated
3. **Monitor Usage**: Check logs for legacy key usage
4. **Secure Storage**: Use environment variables or secret managers (HashiCorp Vault, AWS Secrets Manager)
5. **Backup Keys**: Store keys securely offline before rotation
6. **Test First**: Test rotation in staging environment

## Configuration Examples

### Before Rotation

```env
ENCRYPTION_KEY_ACTIVE=v1:abcdefghijklmnopqrstuvwxyz12
```

### During Rotation (Multiple Legacy Keys)

```env
# New active key
ENCRYPTION_KEY_ACTIVE=v3:new_secure_key_32_chars_long_12

# Legacy keys (comma-separated)
ENCRYPTION_KEY_LEGACY=v1:old_key_32_chars_long_here_abc,v2:mid_key_32_chars_long_here_xyz
```

### After Full Migration

```env
# Only the new key remains
ENCRYPTION_KEY_ACTIVE=v3:new_secure_key_32_chars_long_12
```

## Monitoring

### Check Key Usage

Monitor logs for messages like:
```
[WARN] Decrypted with legacy key { keyId: 'v1' }
```

This indicates files still encrypted with old keys.

### Check Active Keys

```bash
curl http://localhost:3000/admin/keys \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "keys": [
    { "id": "v2", "active": true, "createdAt": "2024-01-15T10:00:00.000Z" },
    { "id": "v1", "active": false, "createdAt": "2024-01-01T00:00:00.000Z" }
  ]
}
```

### Monitor Re-encryption Progress

```bash
# Watch for re-encryption logs
tail -f Backend/logs/app.log | grep "re-encryption"

# Example output:
[INFO] Starting lazy re-encryption { registryId: 'abc123', oldKeyId: 'v1', newKeyId: 'v2' }
[SUCCESS] Lazy re-encryption completed { registryId: 'abc123', duration: 38000 }
```

## Troubleshooting

### "ENCRYPTION_KEY_ACTIVE is required"

**Cause**: Missing or incorrectly formatted active key

**Solution**: Ensure `.env` contains:
```env
ENCRYPTION_KEY_ACTIVE=v1:your_32_character_key_here_abc
```

### "ENCRYPTION_KEY_ACTIVE must be in format 'id:key'"

**Cause**: Missing colon separator or incorrect format

**Solution**: Use format `id:key`, for example:
```env
ENCRYPTION_KEY_ACTIVE=v2:abcdefghijklmnopqrstuvwxyz12
```

### "Encryption key 'vX' not found"

**Cause**: Trying to decrypt data with a key that's no longer configured

**Solution**: Add the missing key back to `ENCRYPTION_KEY_LEGACY`:
```env
ENCRYPTION_KEY_LEGACY=v1:old_key_here,v2:another_old_key
```

### "Failed to decrypt with any available key"

**Cause**: Data was encrypted with a key that's not available

**Solutions**:
1. Check if you removed a legacy key too early
2. Verify the key format is correct (id:key)
3. Check if data was corrupted
4. Ensure keys are exactly 32 characters

### Performance Impact

**Minimal**: Key lookup is O(1), and the system tries the active key first. Legacy keys are only tried on failure.

Re-encryption happens in background with LOW priority, so user operations are not affected.

## API Reference

### GET /admin/keys

Lists all configured encryption keys (IDs only, not the actual keys).

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "keys": [
    {
      "id": "v2",
      "active": true,
      "createdAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": "v1",
      "active": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Keys retrieved successfully
- `401 Unauthorized` - Missing or invalid token

## Migration Strategy

### Zero-Downtime Rotation

1. **Add new key** as `ENCRYPTION_KEY_ACTIVE`
2. **Keep old key** in `ENCRYPTION_KEY_LEGACY`
3. **Deploy** - No downtime, all files remain accessible
4. **Monitor** - Watch for legacy key usage in logs
5. **Wait** - Let lazy re-encryption migrate files naturally
6. **Remove** - Delete legacy key after no more usage in logs

### Emergency Rollback

If issues occur after rotation:

1. Swap keys back:
```env
ENCRYPTION_KEY_ACTIVE=v1:old_key_back_as_primary_here
ENCRYPTION_KEY_LEGACY=v2:new_key_now_legacy_here_abc
```

2. Restart application
3. All data remains accessible

### Forced Migration (Optional)

To force re-encryption of all files:

```bash
# Download and re-upload all files
curl http://localhost:3000/list -H "Authorization: Bearer $TOKEN" | \
  jq -r '.[].id' | \
  while read id; do
    curl http://localhost:3000/download/$id -H "Authorization: Bearer $TOKEN" -o temp.bin
    # This triggers re-encryption on download
    rm temp.bin
  done
```

## Advanced Configuration

### Multiple Legacy Keys

Support for multiple legacy keys during gradual migration:

```env
ENCRYPTION_KEY_ACTIVE=v4:newest_key_32_chars_long_here
ENCRYPTION_KEY_LEGACY=v1:oldest_key,v2:middle_key,v3:recent_key
```

The system will try all keys in order:
1. Active key first (v4)
2. Then legacy keys (v1, v2, v3)

### Key Naming Convention

Recommended naming:
- `v1`, `v2`, `v3` - Version-based
- `2024-01`, `2024-07` - Date-based
- `prod`, `staging` - Environment-based

Choose a consistent convention and stick to it.

## Security Audit Checklist

- [ ] Keys are exactly 32 characters
- [ ] Keys are cryptographically random
- [ ] Keys are stored in environment variables only
- [ ] Keys are not committed to version control
- [ ] Legacy keys are documented with rotation date
- [ ] Monitoring is in place for legacy key usage
- [ ] Backup of keys exists in secure location
- [ ] Rotation schedule is defined (6-12 months)
- [ ] Emergency rollback procedure is tested
