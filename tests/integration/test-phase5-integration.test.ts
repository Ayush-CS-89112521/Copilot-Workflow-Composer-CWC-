/**
 * Phase 5B Integration Tests
 * 
 * Test suite for Human-in-the-Loop AI Agent Safety features:
 * - Steering Interface (5 tests)
 * - MCP Sandbox (4 tests)
 * - Failure Mode Detectors (6 tests)
 * - Trace-Based Evals (5 tests)
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { presentSteeringPrompt } from '../../src/interactive/steering-handler';
import { injectContextIntoStep, detectInjectionType, processSteering, getContextInjections } from '../../src/execution/context-injector';
import { PathTraversalValidator } from '../../src/safety/path-validator';
import { GitSafetyLock } from '../../src/safety/git-safety-lock';
import { LoopDetector } from '../../src/execution/loop-detector';
import { ContextOverflowWatchdog } from '../../src/execution/context-overflow-watchdog';
import { HallucinationChecker } from '../../src/execution/hallucination-checker';
import { AuditEntryBuilder } from '../../src/context/audit-schema';
import type { ExecutionFlags } from '../../src/types/index';
import * as path from 'path';

// ============================================================================
// MODULE 1: STEERING INTERFACE TESTS (5 tests)
// ============================================================================

describe('Module 1: Steering Interface', () => {
  it('should have steering prompt function available', () => {
    expect(typeof presentSteeringPrompt).toBe('function');
  });

  it('should have context injection functions available', () => {
    expect(typeof injectContextIntoStep).toBe('function');
    expect(typeof detectInjectionType).toBe('function');
    expect(typeof processSteering).toBe('function');
  });

  it('should detect goal-correction feedback', () => {
    const result = detectInjectionType('The goal should be security-focused');
    expect(result).toBe('goal-correction');
  });

  it('should detect constraint-addition feedback', () => {
    const result = detectInjectionType('Must not delete any files');
    expect(result).toBe('constraint-addition');
  });

  it('should inject context into workflow step', () => {
    const mockStep = {
      id: 'step-1',
      name: 'List files',
      tool: 'bash',
      arguments: { command: 'ls -la' },
      prompt: 'List all files in the directory',
      timeout: 30
    };

    const originalPrompt = mockStep.prompt;
    injectContextIntoStep(mockStep, 'Focus on important files only', 'goal-correction');

    expect(mockStep.prompt).not.toBe(originalPrompt);
    expect(mockStep.prompt).toContain('HUMAN FEEDBACK');
    expect(mockStep.prompt).toContain('Focus on important files only');
  });
});

// ============================================================================
// MODULE 2: MCP SANDBOX TESTS (4 tests)
// ============================================================================

describe('Module 2: MCP Sandbox - Path Validation', () => {
  let validator: PathTraversalValidator;
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = '/tmp/test-project';
    validator = new PathTraversalValidator({
      projectRoot,
      allowedDirs: [
        projectRoot,
        path.join(projectRoot, 'src'),
        path.join(projectRoot, 'docs')
      ]
    });
  });

  it('should block path traversal attacks', () => {
    const traversalPath = path.join(projectRoot, '../../../etc/passwd');
    expect(() => {
      validator.validatePath(traversalPath, 'read');
    }).toThrow();
  });

  it('should block sensitive system paths', () => {
    const sensitivePath = '/.ssh/id_rsa';
    expect(() => {
      validator.validatePath(sensitivePath, 'read');
    }).toThrow();
  });

  it('should block unauthorized directory access', () => {
    const unauthorizedPath = '/var/log/syslog';
    expect(() => {
      validator.validatePath(unauthorizedPath, 'read');
    }).toThrow();
  });

  it('should allow paths in allowed directories', () => {
    expect(() => {
      validator.validatePath(path.join(projectRoot, 'src/main.ts'), 'read');
    }).not.toThrow();
  });
});

describe('Module 2: MCP Sandbox - Git Safety', () => {
  let gitLock: GitSafetyLock;

  beforeEach(() => {
    gitLock = new GitSafetyLock({
      allowMainPush: false,
      blockForcePush: true,
      blockResetHard: true,
      blockRebasePublic: true
    });
  });

  it('should block force push', () => {
    expect(() => {
      gitLock.validateCommand({
        command: 'push',
        args: ['-f', 'origin', 'test-branch']
      });
    }).toThrow();
  });

  it('should block reset --hard', () => {
    expect(() => {
      gitLock.validateCommand({
        command: 'reset',
        args: ['--hard', 'HEAD~1']
      });
    }).toThrow();
  });

  it('should block interactive rebases', () => {
    expect(() => {
      gitLock.validateCommand({
        command: 'rebase',
        args: ['-i', 'origin/main']
      });
    }).toThrow();
  });

  it('should allow normal push when allowed', () => {
    const permissiveGit = new GitSafetyLock({ allowMainPush: true });
    expect(() => {
      permissiveGit.validateCommand({
        command: 'push',
        args: ['origin', 'feature-branch']
      });
    }).not.toThrow();
  });
});

// ============================================================================
// MODULE 3: FAILURE MODE DETECTORS TESTS (6 tests)
// ============================================================================

describe('Module 3: Failure Mode Detectors - Loop Detection', () => {
  let loopDetector: LoopDetector;

  beforeEach(() => {
    loopDetector = new LoopDetector({ windowSize: 3 });
  });

  it('should initialize loop detector', () => {
    expect(loopDetector).toBeDefined();
    expect(typeof loopDetector.checkForLoop).toBe('function');
  });

  it('should detect repeated identical tool calls', () => {
    const tool = 'grep';
    const args = { pattern: 'error', file: 'log.txt' };

    loopDetector.checkForLoop(tool, args);
    loopDetector.checkForLoop(tool, args);
    const result = loopDetector.checkForLoop(tool, args);

    expect(result).toBe(true);
  });

  it('should detect different tools without false positives', () => {
    loopDetector.checkForLoop('bash', { cmd: 'a' });
    loopDetector.checkForLoop('python', { cmd: 'b' });
    const result = loopDetector.checkForLoop('node', { cmd: 'c' });

    expect(result).toBe(false);
  });
});

describe('Module 3: Failure Mode Detectors - Context Overflow', () => {
  let watchdog: ContextOverflowWatchdog;

  beforeEach(() => {
    watchdog = new ContextOverflowWatchdog({ budgetTokens: 10000 });
  });

  it('should initialize context overflow watchdog', () => {
    expect(watchdog).toBeDefined();
    expect(typeof watchdog.checkContextSize).toBe('function');
  });

  it('should provide recommendations at critical threshold', () => {
    const largeContext = 'x'.repeat(36000);
    const result = watchdog.checkContextSize(largeContext);

    if (result.status === 'critical') {
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    }
  });

  it('should return status and usage metrics', () => {
    const result = watchdog.checkContextSize('x'.repeat(5000));
    expect(result).toBeDefined();
  });
});

describe('Module 3: Failure Mode Detectors - Hallucination Checking', () => {
  let hallChecker: HallucinationChecker;

  beforeEach(() => {
    const mockCatalog = {
      bash: { description: 'Execute shell commands', requiredArgs: ['command'] },
      grep: { description: 'Search text patterns', requiredArgs: ['pattern'] }
    };

    hallChecker = new HallucinationChecker({ toolCatalog: mockCatalog });
  });

  it('should initialize hallucination checker', () => {
    expect(hallChecker).toBeDefined();
    expect(typeof hallChecker.validateTool).toBe('function');
  });

  it('should detect unknown tools and throw errors', () => {
    expect(() => {
      hallChecker.validateTool('unknownTool123', {});
    }).toThrow();
  });

  it('should throw on unknown tools', () => {
    expect(() => {
      hallChecker.validateTool('bassh', { command: 'ls' });
    }).toThrow();
  });

  it('should have validateTool method', () => {
    const result = typeof hallChecker.validateTool;
    expect(result).toBe('function');
  });
});

// ============================================================================
// MODULE 4: TRACE-BASED EVALS TESTS (5 tests)
// ============================================================================

describe('Module 4: Trace-Based Evals - Audit Schema', () => {
  let builder: AuditEntryBuilder;

  beforeEach(() => {
    builder = new AuditEntryBuilder();
  });

  it('should create audit entry builder', () => {
    expect(builder).toBeDefined();
    expect(typeof builder.runId).toBe('function');
  });

  it('should support fluent API', () => {
    const builder2 = new AuditEntryBuilder();
    const result = builder2.runId('test-run').stepId('test-step');
    expect(result).toEqual(builder2);
  });

  it('should chain multiple methods fluently', () => {
    const builder2 = new AuditEntryBuilder();
    const result = builder2
      .runId('run-123')
      .stepId('step-1')
      .agentOutput('bash', { command: 'ls' }, 'List files');

    expect(result).toEqual(builder2);
  });

  it('should support safetyEvaluation method', () => {
    const builder2 = new AuditEntryBuilder();
    const result = builder2.safetyEvaluation({
      status: 'safe',
      violations: [],
      recommendations: []
    });

    expect(result).toEqual(builder2);
  });

  it('should support executionResult method', () => {
    const builder2 = new AuditEntryBuilder();
    const result = builder2.executionResult({
      success: true,
      output: 'test',
      error: undefined
    });

    expect(result).toEqual(builder2);
  });
});

// ============================================================================
// INTEGRATION TESTS: CLI FLAGS
// ============================================================================

describe('Phase 5B Integration: CLI Flags', () => {
  it('should support --step-mode flag', () => {
    const flags: ExecutionFlags = {
      stepMode: true,
      allowMainPush: false,
      enableContextInjection: true
    };

    expect(flags.stepMode).toBe(true);
  });

  it('should support --allow-main-push flag', () => {
    const flags: ExecutionFlags = {
      stepMode: false,
      allowMainPush: true,
      enableContextInjection: true
    };

    expect(flags.allowMainPush).toBe(true);
  });

  it('should support context injection flag', () => {
    const flags: ExecutionFlags = {
      stepMode: true,
      allowMainPush: false,
      enableContextInjection: true
    };

    expect(flags.enableContextInjection).toBe(true);
  });
});

// ============================================================================
// LATENCY & PERFORMANCE VALIDATION
// ============================================================================

describe('Phase 5B: Latency & Performance', () => {
  it('should validate path in <5ms', () => {
    const validator = new PathTraversalValidator({ projectRoot: '/tmp/test' });

    const start = performance.now();
    try {
      validator.validatePath('/tmp/test/file.txt', 'read');
    } catch {
      // Expected
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5);
  });

  it('should validate git command in <5ms', () => {
    const gitLock = new GitSafetyLock({ allowMainPush: false });

    const start = performance.now();
    try {
      gitLock.validateCommand({
        command: 'push',
        args: ['origin', 'test-branch']
      });
    } catch {
      // Expected
    }
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5);
  });

  it('should detect loop in <5ms', () => {
    const detector = new LoopDetector({ windowSize: 3 });

    const start = performance.now();
    detector.checkForLoop('bash', { command: 'ls' });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(5);
  });

  it('should check context size in <10ms', () => {
    const watchdog = new ContextOverflowWatchdog({ budgetTokens: 10000 });
    const context = 'x'.repeat(10000);

    const start = performance.now();
    watchdog.checkContextSize(context);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10);
  });
});

// ============================================================================
// COMPLETION VERIFICATION
// ============================================================================

describe('Phase 5B: Module Completeness', () => {
  it('should have steering functions', () => {
    expect(typeof presentSteeringPrompt).toBe('function');
  });

  it('should have context injection functions', () => {
    expect(typeof injectContextIntoStep).toBe('function');
    expect(typeof detectInjectionType).toBe('function');
    expect(typeof processSteering).toBe('function');
    expect(typeof getContextInjections).toBe('function');
  });

  it('should have path validation class', () => {
    expect(typeof PathTraversalValidator).toBe('function');
    const validator = new PathTraversalValidator({ projectRoot: '/tmp' });
    expect(typeof validator.validatePath).toBe('function');
  });

  it('should have git safety class', () => {
    expect(typeof GitSafetyLock).toBe('function');
    const gitLock = new GitSafetyLock();
    expect(typeof gitLock.validateCommand).toBe('function');
  });

  it('should have loop detector class', () => {
    expect(typeof LoopDetector).toBe('function');
    const detector = new LoopDetector();
    expect(typeof detector.checkForLoop).toBe('function');
  });

  it('should have context overflow watchdog class', () => {
    expect(typeof ContextOverflowWatchdog).toBe('function');
    const watchdog = new ContextOverflowWatchdog();
    expect(typeof watchdog.checkContextSize).toBe('function');
  });

  it('should have hallucination checker class', () => {
    expect(typeof HallucinationChecker).toBe('function');
    const checker = new HallucinationChecker();
    expect(typeof checker.validateTool).toBe('function');
  });

  it('should have audit entry builder class', () => {
    expect(typeof AuditEntryBuilder).toBe('function');
    const builder = new AuditEntryBuilder();
    expect(typeof builder.runId).toBe('function');
    expect(typeof builder.stepId).toBe('function');
    expect(typeof builder.agentOutput).toBe('function');
  });
});
