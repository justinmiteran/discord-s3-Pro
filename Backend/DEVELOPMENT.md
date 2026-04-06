# Development Guide

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for MongoDB)
- Discord Bot Token
- PowerShell 5.1+ (for CLI)

## Project Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd storageBot/Backend
npm install
```

### 2. Environment Configuration

Create `.env` in project root:
```env
DISCORD_TOKEN=your_bot_token_here
ENCRYPTION_KEY=your_32_character_secret_key
```

Create `Backend/config.cfg`:
```ini
[Server]
port = 3000
chunk_size = 8388608

[Database]
db_type = mongodb
mongo_uri = mongodb://localhost:27017/discord-s3

[Discord]
storage_channels = CHANNEL_ID_1,CHANNEL_ID_2
```

### 3. Start Development Environment

**Option A: Full Docker Stack**
```bash
docker compose up -d
```

**Option B: Hybrid (Local Backend + Docker DB)**
```bash
docker compose up -d db
cd Backend
npm run dev
```

## Code Standards

### TypeScript Configuration
- Strict mode enabled
- No implicit any
- ES modules (`.js` imports required)

### Naming Conventions
- **Files**: camelCase (e.g., `storageEngine.ts`)
- **Classes**: PascalCase (e.g., `QueueManager`)
- **Functions**: camelCase (e.g., `processUpload`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `HTTP_STATUS`)

### Documentation
- All public functions require JSDoc comments
- Include `@param` and `@returns` tags
- Explain complex logic with inline comments

### Error Handling
- Use constants from `constants/index.ts`
- Log errors with context
- Throw descriptive error messages

## Project Structure

```
Backend/
├── src/
│   ├── api/                    # HTTP routes and middleware
│   │   ├── middlewares/        # Auth, validation, error handling
│   │   ├── routes/             # REST endpoints
│   │   └── validation/         # Request schemas
│   ├── core/                   # Business logic
│   │   ├── auth/               # Authentication service
│   │   ├── crypto/             # Encryption module
│   │   │   ├── cipher.ts       # Low-level AES-256-GCM operations
│   │   │   ├── keyManager.ts   # Key loading and management
│   │   │   ├── encryptionService.ts # High-level orchestration
│   │   │   └── index.ts        # Module exports
│   │   ├── discord/            # Discord operations
│   │   │   ├── bot.ts          # Discord client
│   │   │   ├── channelPool.ts  # Load balancing
│   │   │   └── discordChunkManager.ts  # Centralized chunk operations
│   │   ├── reencryption/       # Key rotation
│   │   │   ├── lazyReencryption.ts     # Background re-encryption
│   │   │   └── reencryptionScheduler.ts # Trigger management
│   │   ├── storage/            # File operations
│   │   │   ├── storageEngine.ts # Upload/download orchestration
│   │   │   └── deleter.ts      # File deletion
│   │   ├── database.ts         # Repository pattern
│   │   └── queueManager.ts     # Rate limit management
│   ├── pipeline/               # Data transformation
│   │   └── chunker.ts          # File splitting
│   ├── repositories/           # Data persistence
│   │   ├── mongodbRepository.ts # MongoDB storage
│   │   └── userRepository.ts   # User authentication
│   ├── types/                  # TypeScript definitions
│   │   ├── dto/                # Data transfer objects
│   │   ├── interfaces/         # Repository interfaces
│   │   └── models/             # Data models
│   ├── utils/                  # Helper functions
│   │   ├── errors/             # Custom error classes
│   │   ├── hasher.ts           # SHA-256 hashing
│   │   ├── logger.ts           # Structured logging
│   │   └── sanitizer.ts        # Log sanitization
│   ├── constants/              # Application constants
│   ├── config/                 # Configuration management
│   ├── env.ts                  # Environment variables
│   ├── index.ts                # Entry point
│   └── server.ts               # Express setup
├── logs/                       # Application logs
├── data/                       # JSON database (if used)
├── config.cfg                  # Operational configuration
├── Dockerfile
├── ARCHITECTURE.md             # System design documentation
├── DEVELOPMENT.md              # This file
├── KEY_ROTATION.md             # Key rotation guide
└── package.json
```

## Adding New Features

### 1. Create a New Route
```typescript
// src/api/routes/myFeature.routes.ts
import { Router } from 'express';
import logger from '../../utils/logger.js';
import { HTTP_STATUS } from '../../constants/index.js';

const router = Router();

router.get('/my-endpoint', async (req, res) => {
    try {
        // Implementation
        res.json({ success: true });
    } catch (err: any) {
        logger.error('Error in my-endpoint', err);
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: err.message });
    }
});

export default router;
```

### 2. Add a New Core Service
```typescript
// src/core/myService.ts
import logger from '../utils/logger.js';
import { Client } from 'discord.js';
import { encryptionService } from './crypto/index.js';

/**
 * Description of what this service does
 * @param client - Discord bot client
 * @param param1 - Description
 * @returns Description
 */
export const myFunction = async (client: Client, param1: string): Promise<void> => {
    logger.info('Starting operation', { param1 });
    // Use encryption service if needed
    const encrypted = await encryptionService.encryptWithActiveKey(Buffer.from(param1));
    // Implementation
};
```

### 3. Extend Discord Chunk Manager
```typescript
// src/core/discord/discordChunkManager.ts

/**
 * New chunk operation
 * @param chunk - Chunk metadata
 * @param priority - Queue priority
 * @returns Operation result
 */
async myChunkOperation(
    chunk: ChunkMetadata,
    priority: TaskPriority = TaskPriority.NORMAL,
): Promise<void> {
    // Use existing patterns: queue.add(), pool.next(), etc.
}
```

### 4. Extend the Repository
```typescript
// src/types/interfaces/repository.interface.ts
export interface IRepository {
    // ... existing methods
    myNewMethod(): Promise<void>;
}

// Implement in both repositories
// src/repositories/jsonRepository.ts
// src/repositories/mongodbRepository.ts
```

## Testing

### Running Tests
```bash
# Run all tests (205 tests)
npm test

# Run with coverage report
npm run test:coverage

# Run specific test file
npm test -- storageEngine.test.ts

# Watch mode for development
npm test -- --watch

# Run only unit tests
npm test -- unit/

# Run only integration tests
npm test -- integration/
```

### Test Organization
- **Unit tests**: `src/__tests__/unit/` - Isolated component tests
- **Integration tests**: `src/__tests__/integration/` - Component interaction tests
- **E2E tests**: `src/__tests__/e2e/` - Full application stack tests

See [src/__tests__/README.md](src/__tests__/README.md) for detailed test documentation.

### Manual Testing
```bash
# Start the server
npm run dev

# Use PowerShell CLI
cd ../FrontendPowershell
.\cli.ps1 -Action status
.\cli.ps1 -Action upload -Path "C:\test.txt"
.\cli.ps1 -Action list
```

### API Testing with curl
```bash
# Health check
curl http://localhost:3000/status

# List files
curl http://localhost:3000/list

# Upload
curl -X POST http://localhost:3000/upload \
  -H "Content-Type: application/json" \
  -d '{"filePath":"C:\\test.txt"}'
```

## Debugging

### Enable Verbose Logging
Check `logs/app.log` and `logs/error.log` for detailed information.

### Common Issues

**Issue**: "Database not connected"
- **Solution**: Ensure MongoDB is running and `mongo_uri` is correct
- **Check**: `docker compose ps` to verify MongoDB container

**Issue**: "No Discord channels configured"
- **Solution**: Add channel IDs to `config.cfg` under `[Discord]`
- **Verify**: Bot has access to channels and Message Content intent enabled

**Issue**: Rate limit errors
- **Solution**: Reduce concurrent operations or increase `QUEUE.RATE_LIMIT_DELAY`
- **Alternative**: Add more channels to the pool

**Issue**: "Encryption key 'vX' not found"
- **Solution**: Add missing legacy key to environment variables
- **See**: [KEY_ROTATION.md](KEY_ROTATION.md) for key rotation guide
- **Note**: The new crypto architecture uses `encryptionService` from `core/crypto/index.js`

**Issue**: Tests failing after changes
- **Solution**: Update mocks in `src/__tests__/helpers/`
- **Check**: Coverage thresholds with `npm run test:coverage`

## Building for Production

```bash
npm run build
npm start
```

## Code Quality Tools

```bash
# Linting
npm run lint          # Check code quality
npm run lint:fix      # Auto-fix issues

# Formatting
npm run format        # Format with Prettier

# Type checking
npm run build         # Compile TypeScript

# Testing
npm test              # Run test suite
npm run test:coverage # Generate coverage report
```

### Coverage Thresholds
- **Statements**: ≥ 80%
- **Branches**: ≥ 75%
- **Functions**: ≥ 80%
- **Lines**: ≥ 80%

## Contributing Guidelines

1. Create a feature branch
2. Follow code standards
3. Add JSDoc documentation
4. Test thoroughly
5. Update ARCHITECTURE.md if needed
6. Submit pull request

## Performance Tips

- Use streams for large files (avoid loading into memory)
- Leverage the centralized Discord Chunk Manager for batch operations
- Monitor queue size in logs (warnings at >10 tasks)
- Use multiple Discord channels (3-5 recommended) for load balancing
- Enable MongoDB for production (faster than JSON)
- Adjust `chunk_size` based on network speed (default: 8MB)
- Use lazy re-encryption for seamless key rotation
- Monitor logs for bottlenecks: `logs/app.log`

## Architecture Patterns

### Centralized Service Pattern
All Discord operations go through `discordChunkManager.ts`:
- Single point of maintenance
- Consistent error handling
- Reusable batch operations

### Lazy Evaluation Pattern
Re-encryption triggered on-demand:
- Non-blocking background operations
- Preserves user experience
- Automatic migration during file access

### Priority Queue Pattern
Tasks prioritized by importance:
- `HIGH`: User operations (upload, download)
- `NORMAL`: Regular operations (delete)
- `LOW`: Background tasks (re-encryption)

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design patterns.
