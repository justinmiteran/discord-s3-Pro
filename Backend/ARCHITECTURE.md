# Architecture Documentation

## Overview

Discord S3 Pro is a distributed cloud storage system that leverages Discord's infrastructure as a storage backend. The system is built with TypeScript and follows a modular, layered architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│              (PowerShell CLI / HTTP Client)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (Express)                        │
│  - Health Check    - Upload    - Download    - Delete       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Core Services                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Storage      │  │ Queue        │  │ Discord      │      │
│  │ Engine       │  │ Manager      │  │ Chunk Mgr    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Reencryption │  │ Channel      │  │ Key          │      │
│  │ Scheduler    │  │ Pool         │  │ Rotation     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼               ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│  Pipeline    │ │ Database │ │   Discord    │
│  - Chunker   │ │ Layer    │ │   Bot API    │
│  - Encrypt   │ │          │ │              │
│  - Compress  │ │          │ │              │
└──────────────┘ └──────────┘ └──────────────┘
```

## Layer Descriptions

### 1. API Layer (`src/api/`)
- **Purpose**: HTTP interface for client interactions
- **Components**:
  - `routes.ts`: Defines REST endpoints
- **Responsibilities**:
  - Request validation
  - Response formatting
  - Error handling

### 2. Core Services (`src/core/`)
- **crypto/cipher.ts**: Low-level AES-256-GCM encryption/decryption operations
- **crypto/keyManager.ts**: Encryption key loading, validation, and management
- **crypto/encryptionService.ts**: High-level encryption orchestration layer
- **storage/storageEngine.ts**: Orchestrates upload/download operations
- **storage/deleter.ts**: Handles file deletion with deduplication support
- **discord/discordChunkManager.ts**: Centralized Discord operations (upload, download, delete chunks)
- **discord/channelPool.ts**: Load balances across Discord channels
- **discord/bot.ts**: Discord client initialization
- **reencryption/lazyReencryption.ts**: Background re-encryption service
- **reencryption/reencryptionScheduler.ts**: Triggers re-encryption when needed
- **queueManager.ts**: Manages Discord API rate limits with priority system
- **database.ts**: Repository pattern implementation

### 3. Pipeline Layer (`src/pipeline/`)
- **chunker.ts**: Splits files into manageable chunks

### 4. Repository Layer (`src/repositories/`)
- **jsonRepository.ts**: File-based metadata storage
- **mongodbRepository.ts**: MongoDB metadata storage
- **Pattern**: Strategy pattern for swappable storage backends

### 5. Utilities (`src/utils/`)
- **logger.ts**: Structured logging with file output
- **hasher.ts**: SHA-256 integrity verification

## Data Flow

### Upload Process
1. Client sends file path to `/upload`
2. File is read and compressed (gzip)
3. Compressed data is split into chunks
4. Each chunk is encrypted (AES-256-GCM)
5. Chunks are queued and uploaded to Discord
6. Metadata is saved to database
7. File ID is returned to client

### Download Process
1. Client requests `/download/:id`
2. Metadata is retrieved from database
3. Chunks are fetched from Discord (queued)
4. Each chunk is decrypted
5. Decrypted chunks are decompressed
6. Hash verification ensures integrity
7. File is streamed to client

## Design Patterns

### 1. Repository Pattern
- Abstracts data storage implementation
- Allows switching between JSON and MongoDB
- Interface: `IRepository`

### 2. Strategy Pattern
- Dynamic repository selection based on config
- Encryption algorithm encapsulation

### 3. Queue Pattern
- Sequential task execution with priority levels (HIGH, NORMAL, LOW)
- Rate limit management
- Backpressure handling

### 4. Round-Robin Load Balancing
- Distributes chunks across Discord channels
- Prevents single channel overload

### 5. Centralized Service Pattern
- Discord Chunk Manager consolidates all Discord operations
- Single point of maintenance for chunk operations
- Consistent error handling and logging

### 6. Lazy Evaluation Pattern
- Re-encryption triggered on-demand during file access
- Non-blocking background operations
- Preserves user experience during key rotation

## Security Features

1. **AES-256-GCM Encryption**: All chunks encrypted before upload
2. **Modular Crypto Architecture**: 3-layer design (Cipher, KeyManager, EncryptionService) following SOLID principles
3. **SHA-256 Hashing**: Integrity verification on download
4. **Environment Variables**: Sensitive credentials isolated
5. **No Plaintext Storage**: Data never stored unencrypted
6. **Key Rotation Support**: Seamless encryption key updates with lazy re-encryption
7. **Deduplication Security**: Reference counting prevents premature chunk deletion

## Scalability Considerations

1. **Multi-Channel Support**: Horizontal scaling via channel pool
2. **Stream Processing**: Memory-efficient for large files
3. **Queue Management**: Prevents API rate limit violations
4. **Modular Database**: Easy migration to distributed databases

## Configuration

- **config.cfg**: Operational settings (ports, chunk size, channels)
- **.env**: Sensitive credentials (tokens, keys)
- **Dynamic Loading**: Repository selection at runtime

## Error Handling

- Centralized error codes in `constants/`
- Graceful degradation for missing chunks
- Comprehensive logging to `logs/` directory
- HTTP status codes follow REST conventions
