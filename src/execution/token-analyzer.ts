/**
 * Token Analyzer - Estimates and tracks token usage for cost analysis
 * Provides cost estimates, warnings, and monitoring for token efficiency
 */

/**
 * Token costs for different models
 * Based on GitHub Copilot Pro pricing (2026)
 */
export const TOKEN_COSTS = {
  'haiku': {
    inputPerMillion: 0.80, // $0.80 per 1M input tokens
    outputPerMillion: 4.00, // $4.00 per 1M output tokens (5x input cost)
    name: 'Claude Haiku 4.5',
  },
  'sonnet': {
    inputPerMillion: 3.00, // $3.00 per 1M input tokens
    outputPerMillion: 15.00, // $15.00 per 1M output tokens (5x input cost)
    name: 'Claude Sonnet 4.5',
  },
};

/**
 * Token estimate for a piece of text
 * Uses conservative estimate: 1 token per 4 characters
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Cost estimate for tokens
 */
export interface TokenCost {
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Total tokens */
  totalTokens: number;
  /** Estimated cost in USD */
  costUSD: number;
}

/**
 * Calculate cost for a given model and token counts
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: 'haiku' | 'sonnet'
): TokenCost {
  const modelConfig = TOKEN_COSTS[model];
  const inputCost = (inputTokens / 1000000) * modelConfig.inputPerMillion;
  const outputCost = (outputTokens / 1000000) * modelConfig.outputPerMillion;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costUSD: inputCost + outputCost,
  };
}

/**
 * Step-level token tracking
 */
export interface StepTokenAnalysis {
  /** Step ID */
  stepId: string;
  /** Model used for this step */
  model: 'haiku' | 'sonnet';
  /** Prompt/input tokens */
  inputTokens: number;
  /** Response/output tokens */
  outputTokens: number;
  /** Total tokens for this step */
  totalTokens: number;
  /** Cost for this step in USD */
  costUSD: number;
  /** Whether this step hit the 3K token warning threshold */
  highTokenCount?: boolean;
}

/**
 * Workflow-level token summary
 */
export interface WorkflowTokenSummary {
  /** Total steps analyzed */
  totalSteps: number;
  /** Steps using Haiku */
  haikuSteps: number;
  /** Steps using Sonnet */
  sonnetSteps: number;
  /** Total input tokens */
  totalInputTokens: number;
  /** Total output tokens */
  totalOutputTokens: number;
  /** Grand total tokens */
  totalTokens: number;
  /** Estimated total cost in USD */
  totalCostUSD: number;
  /** Haiku cost breakdown */
  haikuCostUSD: number;
  /** Sonnet cost breakdown */
  sonnetCostUSD: number;
  /** Steps exceeding 3K token warning */
  highTokenSteps: number;
  /** Estimated savings if all steps used Haiku */
  potentialSavingsUSD: number;
}

/**
 * Analyze tokens for a single step
 */
export function analyzeStepTokens(
  stepId: string,
  prompt: string,
  output: string,
  model: 'haiku' | 'sonnet'
): StepTokenAnalysis {
  const inputTokens = estimateTokens(prompt);
  const outputTokens = estimateTokens(output);
  const cost = calculateCost(inputTokens, outputTokens, model);

  return {
    stepId,
    model,
    inputTokens,
    outputTokens,
    totalTokens: cost.totalTokens,
    costUSD: cost.costUSD,
    highTokenCount: inputTokens > 3000,
  };
}

/**
 * Aggregate step analyses into workflow summary
 */
export function summarizeWorkflowTokens(
  stepAnalyses: StepTokenAnalysis[]
): WorkflowTokenSummary {
  let totalInput = 0;
  let totalOutput = 0;
  let haikuSteps = 0;
  let sonnetSteps = 0;
  let haikuCost = 0;
  let sonnetCost = 0;
  let highTokenSteps = 0;

  for (const step of stepAnalyses) {
    totalInput += step.inputTokens;
    totalOutput += step.outputTokens;

    if (step.model === 'haiku') {
      haikuSteps++;
    } else {
      sonnetSteps++;
    }

    if (step.highTokenCount) {
      highTokenSteps++;
    }

    if (step.model === 'haiku') {
      haikuCost += step.costUSD;
    } else {
      sonnetCost += step.costUSD;
    }
  }

  const totalCost = haikuCost + sonnetCost;

  // Calculate potential savings if all steps used Haiku
  const allHaikuCost = calculateCost(totalInput, totalOutput, 'haiku').costUSD;
  const potentialSavings = totalCost - allHaikuCost;

  return {
    totalSteps: stepAnalyses.length,
    haikuSteps,
    sonnetSteps,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalTokens: totalInput + totalOutput,
    totalCostUSD: totalCost,
    haikuCostUSD: haikuCost,
    sonnetCostUSD: sonnetCost,
    highTokenSteps,
    potentialSavingsUSD: potentialSavings > 0 ? potentialSavings : 0,
  };
}

/**
 * Format cost for display (USD)
 */
export function formatCost(costUSD: number): string {
  if (costUSD < 0.01) {
    return `$${(costUSD * 1000).toFixed(1)}m`; // Millicents
  }
  return `$${costUSD.toFixed(3)}`;
}

/**
 * Format workflow summary for logging
 */
export function formatWorkflowSummary(summary: WorkflowTokenSummary): string {
  return (
    `Workflow: ${summary.totalSteps} steps, ` +
    `${summary.totalTokens.toLocaleString()} tokens (${summary.haikuSteps} Haiku, ${summary.sonnetSteps} Sonnet) | ` +
    `Cost: ${formatCost(summary.totalCostUSD)} ` +
    `(Haiku: ${formatCost(summary.haikuCostUSD)}, Sonnet: ${formatCost(summary.sonnetCostUSD)})` +
    (summary.potentialSavingsUSD > 0 ? ` | Potential savings: ${formatCost(summary.potentialSavingsUSD)}` : '')
  );
}

/**
 * Check if step token count is concerning (>3K tokens)
 */
export function isHighTokenCount(tokens: number): boolean {
  return tokens > 3000;
}

/**
 * Get warning message for high token count
 */
export function getHighTokenWarning(inputTokens: number, model: 'haiku' | 'sonnet'): string {
  const modelName = TOKEN_COSTS[model].name;
  return (
    `⚠️  High token count (${inputTokens} tokens) for ${modelName}. ` +
    `Consider breaking into smaller steps or using summarization.`
  );
}

/**
 * Estimate total cost for a workflow before execution
 * Used to show cost estimate upfront
 */
export function estimateWorkflowCost(steps: Array<{ prompt: string; model?: 'haiku' | 'sonnet' }>): {
  estimatedTokens: number;
  estimatedCostUSD: number;
} {
  let totalTokens = 0;
  let haikuTokens = 0;
  let sonnetTokens = 0;

  for (const step of steps) {
    const tokens = estimateTokens(step.prompt);
    const model = step.model || 'haiku';

    if (model === 'haiku') {
      haikuTokens += tokens;
    } else {
      sonnetTokens += tokens;
    }

    totalTokens += tokens;
  }

  // Assume output is roughly 50% of input tokens
  const estimatedOutput = totalTokens * 0.5;

  const haikuEstimate = haikuTokens > 0
    ? calculateCost(haikuTokens, estimatedOutput * (haikuTokens / totalTokens), 'haiku')
    : { costUSD: 0 };
  const sonnetEstimate = sonnetTokens > 0
    ? calculateCost(sonnetTokens, estimatedOutput * (sonnetTokens / totalTokens), 'sonnet')
    : { costUSD: 0 };

  return {
    estimatedTokens: Math.ceil(totalTokens + estimatedOutput),
    estimatedCostUSD: haikuEstimate.costUSD + sonnetEstimate.costUSD,
  };
}

/**
 * Format token estimate for display
 */
export function formatTokenEstimate(
  estimate: ReturnType<typeof estimateWorkflowCost>
): string {
  return (
    `Estimated: ${estimate.estimatedTokens.toLocaleString()} tokens, ` +
    `${formatCost(estimate.estimatedCostUSD)}`
  );
}
