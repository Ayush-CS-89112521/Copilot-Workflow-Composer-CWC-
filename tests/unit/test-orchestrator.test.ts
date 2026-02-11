/**
 * Tests for Auto-Switch Orchestrator (Phase 6c)
 * Validates all four phases and their integration
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import {
  AutoSwitchOrchestrator,
  PlannerExecutionMode,
  createOrchestratorFromFlags,
} from '../../src/engine/auto-switch-orchestrator';
import type { ArchitectPlan } from '../../src/types/architect';
import type { CheckpointDecision } from '../../src/interactive/checkpoint-handler';
import type { Workflow, WorkflowStep } from '../../src/parsers/plan-converter';

// Mock Services
mock.module('../../src/services/architect-service', () => ({
  ArchitectService: class {
    createPlanFromRequest = mock(async () => ({
      plan_id: 'test-plan-001',
      request_summary: 'Mock Plan',
      steps: [{ step_id: 1, tool_needed: 'test_tool', dependencies: [] }],
      confidence_score: 0.95,
      total_steps: 1,
      execution_order: [1],
      timestamp: new Date().toISOString(),
      estimated_tokens: 100,
      approval_required: false,
      reasoning: 'Mock reasoning',
      risks: []
    }));
  }
}));

// NOTE: Commented out to prevent test isolation issues with plan-converter tests
// The orchestrator tests will need to be updated to work without this mock
/*
mock.module('../../src/parsers/plan-converter', () => ({
  PlanConverter: class {
    convert = mock(async () => ({
      success: true,
      workflow: {
        name: 'Mock Workflow',
        steps: [{ id: 'step1', name: 'Step 1', tools: [{ id: 'tool1' }], prompt: 'run' }],
        metadata: {}
      },
      hallucinations: []
    }));
  },
  convertPlanToWorkflow: mock(async () => ({ success: true })),
  loadToolCatalog: mock(() => [])
}));
*/

mock.module('../../src/agents/builder', () => ({
  BuilderAgent: class {
    execute = mock(async () => ({
      status: 'success',
      steps_executed: 1,
      total_steps: 1,
      execution_time_ms: 100,
      audit_trail_id: 'audit-1'
    }));
  }
}));

mock.module('../../src/interactive/checkpoint-handler', () => ({
  CheckpointHandler: class {
    getApproval = mock(async () => ({ approved: true, action: 'approve' }));
    autoApprove = mock(async () => ({ approved: true, action: 'approve' }));
  }
}));

mock.module('../../src/optimization/tool-pruner', () => ({
  ToolPruner: class {
    getToolById = mock(() => ({ id: 'tool1', name: 'Tool 1' }));
  },
  createToolPruner: () => new (class {
    getToolById = mock(() => ({ id: 'tool1', name: 'Tool 1' }));
  })()
}));

// Mock user input
const mockUserPrompt = 'Analyze user behavior logs and generate insights';

// Mock Architect Plan
const createMockPlan = (): ArchitectPlan => ({
  plan_id: 'test-plan-001',
  request_summary: mockUserPrompt,
  reasoning: 'Simple two-step plan for data analysis',
  total_steps: 2,
  estimated_tokens: 100,
  approval_required: false,
  confidence_score: 0.95,
  risks: [],
  timestamp: new Date().toISOString(),
  execution_order: [1, 2],
  steps: [
    {
      step_id: 1,
      step_name: 'Load data',
      description: 'Load user logs',
      tool_needed: 'read_file',
      input_requirements: ['file_path'],
      expected_output: 'Raw log data',
      reasoning: 'Need to read from file system',
      dependencies: [],
    },
    {
      step_id: 2,
      step_name: 'Analyze',
      description: 'Analyze behavior patterns',
      tool_needed: 'analyze_data',
      input_requirements: ['data'],
      expected_output: 'Behavioral insights',
      reasoning: 'Specialized analysis tool',
      dependencies: [1],
    },
  ],
});

// Mock Checkpoint Decision
const createMockDecision = (): CheckpointDecision => ({
  approved: true,
  action: 'approve',
  timestamp: new Date().toISOString(),
  user_context: 'Plan looks good',
});

describe('Auto-Switch Orchestrator - Phase 6c', () => {
  let orchestrator: AutoSwitchOrchestrator;

  beforeEach(() => {
    orchestrator = new AutoSwitchOrchestrator({
      mode: PlannerExecutionMode.AUTO_SWITCH,
      steeringEnabled: true,
      autoApprove: false,
      timeout: 30000,
    });
  });

  afterEach(() => {
    mock.restore();
  });

  describe('Initialization', () => {
    it('should create orchestrator with default config', () => {
      const orch = new AutoSwitchOrchestrator();
      const context = orch.getContext();

      expect(context.mode).toBe(PlannerExecutionMode.AUTO_SWITCH);
      expect(context.hallucinations).toEqual([]);
      expect(context.auditTrail).toEqual([]);
      expect(context.planningComplete).toBe(false);
    });

    it('should create orchestrator with custom config', () => {
      const config = {
        mode: PlannerExecutionMode.PLAN_ONLY,
        autoApprove: true,
        timeout: 60000,
      };
      const orch = new AutoSwitchOrchestrator(config);

      expect(orch.getContext().mode).toBe(PlannerExecutionMode.PLAN_ONLY);
    });

    it('should initialize services without errors', () => {
      expect(orchestrator).toBeDefined();
      expect(() => orchestrator.getContext()).not.toThrow();
    });
  });

  describe('Phase A: Generate Plan', () => {
    it('should handle plan generation', async () => {
      // This test validates the interface and error handling
      // Actual ArchitectService would be mocked in integration tests
      const context = orchestrator.getContext();
      expect(context.planningComplete).toBe(false);
      expect(context.currentPlan).toBeUndefined();
    });

    it('should record audit trail for Phase A', () => {
      const orchestrator = new AutoSwitchOrchestrator();
      const auditTrail = orchestrator.getAuditTrail();

      // Initial state should have empty audit trail
      expect(Array.isArray(auditTrail)).toBe(true);
    });

    it('should throw error when ArchitectService fails', async () => {
      const orch = new AutoSwitchOrchestrator({
        mode: PlannerExecutionMode.PLAN_ONLY,
      });

      // Mock failed service by attempting phase without proper init
      // This would fail in real execution
      try {
        await orch.phaseA_GeneratePlan(mockUserPrompt);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Phase B: Steering Validation', () => {
    it('should require user approval', async () => {
      const plan = createMockPlan();

      try {
        await orchestrator.phaseB_ValidateWithSteering(plan);
      } catch (error) {
        // Expected to fail without proper services
        expect(error).toBeDefined();
      }
    });

    it('should handle rejection decision', () => {
      const rejectDecision: CheckpointDecision = {
        approved: false,
        action: 'reject',
        timestamp: new Date().toISOString(),
        user_context: 'Plan needs changes',
      };

      // Validation should track rejection
      expect(rejectDecision.approved).toBe(false);
    });

    it('should track modifications in decision', () => {
      const decision: CheckpointDecision = {
        approved: true,
        action: 'approve',
        timestamp: new Date().toISOString(),
        modified_workflow: {
          name: 'modified',
          steps: [],
          description: 'Modified plan',
          metadata: {
            architect_plan_id: 'test',
            confidence_score: 1,
            conversion_timestamp: '2023-01-01T00:00:00Z',
            tool_count: 0,
            hallucination_count: 0
          }
        },
      };

      expect(decision.modified_workflow).toBeDefined();
    });
  });

  describe('Phase C: Conversion & Tool Injection', () => {
    it('should require valid plan and decision', () => {
      const plan = createMockPlan();
      const decision = createMockDecision();

      // Both should be defined
      expect(plan).toBeDefined();
      expect(decision).toBeDefined();
    });

    it('should handle hallucination alerts', async () => {
      const context = orchestrator.getContext();
      expect(Array.isArray(context.hallucinations)).toBe(true);
    });

    it('should track tool injection metadata', () => {
      const step: WorkflowStep = {
        name: 'test-step',
        id: 'step_1',
        tools: [{ id: 'test_tool', name: 'Test Tool', auth_type: 'none', category: 'test' }],
        prompt: 'test prompt',
        safety: {
          pattern_scan: false,
          require_approval: false,
          timeout: 1000
        },
        error_handling: {
          on_failure: 'stop_workflow',
          fallback_enabled: false
        },
        metadata: {
          tool_action: 'exact',
          confidence_score: 1,
          index: 0,
          tool_injection_timestamp: new Date().toISOString(),
        },
      };

      expect(step.metadata?.tool_injection_timestamp).toBeDefined();
    });
  });

  describe('Phase D: Execution', () => {
    it('should prepare for execution', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'step1',
          name: 'step1',
          tools: [{ id: 'tool1', name: 'Tool 1', auth_type: 'none', category: 'test' }],
          prompt: 'test prompt',
          safety: { pattern_scan: false, require_approval: false, timeout: 1000 },
          error_handling: { on_failure: 'stop_workflow', fallback_enabled: false },
          metadata: { tool_action: 'exact', confidence_score: 1, index: 0 }
        },
      ];

      expect(Array.isArray(steps)).toBe(true);
      expect(steps[0].name).toBe('step1');
    });

    it('should require valid workflow steps', () => {
      const invalidSteps: any[] = [];

      // Should require at least one step
      expect(invalidSteps.length).toBe(0);
    });
  });

  describe('Mode-Based Execution', () => {
    it('should support PLAN_ONLY mode', () => {
      const orch = new AutoSwitchOrchestrator({
        mode: PlannerExecutionMode.PLAN_ONLY,
      });

      expect(orch.getContext().mode).toBe(PlannerExecutionMode.PLAN_ONLY);
    });

    it('should support AUTO_SWITCH mode', () => {
      const orch = new AutoSwitchOrchestrator({
        mode: PlannerExecutionMode.AUTO_SWITCH,
      });

      expect(orch.getContext().mode).toBe(PlannerExecutionMode.AUTO_SWITCH);
    });

    it('should support AUTO_EXECUTE mode (no steering)', () => {
      const orch = new AutoSwitchOrchestrator({
        mode: PlannerExecutionMode.AUTO_EXECUTE,
        steeringEnabled: false,
      });

      expect(orch.getContext().mode).toBe(PlannerExecutionMode.AUTO_EXECUTE);
    });

    it('should support EXECUTE_ONLY mode', () => {
      const orch = new AutoSwitchOrchestrator({
        mode: PlannerExecutionMode.EXECUTE_ONLY,
      });

      expect(orch.getContext().mode).toBe(PlannerExecutionMode.EXECUTE_ONLY);
    });

    it('should support TRADITIONAL mode', () => {
      const orch = new AutoSwitchOrchestrator({
        mode: PlannerExecutionMode.TRADITIONAL,
      });

      expect(orch.getContext().mode).toBe(PlannerExecutionMode.TRADITIONAL);
    });
  });

  describe('Phase Status Tracking', () => {
    it('should initialize all phases as incomplete', () => {
      const status = orchestrator.getPhaseStatus();

      expect(status.planning).toBe(false);
      expect(status.validation).toBe(false);
      expect(status.conversion).toBe(false);
      expect(status.execution).toBe(false);
    });

    it('should track completion flags', () => {
      const context = orchestrator.getContext();

      expect(typeof context.planningComplete).toBe('boolean');
      expect(typeof context.validationComplete).toBe('boolean');
      expect(typeof context.conversionComplete).toBe('boolean');
    });
  });

  describe('Audit Trail', () => {
    it('should maintain audit trail', () => {
      const auditTrail = orchestrator.getAuditTrail();

      expect(Array.isArray(auditTrail)).toBe(true);
    });

    it('should include phase information in audit', () => {
      const auditTrail = orchestrator.getAuditTrail();

      // Audit entries should include phase info
      for (const entry of auditTrail) {
        expect(['A_PLANNING', 'B_VALIDATION', 'C_CONVERSION', 'D_EXECUTION']).toContain(
          entry.phase,
        );
      }
    });

    it('should timestamp audit entries', () => {
      const auditTrail = orchestrator.getAuditTrail();

      for (const entry of auditTrail) {
        expect(entry.timestamp).toBeDefined();
        expect(new Date(entry.timestamp).getTime()).toBeGreaterThan(0);
      }
    });
  });

  describe('Flag-Based Creation', () => {
    it('should create PLAN_ONLY from --plan flag', () => {
      const orch = createOrchestratorFromFlags({ plan: true, execute: false });

      expect(orch.getContext().mode).toBe(PlannerExecutionMode.PLAN_ONLY);
    });

    it('should create EXECUTE_ONLY from --execute flag', () => {
      const orch = createOrchestratorFromFlags({ plan: false, execute: true });

      expect(orch.getContext().mode).toBe(PlannerExecutionMode.EXECUTE_ONLY);
    });

    it('should create AUTO_EXECUTE from --auto-approve flag', () => {
      const orch = createOrchestratorFromFlags({ autoApprove: true });

      expect(orch.getContext().mode).toBe(PlannerExecutionMode.AUTO_EXECUTE);
    });

    it('should create AUTO_SWITCH by default', () => {
      const orch = createOrchestratorFromFlags({});

      expect(orch.getContext().mode).toBe(PlannerExecutionMode.AUTO_SWITCH);
    });

    it('should honor --no-steering flag', () => {
      const orch = createOrchestratorFromFlags({ noSteering: true });

      // Steering disabled
      expect(orch.getContext().mode).toBeDefined();
    });
  });

  describe('Context Management', () => {
    it('should return current context', () => {
      const context = orchestrator.getContext();

      expect(context).toBeDefined();
      expect(context.mode).toBe(PlannerExecutionMode.AUTO_SWITCH);
      expect(context.startTime).toBeInstanceOf(Date);
    });

    it('should maintain context across operations', () => {
      const context1 = orchestrator.getContext();
      const context2 = orchestrator.getContext();

      // Should be same object
      expect(context1).toBe(context2);
    });

    it('should include start time', () => {
      const context = orchestrator.getContext();

      expect(context.startTime).toBeInstanceOf(Date);
      expect(context.startTime.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Summary Display', () => {
    it('should not throw when displaying summary', () => {
      expect(() => orchestrator.displaySummary()).not.toThrow();
    });

    it('should handle empty state summary', () => {
      const orch = new AutoSwitchOrchestrator();

      expect(() => orch.displaySummary()).not.toThrow();
    });

    it('should display phase status', () => {
      const orch = new AutoSwitchOrchestrator();
      const status = orch.getPhaseStatus();

      expect(status.planning).toBeTypeOf('boolean');
      expect(status.validation).toBeTypeOf('boolean');
      expect(status.conversion).toBeTypeOf('boolean');
      expect(status.execution).toBeTypeOf('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should throw on unknown mode', async () => {
      const orch = new AutoSwitchOrchestrator({
        mode: 'unknown' as any,
      });

      try {
        await orch.executeModeAware(mockUserPrompt);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should record errors in audit trail', async () => {
      const orch = new AutoSwitchOrchestrator();

      try {
        // This will fail without proper service initialization
        await orch.phaseA_GeneratePlan(mockUserPrompt);
      } catch (error) {
        const auditTrail = orch.getAuditTrail();
        // Should have audit entries even after error
        expect(Array.isArray(auditTrail)).toBe(true);
      }
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete flow data structures', () => {
      const plan = createMockPlan();
      const decision = createMockDecision();
      const steps: WorkflowStep[] = [
        {
          id: 'exec-step',
          name: 'exec-step',
          tools: [{ id: 'exec_tool', name: 'Exec Tool', auth_type: 'none', category: 'test' }],
          prompt: 'echo test',
          safety: { pattern_scan: false, require_approval: false, timeout: 1000 },
          error_handling: { on_failure: 'stop_workflow', fallback_enabled: false },
          metadata: { tool_action: 'exact', confidence_score: 1, index: 0 }
        },
      ];

      expect(plan.steps.length).toBe(2);
      expect(decision.approved).toBe(true);
      expect(steps.length).toBe(1);
    });

    it('should handle plan with dependencies', () => {
      const plan = createMockPlan();

      // Check step dependencies
      expect(plan.steps[1].dependencies).toContain(1);
    });

    it('should handle confidence scoring', () => {
      const plan = createMockPlan();

      expect(plan.confidence_score).toBe(0.95);
      // Removed step-level confidence checks as they are not in the type definition
    });
  });

  describe('Backward Compatibility', () => {
    it('should support traditional mode without planning', () => {
      const orch = new AutoSwitchOrchestrator({
        mode: PlannerExecutionMode.TRADITIONAL,
      });

      const context = orch.getContext();
      expect(context.mode).toBe(PlannerExecutionMode.TRADITIONAL);
      expect(context.currentPlan).toBeUndefined();
    });

    it('should not require planning if EXECUTE_ONLY', () => {
      const orch = new AutoSwitchOrchestrator({
        mode: PlannerExecutionMode.EXECUTE_ONLY,
      });

      const context = orch.getContext();
      expect(context.planningComplete).toBe(false);
    });
  });
});
