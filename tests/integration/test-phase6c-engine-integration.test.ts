import { describe, it, expect } from 'bun:test';
import type { ExecutionResult } from '../../src/agents/builder.js';
import type { Workflow } from '../../src/parsers/plan-converter.js';
import {
  initializeBridgeContext,
  convertBuilderResultToReport,
  createStepIdMapping,
  generateExecutionSummary,
  type BridgeContext,
  type OrchestratorExecutionOptions,
} from '../../src/engine/orchestration-bridge.js';

describe('Phase 6c: Engine Integration Bridge', () => {
  describe('BridgeContext Initialization', () => {
    it('should initialize bridge context with default options', () => {
      const mockWorkflow: Workflow = {
        name: 'Test Workflow',
        steps: [
          {
            id: 'step_0',
            name: 'Test Step',
            tools: [],
            prompt: 'Test',
            safety: { pattern_scan: true, require_approval: false, timeout: 30000 },
            error_handling: { on_failure: 'stop_workflow', fallback_enabled: false },
            metadata: { tool_action: 'exact', confidence_score: 0.8, index: 0 },
          },
        ],
      };

      const options: OrchestratorExecutionOptions = {};
      const context = initializeBridgeContext(mockWorkflow, options);

      expect(context.workflowContext).toBeDefined();
      expect(context.workflowContext.runId).toBeDefined();
      expect(context.workflowContext.config.timeout).toBe(30000);
      expect(context.workflowContext.config.retries).toBe(2);
      expect(context.stepIdMapping.size).toBe(1);
    });

    it('should initialize bridge context with custom options', () => {
      const mockWorkflow: Workflow = {
        name: 'Test Workflow',
        steps: [],
      };

      const options: OrchestratorExecutionOptions = {
        timeout: 60000,
        retries: 3,
        failFast: false,
        validateOutput: false,
      };

      const context = initializeBridgeContext(mockWorkflow, options);

      expect(context.workflowContext.config.timeout).toBe(60000);
      expect(context.workflowContext.config.retries).toBe(3);
      expect(context.workflowContext.config.failFast).toBe(false);
      expect(context.workflowContext.config.validateOutput).toBe(false);
    });

    it('should set version to 6c for orchestrator workflows', () => {
      const mockWorkflow: Workflow = {
        name: 'Test',
        steps: [],
      };

      const context = initializeBridgeContext(mockWorkflow, {});

      expect(context.workflowContext.metadata.workflowVersion).toBe('6c');
    });
  });

  describe('Step ID Mapping', () => {
    it('should create correct mapping for single step', () => {
      const mockWorkflow: Workflow = {
        name: 'Test',
        steps: [
          {
            id: 'my_step',
            name: 'My Step',
            tools: [],
            prompt: 'Test',
            safety: { pattern_scan: true, require_approval: false, timeout: 30000 },
            error_handling: { on_failure: 'stop_workflow', fallback_enabled: false },
            metadata: { tool_action: 'exact', confidence_score: 0.8, index: 0 },
          },
        ],
      };

      const mapping = createStepIdMapping(mockWorkflow);

      expect(mapping.get('step_0')).toBe('my_step');
      expect(mapping.size).toBe(1);
    });

    it('should create correct mapping for multiple steps', () => {
      const mockWorkflow: Workflow = {
        name: 'Test',
        steps: [
          {
            id: 'step_a',
            name: 'Step A',
            tools: [],
            prompt: 'Test',
            safety: { pattern_scan: true, require_approval: false, timeout: 30000 },
            error_handling: { on_failure: 'stop_workflow', fallback_enabled: false },
            metadata: { tool_action: 'exact', confidence_score: 0.8, index: 0 },
          },
          {
            id: 'step_b',
            name: 'Step B',
            tools: [],
            prompt: 'Test',
            safety: { pattern_scan: true, require_approval: false, timeout: 30000 },
            error_handling: { on_failure: 'stop_workflow', fallback_enabled: false },
            metadata: { tool_action: 'exact', confidence_score: 0.8, index: 1 },
          },
        ],
      };

      const mapping = createStepIdMapping(mockWorkflow);

      expect(mapping.get('step_0')).toBe('step_a');
      expect(mapping.get('step_1')).toBe('step_b');
      expect(mapping.size).toBe(2);
    });
  });

  describe('Result Conversion', () => {
    it('should convert successful execution result', () => {
      const mockWorkflow: Workflow = {
        name: 'Test Workflow',
        description: 'Test',
        steps: [
          {
            id: 'step_1',
            name: 'Test Step',
            tools: [],
            prompt: 'Test',
            safety: { pattern_scan: true, require_approval: false, timeout: 30000 },
            error_handling: { on_failure: 'stop_workflow', fallback_enabled: false },
            metadata: { tool_action: 'exact', confidence_score: 0.8, index: 0 },
          },
        ],
      };

      const context = initializeBridgeContext(mockWorkflow, {});

      const builderResult: ExecutionResult = {
        workflow_id: 'test',
        workflow_name: 'Test',
        status: 'success',
        steps_executed: 1,
        total_steps: 1,
        step_results: [
          {
            step_id: 'step_0',
            step_name: 'Test Step',
            tool_id: 'test_tool',
            tool_name: 'Test Tool',
            status: 'success',
            output: 'Test output',
            duration_ms: 100,
            timestamp: new Date().toISOString(),
            prompt_executed: 'Test prompt',
            audit_entry_id: 'audit_1',
          },
        ],
        errors: [],
        audit_trail_id: 'trail_1',
        execution_time_ms: 100,
        summary: {
          successful_steps: 1,
          failed_steps: 0,
          skipped_steps: 0,
        },
      };

      const report = convertBuilderResultToReport(mockWorkflow, builderResult, context);

      expect(report.success).toBe(true);
      expect(report.stats.totalSteps).toBe(1);
      expect(report.stats.successfulSteps).toBe(1);
      expect(report.stats.failedSteps).toBe(0);
      expect(report.errors.length).toBe(0);
    });

    it('should convert failed execution result', () => {
      const mockWorkflow: Workflow = {
        name: 'Test Workflow',
        description: 'Test',
        steps: [
          {
            id: 'step_1',
            name: 'Test Step',
            tools: [],
            prompt: 'Test',
            safety: { pattern_scan: true, require_approval: false, timeout: 30000 },
            error_handling: { on_failure: 'stop_workflow', fallback_enabled: false },
            metadata: { tool_action: 'exact', confidence_score: 0.8, index: 0 },
          },
        ],
      };

      const context = initializeBridgeContext(mockWorkflow, {});

      const builderResult: ExecutionResult = {
        workflow_id: 'test',
        workflow_name: 'Test',
        status: 'failed',
        steps_executed: 1,
        total_steps: 1,
        step_results: [
          {
            step_id: 'step_0',
            step_name: 'Test Step',
            tool_id: 'test_tool',
            tool_name: 'Test Tool',
            status: 'failed',
            error: {
              message: 'Test error',
              code: 'TEST_ERROR',
            },
            duration_ms: 50,
            timestamp: new Date().toISOString(),
            prompt_executed: 'Test prompt',
            audit_entry_id: 'audit_1',
          },
        ],
        errors: [
          {
            step_id: 'step_0',
            step_name: 'Test Step',
            message: 'Test error',
            timestamp: new Date().toISOString(),
            recoverable: false,
          },
        ],
        audit_trail_id: 'trail_1',
        execution_time_ms: 50,
        summary: {
          successful_steps: 0,
          failed_steps: 1,
          skipped_steps: 0,
        },
      };

      const report = convertBuilderResultToReport(mockWorkflow, builderResult, context);

      expect(report.success).toBe(false);
      expect(report.stats.failedSteps).toBe(1);
      expect(report.errors.length).toBe(1);
    });
  });

  describe('Execution Summary Generation', () => {
    it('should generate summary for successful execution', () => {
      const mockWorkflow: Workflow = {
        name: 'Test',
        steps: [],
      };

      const context = initializeBridgeContext(mockWorkflow, {});

      const builderResult: ExecutionResult = {
        workflow_id: 'test',
        workflow_name: 'Test',
        status: 'success',
        steps_executed: 1,
        total_steps: 1,
        step_results: [],
        errors: [],
        audit_trail_id: 'trail_1',
        execution_time_ms: 1000,
        summary: {
          successful_steps: 1,
          failed_steps: 0,
          skipped_steps: 0,
        },
      };

      const summary = generateExecutionSummary(context, builderResult);

      expect(summary).toContain('Orchestrator Execution Summary');
      expect(summary).toContain('SUCCESS');
      expect(summary).toContain('1000ms');
    });

    it('should include errors in summary', () => {
      const mockWorkflow: Workflow = {
        name: 'Test',
        steps: [],
      };

      const context = initializeBridgeContext(mockWorkflow, {});

      const builderResult: ExecutionResult = {
        workflow_id: 'test',
        workflow_name: 'Test',
        status: 'failed',
        steps_executed: 1,
        total_steps: 1,
        step_results: [],
        errors: [
          {
            step_id: 'step_1',
            step_name: 'Failed Step',
            message: 'Something went wrong',
            timestamp: new Date().toISOString(),
            recoverable: false,
          },
        ],
        audit_trail_id: 'trail_1',
        execution_time_ms: 500,
        summary: {
          successful_steps: 0,
          failed_steps: 1,
          skipped_steps: 0,
        },
      };

      const summary = generateExecutionSummary(context, builderResult);

      expect(summary).toContain('Failed Step');
      expect(summary).toContain('Something went wrong');
    });
  });

  describe('Bridge Context State Management', () => {
    it('should maintain variables in workflow context', () => {
      const mockWorkflow: Workflow = {
        name: 'Test',
        steps: [],
      };

      const context = initializeBridgeContext(mockWorkflow, {});

      context.workflowContext.variables.set('test_var', 'test_value');
      context.workflowContext.variables.set('another_var', 123);

      expect(context.workflowContext.variables.get('test_var')).toBe('test_value');
      expect(context.workflowContext.variables.get('another_var')).toBe(123);
    });

    it('should track options in bridge context', () => {
      const mockWorkflow: Workflow = {
        name: 'Test',
        steps: [],
      };

      const options: OrchestratorExecutionOptions = {
        timeout: 60000,
        autoApprove: true,
        noSteering: true,
      };

      const context = initializeBridgeContext(mockWorkflow, options);

      expect(context.options.timeout).toBe(60000);
      expect(context.options.autoApprove).toBe(true);
      expect(context.options.noSteering).toBe(true);
    });
  });
});
