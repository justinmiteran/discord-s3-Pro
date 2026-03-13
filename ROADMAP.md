# Discord S3 Pro - Evolution Roadmap

This document serves as the operational context. It tracks the current state and planned improvements.

## Current State

* **Core**: Node.js with `discord.js` and `express`.
* **Pipeline**: AES-256-GCM encryption, GZIP compression, and chunking.
* **Storage**: Distributed across multiple Discord channels (Channel Pool).
* **Current Registry**: Local `registry.json` file.

---

## Improvement Steps

### Step 1: Foundations & Security

* [ ] **Database Migration**: Replace `registry.json` with a robust database system (Choice pending user validation).
* [ ] **Secret Hardening**: Move `DISCORD_TOKEN` and `ENCRYPTION_KEY` to system environment variables.
* [ ] **Key Derivation (KDF)**: Implement a unique encryption key per file.

### Step 2: Pipeline Performance

* [ ] **Parallelization**: Upload multiple chunks simultaneously.
* [ ] **Streaming Upload**: Support `multipart/form-data` to remove local `filePath` dependency.
* [ ] **Queue Optimization**: Implement a "Token Bucket" algorithm for the `queueManager`.

### Step 3: Resilience & Integrity

* [x] **Full Hashing**: Calculate/store SHA-256 of original files.
* [ ] **Metadata Backup**: Automate database replication to a dedicated Discord channel.
* [ ] **Auto-Retry**: Handle failed chunk uploads automatically.

---

**Pour la suite, quel système de base de données souhaites-tu implémenter pour remplacer le fichier JSON ?** (Exemples : SQLite, MongoDB, PostgreSQL, ou autre).