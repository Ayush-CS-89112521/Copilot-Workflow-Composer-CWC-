/**
 * Context Injection Engine
 * Corrects agent trajectory by injecting human feedback into next step
 * 
 * Problem: Agent drifts from goal or makes poor decisions
 * Solution: Human provides feedback → injected into next step's system prompt
 * Result: Agent self-corrects without human re-running workflow
 */

import { Workflow, WorkflowStep, ExecutionContext } from '../types/index.js';

/**
 * Types of context injection
 */
export type InjectionType = 'goal-correction' | 'parameter-adjustment' | 'strategy-shift' | 'constraint-addition';

/**
 * Recorded injection for audit trail
 */
export interface ContextInjectionRecord {
  fromStepId: string;
  toStepId: string;
  feedback: string;
  injectionType: InjectionType;
  timestamp: Date;
}

/**
 * Determine next executable step after current step
 * Accounts for conditional branching
 */
export function findNextExecutableStep(
  workflow: Workflow,
  currentStepId: string
): WorkflowStep | undefined {
  const currentIndex = workflow.steps.findIndex(s => s.id === currentStepId);
  
  if (currentIndex === -1 || currentIndex === workflow.steps.length - 1) {
    return undefined; // No next step
  }

  // Return immediately next step
  // (In a more complex system, would handle conditional branching)
  return workflow.steps[currentIndex + 1];
}

/**
 * Inject human feedback into next step's system prompt
 * Creates a "correction preamble" that guides the agent without re-running
 */
export function injectContextIntoStep(
  step: WorkflowStep,
  feedback: string,
  injectionType: InjectionType = 'goal-correction'
): void {
  // Create contextual preamble based on injection type
  const preamble = buildInjectionPreamble(feedback, injectionType);

  // Prepend to step's prompt (preserves original intent, adds correction)
  step.prompt = `${preamble}\n\n---\n\n${step.prompt}`;
}

/**
 * Build formatted preamble based on feedback type
 */
function buildInjectionPreamble(feedback: string, type: InjectionType): string {
  const typeLabels: Record<InjectionType, string> = {
    'goal-correction': '🎯 GOAL CORRECTION',
    'parameter-adjustment': '⚙️ PARAMETER ADJUSTMENT',
    'strategy-shift': '🔄 STRATEGY SHIFT',
    'constraint-addition': '🔒 CONSTRAINT ADDITION',
  };

  const label = typeLabels[type];

  return `[HUMAN FEEDBACK - ${label}]
${feedback}
[END HUMAN FEEDBACK]`;
}

/**
 * Detect injection type from feedback text
 * Uses heuristics to classify feedback
 */
export function detectInjectionType(feedback: string): InjectionType {
  const lowerFeedback = feedback.toLowerCase();

  // Goal-related keywords
  if (
    lowerFeedback.includes('goal') ||
    lowerFeedback.includes('objective') ||
    lowerFeedback.includes('instead')
  ) {
    return 'goal-correction';
  }

  // Parameter-related keywords
  if (
    lowerFeedback.includes('parameter') ||
    lowerFeedback.includes('argument') ||
    lowerFeedback.includes('value')
  ) {
    return 'parameter-adjustment';
  }

  // Strategy-related keywords
  if (
    lowerFeedback.includes('strategy') ||
    lowerFeedback.includes('approach') ||
    lowerFeedback.includes('method')
  ) {
    return 'strategy-shift';
  }

  // Constraint-related keywords
  if (
    lowerFeedback.includes('constraint') ||
    lowerFeedback.includes('must not') ||
    lowerFeedback.includes('cannot') ||
    lowerFeedback.includes('should not')
  ) {
    return 'constraint-addition';
  }

  // Default
  return 'goal-correction';
}

/**
 * Process steering decision and perform context injection
 * Returns record for audit trail
 */
export async function processSteering(
  workflow: Workflow,
  context: ExecutionContext,
  fromStepId: string,
  feedback: string
): Promise<ContextInjectionRecord> {
  const nextStep = findNextExecutableStep(workflow, fromStepId);

  if (!nextStep) {
    throw new Error(
      `Cannot inject context: no next step after ${fromStepId} (at end of workflow)`
    );
  }

  const injectionType = detectInjectionType(feedback);
  injectContextIntoStep(nextStep, feedback, injectionType);

  const record: ContextInjectionRecord = {
    fromStepId,
    toStepId: nextStep.id,
    feedback,
    injectionType,
    timestamp: new Date(),
  };

  // Record in context for audit trail
  context.metadata = context.metadata || {};
  context.metadata.contextInjections = context.metadata.contextInjections || [];
  (context.metadata.contextInjections as ContextInjectionRecord[]).push(record);

  console.log(
    `✅ Context injected into step '${nextStep.id}' (type: ${injectionType})`
  );

  return record;
}

/**
 * Retrieve all context injections for audit trail
 */
export function getContextInjections(context: ExecutionContext): ContextInjectionRecord[] {
  return (context.metadata?.contextInjections as ContextInjectionRecord[]) || [];
}
