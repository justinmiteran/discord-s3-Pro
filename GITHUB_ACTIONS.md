# GitHub Actions Integration Guide

This document explains the CI/CD setup for Discord S3 Pro using GitHub Actions (100% free tier).

## 🚀 Workflows

### 1. CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Jobs:**

#### Lint & Format Check
- Runs ESLint on all TypeScript files
- Checks code formatting with Prettier
- Fails if any issues found

#### Tests & Coverage
- Starts MongoDB service container
- Runs all 170 tests (unit + integration + e2e)
- Generates coverage report
- Uploads to Codecov (optional)
- Enforces coverage thresholds (40/75/60/40)

#### Build
- Compiles TypeScript to JavaScript
- Uploads build artifacts (retained 7 days)
- Verifies production build succeeds

**Status:** ✅ All checks must pass before merge

---

### 2. Docker Build & Push (`.github/workflows/docker.yml`)

**Triggers:**
- Push to `main` branch
- Git tags matching `v*` pattern
- Pull requests to `main` (build only, no push)

**Features:**
- Multi-platform builds (linux/amd64, linux/arm64)
- Pushes to GitHub Container Registry (ghcr.io)
- Automatic tagging:
  - `main` → `latest`
  - `v1.2.3` → `1.2.3`, `1.2`, `1`
  - PR → `pr-123`
- Layer caching for faster builds

**Registry:** `ghcr.io/YOUR_USERNAME/storagebot`

---

### 3. Release Automation (`.github/workflows/release.yml`)

**Triggers:**
- Push to `main` branch (after PR merge)

**Features:**
- Automatic version bumping (semantic versioning)
- Changelog generation from commit messages
- GitHub Release creation
- Git tags (major, minor, patch)

**Commit Types:**
- `feat:` → Minor version bump (1.0.0 → 1.1.0)
- `fix:` → Patch version bump (1.0.0 → 1.0.1)
- `feat!:` or `BREAKING CHANGE:` → Major version bump (1.0.0 → 2.0.0)

---

## 🔧 Setup Instructions

### 1. Enable GitHub Actions

1. Go to your repository on GitHub
2. Click **Settings** → **Actions** → **General**
3. Under "Actions permissions", select **Allow all actions**
4. Under "Workflow permissions", select **Read and write permissions**
5. Check **Allow GitHub Actions to create and approve pull requests**
6. Click **Save**

### 2. Configure Secrets (Optional)

Go to **Settings** → **Secrets and variables** → **Actions**

**Optional secrets:**
- `CODECOV_TOKEN` - For coverage reports (get from codecov.io)
- `DISCORD_TOKEN` - For E2E tests (if needed)

**Note:** `GITHUB_TOKEN` is automatically provided by GitHub Actions.

### 3. Enable GitHub Container Registry

1. Go to **Settings** → **Packages**
2. Make package public or configure access
3. Docker images will be available at:
   ```
   ghcr.io/YOUR_USERNAME/storagebot:latest
   ```

### 4. Pull Docker Images

```bash
# Pull latest
docker pull ghcr.io/YOUR_USERNAME/storagebot:latest

# Pull specific version
docker pull ghcr.io/YOUR_USERNAME/storagebot:1.2.3

# Run container
docker run -d \
  -e DISCORD_TOKEN=your_token \
  -e ENCRYPTION_KEY=your_key \
  -p 3000:3000 \
  ghcr.io/YOUR_USERNAME/storagebot:latest
```

---

## 🪝 Pre-commit Hooks (Husky)

### Setup

Hooks are automatically installed when running:
```bash
npm install
```

### Hooks

#### `pre-commit`
- Runs `lint-staged` on staged files
- Auto-fixes ESLint issues
- Auto-formats with Prettier
- Prevents commit if errors remain

#### `commit-msg`
- Validates commit message format
- Enforces Conventional Commits
- Provides helpful error messages

**Valid commit examples:**
```bash
git commit -m "feat(auth): add JWT refresh tokens"
git commit -m "fix(storage): resolve chunk corruption"
git commit -m "docs: update API documentation"
```

**Invalid commit examples:**
```bash
git commit -m "added feature"           # ❌ No type
git commit -m "feat add feature"        # ❌ Missing colon
git commit -m "feature: add something"  # ❌ Invalid type
```

---

## 📦 Dependabot

**Configuration:** `.github/dependabot.yml`

**Updates:**
- **npm dependencies** - Weekly on Mondays
- **Docker base images** - Weekly on Mondays
- **GitHub Actions** - Weekly on Mondays

**Limits:**
- Max 5 npm PRs open at once
- Max 3 Docker PRs open at once
- Max 3 Actions PRs open at once

**Auto-ignore:**
- Major version updates (manual review required)

**Labels:**
- `dependencies` - All dependency updates
- `backend` - npm updates
- `docker` - Dockerfile updates
- `ci` - GitHub Actions updates

---

## 🎯 Workflow Status Badges

Add to your README.md:

```markdown
![CI](https://github.com/YOUR_USERNAME/storageBot/workflows/CI/badge.svg)
![Docker](https://github.com/YOUR_USERNAME/storageBot/workflows/Docker%20Build%20%26%20Push/badge.svg)
[![codecov](https://codecov.io/gh/YOUR_USERNAME/storageBot/branch/main/graph/badge.svg)](https://codecov.io/gh/YOUR_USERNAME/storageBot)
```

---

## 📊 Free Tier Limits

### GitHub Actions
- **2,000 minutes/month** for private repos
- **Unlimited** for public repos
- **Storage:** 500 MB artifacts

### GitHub Container Registry
- **500 MB** free storage
- **1 GB** free bandwidth/month
- Unlimited public packages

### Optimization Tips
- Use caching to reduce build times
- Limit artifact retention (7 days default)
- Use `if` conditions to skip unnecessary jobs
- Run tests in parallel when possible

---

## 🔍 Monitoring

### View Workflow Runs
1. Go to **Actions** tab in your repository
2. Click on a workflow to see runs
3. Click on a run to see job details
4. Click on a job to see step logs

### Check Coverage
- View in workflow logs
- Upload to Codecov for visual reports
- Coverage badge in README

### Docker Images
- View at `https://github.com/YOUR_USERNAME/storageBot/pkgs/container/storagebot`
- Check image sizes and tags
- Download statistics

---

## 🐛 Troubleshooting

### CI Fails on Tests
```bash
# Run locally first
npm test
npm run test:coverage
```

### Docker Build Fails
```bash
# Test build locally
docker build -t test ./Backend
```

### Pre-commit Hook Fails
```bash
# Run manually
npm run lint:fix
npm run format
```

### Commit Message Rejected
```bash
# Use correct format
git commit -m "type(scope): description"
```

---

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)

---

**Questions?** Open an issue or discussion on GitHub!
