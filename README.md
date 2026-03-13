# Discord S3 Pro

Discord S3 Pro is a decentralized cloud storage solution that utilizes Discord's infrastructure as a storage backend. The project is architected as a modular system consisting of a Node.js API server and a PowerShell Command Line Interface (CLI).

## Project Structure

```text
.
├── Backend/              # Node.js API Server & Core Logic
└── FrontendPowershell/   # PowerShell CLI for end-users

```

## System Overview

1. **Backend**: Manages the data pipeline, including AES-256 encryption, file chunking, request queuing, and Discord API interfacing.
2. **Frontend**: Provides a user-friendly interface to manage cloud operations such as uploading, downloading, and resource deletion.

## Quick Start

1. Configure the Discord Bot credentials in `Backend/.env`.
2. Initialize the server: `cd Backend && npm install && npm start`.
3. Verify connectivity via CLI: `./FrontendPowershell/cli.ps1 -Action status`.