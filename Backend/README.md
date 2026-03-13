# Discord Storage Backend

The Backend is the core engine responsible for transforming local binary data into encrypted segments distributed across Discord channels.

## Technical Hierarchy

```text
Backend/
|-- data/                   # Metadata and local persistence
|   +-- registry.json
|-- src/                    # Primary application logic
|   |-- api/                # Network interface and endpoints
|   |   +-- routes.js
|   |-- core/               # Critical system services
|   |   |-- channelPool.js
|   |   |-- deleter.js
|   |   |-- queueManager.js
|   |   +-- storageEngine.js
|   |-- pipeline/           # Binary data transformation
|   |   |-- chunker.js
|   |   +-- encryptStream.js
|   |-- utils/              # Helper functions and diagnostics
|   |   |-- hasher.js
|   |   +-- logger.js
|   |-- bot.js
|   |-- config.js
|   +-- server.js
|-- .env
|-- index.js
+-- package.jsonon
└── server.js           # Express API Entry Point

```

## Key Architectural Features

- **Stream Processing**: Implements a pipeline for handling large files without exceeding memory limits.
- **Queue Management**: Regulates request frequency to comply with Discord Global Rate Limits and prevent account suspension.
- **Channel Pooling**: Distributes data chunks across multiple channels to optimize availability and circumvent per-channel rate limits.
- **Security**: Ensures data privacy through client-side encryption before transmission.
- **Data Integrity**: Uses SHA-256 hashing to verify file consistency during both upload and download cycles.

## API Endpoints

- `POST /upload`: Initiates the file processing and storage pipeline.
- `GET /download/:id`: Reconstructs files from distributed Discord segments.
- `DELETE /file/:id`: Removes remote Discord messages and updates the local registry.
- `GET /list`: Retrieves metadata for all stored objects.
