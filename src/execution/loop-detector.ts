/**
 * Loop Detector
 * Detects when an agent is stuck in a loop calling the same tool repeatedly
 * 
 * Problem: "Insanity Loop" - agent keeps retrying the same action expecting different results
 * Solution: Hash-based detection of duplicate (tool, args) pairs
 * Action: Pause and request human help
 */

import crypto from 'crypto';

/**
 * Tracked tool invocation
 */
interface ToolInvocation {
  toolName: string;
  args: string;
  hash: string;
  timestamp: number;
}

/**
 * Configuration for loop detector
 */
export interface LoopDetectorConfig {
  windowSize?: number;  // How many recent invocations to track (default: 3)
  hashLength?: number;  // Length of hash for comparison (default: 16)
}

/**
 * Detects repetitive tool invocations that indicate loops
 */
export class LoopDetector {
  private readonly windowSize: number;
  private readonly hashLength: number;
  private invocationHistory: ToolInvocation[] = [];

  constructor(config: LoopDetectorConfig = {}) {
    this.windowSize = config.windowSize ?? 3;
    this.hashLength = config.hashLength ?? 16;
  }

  /**
   * Check if current invocation repeats within the history window
   * Returns true if loop detected (duplicate found)
   */
  checkForLoop(toolName: string, args: string): boolean {
    const currentHash = this.computeHash(toolName, args);

    // Check if same (tool, args) pair exists in recent window
    const isDuplicate = this.invocationHistory
      .slice(-this.windowSize)
      .some(inv => inv.hash === currentHash);

    if (isDuplicate) {
      return true; // Loop detected!
    }

    // Add to history (before checking window)
    this.invocationHistory.push({
      toolName,
      args,
      hash: currentHash,
      timestamp: Date.now(),
    });

    // Maintain window size (keep double for detection)
    if (this.invocationHistory.length > this.windowSize * 2) {
      this.invocationHistory = this.invocationHistory.slice(-this.windowSize * 2);
    }

    return false;
  }

  /**
   * Get recent invocations (for display to user)
   */
  getRecentInvocations(count: number = this.windowSize): Array<{ tool: string; args: string }> {
    return this.invocationHistory
      .slice(-count)
      .map(inv => ({
        tool: inv.toolName,
        args: inv.args.length > 80 ? inv.args.substring(0, 80) + '...' : inv.args,
      }));
  }

  /**
   * Check if tool is repeated N times in a row
   */
  isToolRepeated(toolName: string, count: number = 2): boolean {
    const recent = this.invocationHistory.slice(-count);
    return (
      recent.length === count &&
      recent.every(inv => inv.toolName === toolName)
    );
  }

  /**
   * Compute SHA256 hash of (toolName + args) for comparison
   * Uses truncated hash for efficient comparison
   */
  private computeHash(toolName: string, args: string): string {
    return crypto
      .createHash('sha256')
      .update(`${toolName}:${args}`)
      .digest('hex')
      .substring(0, this.hashLength);
  }

  /**
   * Reset history after successful step completion
   */
  reset(): void {
    this.invocationHistory = [];
  }

  /**
   * Get full history (for audit trail)
   */
  getFullHistory(): Array<{ tool: string; args: string; hash: string; timestamp: Date }> {
    return this.invocationHistory.map(inv => ({
      tool: inv.toolName,
      args: inv.args,
      hash: inv.hash,
      timestamp: new Date(inv.timestamp),
    }));
  }

  /**
   * Clear history
   */
  clear(): void {
    this.invocationHistory = [];
  }
}

/**
 * Create loop detector with default config
 */
export function createLoopDetector(): LoopDetector {
  return new LoopDetector({ windowSize: 3 });
}
