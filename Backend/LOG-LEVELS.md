# Log Levels Guide

## Quick Start

### Enable DEBUG Logs

**Environment Variable (.env):**
```env
LOG_LEVEL=0
```

**Command Line (Temporary):**
```bash
# PowerShell
$env:LOG_LEVEL="0"; npm run dev

# Bash/Linux/Mac
LOG_LEVEL=0 npm run dev
```

## Available Log Levels

| Level | Value | Use Case | Logs Displayed |
|-------|-------|----------|----------------|
| **DEBUG** | 0 | Development, debugging | All logs |
| **INFO** | 1 | Production (default) | INFO, SUCCESS, WARN, ERROR, FATAL |
| **SUCCESS** | 2 | Minimal production | SUCCESS, WARN, ERROR, FATAL |
| **WARN** | 3 | Problem monitoring | WARN, ERROR, FATAL |
| **ERROR** | 4 | Errors only | ERROR, FATAL |
| **FATAL** | 5 | Critical errors only | FATAL |

## Recommended Settings

### Development
```env
LOG_LEVEL=0  # DEBUG - See everything
LOG_JSON=false
```

### Staging/Testing
```env
LOG_LEVEL=1  # INFO - Balanced
LOG_JSON=true
```

### Production
```env
LOG_LEVEL=1  # INFO - Standard
LOG_JSON=true
```

### High-Performance Production
```env
LOG_LEVEL=2  # SUCCESS - Minimal
LOG_JSON=true
```

## Log Examples

### DEBUG (0)
```
[DEBUG] Loading environment variables
[DEBUG] Discord channels loaded { count: 3 }
[DEBUG] Chunk uploaded { chunkIndex: 1, channelId: "123..." }
[DEBUG] Hash calculated { hash: "a7f2b...", duration: 150 }
```

### INFO (1)
```
[INFO] Initializing database { provider: "mongodb" }
[INFO] Starting file upload { fileName: "test.txt", size: 1024 }
[INFO] GET /status - 200 (5ms)
```

### SUCCESS (2)
```
[SUCCESS] Configuration loaded successfully
[SUCCESS] Database initialized { provider: "mongodb", connectionTime: 1250 }
[SUCCESS] Discord Bot connected { username: "Bot#1234" }
[SUCCESS] File upload completed { fileId: "abc123", duration: 2500 }
```

### WARN (3)
```
[WARN] Queue size growing { queueSize: 15 }
[WARN] Rate limit hit { resetAfter: 1000 }
[WARN] File not found for deletion { fileId: "invalid" }
```

### ERROR (4)
```
[ERROR] Upload pipeline failed { fileName: "test.txt", duration: 2500 }
[ERROR] Chunk upload failed { chunkIndex: 5 }
[ERROR] MongoDB connection failed
[ERROR] Integrity verification failed - CORRUPTION DETECTED
```

### FATAL (5)
```
[FATAL] Configuration file missing { path: "/app/config.cfg" }
[FATAL] Database initialization failed
[FATAL] System startup failed
```

## Filtering Logs

### View Specific Level
```bash
# DEBUG only
grep "\[DEBUG\]" logs/app.log

# Errors and warnings
grep -E "\[ERROR\]|\[WARN\]" logs/app.log

# Critical issues
grep -E "\[ERROR\]|\[FATAL\]" logs/app.log
```

### Real-time Monitoring
```bash
# Watch all logs
tail -f logs/app.log

# Watch errors only
tail -f logs/error.log

# Filter by keyword
tail -f logs/app.log | grep "upload"
```

## Performance Impact

- **DEBUG (0)**: High log volume, slight performance impact
- **INFO (1)**: Balanced, minimal impact (recommended)
- **SUCCESS (2)**: Low volume, negligible impact
- **WARN+ (3-5)**: Very low volume, no measurable impact

## Log Rotation

- Automatic rotation at 10MB
- Archives kept with timestamp
- Location: `logs/app.log`, `logs/error.log`

## Troubleshooting

### Logs Not Appearing

1. Check `.env` file: `LOG_LEVEL=0`
2. Restart application
3. Verify no spaces around `=`
4. Check file permissions on `logs/` directory

### Too Many Logs

1. Increase `LOG_LEVEL` to `1` or `2`
2. Use log filtering with `grep`
3. Enable log rotation (automatic)

### Production Monitoring

```env
LOG_LEVEL=1
LOG_JSON=true  # For parsing with tools like ELK, Grafana Loki
```

Then use log aggregation tools:
- Grafana Loki
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Datadog
- Splunk
