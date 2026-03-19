# Discord S3 Pro - Backend

## Overview

Node.js/TypeScript backend for Discord S3 Pro - a distributed, encrypted cloud storage system using Discord as the storage layer.

## Features

- **AES-256-GCM Encryption**: Military-grade encryption for all stored data
- **Gzip Compression**: Reduces storage footprint
- **Stream Processing**: Memory-efficient handling of large files
- **Multi-Channel Load Balancing**: Distributes data across Discord channels
- **Rate Limit Management**: Intelligent queue system for API compliance
- **Dual Storage Backends**: MongoDB or JSON file storage
- **SHA-256 Integrity Verification**: Ensures data consistency

## Quick Start

### Prerequisites
- Node.js 18+
- Discord Bot with Message Content intent
- MongoDB (optional, can use JSON)

### Installation

```bash
npm install
```

### Configuration

1. Create `.env` in project root:
```env
DISCORD_TOKEN=your_bot_token
ENCRYPTION_KEY=your_32_char_key
```

2. Configure `config.cfg`:
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

### Running

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

## API Endpoints

### GET /status
Health check endpoint

**Response:**
```json
{
  "status": "online",
  "bot": "BotName#1234"
}
```

### GET /list
Retrieve all stored files

**Response:**
```json
[
  {
    "id": "a7f2b",
    "name": "document.pdf",
    "size": 1048576,
    "date": "2024-01-15T10:30:00.000Z",
    "chunkCount": 5
  }
]
```

### POST /upload
Upload a new file

**Request:**
```json
{
  "filePath": "C:\\path\\to\\file.txt"
}
```

**Response:**
```json
{
  "success": true,
  "id": "a7f2b",
  "url": "/download/a7f2b"
}
```

### GET /download/:id
Download a file by ID

**Response:** Binary file stream

### DELETE /file/:id
Delete a file and all its chunks

**Response:**
```json
{
  "success": true,
  "message": "File document.pdf removed."
}
```

## Project Structure

```
src/
├── api/              # HTTP routes and controllers
├── core/             # Business logic and services
├── pipeline/         # Data transformation (chunking, encryption)
├── repositories/     # Data persistence layer
├── types/            # TypeScript interfaces and DTOs
├── utils/            # Helper functions (logging, hashing)
├── constants/        # Application constants
├── bot.ts            # Discord client initialization
├── config.ts         # Configuration management
└── server.ts         # Express server setup
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for contribution guidelines.

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production build
- `npm run lint` - Check code quality
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DISCORD_TOKEN | Discord bot authentication token | Yes |
| ENCRYPTION_KEY | 32-character encryption key | Yes |

## Configuration Options

### Server
- `port`: HTTP server port (default: 3000)
- `chunk_size`: Size of each chunk in bytes (default: 8MB)

### Database
- `db_type`: Storage backend (`mongodb` or `json`)
- `mongo_uri`: MongoDB connection string (if using MongoDB)
- `db_path`: JSON file path (if using JSON)

### Discord
- `storage_channels`: Comma-separated Discord channel IDs

## Logging

Logs are written to:
- `logs/app.log` - All application logs
- `logs/error.log` - Error logs only

## Security

- All data is encrypted with AES-256-GCM before upload
- Encryption keys are stored in environment variables
- SHA-256 hashing ensures data integrity
- No plaintext data is ever stored on Discord

## License

See root LICENSE file
