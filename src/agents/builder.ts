import type { Workflow, WorkflowStep } from '../parsers/plan-converter';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Execution context maintained across workflow steps
 * Allows steps to reference outputs from previous steps
 */
interface ExecutionContext {
  variables: Map<string, unknown>;
  stepResults: Map<string, StepResult>;
  auditTrail: AuditEntry[];
  startTime: number;
  timeoutMs: number;
}

/**
 * Result from executing a single step
 */
export interface StepResult {
  step_id: string;
  step_name: string;
  tool_id: string;
  tool_name: string;
  status: 'success' | 'failed' | 'skipped';
  output?: unknown;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  duration_ms: number;
  timestamp: string;
  prompt_executed: string;
  audit_entry_id: string;
}

/**
 * Complete workflow execution result
 */
export interface ExecutionResult {
  workflow_id: string;
  workflow_name: string;
  status: 'success' | 'partial' | 'failed';
  steps_executed: number;
  total_steps: number;
  step_results: StepResult[];
  errors: ExecutionError[];
  audit_trail_id: string;
  execution_time_ms: number;
  summary: {
    successful_steps: number;
    failed_steps: number;
    skipped_steps: number;
  };
}

/**
 * Error encountered during execution
 */
export interface ExecutionError {
  step_id: string;
  step_name: string;
  message: string;
  timestamp: string;
  recoverable: boolean;
}

/**
 * Audit trail entry for Phase 5 steering + Phase 7 RLHF
 */
export interface AuditEntry {
  id: string;
  timestamp: string;
  step_id: string;
  step_name: string;
  event_type: 'step_started' | 'step_completed' | 'tool_loaded' | 'error' | 'steering_input';
  details: unknown;
  user_input?: {
    action: 'approve' | 'modify' | 'skip' | 'terminate';
    context?: string;
    modified_prompt?: string;
  };
}

/**
 * Tool implementation interface (stub for actual tool execution)
 */
interface ToolImplementation {
  id: string;
  name: string;
  execute: (prompt: string, context: ExecutionContext) => Promise<unknown>;
}

/**
 * Builder Agent: Execute approved workflows with full tool access
 * - Loads tools from approved Workflow specification
 * - Executes in dependency order
 * - Real-time audit trail for Phase 5 steering
 * - Training data collection for Phase 7 RLHF
 */
export class BuilderAgent {
  private loadedTools: Map<string, ToolImplementation> = new Map();
  private toolCatalog: Map<string, unknown>;
  private auditTrail: AuditEntry[] = [];

  constructor(toolCatalog?: Map<string, unknown>) {
    this.toolCatalog = toolCatalog || new Map();
  }

  /**
   * Main entry point: Execute a complete workflow
   */
  async execute(workflow: Workflow): Promise<ExecutionResult> {
    const startTime = Date.now();
    const context: ExecutionContext = {
      variables: new Map(),
      stepResults: new Map(),
      auditTrail: [],
      startTime,
      timeoutMs: 300000, // 5-minute default timeout
    };

    const stepResults: StepResult[] = [];
    const errors: ExecutionError[] = [];
    let executedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Build execution order based on dependencies
    const executionOrder = this.buildExecutionOrder(workflow.steps);

    // Execute steps in order
    for (const stepIndex of executionOrder) {
      const step = workflow.steps[stepIndex];

      try {
        // Check dependencies before executing
        if (!this.evaluateConditions(step, context)) {
          // Step skipped due to unmet conditions
          const skipResult = this.createSkippedResult(step);
          stepResults.push(skipResult);
          context.stepResults.set(step.id, skipResult);
          skippedCount++;
          continue;
        }

        // Execute the step
        const result = await this.executeStep(step, context);
        stepResults.push(result);
        context.stepResults.set(step.id, result);
        executedCount++;

        if (result.status === 'failed') {
          failedCount++;
          errors.push({
            step_id: step.id,
            step_name: step.name,
            message: result.error?.message || 'Unknown error',
            timestamp: new Date().toISOString(),
            recoverable: this.isRecoverable(step, result),
          });

          // Handle error according to strategy
          if (step.error_handling?.on_failure === 'stop_workflow') {
            break;
          }
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : String(err);
        errors.push({
          step_id: step.id,
          step_name: step.name,
          message: errorMsg,
          timestamp: new Date().toISOString(),
          recoverable: false,
        });

        if (step.error_handling?.on_failure === 'stop_workflow') {
          break;
        }
      }
    }

    const endTime = Date.now();

    // Copy audit trail to class property so getAuditTrail() can access it
    this.auditTrail = context.auditTrail;

    return {
      workflow_id: workflow.name,
      workflow_name: workflow.name,
      status:
        failedCount === 0
          ? 'success'
          : failedCount === executedCount
            ? 'failed'
            : 'partial',
      steps_executed: executedCount,
      total_steps: workflow.steps.length,
      step_results: stepResults,
      errors,
      audit_trail_id: `audit_${Date.now()}`,
      execution_time_ms: endTime - startTime,
      summary: {
        successful_steps: executedCount - failedCount,
        failed_steps: failedCount,
        skipped_steps: skippedCount,
      },
    };
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: WorkflowStep,
    context: ExecutionContext,
  ): Promise<StepResult> {
    const stepStartTime = Date.now();
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log step started
    context.auditTrail.push({
      id: auditId,
      timestamp: new Date().toISOString(),
      step_id: step.id,
      step_name: step.name,
      event_type: 'step_started',
      details: {
        tool_id: step.tools[0]?.id,
        prompt_hash: this.hashString(step.prompt),
      },
    });

    try {
      // Load tool
      const tool = await this.loadTool(step.tools[0].id);
      if (!tool) {
        throw new Error(`Failed to load tool: ${step.tools[0]?.id}`);
      }

      context.auditTrail.push({
        id: `audit_${Date.now()}_load`,
        timestamp: new Date().toISOString(),
        step_id: step.id,
        step_name: step.name,
        event_type: 'tool_loaded',
        details: {
          tool_id: tool.id,
          tool_name: tool.name,
        },
      });

      // Execute tool with step prompt
      const output = await this.runTool(
        tool,
        step.prompt,
        context,
        step.safety?.timeout || 60000,
      );

      const stepEndTime = Date.now();

      context.auditTrail.push({
        id: auditId + '_complete',
        timestamp: new Date().toISOString(),
        step_id: step.id,
        step_name: step.name,
        event_type: 'step_completed',
        details: {
          output_size: JSON.stringify(output).length,
          duration_ms: stepEndTime - stepStartTime,
        },
      });

      // Store result in context for dependent steps
      const result: StepResult = {
        step_id: step.id,
        step_name: step.name,
        tool_id: tool.id,
        tool_name: tool.name,
        status: 'success',
        output,
        duration_ms: stepEndTime - stepStartTime,
        timestamp: new Date().toISOString(),
        prompt_executed: step.prompt,
        audit_entry_id: auditId,
      };

      return result;
    } catch (err) {
      const stepEndTime = Date.now();
      const errorMsg =
        err instanceof Error ? err.message : String(err);

      context.auditTrail.push({
        id: auditId + '_error',
        timestamp: new Date().toISOString(),
        step_id: step.id,
        step_name: step.name,
        event_type: 'error',
        details: {
          error_message: errorMsg,
          error_type: err instanceof Error ? err.constructor.name : 'Unknown',
        },
      });

      return {
        step_id: step.id,
        step_name: step.name,
        tool_id: step.tools[0]?.id || 'unknown',
        tool_name: step.tools[0]?.name || 'Unknown',
        status: 'failed',
        error: {
          message: errorMsg,
          code: 'EXECUTION_ERROR',
          stack:
            err instanceof Error ? err.stack : undefined,
        },
        duration_ms: stepEndTime - stepStartTime,
        timestamp: new Date().toISOString(),
        prompt_executed: step.prompt,
        audit_entry_id: auditId,
      };
    }
  }

  /**
   * Load tool dynamically from catalog
   * Only loads tools that are explicitly in the approved Workflow
   */
  private async loadTool(toolId: string): Promise<ToolImplementation | null> {
    // Check cache first
    if (this.loadedTools.has(toolId)) {
      return this.loadedTools.get(toolId) || null;
    }

    // For now, return stub tool
    // In production, would load from actual MCP catalog and validate
    const stubTool: ToolImplementation = {
      id: toolId,
      name: toolId.replace(/-/g, ' ').toUpperCase(),
      execute: this.createMockToolExecution(toolId),
    };

    this.loadedTools.set(toolId, stubTool);
    return stubTool;
  }

  /**
   * Create mock tool execution for testing
   * In production, would call actual tool via MCP
   */
  private createMockToolExecution(toolId: string) {
    return async (
      prompt: string,
      context: ExecutionContext,
    ): Promise<unknown> => {
      // Simulate tool execution
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        tool_id: toolId,
        executed_prompt: prompt.substring(0, 100),
        result: `Executed ${toolId}`,
        timestamp: new Date().toISOString(),
      };
    };
  }

  /**
   * Run tool with timeout and error handling
   */
  private async runTool(
    tool: ToolImplementation,
    prompt: string,
    context: ExecutionContext,
    timeoutMs: number,
  ): Promise<unknown> {
    return Promise.race([
      tool.execute(prompt, context),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Tool execution timeout after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * Evaluate conditional execution (when clauses)
   * Returns true if step should execute, false if conditions not met
   */
  private evaluateConditions(
    step: WorkflowStep,
    context: ExecutionContext,
  ): boolean {
    if (!step.when) {
      return true; // No conditions, execute
    }

    // Parse "step_X_complete == true && step_Y_complete == true"
    const conditions = step.when.split('&&').map(c => c.trim());

    for (const condition of conditions) {
      const match = condition.match(/step_(\d+)_complete\s*==\s*true/);
      if (match) {
        const depStepId = `step_${match[1]}`;
        const depResult = context.stepResults.get(depStepId);

        if (!depResult || depResult.status !== 'success') {
          return false; // Dependency not met
        }
      }
    }

    return true; // All conditions met
  }

  /**
   * Build execution order from dependency graph
   * Returns array of step indices in execution order
   */
  private buildExecutionOrder(steps: WorkflowStep[]): number[] {
    const order: number[] = [];
    const visited = new Set<number>();
    const visiting = new Set<number>();

    const visit = (index: number) => {
      if (visited.has(index)) return;
      if (visiting.has(index)) {
        throw new Error('Circular dependency detected in workflow');
      }

      visiting.add(index);
      const step = steps[index];

      // Extract dependencies from when clause
      if (step.when) {
        const matches = step.when.match(/step_(\d+)_complete/g);
        if (matches) {
          const deps = [...new Set(matches)]; // Remove duplicates
          for (const dep of deps) {
            const depMatch = dep.match(/step_(\d+)/);
            if (depMatch) {
              const depIndex = parseInt(depMatch[1]);
              visit(depIndex);
            }
          }
        }
      }

      visiting.delete(index);
      visited.add(index);
      order.push(index);
    };

    for (let i = 0; i < steps.length; i++) {
      visit(i);
    }

    return order;
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(
    step: WorkflowStep,
    result: StepResult,
  ): boolean {
    // Timeouts and network errors are generally recoverable
    const message = result.error?.message || '';
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('ECONNREFUSED')
    );
  }

  /**
   * Create result for skipped step
   */
  private createSkippedResult(step: WorkflowStep): StepResult {
    return {
      step_id: step.id,
      step_name: step.name,
      tool_id: step.tools[0]?.id || 'unknown',
      tool_name: step.tools[0]?.name || 'Unknown',
      status: 'skipped',
      duration_ms: 0,
      timestamp: new Date().toISOString(),
      prompt_executed: '', // Not executed
      audit_entry_id: `skipped_${Date.now()}`,
    };
  }

  /**
   * Simple hash for audit trail
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Get audit trail for Phase 5 steering + Phase 7 RLHF
   */
  getAuditTrail(): AuditEntry[] {
    return this.auditTrail;
  }

  /**
   * Allow Phase 5 steering to inject user feedback
   */
  async handleSteeringInput(
    stepId: string,
    input: {
      action: 'approve' | 'modify' | 'skip' | 'terminate';
      context?: string;
      modified_prompt?: string;
    },
  ): Promise<void> {
    this.auditTrail.push({
      id: `steering_${Date.now()}`,
      timestamp: new Date().toISOString(),
      step_id: stepId,
      step_name: stepId,
      event_type: 'steering_input',
      user_input: input,
      details: {
        action: input.action,
        has_context: !!input.context,
        has_modified_prompt: !!input.modified_prompt,
      },
    });
  }
}
