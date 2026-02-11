# API Reference - Copilot Workflow Composer

**Complete CLI and Programmatic API Documentation**

---

## 📋 Table of Contents

1. [CLI Commands](#cli-commands)
2. [Workflow YAML Structure](#workflow-yaml-structure)
3. [Programmatic API](#programmatic-api)
4. [Environment Variables](#environment-variables)
5. [Exit Codes](#exit-codes)

---

## 🖥️ CLI Commands

### Basic Usage

```bash
cwc <command> [options]
cwc <workflow-file> [options]
cwc <prompt-string> --plan [options]
```

### Commands

#### `cwc init <name>`

Create a new workflow project with scaffolding.

**Arguments**:
- `<name>` - Directory name for new workflow project (required)

**Options**:
- `--skip-readme` - Don't generate README.md
- `--skip-env` - Don't generate .env.example
- `--with-ci` - Include GitHub Actions CI template

**Examples**:
```bash
cwc init my-workflow
cwc init my-project --skip-readme
cwc init production-workflow --with-ci
```

---

#### `cwc connect <tool-name>`

Connect an MCP tool to current workflow.

**Arguments**:
- `<tool-name>` - Name of MCP tool to discover and connect (required)

**Examples**:
```bash
cwc connect figma
cwc connect postgresql
cwc connect aws-cli
```

**Output**:
- Searches MCP catalog for tool
- Displays tool metadata (category, languages, scope)
- Checks environment variable requirements
- Generates workflow step configuration
- Adds step to existing workflow.yaml

---

#### `cwc <workflow-file>`

Execute a workflow YAML file.

**Arguments**:
- `<workflow-file>` - Path to workflow YAML file (required)

**Options**:
- `--timeout <ms>` - Override default timeout per step (milliseconds)
- `--retries <n>` - Override default number of retries
- `--no-fail-fast` - Continue executing steps even if one fails
- `--validate-output` - Enable output validation (default: true)
- `--step-mode` - Pause before every tool call for steering/feedback
- `--allow-main-push` - Allow git pushes to main/master branches

**Examples**:
```bash
cwc ./workflow.yaml
cwc ./my-workflow.yaml --timeout 60000 --retries 3
cwc ./workflow.yaml --step-mode --no-fail-fast
cwc ./workflow.yaml --step-mode --allow-main-push
```

---

#### `cwc <prompt-string> --plan`

Generate and execute plan from natural language (Phase 6C).

**Arguments**:
- `<prompt-string>` - Natural language description of task (required with --plan)

**Options**:
- `--plan` - Trigger planning mode (required)
- `--auto-switch` - Use auto-switch orchestrator for hybrid execution
- `--auto-approve` - Auto-approve safe plans without user confirmation
- `--execute-only` - Skip planning phase, go straight to execution
- `--no-steering` - Disable interactive steering during execution

**Examples**:
```bash
cwc "Create Python search CLI tool" --plan
cwc "Refactor the login module to use async/await" --plan --auto-switch
cwc "Create a new API endpoint" --plan --auto-approve --auto-switch
cwc "Deploy to production" --plan --no-steering
```

---

#### `cwc --check-auth`

Verify GitHub Copilot CLI authentication status.

**Examples**:
```bash
cwc --check-auth
```

---

#### `cwc --help` / `cwc -h`

Show help message with all commands and options.

**Examples**:
```bash
cwc --help
cwc -h
```

---

#### `cwc --version`

Show version information.

**Examples**:
```bash
cwc --version
```

---

## 📄 Workflow YAML Structure

### Basic Structure

```yaml
name: "Workflow Name"
version: "1.0.0"
description: "Optional workflow description"

steps:
  - id: step-1
    name: "Step Name"
    agent: suggest
    prompt: "Your instruction to the agent"
    timeout: 10000
    retries: 1

env:
  PROJECT_NAME: "My Project"
  DEBUG: "false"

safety:
  maxCpuPercent: 80
  maxMemoryMB: 512
```

### Step Configuration

#### Required Fields

```yaml
- id: unique-step-id          # Unique identifier for this step
  agent: suggest               # Agent type: suggest, explain, edit
  prompt: "Step instruction"  # Instruction for the agent
```

#### Optional Fields

```yaml
- id: step-id
  name: "Human-readable name"
  agent: suggest
  prompt: "Instruction"
  
  # Execution control
  timeout: 30000              # Timeout in milliseconds (default: 30000)
  retries: 2                  # Number of retries on failure (default: 1)
  when: true                  # Condition expression (default: true)
  
  # Dependencies (inferred from variable references in prompt)
  # or manually via 'when' conditions
  
  # Output handling
  output:
    type: variable            # variable or file
    name: step_result         # Variable name or file path
  
  # Resource limits
  resources:
    memoryMB: 512
    cpuWarnPercent: 80
  
  # Environment variables
  env:
    API_KEY: $secrets.API_KEY
    DEBUG: "true"
  
  # Safety overrides
  safety:
    categorizeAs: database    # Category for safety detection
```

#### `suggest`
Uses `gh copilot suggest` for command and code suggestions.

```yaml
- id: suggest-command
  agent: suggest
  prompt: "Create a new directory called 'output'"
```

#### `suggest`
Uses `gh copilot suggest` for general suggestions.

```yaml
- id: suggest-code
  agent: suggest
  prompt: "Write a Python function to calculate factorial"
```

#### `explain`
Uses `gh copilot explain` for explanations.

```yaml
- id: explain-code
  agent: explain
  prompt: "Explain how this regex works: /^[a-z0-9]+$/"
```

### Condition Expressions

Conditions use a safe, whitelist-only grammar:

```yaml
# Simple boolean
when: true

# Variable comparison
when: steps.previous.success == true

# Numeric comparison
when: steps.analyze.error_count < 5

# String comparison
when: env.ENVIRONMENT == "production"

# Logical operators
when: steps.test.success == true && env.DEPLOY == "true"

# Complex conditions
when: (steps.test.success == true || env.SKIP_TESTS == "true") && env.ENVIRONMENT != "local"
```

**Supported Operators**:
- Comparison: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `&&` (and), `||` (or)
- Grouping: `(` `)`

### Variable References

Reference outputs from previous steps:

```yaml
steps:
  - id: analyze
    agent: suggest
    prompt: "Analyze this code"
    output:
      type: variable
      name: analysis_result

  - id: refactor
    agent: suggest
    prompt: |
      Based on this analysis:
      ${steps.analyze.analysis_result}
      
      Refactor the code to fix the issues.
```

### Environment Variables

```yaml
env:
  # Static values
  PROJECT_NAME: "My Project"
  DEBUG: "false"
  
  # Secret references
  API_KEY: $secrets.API_KEY
  DATABASE_URL: $secrets.DATABASE_URL
  
  # System environment variables
  HOME: $env.HOME
  PATH: $env.PATH
```

### Safety Configuration

```yaml
safety:
  # Resource limits
  maxCpuPercent: 80           # CPU usage threshold
  maxMemoryMB: 512            # Memory limit in MB
  memoryLeakThreshold: 50     # Memory leak detection threshold
  
  # Approval settings
  autoApproveSafe: true       # Auto-approve if no violations
  requireApprovalForViolations: true  # Require approval for violations
```

### Complete Example

```yaml
name: "Code Refactoring Workflow"
version: "1.0.0"
description: "Analyze and refactor code with error handling"

config:
  timeout: 60000
  retries: 1
  failFast: true

steps:
  - id: analyze
    name: "Analyze Code"
    agent: suggest
    prompt: |
      Analyze this TypeScript code for error handling issues:
      
      ```typescript
      export function divide(a: number, b: number): number {
        return a / b;
      }
      ```
      
      Provide analysis in JSON format.
    output:
      type: variable
      name: analysis_result
    timeout: 30000

  - id: plan
    name: "Create Refactoring Plan"
    agent: suggest
    prompt: |
      Based on this analysis:
      ${steps.analyze.analysis_result}
      
      Create a refactoring plan in JSON format.
    output:
      type: variable
      name: plan_output
    dependsOn:
      - analyze

  - id: refactor
    name: "Generate Improved Code"
    agent: suggest
    prompt: |
      Using this plan:
      ${steps.plan.plan_output}
      
      Generate improved TypeScript code with error handling.
    output:
      type: file
      path: refactored-code.ts
    dependsOn:
      - plan
    when: steps.plan.success == true

env:
  PROJECT_NAME: "Code Refactor"
  DEBUG: "false"

safety:
  maxCpuPercent: 80
  maxMemoryMB: 512
  autoApproveSafe: true
  requireApprovalForViolations: true
```

---

## 🔧 Programmatic API

### TypeScript/JavaScript Usage

```typescript
import { loadWorkflowFromFile, executeWorkflowWithLogging } from './engine/workflow-engine';
import { verifyGithubCopilotAuth } from './execution/github-auth';

// Load workflow
const workflow = await loadWorkflowFromFile('./workflow.yaml');

// Verify authentication
const authStatus = await verifyGithubCopilotAuth();
if (!authStatus.authenticated) {
  throw new Error('GitHub Copilot not authenticated');
}

// Execute workflow
const result = await executeWorkflowWithLogging(workflow, {
  timeout: 60000,
  retries: 3,
  failFast: true,
  validateOutput: true
});

console.log('Workflow completed:', result.success);
console.log('Steps executed:', result.steps.length);
```

### Tool Discovery API

```typescript
import { ToolDiscoveryService } from './execution/tool-discovery-resolver';

// Initialize service
const service = new ToolDiscoveryService();

// Find tool
const tool = await service.findTool('figma');
if (!tool) {
  throw new Error('Tool not found');
}

// Check availability
const availability = await service.checkAvailability(tool);
console.log('Available:', availability.available);
console.log('Missing env vars:', availability.missingEnvVars);
```

### Safety Guardrail API

```typescript
import { SafetyGuardrail } from './safety/safety-guardrail';

// Initialize guardrail
const guardrail = new SafetyGuardrail({
  enabled: true,
  mode: 'warn',
  categories: {
    destructive: true,
    exfiltration: true,
    privilege: true,
    filesystem: true
  },
  confidenceThreshold: 0.75
});

// Scan step output
const result = await guardrail.scanStepOutput('step-1', 'rm -rf /');

console.log('Status:', result.status);
console.log('Violations:', result.violations.length);

if (result.violations.length > 0) {
  console.log(guardrail.formatViolationsForDisplay(result.violations));
}
```

### Architect Agent API

```typescript
import { ArchitectAgent } from './agents/architect';

// Initialize architect
const architect = new ArchitectAgent({
  model_tier: 'haiku',
  max_input_tokens: 2000,
  max_output_tokens: 1000,
  temperature: 0.3
});

// Generate plan
const plan = await architect.plan(
  'Create Python search CLI tool',
  prunedToolIndex
);

if ('error_code' in plan) {
  console.error('Planning failed:', plan.error_message);
} else {
  console.log('Plan generated:', plan.total_steps, 'steps');
  console.log('Estimated tokens:', plan.estimated_tokens);
}
```

---

## 🌍 Environment Variables

### Authentication

**This project uses GitHub CLI (`gh`) for authentication - NO GITHUB_TOKEN NEEDED!**

```bash
# One-time setup - authenticate with GitHub CLI
gh auth login

# Verify authentication
gh auth status
gh copilot --version
```

**Requirements:**
- GitHub CLI (`gh`) must be installed
- Active GitHub Copilot subscription on your account
- Authenticated via `gh auth login`

The GitHub CLI handles all authentication automatically. Tokens are managed securely by `gh` and never need to be stored in environment variables.

### Optional Configuration

```bash
# Debug and Development
DEBUG=false                    # Enable debug logging
VERBOSE=false                  # Enable verbose output
CI=false                       # CI environment flag

# UI and Display
NO_COLORS=false                # Disable colored output
NO_SPINNERS=false              # Disable spinner animations
NO_FRAMES=false                # Disable box framing
SILENT=false                   # Suppress all output

# Resource Limits (override workflow.yaml)
MAX_CPU_PERCENT=80             # Maximum CPU usage
MAX_MEMORY_MB=512              # Maximum memory usage

# Safety Options
REQUIRE_APPROVAL=true          # Always prompt for violations
AUTO_APPROVE_SAFE=true         # Auto-approve if no violations
DETAILED_AUDIT=true            # Detailed execution logging

# Optional: Web Scraping Features (uses Claude API)
ANTHROPIC_API_KEY=your_key     # For web scraping functionality
ENABLE_WEB_SCRAPING=true       # Enable web scraping

# API Keys (if your workflow steps use external APIs)
API_KEY=your-api-key-here
FIGMA_API_KEY=your-figma-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

---

## 🚪 Exit Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 0 | Success | Workflow completed successfully |
| 1 | General Error | Unspecified error occurred |
| 2 | Validation Error | Workflow validation failed |
| 3 | Execution Error | Step execution failed |
| 4 | Safety Violation | Safety violation detected and blocked |
| 5 | Authentication Error | GitHub Copilot not authenticated |
| 6 | Timeout Error | Step exceeded timeout limit |
| 7 | Dependency Error | Circular dependency detected |
| 8 | Resource Error | Resource limit exceeded |
| 9 | User Denial | User denied approval |

### Usage in Scripts

```bash
#!/bin/bash

cwc ./workflow.yaml

case $? in
  0)
    echo "✅ Workflow completed successfully"
    ;;
  4)
    echo "❌ Safety violation detected"
    exit 1
    ;;
  5)
    echo "❌ GitHub Copilot not authenticated"
    echo "Run: gh auth login"
    exit 1
    ;;
  *)
    echo "❌ Workflow failed with exit code $?"
    exit 1
    ;;
esac
```

---

## 📚 Additional Resources

### Example Workflows

See `examples/` directory for complete workflow examples:
- `examples/advanced-refactor.yaml` - Code refactoring workflow
- `examples/code-review-workflow.yaml` - Code review workflow

### Test Files

See `tests/` directory for usage examples:
- `tests/unit/` - Unit test examples
- `tests/integration/` - Integration test examples
- `tests/e2e/` - End-to-end test examples

---

**Last Updated**: February 11, 2026  
**API Version**: 7.0 (Stable)  
**Status**: Production-ready
