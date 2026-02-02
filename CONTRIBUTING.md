# Contributing to ngauth

First off, thank you for considering contributing to ngauth! It's people like you that make ngauth a great tool for the community.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior by opening an issue.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code snippets, configuration files, etc.)
- **Describe the behavior you observed** and what you expected
- **Include environment details** (OS, Node.js version, Docker version)
- **Add screenshots or logs** if applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful** to most users
- **List any alternatives** you've considered

### Pull Requests

We actively welcome your pull requests:

1. **Fork the repo** and create your branch from `main`
2. **Add tests** if you've added code that should be tested
3. **Ensure the test suite passes** (`npm test`)
4. **Update documentation** if you've changed APIs or added features
5. **Follow the code style** (we use ESLint - `npm run lint`)
6. **Write a clear commit message**

#### Pull Request Process

1. Update the README.md or relevant documentation with details of changes
2. Update the CHANGELOG.md if applicable
3. The PR will be merged once you have sign-off from a maintainer

## Development Setup

### Prerequisites

- Node.js >= 14.x
- npm >= 6.x
- Docker (for integration tests)

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

### Project Structure

```
server/
├── src/               # Source code
│   ├── routes/        # Express route handlers
│   ├── middleware/    # Express middleware
│   ├── db.js          # Database (in-memory)
│   ├── tokens.js      # JWT generation/verification
│   ├── oidc.js        # OIDC claim building
│   └── index.js       # Main application
├── test/              # Tests
│   ├── unit/          # Unit tests
│   └── integration/   # Integration tests
├── docs/              # Documentation
└── package.json
```

### Testing Guidelines

- **Write tests** for all new features and bug fixes
- **Unit tests** should be fast and isolated
- **Integration tests** can use real server instances
- Run `npm test` before submitting PR
- Aim for high test coverage

### Code Style

- We use **ESLint** with standard JavaScript style
- Run `npm run lint` to check code style
- Run `npm run lint:fix` to auto-fix issues
- Use meaningful variable and function names
- Add comments for complex logic

### Commit Messages

Follow these guidelines for commit messages:

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters
- Reference issues and pull requests after the first line

Example:
```
Add UserInfo endpoint for OIDC compliance

- Implement /userinfo route with Bearer token auth
- Add scope-based claim filtering
- Include integration tests
- Closes #42
```

## Testing with Testcontainers

When adding new features, consider how they work with Testcontainers:

```javascript
const { GenericContainer } = require('testcontainers');

const container = await new GenericContainer('ngauth/server')
  .withExposedPorts(3000)
  .withEnvironment('NGAUTH_PRESET', 'keycloak')
  .start();

// Your tests here
```

## Documentation

- Keep documentation up-to-date with code changes
- Add examples for new features
- Update API documentation in README.md
- Add inline code comments for complex logic

## Questions?

Feel free to:
- Open an issue with the label `question`
- Start a discussion in GitHub Discussions
- Check existing documentation in `/docs`

## Recognition

Contributors will be recognized in:
- README.md contributors section
- GitHub contributors page
- Release notes

Thank you for contributing to ngauth! 🎉
