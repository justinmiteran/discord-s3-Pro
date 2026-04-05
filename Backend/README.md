# Discord S3 Pro - Backend API

Node.js/TypeScript backend for Discord S3 Pro - a distributed, encrypted cloud storage system using Discord as the storage layer.

## Table of Contents

- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Integration Examples](#integration-examples)
- [Advanced Configuration](#advanced-configuration)
- [Architecture](#architecture)
- [Development](#development)

## API Reference

Base URL: `http://localhost:3000`

### Health Check

#### GET /status

Check server and Discord bot status.

**Response:**
```json
{
  "status": "online",
  "bot": "BotName#1234"
}
```

**Status Codes:**
- `200 OK` - Server is running
- `500 Internal Server Error` - Server or bot initialization failed

---

### File Management

#### GET /list

Retrieve all stored files.

**Authentication:** Required (Bearer token)

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

**Status Codes:**
- `200 OK` - Files retrieved successfully
- `401 Unauthorized` - Missing or invalid token
- `500 Internal Server Error` - Database error

---

#### POST /upload

Upload a new file to the storage system.

**Authentication:** Required (Bearer token)

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

**Status Codes:**
- `200 OK` - File uploaded successfully
- `400 Bad Request` - Invalid file path or file too large
- `401 Unauthorized` - Missing or invalid token
- `500 Internal Server Error` - Upload failed

**Notes:**
- Files are automatically deduplicated based on SHA-256 hash
- Maximum file size can be configured in `config.cfg`
- Upload process: Compression → Chunking → Encryption → Discord upload

---

#### GET /download/:id

Download a file by its unique identifier.

**Authentication:** Required (Bearer token)

**Parameters:**
- `id` (string) - File identifier

**Response:** Binary file stream

**Headers:**
- `Content-Disposition: attachment; filename="original_name.ext"`
- `Content-Type: application/octet-stream`

**Status Codes:**
- `200 OK` - File download started
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - File does not exist
- `500 Internal Server Error` - Download failed

**Notes:**
- Files are streamed directly to the client (memory-efficient)
- Automatic integrity verification with SHA-256
- Lazy re-encryption triggered if file uses legacy encryption key

---

#### DELETE /file/:id

Delete a file and its associated chunks.

**Authentication:** Required (Bearer token)

**Parameters:**
- `id` (string) - File identifier

**Response:**
```json
{
  "success": true,
  "message": "File document.pdf removed."
}
```

**Status Codes:**
- `200 OK` - File deleted successfully
- `401 Unauthorized` - Missing or invalid token
- `404 Not Found` - File does not exist
- `500 Internal Server Error` - Deletion failed

**Notes:**
- Chunks are only deleted from Discord if no other files reference them (deduplication)
- Uses reference counting to prevent data loss

---

### Authentication

#### POST /auth/login

Authenticate and receive access tokens.

**Request:**
```json
{
  "username": "admin",
  "password": "your_password"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Status Codes:**
- `200 OK` - Authentication successful
- `400 Bad Request` - Missing credentials
- `401 Unauthorized` - Invalid credentials

---

#### POST /auth/refresh

Refresh an expired access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Status Codes:**
- `200 OK` - Token refreshed successfully
- `400 Bad Request` - Missing refresh token
- `401 Unauthorized` - Invalid or expired refresh token

---

#### POST /auth/logout

Invalidate refresh token.

**Authentication:** Required (Bearer token)

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

**Status Codes:**
- `200 OK` - Logout successful
- `401 Unauthorized` - Missing or invalid token

---

### Key Rotation

#### GET /admin/keys

List all configured encryption keys (admin only).

**Authentication:** Required (Bearer token with admin role)

**Response:**
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

**Status Codes:**
- `200 OK` - Keys retrieved successfully
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - User is not admin

---

## Authentication

All endpoints except `/status` require authentication using JWT Bearer tokens.

### Using Bearer Tokens

Include the access token in the `Authorization` header:

```bash
curl http://localhost:3000/list \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Token Lifecycle

1. **Login** - Obtain access token (15min) and refresh token (7 days)
2. **Use** - Include access token in requests
3. **Refresh** - Use refresh token to get new access token when expired
4. **Logout** - Invalidate refresh token

---

## Integration Examples

### Node.js/JavaScript

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000';
let accessToken = '';

// Login
async function login() {
  const response = await axios.post(`${API_URL}/auth/login`, {
    username: 'admin',
    password: 'password'
  });
  accessToken = response.data.accessToken;
}

// Upload file
async function uploadFile(filePath) {
  const response = await axios.post(
    `${API_URL}/upload`,
    { filePath },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data.id;
}

// List files
async function listFiles() {
  const response = await axios.get(`${API_URL}/list`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return response.data;
}

// Download file
async function downloadFile(fileId, outputPath) {
  const response = await axios.get(`${API_URL}/download/${fileId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    responseType: 'stream'
  });
  
  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}
```

### Python

```python
import requests

API_URL = 'http://localhost:3000'
access_token = ''

# Login
def login():
    global access_token
    response = requests.post(f'{API_URL}/auth/login', json={
        'username': 'admin',
        'password': 'password'
    })
    access_token = response.json()['accessToken']

# Upload file
def upload_file(file_path):
    response = requests.post(
        f'{API_URL}/upload',
        json={'filePath': file_path},
        headers={'Authorization': f'Bearer {access_token}'}
    )
    return response.json()['id']

# List files
def list_files():
    response = requests.get(
        f'{API_URL}/list',
        headers={'Authorization': f'Bearer {access_token}'}
    )
    return response.json()

# Download file
def download_file(file_id, output_path):
    response = requests.get(
        f'{API_URL}/download/{file_id}',
        headers={'Authorization': f'Bearer {access_token}'},
        stream=True
    )
    
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
```

### cURL

```bash
# Login
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}' \
  | jq -r '.accessToken')

# Upload
FILE_ID=$(curl -X POST http://localhost:3000/upload \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filePath":"C:\\file.txt"}' \
  | jq -r '.id')

# List
curl http://localhost:3000/list \
  -H "Authorization: Bearer $TOKEN"

# Download
curl http://localhost:3000/download/$FILE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -o downloaded_file.txt

# Delete
curl -X DELETE http://localhost:3000/file/$FILE_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## Advanced Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DISCORD_TOKEN` | Discord bot authentication token | Yes | - |
| `ENCRYPTION_KEY` | Active 32-character encryption key | Yes | - |
| `ENCRYPTION_KEY_V1` | Legacy encryption key (for rotation) | No | - |
| `ENCRYPTION_KEY_V2` | Legacy encryption key (for rotation) | No | - |
| `LOG_LEVEL` | Logging level (0=DEBUG, 1=INFO, 2=SUCCESS, 3=WARN, 4=ERROR, 5=FATAL) | No | 1 |
| `LOG_JSON` | Output logs in JSON format | No | false |

### Configuration File (config.cfg)

```ini
[Server]
port = 3000                    # API server port
chunk_size = 8388608           # Chunk size in bytes (8MB)
max_file_size = 0              # Max file size (0 = unlimited)

[Database]
db_type = mongodb              # mongodb or json
mongo_uri = mongodb://localhost:27017/discord-s3
# db_path = data/registry.json # For JSON mode

[Discord]
storage_channels = ID1,ID2,ID3 # Comma-separated channel IDs

[Security]
jwt_secret = your_jwt_secret_key_here
jwt_expires_in = 15m           # Access token expiration
jwt_refresh_expires_in = 7d    # Refresh token expiration

[Auth]
mongo_uri = mongodb://localhost:27017/discord-s3-auth
```

### Rate Limiting

The system includes built-in rate limiting for Discord API compliance:
- Default delay: 200ms between Discord operations
- Configurable in `src/constants/index.ts` (`QUEUE.RATE_LIMIT_DELAY`)
- Priority queue: HIGH (user ops) > NORMAL > LOW (background tasks)

### Logging

Logs are written to:
- `logs/app.log` - All application logs
- `logs/error.log` - Error logs only

Log rotation:
- Automatic rotation at 10MB
- Archives kept with timestamp

See [LOG-LEVELS.md](LOG-LEVELS.md) for detailed logging configuration.

---

## Architecture

### System Components

```
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

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed system design and patterns.

---

## Development

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production build
- `npm test` - Run test suite (249 tests)
- `npm run test:coverage` - Generate coverage report
- `npm run lint` - Check code quality
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier

### Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design and patterns
- [DEVELOPMENT.md](DEVELOPMENT.md) - Contribution guidelines and best practices
- [KEY_ROTATION.md](KEY_ROTATION.md) - Encryption key management
- [LOG-LEVELS.md](LOG-LEVELS.md) - Logging configuration
- [src/__tests__/README.md](src/__tests__/README.md) - Test suite documentation

### Project Structure

See [DEVELOPMENT.md](DEVELOPMENT.md#project-structure) for detailed project structure.

---

## Error Handling

All API errors follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "statusCode": 400
}
```

### Common Error Codes

- `FILE_NOT_FOUND` - Requested file does not exist
- `CHUNK_LOST` - Chunk missing from Discord
- `INVALID_PATH` - Invalid file path provided
- `DB_NOT_INITIALIZED` - Database connection failed
- `NO_CHANNELS` - No Discord channels configured
- `FILE_TOO_LARGE` - File exceeds maximum size limit

---

## Security

### Data Protection

- **Encryption**: AES-256-GCM for all data before upload
- **Hashing**: SHA-256 for integrity verification
- **Key Rotation**: Seamless encryption key updates with lazy re-encryption
- **Authentication**: JWT-based with refresh token rotation

### Best Practices

- Store encryption keys in environment variables only
- Rotate encryption keys periodically (see [KEY_ROTATION.md](KEY_ROTATION.md))
- Use HTTPS in production
- Enable rate limiting
- Monitor logs for suspicious activity
- Use dedicated Discord channels
- Implement proper access control

---

## License

See root LICENSE file for details.
