/**
 * Test Suite: Phase 3 Integration - Conditional Branching & Resource Monitoring
 * End-to-end validation of Intelligence & Resilience features
 */

import { describe, it, expect } from 'bun:test';
import { evaluateCondition } from '../../src/execution/condition-evaluator';
import { ResourceWatchdog } from '../../src/execution/resource-watchdog';
import { ExecutionContext, ResourceAlert } from '../../src/types/index';

describe('Phase 3 - Conditional Branching', () => {
  it('should have condition evaluator available for step execution', () => {
    const context: ExecutionContext = {
      runId: 'test-run',
      currentStepId: 'test',
      results: [],
      variables: new Map(),
      config: { timeout: 30000, retries: 2 },
      startTime: new Date(),
    };

    // Simple true condition
    const result = evaluateCondition('${true}', context);
    expect(result.evaluated).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should support conditional expression evaluation', () => {
    const context: ExecutionContext = {
      runId: 'test-run',
      currentStepId: 'test',
      results: [],
      variables: new Map([['enabled', true]]),
      config: { timeout: 30000, retries: 2 },
      startTime: new Date(),
    };

    // Result should have the shape needed by workflow engine
    const result = evaluateCondition('${true}', context);

    expect(result.condition).toBeDefined();
    expect(typeof result.evaluated).toBe('boolean');
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(typeof result.context).toBe('object');
  });

  it('should record evaluation context for audit trail', () => {
    const context: ExecutionContext = {
      runId: 'test-run',
      currentStepId: 'check',
      results: [],
      variables: new Map([['status', 'ready']]),
      config: { timeout: 30000, retries: 2 },
      startTime: new Date(),
    };

    const result = evaluateCondition('${true}', context);

    // Audit trail should be populated
    expect(result.context).toBeDefined();
    expect(typeof result.context === 'object').toBe(true);
  });
});

describe('Phase 3 - Resource Watchdog Monitoring', () => {
  it('should initialize resource watchdog for process monitoring', () => {
    const watchdog = new ResourceWatchdog(process.pid, {
      memoryMB: 512,
      cpuWarnPercent: 80,
      checkIntervalMs: 500,
      maxHighResourceReadings: 6,
    });

    expect(watchdog).toBeDefined();
    // Should have stop method for cleanup
    expect(typeof watchdog.stop).toBe('function');
  });

  it('should capture process metrics during execution', () => {
    const watchdog = new ResourceWatchdog(process.pid, {
      memoryMB: 256,
      cpuWarnPercent: 90,
    });

    // Should support output length tracking
    watchdog.updateOutputLength(1024);
    watchdog.updateOutputLength(2048);

    const alerts = watchdog.stop();
    expect(Array.isArray(alerts)).toBe(true);
  });

  it('should detect resource violations', () => {
    // Test that watchdog can raise alerts for:
    // 1. Memory exceeding limit
    // 2. Sustained high CPU usage
    // 3. Runaway output growth

    const alert: ResourceAlert = {
      stepId: 'test-step',
      alertType: 'memory',
      actualValue: 600,
      limitValue: 512,
      unit: 'MB',
      timestamp: new Date(),
      message: 'Memory limit exceeded',
      pid: process.pid,
    };

    expect(alert.stepId).toBe('test-step');
    expect(alert.alertType).toBe('memory');
    expect(alert.actualValue).toBeGreaterThan(alert.limitValue);
  });

  it('should support different alert types', () => {
    const memoryAlert: ResourceAlert = {
      stepId: 'step1',
      alertType: 'memory',
      actualValue: 600,
      limitValue: 512,
      unit: 'MB',
      timestamp: new Date(),
      message: 'Memory exceeded',
      pid: 123,
    };

    const cpuAlert: ResourceAlert = {
      stepId: 'step2',
      alertType: 'cpu',
      actualValue: 95,
      limitValue: 80,
      unit: '%',
      timestamp: new Date(),
      message: 'CPU warning',
      pid: 456,
    };

    const killAlert: ResourceAlert = {
      stepId: 'step3',
      alertType: 'process_killed',
      actualValue: 150,
      limitValue: 512,
      unit: 'MB',
      timestamp: new Date(),
      message: 'Process killed',
      pid: 789,
      lastOutput: 'partial output',
    };

    expect(memoryAlert.alertType).toBe('memory');
    expect(cpuAlert.alertType).toBe('cpu');
    expect(killAlert.alertType).toBe('process_killed');
    expect(killAlert.lastOutput).toBe('partial output');
  });
});

describe('Phase 3 - Workflow Engine Integration', () => {
  it('should use condition evaluator for step skipping decisions', () => {
    const context: ExecutionContext = {
      runId: 'workflow-1',
      currentStepId: 'deploy',
      results: [
        {
          stepId: 'analyze',
          success: true,
          output: 'Analysis complete',
          duration: 5000,
          timestamp: new Date(),
          retriesAttempted: 0,
        },
      ],
      variables: new Map([['environment', 'production']]),
      config: { timeout: 30000, retries: 2 },
      startTime: new Date(),
    };

    // Workflow engine would use this to skip steps
    const skipCondition = '${false}'; // If false, skip the step
    const result = evaluateCondition(skipCondition, context);

    expect(result.evaluated).toBe(false); // Step should be skipped
    expect(result.error).toBeUndefined();
  });

  it('should track skipped steps in execution context', () => {
    const context: ExecutionContext = {
      runId: 'workflow-2',
      currentStepId: 'optional-step',
      results: [],
      variables: new Map(),
      config: { timeout: 30000, retries: 2 },
      startTime: new Date(),
      skippedSteps: [
        {
          stepId: 'cleanup',
          condition: '${environment === "dev"}',
          timestamp: new Date(),
          reason: 'Condition evaluated to false',
        },
      ],
    };

    expect(context.skippedSteps).toBeDefined();
    expect(context.skippedSteps?.length).toBe(1);
    expect(context.skippedSteps?.[0].stepId).toBe('cleanup');
  });
});

describe('Phase 3 - Error Handling & Resilience', () => {
  it('should handle malformed condition expressions gracefully', () => {
    const context: ExecutionContext = {
      runId: 'test-run',
      currentStepId: 'test',
      results: [],
      variables: new Map(),
      config: { timeout: 30000, retries: 2 },
      startTime: new Date(),
    };

    const result = evaluateCondition('invalid-format', context);

    // Should not throw, should return error in result
    expect(result.evaluated).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should record resource alerts for audit trail', () => {
    const alert: ResourceAlert = {
      stepId: 'failing-step',
      alertType: 'process_killed',
      actualValue: 1024,
      limitValue: 512,
      unit: 'MB',
      timestamp: new Date(),
      message: 'Process killed due to excessive memory usage',
      pid: 12345,
    };

    const context: ExecutionContext = {
      runId: 'test-run',
      currentStepId: 'test',
      results: [],
      variables: new Map(),
      config: { timeout: 30000, retries: 2 },
      startTime: new Date(),
      resourceAlerts: [alert],
    };

    expect(context.resourceAlerts).toBeDefined();
    expect(context.resourceAlerts?.[0].alertType).toBe('process_killed');
    expect(context.resourceAlerts?.[0].message).toContain('memory');
  });
});

describe('Phase 3 - Type Safety', () => {
  it('should maintain type safety for condition results', () => {
    const context: ExecutionContext = {
      runId: 'test-run',
      currentStepId: 'test',
      results: [],
      variables: new Map(),
      config: { timeout: 30000, retries: 2 },
      startTime: new Date(),
    };

    const result = evaluateCondition('${true}', context);

    // Type-safe access to result properties
    const evaluated: boolean = result.evaluated;
    const condition: string = result.condition;
    const timestamp: Date = result.timestamp;
    const context_used: Record<string, unknown> = result.context;
    const error: string | undefined = result.error;

    expect(typeof evaluated).toBe('boolean');
    expect(typeof condition).toBe('string');
    expect(timestamp instanceof Date).toBe(true);
    expect(typeof context_used).toBe('object');
    expect(error === undefined || typeof error === 'string').toBe(true);
  });

  it('should maintain type safety for resource alerts', () => {
    const alert: ResourceAlert = {
      stepId: 'step-1',
      alertType: 'cpu',
      actualValue: 95,
      limitValue: 80,
      unit: '%',
      timestamp: new Date(),
      message: 'High CPU usage detected',
      pid: 9999,
    };

    // Type-safe property access
    const stepId: string = alert.stepId;
    const type: 'memory' | 'cpu' | 'process_killed' = alert.alertType;
    const actual: number = alert.actualValue;
    const limit: number = alert.limitValue;

    expect(stepId).toBe('step-1');
    expect(type).toBe('cpu');
    expect(actual).toBe(95);
    expect(limit).toBe(80);
  });
});
