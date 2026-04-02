# Encryption Key Rotation

## Overview

The key rotation mechanism allows you to change encryption keys without losing access to existing data. The system supports multiple encryption keys simultaneously and **automatically re-encrypts old data on access** (lazy re-encryption).

## How It Works

### Key Storage

- **Active Key**: `ENCRYPTION_KEY` environment variable - used for all new encryptions
- **Legacy Keys**: `ENCRYPTION_KEY_V1`, `ENCRYPTION_KEY_V2`, etc. - used only for decryption

### Lazy Re-encryption with Deduplication

**Strategy**: Modify the `ChunkRegistry` in place when accessed.

When a file is downloaded:

1. **Check**: Does the `ChunkRegistry` use a legacy key?
2. **If yes**:
   - Download and decrypt all chunks with the old key
   - Re-encrypt with the new active key
   - Upload new chunks to Discord
   - **Update the ChunkRegistry** with new chunks and keyId
   - Delete old chunks from Discord
3. **If no**: Download normally

**Example**:
```
Before:
FileA ──┐
        ├──> ChunkRegistry1 (keyId: v1, refCount: 2, chunks: [old1, old2])
FileB ──┘

FileA is downloaded → Re-encryption triggered:

After:
FileA ──┐
        ├──> ChunkRegistry1 (keyId: current, refCount: 2, chunks: [new1, new2])
FileB ──┘
        Old chunks [old1, old2] deleted from Discord
```

**Benefits**:
- ✅ All files referencing the registry migrate at once
- ✅ No registry duplication
- ✅ Simpler logic
- ✅ Less storage on Discord
- ✅ Preserves deduplication perfectly

### Key Rotation Process

#### Step 1: Add New Key

1. Set new `ENCRYPTION_KEY` in `.env`:
```env
ENCRYPTION_KEY=new-key-32-characters-long-here
```

2. Move old key to legacy:
```env
ENCRYPTION_KEY_V1=old-key-32-characters-long-here
```

3. Restart the application

#### Step 2: Verify

All new uploads will use the new key. Existing files remain accessible using the legacy key.

```bash
curl http://localhost:3000/admin/keys \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "keys": [
    { "id": "current", "active": true, "createdAt": "2024-01-15T10:00:00.000Z" },
    { "id": "v1", "active": false, "createdAt": "2024-01-01T00:00:00.000Z" }
  ]
}
```

#### Step 3: Re-encrypt Old Data (Optional)

To re-encrypt old data with the new key, you would need to:

1. Download the file
2. Delete the old file
3. Re-upload with the new key

This is not automated to avoid accidental data loss.

#### Step 4: Remove Legacy Key (After Migration)

Once all old data has been re-encrypted or is no longer needed:

1. Remove `ENCRYPTION_KEY_V1` from `.env`
2. Restart the application

## Security Considerations

### Key Requirements

- Keys must be exactly 32 characters (256 bits)
- Use cryptographically secure random strings
- Never commit keys to version control

### Key Generation

```bash
# Generate a secure 32-character key
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### Best Practices

1. **Rotate Regularly**: Change keys every 6-12 months
2. **Keep Legacy Keys**: Maintain old keys until all data is migrated
3. **Monitor Usage**: Check logs for legacy key usage
4. **Secure Storage**: Use environment variables or secret managers
5. **Backup Keys**: Store keys securely offline before rotation

## Example Configuration

### Before Rotation

```env
ENCRYPTION_KEY=abcdefghijklmnopqrstuvwxyz123456
```

### During Rotation

```env
# New active key
ENCRYPTION_KEY=new-secure-key-32-chars-long-12

# Legacy keys (for decryption only)
ENCRYPTION_KEY_V1=abcdefghijklmnopqrstuvwxyz123456
```

### After Full Migration

```env
# Only the new key remains
ENCRYPTION_KEY=new-secure-key-32-chars-long-12
```

## Monitoring

### Check Key Usage

Monitor logs for messages like:
```
[WARN] Decrypted with legacy key { keyId: 'v1' }
```

This indicates files still encrypted with old keys.

### List Active Keys

```bash
curl http://localhost:3000/admin/keys \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting

### "Encryption key 'vX' not found"

**Cause**: Trying to decrypt data with a key that's no longer configured

**Solution**: Add the missing key back to environment variables

### "Failed to decrypt with any available key"

**Cause**: Data was encrypted with a key that's not available

**Solutions**:
1. Check if you removed a legacy key too early
2. Verify the `ENCRYPTION_KEY` is correct
3. Check if data was corrupted

### Performance Impact

**Minimal**: Key lookup is O(1), and the system tries the active key first. Legacy keys are only tried on failure.

## API Reference

### GET /admin/keys

Lists all configured encryption keys (IDs only, not the actual keys).

**Authentication**: Required (Bearer token)

**Response**:
```json
{
  "keys": [
    {
      "id": "current",
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

## Migration Strategy

### Zero-Downtime Rotation

1. **Add new key** as `ENCRYPTION_KEY`
2. **Keep old key** as `ENCRYPTION_KEY_V1`
3. **Deploy** - no downtime, all files remain accessible
4. **Monitor** - watch for legacy key usage in logs
5. **Migrate** - gradually re-upload important files
6. **Remove** - delete legacy key after migration complete

### Emergency Rollback

If issues occur after rotation:

1. Swap keys back:
```env
ENCRYPTION_KEY=old-key-back-as-primary
ENCRYPTION_KEY_V1=new-key-now-legacy
```

2. Restart application
3. All data remains accessible
