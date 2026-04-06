# TODO & Roadmap

## 🚨 Urgent

- [x] Fix Dockerfile — references `index.js` but project compiles to `dist/src/index.js`
- [x] Add API authentication — all REST endpoints are currently unprotected (JWT + MongoDB)
- [x] Add input validation middleware (Zod or Joi) on all API routes
- [x] Add basic unit tests (unit + integration)
- [x] Fix incorrectly typed errors in error handling
- [x] Fix authMiddleware throw → next() (errors now reach errorHandler)
- [x] Fix findUserById ObjectId vs string mismatch
- [x] Add POST /auth/logout + refresh token rotation
- [x] Remove orphaned jwtRefreshSecret

## ⚡ Short Term (1–2 weeks)

- [x] File deduplication based on SHA-256 hash
- [x] Server-side rate limiting (`express-rate-limit`)
- [x] PowerShell CLI — add progress bar
- [x] PowerShell CLI — add upload resume on failure
- [x] Swagger/OpenAPI documentation
- [x] Max file size validation (configurable limit)
- [x] Prevent sensitive data from leaking into logs
- [x] Encryption key rotation mechanism without data loss
- [x] MongoDB connection pool explicit configuration

## 📅 Medium Term (1–2 months)

- [ ] Web UI (React or Vue) to replace PowerShell CLI with drag & drop
- [ ] Real-time upload progress display in web UI
- [ ] Desktop notifications on upload completion
- [ ] Cross-platform CLI rewrite in Node.js (Linux/macOS support)
- [ ] File sharing with expiring temporary links
- [x] Parallelize chunk uploads (currently sequential)
- [x] Adaptive compression level by file type
- [ ] In-memory metadata cache for frequently accessed files
- [ ] Optimized streaming with smarter buffers
- [ ] CI/CD pipeline (GitHub Actions — auto tests + deploy)
- [ ] Multi-environment configs (dev / staging / production)
- [ ] Advanced health checks (Discord, MongoDB, disk space)
- [ ] Sequence diagrams for complex flows in documentation
- [ ] Integration examples (how to embed in other apps)
- [ ] Detailed troubleshooting guide
- [ ] Performance benchmarks publication

## 🔮 Long Term (3–6 months)

- [ ] Multitenancy — multiple users with data isolation
- [ ] Per-user storage quotas
- [ ] File versioning (keep modification history)
- [ ] Redis cache layer for frequently accessed chunks/metadata
- [ ] Microservices split (upload / download / metadata as independent services)
- [ ] RabbitMQ or Redis message queue for async task management
- [ ] API Gateway with reverse proxy (Nginx or Traefik) + load balancing
- [ ] Kubernetes support (Helm charts for scalable deployment)
- [ ] Multi-cloud backends (AWS S3, Google Cloud Storage as alternatives)
- [ ] OpenTelemetry distributed tracing
- [ ] Prometheus/Grafana monitoring and metrics
- [ ] Automatic MongoDB backup strategy
- [ ] Secrets management (HashiCorp Vault or AWS Secrets Manager)
- [ ] GDPR/HIPAA compliance features
- [ ] Metadata encryption at rest in MongoDB
- [ ] Event sourcing — trace all operations for audit and replay
- [ ] Mobile client (iOS/Android)

## 💡 Ideas (no priority)

- [ ] Thumbnail generation for images/videos (preview)
- [ ] Client-side encryption option (encrypt before sending to server)
- [ ] Webhook notifications on upload complete / error
- [ ] GraphQL API as alternative to REST
- [ ] WebSocket support for real-time notifications
- [ ] Plugin system to extend functionality
- [ ] Advanced search (by name, date, size, tags)
- [ ] Adaptive compression by file type
- [ ] Blockchain file integrity proof
- [ ] AI-powered features (auto classification, OCR, content analysis)
