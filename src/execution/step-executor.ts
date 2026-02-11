/**
 * Step Executor - Executes individual workflow steps
 * Handles gh copilot suggest invocation and output processing
 * Monitors resource usage to prevent runaway processes
 * Integrates with SpinnerManager for visual progress feedback
 * 
 * Layer 8: Audit Trail Integration
 * - Track tool usage per step execution
 * - Log tool availability at execution time
 * - Record resource limits applied
 * - Generate tool usage summary for post-workflow analysis
 */

import { spawn } from 'bun';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import {
  ExecutionContext,
  WorkflowStep,
  StepResult,
  ResourceAlert,
} from '../types/index.js';
import { resolvePrompt } from './variable-resolver.js';
import { getRunDirectory } from '../context/context-manager.js';
import { ResourceWatchdog } from './resource-watchdog.js';
import { SpinnerManager } from '../ui/spinner-manager.js';
import type { ToolDescriptor } from '../types/tool-discovery.js';

/**
 * Error thrown when step execution fails
 */
export class StepExecutionError extends Error {
  constructor(
    message: string,
    public readonly stepId: string,
    public readonly attemptNumber: number = 1
  ) {
    super(message);
    this.name = 'StepExecutionError';
  }
}

/**
 * Estimate token count in prompt (rough approximation)
 * Uses heuristic: ~1 token per 4 characters (conservative estimate)
 * 
 * @param text - Text to tokenize
 * @returns Estimated token count
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Select optimal model based on prompt complexity
 * Strategy:
 * - Default: Claude Haiku 4.5 (cheapest, fastest)
 * - Upgrade to Sonnet 4.5 if: prompt >3K tokens OR agent=='edit'
 * - Never use Opus (3x cost isn't justified)
 *
 * @param prompt - Prompt text
 * @param agent - Agent type ('suggest', 'explain', 'edit')
 * @param stepModel - Explicit model override from step config
 * @returns 'haiku' or 'sonnet'
 */
function selectModel(
  prompt: string,
  agent: string,
  stepModel?: 'haiku' | 'sonnet'
): 'haiku' | 'sonnet' {
  // Step-level override takes precedence
  if (stepModel) {
    return stepModel;
  }

  // Estimate tokens in prompt
  const tokenCount = estimateTokenCount(prompt);

  // Complexity factors:
  // 1. Prompt length: >3K tokens suggests complex task
  // 2. Agent type: 'edit' is inherently more complex
  const isComplexLength = tokenCount > 3000;
  const isEditAgent = agent === 'edit';

  // If either complexity signal detected, use Sonnet
  if (isComplexLength || isEditAgent) {
    return 'sonnet';
  }

  // Default to Haiku (fast, cheap)
  return 'haiku';
}

/**
 * Wrapper around 'gh copilot suggest' command
 * Spawns the gh CLI with appropriate arguments and captures output
 * Monitors resource usage via ResourceWatchdog
 *
 * Uses 2026-standard flags:
 * --shell: Returns raw code without interactive "Do you want to run this?" menu
 * --silent: Suppresses ASCII banners and loading messages for clean parsing
 *
 * @param prompt - The prompt to send to the agent
 * @param agentType - The type of copilot agent (suggest, explain, edit)
 * @param stepId - Step ID for resource monitoring logs
 * @param memoryMB - Memory limit in MB (from step config)
 * @param cpuWarnPercent - CPU warning threshold (from step config)
 * @param model - AI model to use: 'haiku' (default, fast, cheap) or 'sonnet' (powerful, 3x cost)
 * @returns The output from the copilot agent
 * @throws StepExecutionError if command execution fails
 */
async function invokeGhCopilot(
  prompt: string,
  agentType: string,
  stepId: string = 'unknown',
  memoryMB: number = 512,
  cpuWarnPercent: number = 80,
  model: 'haiku' | 'sonnet' = 'haiku'
): Promise<string> {
  try {
    // Use --shell and --silent flags for clean output
    // --shell: Ensures raw code without interactive prompts
    // --silent: Suppresses ASCII banners and loading messages
    // --model: Specify which Claude model to use
    const modelFlag = model === 'sonnet' ? '--model=claude-sonnet-4.5' : '--model=claude-haiku-4.5';
    const args = ['gh', 'copilot', agentType, '--shell', '--silent', modelFlag, prompt];

    const proc = spawn(args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Start resource watchdog monitoring in background
    const watchdog = new ResourceWatchdog(proc.pid, {
      memoryMB,
      cpuWarnPercent,
      checkIntervalMs: 500,
      maxHighResourceReadings: 6,
    });

    let output = '';
    let resourceAlert: ResourceAlert | null = null;

    // Start monitoring (non-blocking)
    const monitoringPromise = watchdog.start(stepId, 0).then((alert) => {
      if (alert) {
        resourceAlert = alert;
        // Kill the process if resource limit exceeded
        console.error(`🛑 Resource limit exceeded for step '${stepId}': ${alert.message}`);
        try {
          process.kill(-proc.pid, 'SIGKILL');
        } catch {
          // Process may already be dead
        }
      }
      return alert;
    });

    // Capture output with size tracking for watchdog
    const readOutput = new Response(proc.stdout).text().then((text) => {
      output = text;
      watchdog.updateOutputLength(output.length);
      return text;
    });

    const readError = new Response(proc.stderr).text();

    // Wait for either:
    // 1. Process to complete normally
    // 2. Resource watchdog to kill process
    const [exitCodeOrAlert] = await Promise.all([
      Promise.race([proc.exited, monitoringPromise]),
      readOutput,
      readError,
    ]);

    // Stop watchdog and collect alerts
    watchdog.stop();

    // If resource limit was hit, throw error
    if (resourceAlert !== null) {
      throw new Error((resourceAlert as ResourceAlert).message);
    }

    const exitCode =
      typeof exitCodeOrAlert === 'number' ? exitCodeOrAlert : 1;

    if (exitCode !== 0) {
      const errorText = await readError;
      throw new Error(
        `Command failed with exit code ${exitCode}: ${errorText || 'unknown error'}`
      );
    }

    return output.trim();
  } catch (error) {
    throw new Error(
      `Failed to invoke gh copilot: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse the output from gh copilot suggest into structured data
 * Handles different output formats (JSON, shell scripts, plain text)
 *
 * @param output - The raw output from gh copilot
 * @returns Parsed output object, or the original string if not JSON
 */
function parseGhCopilotOutput(output: string): unknown {
  try {
    // Try to parse as JSON
    return JSON.parse(output);
  } catch {
    // Return raw output if not JSON
    return output;
  }
}

/**
 * Save a step's output to the filesystem with Layer 8 enrichment
 * Handles different output configurations (variable, file, files)
 * Layer 8: Includes tool metadata, resource configuration, and availability in audit trail
 *
 * @param context - The execution context
 * @param step - The workflow step
 * @param output - The raw output string
 */
async function saveStepOutputToFilesystem(
  context: ExecutionContext,
  step: WorkflowStep,
  output: string
): Promise<void> {
  const runDir = getRunDirectory(context.runId);

  // Layer 8: Build metadata enrichment for audit trail
  const auditMetadata = {
    stepId: step.id,
    timestamp: new Date().toISOString(),
    toolMetadata: null as ToolDescriptor | null,
    resourcesApplied: null as Record<string, unknown> | null,
  };

  // Layer 8: Capture tool metadata if available
  if (context.toolMetadata && context.toolMetadata.size > 0) {
    // Try to find tool that matches this step's prompt
    for (const [_toolId, toolMeta] of context.toolMetadata) {
      const toolMetaTyped = toolMeta as ToolDescriptor;
      if (
        step.prompt.includes(toolMetaTyped.id) ||
        step.prompt.includes(toolMetaTyped.name) ||
        step.prompt.toLowerCase().includes(toolMetaTyped.name.toLowerCase())
      ) {
        auditMetadata.toolMetadata = toolMetaTyped;
        break;
      }
    }
  }

  // Layer 8: Record applied resource limits
  if (step.resources) {
    auditMetadata.resourcesApplied = {
      memoryMB: step.resources.memoryMB,
      cpuWarnPercent: step.resources.cpuWarnPercent,
    };
  }

  if (step.output.type === 'file') {
    const filePath = step.output.path!;
    const absolutePath = join(runDir, 'outputs', filePath);

    // Create directory structure if needed
    const dir = absolutePath.substring(0, absolutePath.lastIndexOf('/'));
    await Bun.write(Bun.file(dir), '');

    // Layer 8: Prepend audit metadata as JSON header
    const auditOutput = `${JSON.stringify(auditMetadata, null, 2)}\n\n---OUTPUT---\n\n${output}`;
    await writeFile(absolutePath, auditOutput);
  } else if (step.output.type === 'files') {
    // For glob patterns, assume output is a list of file paths or contents
    // Implementation depends on specific use case
    // For now, save as a manifest
    const manifestPath = join(runDir, 'outputs', `${step.id}_manifest.json`);
    
    // Layer 8: Include tool and resource metadata in manifest
    const manifest = {
      output,
      ...auditMetadata,
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
}

/**
 * Execute a single workflow step
 * Resolves variables in the prompt, invokes gh copilot, and records the result
 *
 * @param context - The execution context
 * @param step - The workflow step to execute
 * @param attemptNumber - The current attempt number (for retries)
 * @returns The step execution result
 */
export async function executeStep(
  context: ExecutionContext,
  step: WorkflowStep,
  attemptNumber: number = 1,
  spinnerManager?: SpinnerManager
): Promise<StepResult> {
  const startTime = Date.now();

  try {
    // Update context to track current step
    context.currentStepId = step.id;

    // Start spinner if manager provided
    if (spinnerManager) {
      spinnerManager.start(step.id, step.agent);
    }

    // Step 1: Resolve variable references in the prompt
    let resolvedPrompt = step.prompt;
    try {
      resolvedPrompt = resolvePrompt(step.prompt, context);
    } catch (error) {
      if (spinnerManager) {
        spinnerManager.fail(error instanceof Error ? error.message : String(error));
      }
      throw new StepExecutionError(
        `Variable resolution failed: ${error instanceof Error ? error.message : String(error)}`,
        step.id,
        attemptNumber
      );
    }

    // Step 2: Invoke gh copilot with the resolved prompt
    // Determine resource limits (step-level override or workflow default)
    const memoryMB = step.resources?.memoryMB ?? context.config.resources?.defaultMemoryMB ?? 512;
    const cpuWarnPercent =
      step.resources?.cpuWarnPercent ?? context.config.resources?.defaultCpuWarnPercent ?? 80;

    // Step 2a: Select optimal model based on complexity
    const selectedModel = selectModel(resolvedPrompt, step.agent, step.model);

    let output: string;
    try {
      output = await invokeGhCopilot(
        resolvedPrompt,
        step.agent,
        step.id,
        memoryMB,
        cpuWarnPercent,
        selectedModel
      );
      // Update spinner with output size and model used
      if (spinnerManager && output) {
        spinnerManager.update(`${output.length} bytes generated (${selectedModel})`);
      }
    } catch (error) {
      if (spinnerManager) {
        spinnerManager.fail(error instanceof Error ? error.message : String(error));
      }
      throw new StepExecutionError(
        `Agent invocation failed: ${error instanceof Error ? error.message : String(error)}`,
        step.id,
        attemptNumber
      );
    }

    // Step 3: Parse the output
    const parsedOutput = parseGhCopilotOutput(output);

    // Step 4: Save the output to storage
    await saveStepOutputToFilesystem(context, step, output);

    // Step 5: Create and return successful result
    const duration = Date.now() - startTime;

    // Update spinner with success
    if (spinnerManager) {
      spinnerManager.succeed(`Completed in ${(duration / 1000).toFixed(1)}s`);
    }

    // Calculate token estimate for this step
    const promptTokens = estimateTokenCount(resolvedPrompt);
    const outputTokens = estimateTokenCount(output);
    const tokenEstimate = promptTokens + outputTokens;

    return {
      stepId: step.id,
      success: true,
      output,
      parsedOutput,
      duration,
      timestamp: new Date(),
      retriesAttempted: attemptNumber - 1,
      model: selectedModel,
      tokenEstimate,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    const errorMessage =
      error instanceof StepExecutionError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);

    // Update spinner with failure
    if (spinnerManager) {
      spinnerManager.fail(errorMessage);
    }

    return {
      stepId: step.id,
      success: false,
      output: '',
      error: errorMessage,
      duration,
      timestamp: new Date(),
      retriesAttempted: attemptNumber - 1,
    };
  }
}

/**
 * Execute a step with retry logic
 * Retries the step up to maxRetries times if it fails
 *
 * @param context - The execution context
 * @param step - The workflow step to execute
 * @param maxRetries - Maximum number of retries (from config or step)
 * @param spinnerManager - Optional spinner for visual feedback
 * @returns The step execution result (final attempt)
 */
export async function executeStepWithRetry(
  context: ExecutionContext,
  step: WorkflowStep,
  maxRetries?: number,
  spinnerManager?: SpinnerManager
): Promise<StepResult> {
  const retries = maxRetries ?? step.retries ?? context.config.retries;

  let lastResult: StepResult | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    lastResult = await executeStep(context, step, attempt, spinnerManager);

    if (lastResult.success) {
      return lastResult;
    }

    // Don't sleep on the final attempt
    if (attempt <= retries) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return lastResult!;
}

/**
 * Execute a step with timeout enforcement
 * Times out the step execution after the specified duration
 *
 * @param context - The execution context
 * @param step - The workflow step to execute
 * @param timeoutMs - Timeout in milliseconds (from step or config)
 * @param spinnerManager - Optional spinner for visual feedback
 * @returns The step execution result
 */
export async function executeStepWithTimeout(
  context: ExecutionContext,
  step: WorkflowStep,
  timeoutMs?: number,
  spinnerManager?: SpinnerManager
): Promise<StepResult> {
  const timeout = timeoutMs ?? step.timeout ?? context.config.timeout;

  const timeoutPromise = new Promise<StepResult>((resolve) => {
    setTimeout(() => {
      if (spinnerManager) {
        spinnerManager.fail(`Timeout after ${timeout}ms`);
      }
      resolve({
        stepId: step.id,
        success: false,
        output: '',
        error: `Step execution timed out after ${timeout}ms`,
        duration: timeout,
        timestamp: new Date(),
        retriesAttempted: 0,
      });
    }, timeout);
  });

  const executionPromise = executeStepWithRetry(context, step, undefined, spinnerManager);

  return Promise.race([executionPromise, timeoutPromise]);
}
