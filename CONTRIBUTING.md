# Contributing to Discord S3 Pro

Thank you for considering contributing to Discord S3 Pro! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Git
- Discord Bot Token

### Setup Development Environment

1. Fork and clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/storageBot.git
cd storageBot
```

2. Install dependencies:
```bash
cd Backend
npm install
```

3. Create `.env` file:
```env
DISCORD_TOKEN=your_token_here
ENCRYPTION_KEY=your_32_character_key_here
```

4. Start MongoDB:
```bash
docker compose up -d db
```

5. Run development server:
```bash
npm run dev
```

## Development Workflow

### Branch Naming

- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/what-changed` - Documentation
- `refactor/what-changed` - Code refactoring
- `test/what-added` - Test additions

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Tests
- `build`: Build system
- `ci`: CI/CD
- `chore`: Maintenance

**Examples:**
```
feat(auth): add JWT refresh token support
fix(storage): resolve chunk corruption on large files
docs: update API documentation
test(deleter): add edge case coverage
```

### Code Standards

- **Language**: All code, comments, and documentation in English
- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (auto-formatted on commit)
- **Linting**: ESLint (auto-fixed on commit)
- **Testing**: All features must include tests

### Testing

Run tests before submitting:

```bash
npm test                 # Run all tests
npm run test:coverage    # Check coverage
npm run lint             # Check code quality
npm run build            # Verify build
```

**Coverage Requirements:**
- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

## Pull Request Process

1. **Create a branch** from `develop`
2. **Make your changes** following code standards
3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Run all checks**:
   ```bash
   npm run lint
   npm test
   npm run build
   ```
6. **Commit** using Conventional Commits
7. **Push** to your fork
8. **Open a Pull Request** to `develop` branch

### PR Checklist

- [ ] Code follows project style
- [ ] Self-reviewed code
- [ ] Added/updated tests
- [ ] All tests pass
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Conventional commit messages

## Project Structure

```
Backend/
├── src/
│   ├── api/              # REST endpoints
│   ├── core/             # Business logic
│   ├── pipeline/         # Data transformation
│   ├── repositories/     # Data persistence
│   ├── utils/            # Helpers
│   └── __tests__/        # Test suites
├── logs/                 # Application logs
└── config.cfg            # Configuration
```

## Architecture Guidelines

- **Separation of Concerns**: Keep layers independent
- **Error Handling**: Use AppError classes
- **Logging**: Use structured logger
- **Security**: Never commit secrets
- **Performance**: Consider memory usage for streams

## Need Help?

- 📖 Read [ARCHITECTURE.md](Backend/ARCHITECTURE.md)
- 📖 Read [DEVELOPMENT.md](Backend/DEVELOPMENT.md)
- 💬 Open a [Discussion](https://github.com/YOUR_USERNAME/storageBot/discussions)
- 🐛 Report [Issues](https://github.com/YOUR_USERNAME/storageBot/issues)

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- GitHub contributors page

Thank you for contributing! 🚀
