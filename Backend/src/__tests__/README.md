# Test Suite Documentation

## Overview

This test suite ensures the reliability, security, and correctness of the Discord S3 Pro storage system. Tests focus on real-world scenarios, edge cases, and security vulnerabilities with strict coverage thresholds enforced.

## Test Organization

```
__tests__/
├── fixtures/          # Reusable test data
├── helpers/           # Mock factories and test utilities
├── unit/              # Isolated component tests
├── integration/       # Component interaction tests
└── e2e/               # End-to-end application tests
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- AppError.test.ts

# Watch mode
npm test -- --watch

# Run only unit tests
npm test -- unit/

# Run only integration tests
npm test -- integration/

# Run only E2E tests
npm test -- e2e/
```

## Coverage Thresholds

Strict thresholds enforced in CI/CD:

- **Statements**: ≥ 80%
- **Branches**: ≥ 75%
- **Functions**: ≥ 80%
- **Lines**: ≥ 80%

## Unit Tests

### Core Business Logic

- **authService.test.ts**: Authentication flows (login, refresh, logout, admin init)
    - ✅ Invalid credentials
    - ✅ Token rotation
    - ✅ User deletion during refresh
    - ✅ Missing environment variables
- **storageEngine.test.ts**: File upload/download pipeline
    - ✅ Missing files
    - ✅ HTTP headers
- **deleter.test.ts**: File deletion from Discord and registry
    - ✅ File not found
    - ✅ Channel not found
    - ✅ Message already deleted (Discord 10008)
    - ✅ Partial deletion failure
    - ✅ All chunks fail
    - ✅ Empty file (no chunks)
    - ✅ Sequential queue usage
- **queueManager.test.ts**: Task queuing and rate limit handling
    - ✅ Sequential execution
    - ✅ Rate limit delay (200ms)
    - ✅ Queue size warnings (>10)
    - ✅ Rate limit detection

### Data Processing

- **chunker.test.ts**: File splitting into chunks
    - ✅ Multiple writes before end
    - ✅ Error handling
    - ✅ Boundary conditions
- **encryptStream.test.ts**: AES-256-GCM encryption/decryption
    - ✅ **SECURITY**: Tampering detection
    - ✅ **SECURITY**: Truncation attacks
    - ✅ Empty buffers
    - ✅ Binary data
- **hasher.test.ts**: SHA-256 hashing and integrity verification
    - ✅ **SECURITY**: Hash mismatch detection
    - ✅ Consistent hashing
    - ✅ File read errors

### Infrastructure

- **channelPool.test.ts**: Round-robin channel distribution
    - ✅ Even load distribution
    - ✅ Empty channel list error
- **jsonRepository.test.ts**: JSON-based file metadata storage
    - ✅ **CRITICAL**: Corrupted JSON handling
    - ✅ **CRITICAL**: Disk full errors
    - ✅ Empty registry
- **mongodbRepository.test.ts**: MongoDB-based file metadata storage
    - ✅ Connection success/failure
    - ✅ CRUD operations
    - ✅ Database not connected errors
    - ✅ Duplicate key handling
- **userRepository.test.ts**: User authentication persistence
    - ✅ User CRUD operations
    - ✅ Refresh token management
    - ✅ Index creation

### API Layer

- **authMiddleware.test.ts**: JWT token validation
    - ✅ Malformed tokens
    - ✅ Empty Bearer tokens
    - ✅ Expired tokens
    - ✅ Wrong secret
- **errorHandler.test.ts**: Error response formatting
    - ✅ AppError handling
    - ✅ Generic errors
    - ✅ Non-Error objects
- **validate.test.ts**: Request validation with Zod
    - ✅ Body validation
    - ✅ Params validation
    - ✅ Error messages

### Error Handling

- **AppError.test.ts**: Custom error classes and error conversion
    - ✅ All error subclasses
    - ✅ toError() edge cases
    - ✅ Stack traces

## Integration Tests

- **health.routes.test.ts**: Health check endpoint with real HTTP requests
    - ✅ Bot status
    - ✅ Uninitialized bot
    - ✅ Content-Type headers
- **auth.routes.test.ts**: Authentication endpoints
    - ✅ Login with valid/invalid credentials
    - ✅ Token refresh
    - ✅ Logout
    - ✅ Request validation
- **file.routes.test.ts**: File management endpoints
    - ✅ Upload files
    - ✅ Download files
    - ✅ List files
    - ✅ Delete files
    - ✅ Error handling

## End-to-End Tests

- **app.test.ts**: Full application stack testing
    - ✅ Health check flow
    - ✅ File management flow
    - ✅ Error handling flow
    - ✅ CORS and headers
    - ✅ Malformed JSON handling

## Test Fixtures

Located in `fixtures/index.ts`:

- **authFixtures**: User credentials and tokens with bcrypt hashing
- **fileFixtures**: Sample file metadata with realistic SHA-256 hashes and chunk arrays

## Mock Helpers

Located in `helpers/mocks.ts`:

- **createMockConfig()**: Configuration object factory
- **createMockLogger()**: Logger mock factory
- **createMockDiscordClient()**: Discord client mock factory
- **createMockTextChannel()**: Discord channel mock factory
- **createMockMessage()**: Discord message mock factory
- **createMockRepository()**: Database repository mock factory

Located in `helpers/testSetup.ts`:

- **mockConfig**: Centralized configuration for all tests
- **mockLogger**: Centralized logger mock
- **setupStandardMocks()**: Setup config and logger mocks
- **setupBeforeEach()**: Standard beforeEach hook

## Critical Test Scenarios

### Security

- ✅ Encryption tampering detection (encryptStream.test.ts)
- ✅ Encryption truncation attacks (encryptStream.test.ts)
- ✅ Hash mismatch detection (hasher.test.ts)
- ✅ JWT expiration and invalid tokens (authMiddleware.test.ts)
- ✅ Malformed JWT tokens (authMiddleware.test.ts)
- ✅ Password validation (authService.test.ts)

### Data Integrity

- ✅ Chunk corruption detection (storageEngine.test.ts)
- ✅ File hash verification (hasher.test.ts)
- ✅ Round-trip encryption (encryptStream.test.ts)
- ✅ Corrupted JSON registry (jsonRepository.test.ts)
- ✅ Partial deletion handling (deleter.test.ts)
- ✅ Discord message not found (deleter.test.ts)

### Error Handling

- ✅ Missing files (storageEngine.test.ts)
- ✅ Disk full errors (jsonRepository.test.ts)
- ✅ Invalid input validation (validate.test.ts)
- ✅ Rate limit handling (queueManager.test.ts)
- ✅ File read errors (hasher.test.ts)
- ✅ Database connection failures (mongodbRepository.test.ts)

### Load Distribution

- ✅ Even channel distribution (channelPool.test.ts)
- ✅ Sequential task processing (queueManager.test.ts)
- ✅ Rate limit delays (queueManager.test.ts)

## Best Practices

1. **Isolation**: Each test is independent and doesn't rely on other tests
2. **Clarity**: Test names describe the scenario and expected outcome
3. **Realism**: Use realistic test data from fixtures
4. **Mocking**: Mock external dependencies (Discord API, filesystem, database)
5. **Assertions**: Test behavior, not implementation details
6. **Edge Cases**: Include error scenarios, boundary conditions, and security attacks
7. **No Flaky Tests**: Use fake timers for time-dependent tests
8. **Centralized Mocks**: Use helpers/testSetup.ts for standard mocks
9. **Coverage Thresholds**: Enforce minimum coverage in CI/CD

## Test Improvements History

### Round 1: Initial Cleanup

- Removed 4 useless test files (bot.test.ts, rateLimiter.test.ts, trivial route tests)
- Added security tests for encryption tampering
- Added hash mismatch detection test
- Improved authService tests with JWT validation
- Created reusable mock factories
- Enhanced fixtures with realistic data

### Round 2: Edge Cases

- Added multiple writes test for chunker
- Added error handling test for chunker
- Fixed hasher error message assertion
- Added malformed token tests for authMiddleware
- Added empty Bearer token test
- Added corrupted JSON test for jsonRepository
- Added disk full error test for jsonRepository
- Fixed queueManager tests with fake timers
- Added rate limit delay test
- Added queue size warning test

### Round 3: Critical Coverage

- Added deleter.test.ts (8 tests, 100% coverage)
- File deletion with all error scenarios
- Discord API error handling (10008, channel not found)
- Partial deletion failures
- Sequential queue usage verification

### Round 4: Professional Organization (Current)

- **Removed**: helpers/setup.ts (redundant)
- **Added**: helpers/testSetup.ts (centralized setup utilities)
- **Added**: mongodbRepository.test.ts (production database tests)
- **Added**: userRepository.test.ts (authentication persistence tests)
- **Added**: integration/auth.routes.test.ts (authentication endpoints)
- **Added**: integration/file.routes.test.ts (file management endpoints)
- **Added**: e2e/app.test.ts (full application stack tests)
- **Updated**: vitest.config.ts (coverage thresholds enforced)

## Future Improvements

- Add MongoDB integration tests with testcontainers
- Add performance benchmarks for large file uploads
- Add concurrency tests for parallel uploads
- Add stress tests for queue manager under high load
- Add Discord API integration tests (test environment)
- Add mutation testing with Stryker
- Add visual regression tests for CLI output
