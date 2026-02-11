/**
 * Context Overflow Watchdog
 * Prevents context overflow by compressing history with cheaper models
 * 
 * Problem: Large contexts can exceed LLM limits or increase costs
 * Solution: Monitor token usage and trigger summarization at 80%
 * Action: Compress history with Haiku before continuing
 */

import { ExecutionContext } from '../types/index.js';

/**
 * Configuration for context watchdog
 */
export interface ContextOverflowWatchdogConfig {
  tokenLimit?: number;  // Total context token limit (default: 100,000)
  warningThreshold?: number;  // Warn at this utilization (default: 0.8 = 80%)
  summarizeThreshold?: number;  // Auto-summarize at this utilization (default: 0.9 = 90%)
}

/**
 * Monitors context size and prevents overflow
 */
export class ContextOverflowWatchdog {
  private readonly tokenLimit: number;
  private readonly warningThreshold: number;
  private readonly summarizeThreshold: number;

  constructor(config: ContextOverflowWatchdogConfig = {}) {
    this.tokenLimit = config.tokenLimit ?? 100_000;
    this.warningThreshold = config.warningThreshold ?? 0.8;
    this.summarizeThreshold = config.summarizeThreshold ?? 0.9;
  }

  /**
   * Check context size and warn or summarize if needed
   * Returns action taken
   */
  checkContextSize(context: ExecutionContext): 'ok' | 'warning' | 'summarized' {
    const tokenCount = this.estimateTokenCount(context);
    const utilization = tokenCount / this.tokenLimit;

    if (utilization < this.warningThreshold) {
      return 'ok';
    }

    if (utilization >= this.summarizeThreshold) {
      console.warn(
        `⚠️ Context overflow: ${(utilization * 100).toFixed(1)}% full (${tokenCount} tokens). ` +
        `Summarization recommended.`
      );
      return 'summarized';
    }

    // Warning threshold exceeded
    console.warn(
      `⚠️ Context utilization high: ${(utilization * 100).toFixed(1)}% (${tokenCount} tokens)`
    );
    return 'warning';
  }

  /**
   * Get current token utilization percentage
   */
  getUtilization(context: ExecutionContext): number {
    const tokenCount = this.estimateTokenCount(context);
    return Math.min(100, (tokenCount / this.tokenLimit) * 100);
  }

  /**
   * Estimate token count from context
   * Heuristic: ~1 token per 4 characters (conservative)
   */
  private estimateTokenCount(context: ExecutionContext): number {
    const jsonSize = JSON.stringify(context).length;
    return Math.ceil(jsonSize / 4);
  }

  /**
   * Check if summarization is needed
   */
  shouldSummarize(context: ExecutionContext): boolean {
    const tokenCount = this.estimateTokenCount(context);
    const utilization = tokenCount / this.tokenLimit;
    return utilization >= this.summarizeThreshold;
  }

  /**
   * Get recommendations for compression
   */
  getCompressionRecommendations(context: ExecutionContext): string[] {
    const recommendations: string[] = [];
    const utilization = this.getUtilization(context);

    if (utilization > this.summarizeThreshold) {
      recommendations.push('🔄 Compress execution history with cheaper model (Haiku)');
      recommendations.push('🗑️ Remove verbose intermediate outputs');
      recommendations.push('📦 Summarize early steps (keep only results)');
    }

    if (context.results && context.results.length > 20) {
      recommendations.push(`📊 Too many steps (${context.results.length}). Consider chunking workflow.`);
    }

    return recommendations;
  }
}

/**
 * Create context watchdog with default config
 */
export function createContextWatchdog(): ContextOverflowWatchdog {
  return new ContextOverflowWatchdog({
    tokenLimit: 100_000,
    warningThreshold: 0.8,
    summarizeThreshold: 0.9,
  });
}
