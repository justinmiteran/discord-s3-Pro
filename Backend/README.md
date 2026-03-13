# Discord Storage Backend

The Backend is the core engine responsible for transforming local binary data into encrypted segments distributed across Discord channels.

## Technical Hierarchy

```text
Backend/
|-- src/                    # Primary application logic
|   |-- api/                # Network interface and endpoints
|   |   +-- routes.js
|   |-- core/               # Critical system services
|   |   |-- channelPool.js
|   |   |-- database.js
|   |   |-- deleter.js
|   |   |-- queueManager.js
|   |   +-- storageEngine.js
|   |-- pipeline/           # Binary data transformation
|   |   |-- chunker.js
|   |   +-- encryptStream.js
|   |-- repositories/       # Agnostic Storage Providers
│   |   |-- mongodbRepository.js
│   |   +-- jsonRepository.js
|   |-- utils/              # Helper functions and diagnostics
|   |   |-- hasher.js
|   |   +-- logger.js
|   |-- bot.js
|   |-- config.js
|   +-- server.js
|-- config.cfg              # User configuration (MANDATORY)
|-- Dockerfile              # Professional containerization
|-- index.js
+-- package.json
```

## Key Architectural Features

- **Strict Configuration Management**: Uses a dual-layer system (Secret `.env` + Operational `config.cfg`) with a Fail-Fast validator to prevent misconfigured starts.
- **Database Agnostic (Repository Pattern)**: Core logic is decoupled from storage technology. Supports high-performance **MongoDB** for production and **JSON** for lightweight local testing.
- **Dockerized Infrastructure**: Fully orchestrated via Docker Compose with persistent volumes for data integrity.
- **Stream Processing**: Implements a pipeline for handling large files without exceeding memory limits.
- **Queue Management**: Regulates request frequency to comply with Discord Global Rate Limits.
- **Channel Pooling**: Distributes data chunks across multiple channels to optimize availability and circumvent per-channel rate limits.
- **Security**: Ensures data privacy through client-side encryption before transmission.
- **Data Integrity**: Uses SHA-256 hashing to verify file consistency during both upload and download cycles.

## API Endpoints

- `POST /upload`: Initiates the file processing and storage pipeline.
- `GET /download/:id`: Reconstructs files from distributed Discord segments.
- `DELETE /file/:id`: Removes remote Discord messages and updates the active repository.
- `GET /list`: Retrieves metadata for all stored objects from the configured database.

```

```
