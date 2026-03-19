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
│   ├── api/              # HTTP routes
│   ├── core/             # Business logic
│   ├── pipeline/         # Data transformation
│   ├── repositories/     # Data persistence
│   ├── types/            # TypeScript interfaces
│   ├── utils/            # Helper functions
│   ├── constants/        # Application constants
│   ├── bot.ts            # Discord client
│   ├── config.ts         # Configuration loader
│   └── server.ts         # Express setup
├── logs/                 # Application logs
├── data/                 # JSON database (if used)
├── index.ts              # Entry point
└── package.json
```

## Adding New Features

### 1. Create a New Route
```typescript
// src/api/routes.ts
router.get('/my-endpoint', async (req, res) => {
    try {
        // Implementation
        res.json({ success: true });
    } catch (err: any) {
        logger.error(`Error: ${err.message}`);
        res.status(HTTP_STATUS.INTERNAL_ERROR).json({ error: err.message });
    }
});
```

### 2. Add a New Service
```typescript
// src/core/myService.ts
import logger from '../utils/logger.js';

/**
 * Description of what this service does
 * @param param1 - Description
 * @returns Description
 */
export const myFunction = async (param1: string): Promise<void> => {
    logger.info(`Starting operation: ${param1}`);
    // Implementation
};
```

### 3. Extend the Repository
```typescript
// src/types/index.ts
export interface IRepository {
    // ... existing methods
    myNewMethod(): Promise<void>;
}

// Implement in both repositories
// src/repositories/jsonRepository.ts
// src/repositories/mongodbRepository.ts
```

## Testing

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

**Issue**: "No Discord channels configured"
- **Solution**: Add channel IDs to `config.cfg` under `[Discord]`

**Issue**: Rate limit errors
- **Solution**: Reduce concurrent operations or increase `QUEUE.RATE_LIMIT_DELAY`

## Building for Production

```bash
npm run build
npm start
```

## Code Quality Tools

```bash
# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
```

## Contributing Guidelines

1. Create a feature branch
2. Follow code standards
3. Add JSDoc documentation
4. Test thoroughly
5. Update ARCHITECTURE.md if needed
6. Submit pull request

## Performance Tips

- Use streams for large files
- Avoid loading entire files into memory
- Leverage the queue for Discord API calls
- Monitor `logs/` for bottlenecks
