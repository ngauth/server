# Contributing to ngauth

Thank you for your interest in contributing to ngauth! We welcome contributions from the community.

## Code of Conduct

This project adheres to our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## How to Contribute

### Reporting Issues

Before creating an issue, please search existing issues to avoid duplicates. When reporting bugs or requesting features:

- Use a clear, descriptive title
- Provide detailed steps to reproduce (for bugs)
- Include your environment details (OS, Node.js version, Docker version)
- Add relevant code snippets, logs, or screenshots

### Submitting Changes

1. Fork the repository and create a branch from `main`
2. Make your changes following our coding standards
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Run linter: `npm run lint`
6. Update documentation as needed
7. Submit a pull request with a clear description

## Development Setup

### Prerequisites

- Node.js 14 or higher
- Docker (for integration tests)
- Git

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/server.git
cd server

# Install dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Start development server
npm start
```

## Project Structure

```
src/               # Source code
├── routes/        # API endpoints
├── middleware/    # Express middleware
└── index.js       # Application entry point

test/              # Test suites
├── unit/          # Unit tests
└── integration/   # Integration tests
```

## Coding Standards

- Follow Standard JavaScript style (enforced by ESLint)
- Write clear, maintainable code
- Add tests for new features
- Document public APIs
- Keep commits focused and atomic

## Questions?

Feel free to open an issue for any questions about contributing.

---

Thank you for contributing to ngauth!
