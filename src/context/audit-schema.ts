/**
 * Enhanced Audit Schema for Phase 5
 * Captures human feedback and steering decisions for training data generation
 * 
 * Goals:
 * 1. Record every human intervention (steering, approval, context injection)
 * 2. Link agent outputs to human corrections
 * 3. Enable future fine-tuning dataset generation
 */

import type { SafetyScanResult } from '../types/index.js';

/**
 * ISO 8601 string type
 */
export type ISO8601String = string;

/**
 * User feedback recorded during execution
 */
export interface UserFeedbackRecord {
  /** What decision did user make? */
  decision: 'approve' | 'deny' | 'steer' | 'edit' | 'inspect' | 'terminate';

  /** Steering action (if decision=steer) */
  steeringAction?: 'edit-args' | 'add-context' | 'terminate';

  /** Feedback text from user */
  feedbackText?: string;

  /** Why did user make this decision? */
  reasoning?: string;

  /** Timestamp of feedback */
  timestamp: ISO8601String;

  /** How long user took to decide (milliseconds) */
  decisionTimeMs: number | undefined;
}

/**
 * Resource analysis for the step
 */
export interface ResourceAnalysis {
  memoryUsageMB?: number;
  cpuUsagePercent?: number;
  durationMs: number;
  outputSizeBytes?: number;
}

/**
 * Pattern match from safety scanning
 */
export interface PatternMatchRecord {
  patternId: string;
  category: string;
  severity: 'warn' | 'pause' | 'block';
  confidence: number;
  matched: string;
}

/**
 * Tool availability check result
 */
export interface ToolAvailabilityRecord {
  found: boolean;
  toolId?: string;
  toolName?: string;
  suggestions?: string[];
}

/**
 * Training data signal (for future fine-tuning)
 */
export interface TrainingDataSignal {
  /** Did this step require human intervention? */
  requiresIntervention: boolean;

  /** Type of intervention (if any) */
  interventionType?: 'safety-violation' | 'steering' | 'approval' | 'hallucination';

  /** How difficult was this for the agent? (1-10 scale) */
  difficultyScore?: number;

  /** Should this be included in training data? */
  includeInTraining: boolean;

  /** Tags for categorizing training data */
  tags?: string[];
}

/**
 * Complete audit entry for a single step execution
 */
export interface AuditEntry {
  // ========================
  // Metadata
  // ========================
  runId: string;
  stepId: string;
  timestamp: ISO8601String;
  version: 'phase5-v1';

  // ========================
  // Agent Output & Reasoning
  // ========================
  agentOutput: {
    toolName: string;
    arguments: Record<string, unknown>;
    reasoning: string;
    model?: 'haiku' | 'sonnet';
  };

  // ========================
  // Safety Evaluation (Enhanced)
  // ========================
  safetyEvaluation: {
    patternMatches: PatternMatchRecord[];
    violations: SafetyScanResult[];
    resourceAnalysis: ResourceAnalysis;
    toolAvailability: ToolAvailabilityRecord;
    loopDetection?: {
      detected: boolean;
      recentInvocations?: Array<{ tool: string; args: string }>;
    };
  };

  // ========================
  // Human Feedback (NEW for Phase 5)
  // ========================
  userFeedback?: UserFeedbackRecord;

  // ========================
  // Context Injection (NEW for Phase 5)
  // ========================
  contextInjection: {
    injected: boolean;
    fromStep: string | undefined;
    feedback: string | undefined;
    injectionType: 'goal-correction' | 'parameter-adjustment' | 'strategy-shift' | undefined;
  } | undefined;

  // ========================
  // Execution Result
  // ========================
  executionResult: {
    status: 'success' | 'failure' | 'timeout' | 'blocked' | 'terminated';
    output?: string;
    error?: string;
    errorCode?: number;
    durationMs: number;
  };

  // ========================
  // Context State (for replay/analysis)
  // ========================
  contextState: {
    variables: Record<string, unknown>;
    historyLength: number;
    tokenEstimate?: number;
  };

  // ========================
  // Training Data Signals (NEW for Phase 5)
  // ========================
  trainingData: TrainingDataSignal;
}

/**
 * Audit log file format (line-delimited JSON)
 */
export interface AuditLog {
  entries: AuditEntry[];
}

/**
 * Training example extracted from audit logs
 */
export interface TrainingExample {
  id: string;  // runId:stepId
  
  // What the agent proposed
  before: {
    toolName: string;
    arguments: Record<string, unknown>;
    reasoning: string;
  };

  // What the human corrected
  after: {
    humanFeedback: string;
    correctionType: 'safety' | 'steering' | 'hallucination' | 'approval';
    correctedOutput?: string;
    updatedArguments?: Record<string, unknown>;
  };

  // Context for training
  metadata: {
    difficulty: number;
    category: string;
    timestamp: ISO8601String;
    stepIndex: number;
  };
}

/**
 * Builder for audit entries
 * Provides fluent API for constructing entries
 */
export class AuditEntryBuilder {
  private entry: Partial<AuditEntry> = {
    version: 'phase5-v1',
  };

  runId(id: string): this {
    this.entry.runId = id;
    return this;
  }

  stepId(id: string): this {
    this.entry.stepId = id;
    return this;
  }

  agentOutput(toolName: string, args: Record<string, unknown>, reasoning: string): this {
    this.entry.agentOutput = { toolName, arguments: args, reasoning };
    return this;
  }

  safetyEvaluation(evaluation: AuditEntry['safetyEvaluation']): this {
    this.entry.safetyEvaluation = evaluation;
    return this;
  }

  userFeedback(feedback: UserFeedbackRecord): this {
    this.entry.userFeedback = feedback;
    return this;
  }

  contextInjection(injection: AuditEntry['contextInjection']): this {
    this.entry.contextInjection = injection;
    return this;
  }

  executionResult(result: AuditEntry['executionResult']): this {
    this.entry.executionResult = result;
    return this;
  }

  trainingData(signal: TrainingDataSignal): this {
    this.entry.trainingData = signal;
    return this;
  }

  build(): AuditEntry {
    if (!this.entry.runId || !this.entry.stepId || !this.entry.agentOutput || !this.entry.safetyEvaluation || !this.entry.executionResult || !this.entry.trainingData) {
      throw new Error('Missing required audit entry fields');
    }

    return {
      timestamp: new Date().toISOString(),
      ...this.entry,
    } as AuditEntry;
  }
}

/**
 * Create a new audit entry builder
 */
export function auditEntry(): AuditEntryBuilder {
  return new AuditEntryBuilder();
}
