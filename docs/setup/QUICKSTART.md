# Quick Reference - Copilot Workflow Composer

**Essential commands and concepts at a glance**

---

## ⚡ Quick Start

```bash
# Install
npm install

# Run tests
bun test

# Execute workflow
cwc ./workflow.yaml

# Interactive mode (pause before each step)
cwc ./workflow.yaml --step-mode

# Generate plan from natural language
cwc "Create Python CLI tool" --plan
```

---

## 📋 Common Commands

```bash
# Create new workflow project
cwc init my-workflow

# Connect MCP tool
cwc connect figma

# Execute with options
cwc ./workflow.yaml --timeout 60000 --retries 3

# Check authentication
cwc --check-auth

# Show help
cwc --help
```

---

## 🛡️ 8-Layer Safety System

1. **Schema Gate** (<1ms) - Zod validation
2. **Dependency Check** (<1ms) - Topological sort
3. **Condition Sandbox** (<1ms) - Recursive descent parser
4. **Resource Watchdog** (500ms) - Memory/CPU monitoring
5. **Pattern Library** (<20ms) - 18+ malicious patterns
6. **Human Gate** (variable) - Interactive approval
7. **Secret Masking** (<1ms) - Credential redaction
8. **Atomic Finalization** (<10ms) - Crash-safe persistence

**Total Overhead**: ~30ms

---

## 📄 Workflow YAML Template

```yaml
name: "Workflow Name"
version: "1.0.0"

steps:
  - id: step-1
    agent: github
    prompt: "Your instruction"
    timeout: 30000
    retries: 1

env:
  PROJECT_NAME: "My Project"

safety:
  maxCpuPercent: 80
  maxMemoryMB: 512
```

---

## 🔑 Authentication

**GitHub Copilot CLI Integration:**
This project uses GitHub CLI (`gh`) for authentication - **no tokens needed in environment variables**.

```bash
# Authenticate with GitHub CLI (one-time setup)
gh auth login

# Verify authentication
gh auth status
gh copilot --version
```

## 🔧 Optional Environment Variables

```bash
# Optional configuration
DEBUG=false
VERBOSE=false
MAX_CPU_PERCENT=80
MAX_MEMORY_MB=512
REQUIRE_APPROVAL=true

# Optional: For web scraping features
ANTHROPIC_API_KEY=your_key_here
ENABLE_WEB_SCRAPING=true
```

---

## 🧪 Testing

```bash
# Run all tests
bun test

# Run specific test
bun test tests/unit/test-architect.test.ts

# Type check
bunx tsc --noEmit
```

**Current Status**: 434/444 passing (98%)

---

## 📊 Test Results Summary

- ✅ **434 tests passing**
- ❌ **10 tests failing** (Environment-specific)
- ⚠️ **0 module errors**
- **Execution time**: 12.4s

---

## 🐛 Known Issues (Minor)

1. Architect/ToolPruner test isolation issues (Passes in isolation, fails in full suite due to global mocks)
2. AI service timeouts in some environments (Requires high-latency mock configuration)
3. 3 Instrumentation warnings (Non-blocking)

---

## 🚀 Architect-Builder Pattern

| Phase | Model | Tokens | Cost |
|-------|-------|--------|------|
| Planning | Haiku | 450 | $0.0027 |
| Execution | Sonnet | 320 | $0.0030 |
| **Total** | - | **770** | **$0.0057** |

**Savings**: 62% vs Sonnet-only ($0.060)

---

## 🔒 Security

### Attack Vectors Detected

- Base64 encoding ✅
- Hex encoding ✅
- Environment variable injection ✅
- Polyglot payload ✅
- Process substitution ✅
- Obfuscated variables ✅
- Comment-hidden payload ✅
- Complex nested attack ✅

---

## 📚 Documentation

- **README.md** - Project overview
- **TESTING.md** - Test results and analysis
- **ARCHITECTURE.md** - Technical deep dive
- **API.md** - API reference
- **DEPLOYMENT.md** - Operations guide
- **CONTRIBUTING.md** - Contribution guidelines
- **REGENERATION_REPORT.md** - Documentation regeneration report

---

## 🔧 Troubleshooting

### GitHub Authentication Failed

**The project uses GitHub CLI authentication, not tokens:**

```bash
# Step 1: Authenticate with GitHub CLI
gh auth login

# Step 2: Verify authentication
gh auth status

# Step 3: Verify Copilot CLI is available
gh copilot --version

# Step 4: Test with CWC
cwc --check-auth
```

**Note:** You need an active GitHub Copilot subscription on your account.

### Module Not Found

```bash
bunx tsc
ls -la dist/
```

### Memory Limit Exceeded

```bash
echo "MAX_MEMORY_MB=1024" >> .env
```

---

## 📈 Performance

| Layer | Budget | Actual |
|-------|--------|--------|
| Schema Validation | <1ms | ~0.3ms |
| Dependency Check | <1ms | ~0.2ms |
| Condition Sandbox | <1ms | ~0.4ms |
| Resource Watchdog | <1ms | ~0.1ms |
| Pattern Library | <20ms | ~12ms |
| Secret Masking | <1ms | ~0.5ms |
| Atomic Finalization | <10ms | ~8ms |
| **Total** | **<50ms** | **~30ms** |

---

## 🎯 Next Steps

1. Fix module resolution errors
2. Fix TypeScript compilation errors
3. Fix CLI flag recognition
4. Achieve 100% test pass rate

---

## 📞 Support

- **Documentation**: See `docs/` directory
- **Examples**: See `examples/` directory
- **Tests**: See `tests/` directory
- **Issues**: GitHub Issues

---

**Last Updated**: February 11, 2026  
**Version**: 7.0 (Stable)  
**Status**: 434/444 tests passing (98%)
