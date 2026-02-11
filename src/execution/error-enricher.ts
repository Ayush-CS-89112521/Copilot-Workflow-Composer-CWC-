/**
 * Error Enricher - Provides context-aware error messages with suggestions
 * Converts generic errors into actionable guidance for users
 * Uses fuzzy matching to suggest available variables/steps when references fail
 */

import { ExecutionContext } from '../types/index.js';

/**
 * Enriched error with context and suggestions
 */
export interface EnrichedError {
  /** Original error message */
  originalMessage: string;
  /** Category of the error */
  category: 'variable_resolution' | 'step_execution' | 'condition_evaluation' | 'resource' | 'unknown';
  /** Context about what was being attempted */
  context: string;
  /** Suggested fixes (in priority order) */
  suggestions: string[];
  /** Available variables at time of error */
  availableVariables: string[];
  /** Completed steps at time of error */
  completedSteps: string[];
  /** Skipped steps at time of error */
  skippedSteps: string[];
}

/**
 * Simple fuzzy string matching
 * Returns similarity score 0-1 (1 = exact match, 0 = no similarity)
 */
function calculateSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 1;

  // Levenshtein distance for typos
  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1;

  let matches = 0;
  for (let i = 0; i < Math.min(aLower.length, bLower.length); i++) {
    if (aLower[i] === bLower[i]) matches++;
  }

  return matches / maxLen;
}

/**
 * Find close matches in a list using fuzzy matching
 * Returns up to `limit` best matches
 */
function findCloseMatches(query: string, candidates: string[], limit: number = 3): string[] {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: calculateSimilarity(query, candidate),
    }))
    .filter((item) => item.score > 0.3) // Only include >30% similar
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.candidate);

  return scored;
}

/**
 * Enrich a variable resolution error
 */
export function enrichVariableResolutionError(
  errorMessage: string,
  failedReference: string,
  context: ExecutionContext
): EnrichedError {
  const availableVars = Array.from(context.variables.keys());
  const completedSteps = context.results.map((r) => r.stepId);
  const skippedSteps = context.skippedSteps?.map((s) => s.stepId) || [];

  const suggestions: string[] = [];

  // Determine error subcategory and provide specific suggestions
  if (errorMessage.includes('not executed yet') || errorMessage.includes('not found')) {
    // Forward reference - suggest completed steps
    const refStep = failedReference.split('.')[1];
    if (refStep && completedSteps.length > 0) {
      const matches = findCloseMatches(refStep, completedSteps, 2);
      if (matches.length > 0) {
        suggestions.push(`Did you mean: ${matches.map((m) => `steps.${m}`).join(' or ')}`);
      } else {
        suggestions.push(`Available steps: ${completedSteps.map((s) => `steps.${s}`).join(', ')}`);
      }
    }
  }

  if (errorMessage.includes('was skipped')) {
    // Skipped step reference
    suggestions.push('Skipped steps cannot be referenced. Consider removing the condition that skips this step.');
    suggestions.push('Or: Ensure the referenced step has no "when" condition that could cause it to skip.');
  }

  if (errorMessage.includes('not in context') || errorMessage.includes('Variable')) {
    // Missing variable - suggest available ones
    const varName = failedReference.split('.')[2] || 'output';
    if (availableVars.length > 0) {
      const matches = findCloseMatches(varName, availableVars, 2);
      if (matches.length > 0) {
        suggestions.push(`Did you mean: ${matches.map((m) => `${m}`).join(' or ')}`);
      } else {
        suggestions.push(`Available variables: ${availableVars.join(', ')}`);
      }
    } else {
      suggestions.push('No variables have been set yet. Ensure previous steps have completed.');
    }
  }

  if (suggestions.length === 0) {
    // Generic fallback
    suggestions.push('Check the step order - variables must be referenced from previously completed steps.');
    suggestions.push('Review the variable reference syntax: ${steps.STEP_ID.VARIABLE_NAME}');
  }

  return {
    originalMessage: errorMessage,
    category: 'variable_resolution',
    context: `Attempted to resolve variable reference: ${failedReference}`,
    suggestions,
    availableVariables: availableVars,
    completedSteps,
    skippedSteps,
  };
}

/**
 * Enrich a step execution error
 */
export function enrichStepExecutionError(
  errorMessage: string,
  stepId: string,
  context: ExecutionContext
): EnrichedError {
  const stepResult = context.results.find((r) => r.stepId === stepId);
  const suggestions: string[] = [];

  if (stepResult?.error) {
    suggestions.push(`Step error: ${stepResult.error}`);
  }

  if (errorMessage.includes('timed out')) {
    suggestions.push('The step exceeded the timeout limit. Increase the timeout in workflow config.');
    suggestions.push('Or: Check if the step is waiting for user input or external resource.');
  }

  if (errorMessage.includes('failed') || errorMessage.includes('error')) {
    suggestions.push('Check the step output for more details.');
    suggestions.push('Enable verbose logging to see what went wrong.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Review the step command and ensure all inputs are valid.');
  }

  return {
    originalMessage: errorMessage,
    category: 'step_execution',
    context: `Step '${stepId}' failed during execution`,
    suggestions,
    availableVariables: Array.from(context.variables.keys()),
    completedSteps: context.results.map((r) => r.stepId),
    skippedSteps: context.skippedSteps?.map((s) => s.stepId) || [],
  };
}

/**
 * Enrich a condition evaluation error
 */
export function enrichConditionEvaluationError(
  errorMessage: string,
  stepId: string,
  condition: string,
  context: ExecutionContext
): EnrichedError {
  const suggestions: string[] = [];

  if (errorMessage.includes('undefined') || errorMessage.includes('not found')) {
    suggestions.push(`Check that all variables in the condition are available: ${condition}`);
    suggestions.push(`Available variables: ${Array.from(context.variables.keys()).join(', ') || 'none'}`);
  }

  if (errorMessage.includes('syntax') || errorMessage.includes('invalid')) {
    suggestions.push('Ensure the condition syntax is valid. Example: ${steps.step1.output} == "value"');
    suggestions.push('Supported operators: ==, !=, >, <, >=, <=, includes(), length');
  }

  if (suggestions.length === 0) {
    suggestions.push(`Review the condition syntax: ${condition}`);
    suggestions.push('Ensure all referenced variables have been set by previous steps.');
  }

  return {
    originalMessage: errorMessage,
    category: 'condition_evaluation',
    context: `Condition evaluation failed for step '${stepId}': ${condition}`,
    suggestions,
    availableVariables: Array.from(context.variables.keys()),
    completedSteps: context.results.map((r) => r.stepId),
    skippedSteps: context.skippedSteps?.map((s) => s.stepId) || [],
  };
}

/**
 * Enrich a resource error
 */
export function enrichResourceError(
  errorMessage: string,
  stepId: string,
  context: ExecutionContext
): EnrichedError {
  const suggestions: string[] = [];

  if (errorMessage.includes('Memory')) {
    suggestions.push('Increase the memory limit in workflow config.');
    suggestions.push('Check if the step is producing excessive output.');
    suggestions.push('Consider breaking the step into smaller operations.');
  } else if (errorMessage.includes('CPU')) {
    suggestions.push('The step is using sustained high CPU. It may be stuck in a loop.');
    suggestions.push('Check if the step is waiting for external input.');
  } else if (errorMessage.includes('output')) {
    suggestions.push('The step is producing too much output.');
    suggestions.push('Limit output verbosity or split into multiple steps.');
  } else {
    suggestions.push('Check resource usage in the step. Optimize as needed.');
  }

  return {
    originalMessage: errorMessage,
    category: 'resource',
    context: `Resource limit exceeded for step '${stepId}'`,
    suggestions,
    availableVariables: Array.from(context.variables.keys()),
    completedSteps: context.results.map((r) => r.stepId),
    skippedSteps: context.skippedSteps?.map((s) => s.stepId) || [],
  };
}

/**
 * Format an enriched error for display
 */
export function formatEnrichedError(enriched: EnrichedError): string {
  const lines: string[] = [];

  lines.push('\n' + '═'.repeat(80));
  lines.push(`❌ ERROR [${enriched.category.toUpperCase()}]`);
  lines.push('─'.repeat(80));

  lines.push(`\nMessage: ${enriched.originalMessage}`);
  lines.push(`Context: ${enriched.context}`);

  if (enriched.suggestions.length > 0) {
    lines.push('\n💡 Suggestions:');
    enriched.suggestions.forEach((s, i) => {
      lines.push(`   ${i + 1}. ${s}`);
    });
  }

  if (enriched.completedSteps.length > 0) {
    lines.push(`\n✅ Completed steps: ${enriched.completedSteps.join(', ')}`);
  }

  if (enriched.skippedSteps.length > 0) {
    lines.push(`⏭️  Skipped steps: ${enriched.skippedSteps.join(', ')}`);
  }

  if (enriched.availableVariables.length > 0) {
    lines.push(`\n📦 Available variables: ${enriched.availableVariables.join(', ')}`);
  }

  lines.push('\n' + '═'.repeat(80) + '\n');

  return lines.join('\n');
}

/**
 * Parse error and return enriched version
 * Automatically detects error type and enriches appropriately
 */
export function enrichError(
  error: unknown,
  context: ExecutionContext,
  stepId?: string
): EnrichedError {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : 'Unknown';

  // Route to appropriate enricher based on error type
  if (errorName.includes('VariableResolution') || errorName.includes('SkippedStep')) {
    const reference = (error as any)?.reference || '';
    return enrichVariableResolutionError(errorMessage, reference, context);
  }

  if (errorName.includes('StepExecution') || errorName === 'Error') {
    if (stepId) {
      return enrichStepExecutionError(errorMessage, stepId, context);
    }
  }

  if (errorName.includes('Condition')) {
    return enrichConditionEvaluationError(errorMessage, stepId || 'unknown', '', context);
  }

  if (errorName.includes('Resource')) {
    return enrichResourceError(errorMessage, stepId || 'unknown', context);
  }

  // Fallback to generic enrichment
  return {
    originalMessage: errorMessage,
    category: 'unknown',
    context: stepId ? `Step '${stepId}' encountered an error` : 'An error occurred during workflow execution',
    suggestions: ['Check the error message above for details.', 'Review the workflow definition and ensure all steps are correctly configured.'],
    availableVariables: Array.from(context.variables.keys()),
    completedSteps: context.results.map((r) => r.stepId),
    skippedSteps: context.skippedSteps?.map((s) => s.stepId) || [],
  };
}
