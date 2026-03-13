# Discord S3 Pro

Discord S3 Pro is a decentralized cloud storage solution that utilizes Discord's infrastructure as a storage backend. The project is architected as a modular system consisting of a Node.js API server and a PowerShell Command Line Interface (CLI).

## Project Structure

```text
.
├── .env                    # ROOT: Sensitive Secrets (Tokens, Keys)
├── docker-compose.yml      # ROOT: Orchestration for App + MongoDB
├── Backend/                # Node.js API Server & Core Logic
└── FrontendPowershell/     # PowerShell CLI for end-users

```

## System Overview

1. **Backend**: Manages the data pipeline, including AES-256 encryption, file chunking, request queuing, and multi-provider metadata storage (MongoDB/JSON).
2. **Frontend**: Provides a user-friendly interface to manage cloud operations such as uploading, downloading, and resource deletion.

## Quick Start (Production/Docker)

1. Configure your secrets in `.env` at the project root.
2. Configure your operational settings in `Backend/config.cfg` (ensure `db_type = mongodb`).
3. Launch the stack: `docker compose up -d`.

## Quick Start (Hybrid Development)

1. Start only the database: `docker compose up -d db`.
2. Configure `Backend/config.cfg` with `mongo_uri = mongodb://localhost:27017/discord-s3`.
3. Initialize the server: `cd Backend && npm install && npm start`.