# Discord S3 Pro

![Tests](https://github.com/justinmiteran/storageBot/workflows/Tests/badge.svg)
![Lint](https://github.com/justinmiteran/storageBot/workflows/Lint/badge.svg)
![Coverage](https://github.com/justinmiteran/storageBot/workflows/Coverage/badge.svg)
![Docker](https://github.com/justinmiteran/storageBot/workflows/Docker/badge.svg)
![Security](https://github.com/justinmiteran/storageBot/workflows/Security/badge.svg)

A professional-grade, decentralized cloud storage solution that leverages Discord's infrastructure as a storage backend. Built with security, scalability, and maintainability in mind.

## 🎯 Key Features

- **🔐 Military-Grade Encryption**: AES-256-GCM encryption for all data
- **📦 Intelligent Compression**: Gzip compression reduces storage footprint
- **⚡ Stream Processing**: Memory-efficient handling of files of any size
- **🔄 Load Balancing**: Multi-channel distribution for optimal performance
- **🛡️ Data Integrity**: SHA-256 hashing ensures file consistency
- **🗄️ Flexible Storage**: MongoDB or JSON-based metadata storage
- **🚦 Rate Limit Management**: Intelligent queue system for API compliance
- **🐳 Docker Ready**: Full containerization support

## 📋 Table of Contents

- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Usage](#usage)
- [Development](#development)
- [Security](#security)
- [License](#license)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  PowerShell CLI Client                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Node.js/TypeScript Backend                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Compress │→ │  Chunk   │→ │ Encrypt  │→ │  Queue   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼               ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   MongoDB    │ │  Discord │ │  JSON Store  │
│  (Metadata)  │ │  (Chunks)│ │  (Metadata)  │
└──────────────┘ └──────────┘ └──────────────┘
```

### Data Flow

**Upload Process:**
1. File → Compression (gzip) → Chunking (8MB) → Encryption (AES-256-GCM)
2. Encrypted chunks → Queue → Discord channels
3. Metadata → Database (MongoDB/JSON)

**Download Process:**
1. Fetch metadata from database
2. Retrieve chunks from Discord → Decrypt → Decompress
3. Verify integrity (SHA-256) → Stream to client

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose (recommended)
- **Discord Bot** with Message Content intent enabled
- **PowerShell** 5.1+ (for CLI)

### Installation

#### Option 1: Docker (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd storageBot
```

2. Create `.env` file in project root:
```env
DISCORD_TOKEN=your_discord_bot_token
ENCRYPTION_KEY=your_32_character_secret_key_here
```

3. Configure `Backend/config.cfg`:
```ini
[Server]
port = 3000
chunk_size = 8388608

[Database]
db_type = mongodb
mongo_uri = mongodb://db:27017/discord-s3

[Discord]
storage_channels = CHANNEL_ID_1,CHANNEL_ID_2,CHANNEL_ID_3
```

4. Start the stack:
```bash
docker compose up -d
```

#### Option 2: Local Development

1. Start MongoDB:
```bash
docker compose up -d db
```

2. Install and run backend:
```bash
cd Backend
npm install
npm run dev
```

### Verify Installation

```powershell
cd FrontendPowershell
.\cli.ps1 -Action status
```

Expected output: `[OK] Serveur actif (Bot: YourBot#1234)`

## 📁 Project Structure

```
storageBot/
├── Backend/                    # Node.js/TypeScript API Server
│   ├── src/
│   │   ├── api/               # REST endpoints
│   │   ├── core/              # Business logic
│   │   ├── pipeline/          # Data transformation
│   │   ├── repositories/      # Data persistence
│   │   ├── types/             # TypeScript definitions
│   │   ├── utils/             # Helper functions
│   │   └── constants/         # Application constants
│   ├── logs/                  # Application logs
│   ├── config.cfg             # Operational configuration
│   ├── Dockerfile
│   ├── ARCHITECTURE.md        # Detailed architecture docs
│   ├── DEVELOPMENT.md         # Development guide
│   └── package.json
│
├── FrontendPowershell/        # PowerShell CLI
│   ├── cli.ps1               # Command-line interface
│   └── README.md
│
├── .env                       # Secrets (not in git)
├── docker-compose.yml         # Container orchestration
├── .gitignore
└── README.md                  # This file
```

## ⚙️ Configuration

### Environment Variables (`.env`)

```env
# Discord Bot Token (required)
DISCORD_TOKEN=your_bot_token_here

# 32-character encryption key (required)
ENCRYPTION_KEY=abcdefghijklmnopqrstuvwxyz123456
```

### Operational Config (`Backend/config.cfg`)

```ini
[Server]
port = 3000                    # API server port
chunk_size = 8388608           # 8MB chunks

[Database]
db_type = mongodb              # mongodb or json
mongo_uri = mongodb://db:27017/discord-s3
# db_path = data/registry.json # For JSON mode

[Discord]
storage_channels = ID1,ID2,ID3 # Comma-separated channel IDs
```

## 💻 Usage

### PowerShell CLI

```powershell
# Check system status
.\cli.ps1 -Action status

# Upload a file
.\cli.ps1 -Action upload -Path "C:\Documents\file.pdf"

# List all files
.\cli.ps1 -Action list

# Download a file
.\cli.ps1 -Action download -Id a7f2b -Path "C:\Downloads\file.pdf"

# Delete a file
.\cli.ps1 -Action delete -Id a7f2b
```

### REST API

```bash
# Health check
curl http://localhost:3000/status

# List files
curl http://localhost:3000/list

# Upload
curl -X POST http://localhost:3000/upload \
  -H "Content-Type: application/json" \
  -d '{"filePath":"C:\\file.txt"}'

# Download
curl http://localhost:3000/download/a7f2b -o file.txt

# Delete
curl -X DELETE http://localhost:3000/file/a7f2b
```

## 🛠️ Development

### Backend Development

```bash
cd Backend
npm install
npm run dev          # Development with hot reload
npm run build        # Compile TypeScript
npm run lint         # Check code quality
npm run format       # Format code
npm test             # Run test suite
npm run test:coverage # Run tests with coverage report
```

### Testing

Comprehensive test suite with strict coverage thresholds:
- **170 tests** across unit, integration, and E2E levels
- **Coverage thresholds**: 80% statements, 75% branches, 80% functions
- **Test categories**:
  - Unit tests: Core business logic, data processing, infrastructure
  - Integration tests: HTTP endpoints, route handlers
  - E2E tests: Full application stack

See [Backend/src/__tests__/README.md](Backend/src/__tests__/README.md) for detailed test documentation.

### Code Standards

- **TypeScript Strict Mode**: Enabled
- **Documentation**: JSDoc required for all public functions
- **Error Handling**: Use constants from `constants/index.ts`
- **Logging**: Use structured logger from `utils/logger.ts`
- **Testing**: All new features must include tests

See [Backend/DEVELOPMENT.md](Backend/DEVELOPMENT.md) for detailed guidelines.

## 🔒 Security

### Encryption
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Management**: Environment variables only
- **Scope**: All data encrypted before leaving the system

### Integrity
- **Hashing**: SHA-256 for all files
- **Verification**: Automatic on download
- **Corruption Detection**: Immediate notification

### Best Practices
- Never commit `.env` files
- Rotate encryption keys periodically
- Use dedicated Discord channels
- Monitor logs for suspicious activity

## 📊 Monitoring

### Logs Location
- `Backend/logs/app.log` - All application events
- `Backend/logs/error.log` - Errors only

### MongoDB UI (Optional)
Access Mongo Express at `http://localhost:8081`
- Username: `admin`
- Password: `pass`

## 🐛 Troubleshooting

### Common Issues

**"Database not connected"**
- Ensure MongoDB is running: `docker compose ps`
- Check `mongo_uri` in `config.cfg`

**"No Discord channels configured"**
- Add channel IDs to `config.cfg` under `[Discord]`
- Ensure bot has access to channels

**Rate limit errors**
- Reduce concurrent operations
- Add more channels to the pool

**File corruption on download**
- Check logs for chunk recovery errors
- Verify Discord messages weren't manually deleted

## 📈 Performance Tips

- Use multiple Discord channels (3-5 recommended)
- Adjust `chunk_size` based on network speed
- Use MongoDB for production (faster than JSON)
- Monitor queue length in logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow code standards
4. Add documentation
5. Submit a pull request

## 📄 License

See LICENSE file for details.

## 🙏 Acknowledgments

Built with:
- [Discord.js](https://discord.js.org/) - Discord API wrapper
- [Express](https://expressjs.com/) - Web framework
- [MongoDB](https://www.mongodb.com/) - Database
- [TypeScript](https://www.typescriptlang.org/) - Type safety

---

**⚠️ Disclaimer**: This project is for educational purposes. Ensure compliance with Discord's Terms of Service when using this software.
