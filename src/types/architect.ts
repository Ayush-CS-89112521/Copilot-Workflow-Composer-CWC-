/**
 * Phase 6: Architect-Builder Pattern
 * Type definitions for the Architect Agent and Tool Pruner
 */

/**
 * Lightweight tool entry in the pruned catalog
 * Stripped of full schemas to save 90% of tokens
 */
export interface LightweightToolEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  languages?: string[];
  scope?: 'local_service' | 'cloud_service' | 'embedded';
}

/**
 * Pruned tool index for lightweight context
 * Contains only ID, Name, Description, Category
 */
export interface PrunedToolIndex {
  total_tools_available: number;
  pruned_count: number;
  pruned_tools: LightweightToolEntry[];
  generated_at: string;
  token_estimate: number;
}

/**
 * Single step in the execution plan
 */
export interface ArchitectPlanStep {
  step_id: number;
  step_name: string;
  description?: string;
  tool_needed: string; // Must match a tool ID from pruned index
  reasoning: string; // Why this tool, in human terms
  expected_output?: string; // What we expect to get back
  dependencies?: number[]; // Step IDs this depends on
  input_requirements?: string[]; // What data this step needs
  error_handling?: string; // How to handle failures
  confidence?: number;
  category?: string;
  [key: string]: any;
}

/**
 * Complete plan output by the Architect Agent
 */
export interface ArchitectPlan {
  request_summary: string;
  steps: ArchitectPlanStep[];
  total_steps: number;
  estimated_tokens: number;
  approval_required: boolean;
  confidence_score: number; // 0-1, how confident the plan is
  risks: string[]; // Identified risks or warnings
  assumptions?: string[];
  plan_id: string;
  reasoning?: string;
  execution_order: number[]; // Step IDs in recommended order
  timestamp: string;
}

/**
 * Configuration for the Architect Agent
 */
export interface ArchitectConfig {
  model_tier: 'haiku' | 'sonnet' | 'opus';
  max_input_tokens: number;
  max_output_tokens: number;
  temperature: number;
  system_prompt: string;
}

/**
 * Configuration for the Tool Pruner
 */
export interface ToolPrunerConfig {
  max_relevant_tools: number;
  min_relevance_score: number;
  selection_strategy: 'keyword' | 'semantic' | 'hybrid';
}

/**
 * Service-level configuration combining both
 */
export interface ArchitectServiceConfig extends ArchitectConfig {
  pruner: ToolPrunerConfig;
  enable_token_counting: boolean;
  enable_validation: boolean;
}

/**
 * Result of tool selection/pruning
 */
export interface ToolSelectionResult {
  selected_tools: LightweightToolEntry[];
  total_scanned: number;
  selection_confidence: number;
  search_strategy: string;
  execution_time_ms: number;
}

/**
 * Error response from Architect
 */
export interface ArchitectError {
  error_code: string;
  error_message: string;
  context?: Record<string, unknown>;
  suggestion?: string;
}

/**
 * Wrapper for plan responses
 */
export type ArchitectResponse = ArchitectPlan | ArchitectError;

/**
 * Type guard to check if response is an error
 */
export function isArchitectError(response: ArchitectResponse): response is ArchitectError {
  return 'error_code' in response;
}

/**
 * Type guard to check if response is a valid plan
 */
export function isArchitectPlan(response: ArchitectResponse): response is ArchitectPlan {
  return 'plan' in response && Array.isArray(response.plan);
}

/**
 * Token estimation result
 */
export interface TokenEstimate {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  breakdown: {
    system_prompt: number;
    tool_index: number;
    user_request: number;
    response: number;
  };
}

/**
 * Validation result for architect output
 */
export interface PlanValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  tool_coverage: number; // % of mentioned tools in index
}
