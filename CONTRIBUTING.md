# Contributing to Copilot Workflow Composer

Thank you for your interest in contributing to CWC! This document provides guidelines for contributing to the project.

---

## 🎯 Ways to Contribute

- **Bug Reports**: Report bugs via GitHub Issues
- **Feature Requests**: Suggest new features via GitHub Issues
- **Code Contributions**: Submit pull requests with improvements
- **Documentation**: Improve documentation and examples
- **Testing**: Add test coverage and report test results

---

## 🚀 Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/copilot-workflow-composer.git
cd copilot-workflow-composer
```

### 2. Install Dependencies

```bash
# Using Bun (recommended)
bun install

# Or using npm
npm install
```

### 3. Run Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/unit/test-architect.test.ts

# Run with coverage
bun test --coverage
```

### 4. Build

```bash
# Build TypeScript
bun run build

# Type check
bunx tsc --noEmit
```

---

## 📝 Development Workflow

### 1. Create a Branch

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or bug fix branch
git checkout -b fix/bug-description
```

### 2. Make Changes

- Follow existing code style
- Add tests for new features
- Update documentation as needed
- Ensure TypeScript compiles without errors

### 3. Test Your Changes

```bash
# Run tests
bun test

# Type check
bunx tsc --noEmit

# Test manually
bun run src/cli.ts --help
```

### 4. Commit Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: add new feature description"

# Or for bug fixes
git commit -m "fix: resolve issue with X"
```

**Commit Message Format**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test additions or changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### 5. Push and Create Pull Request

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create pull request on GitHub
# Provide clear description of changes
```

---

## 🧪 Testing Guidelines

### Writing Tests

```typescript
import { describe, it, expect } from 'bun:test';

describe('Feature Name', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Test Coverage

- Aim for 80%+ code coverage
- Test happy paths and error cases
- Test edge cases (empty inputs, null values, boundaries)
- Add integration tests for new features

---

## 📚 Documentation Guidelines

### Code Documentation

```typescript
/**
 * Brief description of function
 * 
 * @param param1 - Description of parameter
 * @param param2 - Description of parameter
 * @returns Description of return value
 * 
 * @example
 * ```typescript
 * const result = myFunction('input');
 * console.log(result); // 'output'
 * ```
 */
export function myFunction(param1: string, param2: number): string {
  // Implementation
}
```

### Markdown Documentation

- Use clear, concise language
- Include code examples
- Add screenshots for UI features
- Keep documentation up-to-date with code changes

---

## 🎨 Code Style

### TypeScript

- Use TypeScript strict mode
- Define types for all function parameters and return values
- Avoid `any` type
- Use meaningful variable names

### Formatting

```bash
# Format code (if formatter configured)
bun run format

# Or manually ensure:
# - 2 spaces for indentation
# - Single quotes for strings
# - Semicolons at end of statements
```

---

## 🐛 Reporting Bugs

### Bug Report Template

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Run command '...'
2. See error

**Expected behavior**
A clear description of what you expected to happen.

**Actual behavior**
What actually happened.

**Environment**
- OS: [e.g., Ubuntu 22.04]
- Bun version: [e.g., 1.0.0]
- CWC version: [e.g., 0.1.0]

**Additional context**
Add any other context about the problem here.
```

---

## 💡 Feature Requests

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request.
```

---

## 🔍 Code Review Process

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added for new features
- [ ] All tests passing
- [ ] TypeScript compiles without errors
- [ ] Documentation updated
- [ ] Commit messages follow format
- [ ] Branch is up-to-date with main

### Review Criteria

- **Functionality**: Does it work as intended?
- **Tests**: Are there adequate tests?
- **Code Quality**: Is the code clean and maintainable?
- **Documentation**: Is it well-documented?
- **Performance**: Are there any performance concerns?

---

## 📄 License

By contributing to CWC, you agree that your contributions will be licensed under the MIT License.

---

## 🙏 Thank You!

Thank you for contributing to Copilot Workflow Composer! Your contributions help make this project better for everyone.

---

**Questions?** Open an issue or reach out to the maintainers.
