/**
 * Safety Guardrail Interceptor
 * Scans step outputs for dangerous patterns before variable persistence
 */

import { SafetyPolicy, SafetyViolation, SafetyScanResult } from '../types/index';
import { PATTERN_LIBRARY, DEFAULT_ALLOWLIST, detectDangerousPipe, detectObfuscation } from './pattern-library';

/**
 * Custom error for safety violations
 */
export class SafetyViolationError extends Error {
  constructor(
    public violations: SafetyViolation[],
    public stepId: string,
    public mode: 'warn' | 'pause' | 'block',
  ) {
    const violationSummary = violations.map((v) => `[${v.category}] ${v.match}`).join('\n  ');
    super(`Safety violation in step ${stepId}:\n  ${violationSummary}`);
    this.name = 'SafetyViolationError';
  }
}

/**
 * Safety Guardrail - Main scanning engine
 */
export class SafetyGuardrail {
  private policy: SafetyPolicy;
  private allowPatterns: RegExp[] = [];

  constructor(policy?: SafetyPolicy) {
    this.policy = policy || this.getDefaultPolicy();
    this.compileAllowlist(this.policy.allowPatterns);
  }

  /**
   * Get default (permissive) safety policy
   */
  private getDefaultPolicy(): SafetyPolicy {
    return {
      enabled: true,
      mode: 'warn',
      categories: {
        destructive: true,
        exfiltration: true,
        privilege: true,
        filesystem: true,
      },
      confidenceThreshold: 0.75,
    };
  }

  /**
   * Compile allow patterns into RegExp for faster matching
   */
  private compileAllowlist(patterns?: string[]): void {
    const allPatterns = [...DEFAULT_ALLOWLIST, ...(patterns || [])];

    this.allowPatterns = allPatterns
      .map((p) => {
        try {
          return new RegExp(p, 'i');
        } catch {
          console.warn(`Invalid allowlist regex: ${p}`);
          return null;
        };
      })
      .filter((p): p is RegExp => p !== null);
  }

  /**
   * Check if a line matches the allowlist (early exit - no scan if whitelisted)
   */
  private isAllowlisted(line: string): boolean {
    return this.allowPatterns.some((pattern) => pattern.test(line));
  }

  /**
   * Scan step output for safety violations
   * Returns immediately if scan disabled
   */
  public async scanStepOutput(stepId: string, output: string): Promise<SafetyScanResult> {
    const startTime = Date.now();

    const result: SafetyScanResult = {
      stepId,
      scanCompleted: false,
      violations: [],
      status: 'safe',
      timestamp: new Date(),
      duration: 0,
    };

    // If safety disabled, return immediately
    if (!this.policy.enabled) {
      result.scanCompleted = true;
      result.status = 'safe';
      result.duration = Date.now() - startTime;
      return result;
    }

    // Split output into lines for line-by-line analysis
    const lines = output.split('\n');

    // Scan each line
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex].trim();

      // Skip empty lines
      if (!line) continue;

      // Skip if allowlisted
      if (this.isAllowlisted(line)) continue;

      // Scan for pattern violations
      const violations = this.scanLine(line, lineIndex + 1);
      result.violations.push(...violations);

      // Early exit on block-level severity
      if (violations.some((v) => v.severity === 'block')) {
        break;
      }
    }

    // Determine overall status based on violations
    result.status = this.determineStatus(result.violations);
    result.scanCompleted = true;
    result.duration = Date.now() - startTime;

    return result;
  }

  /**
   * Scan individual line for violations
   */
  private scanLine(line: string, lineNumber: number): SafetyViolation[] {
    const violations: SafetyViolation[] = [];

    // Check heuristics first (fast path)
    if (detectDangerousPipe(line)) {
      violations.push({
        category: 'exfiltration',
        severity: 'block',
        pattern: 'dangerous pipe to bash/sh',
        match: line.substring(0, 100),
        line: lineNumber,
        confidence: 0.95,
        remediation: 'Never pipe untrusted input to shell - execute after verification',
        timestamp: new Date(),
      });
    }

    if (detectObfuscation(line)) {
      violations.push({
        category: 'custom',
        severity: 'warn',
        pattern: 'obfuscated code detected',
        match: line.substring(0, 100),
        line: lineNumber,
        confidence: 0.6,
        remediation: 'Review obfuscated code carefully for security risks',
        timestamp: new Date(),
      });
    }

    // Check pattern library
    for (const rule of PATTERN_LIBRARY) {
      // Skip if category disabled
      if (!this.isCategoryEnabled(rule.category)) continue;

      // Skip if confidence below threshold
      if (rule.confidence < (this.policy.confidenceThreshold || 0.75)) continue;

      // Test pattern
      if (rule.pattern.test(line)) {
        const match = line.match(rule.pattern);

        violations.push({
          category: rule.category,
          severity: rule.severity,
          pattern: rule.name,
          match: match ? match[0] : line.substring(0, 100),
          line: lineNumber,
          confidence: rule.confidence,
          remediation: rule.remediation,
          timestamp: new Date(),
        });

        // Stop checking after first match per line (no duplicates)
        break;
      }
    }

    return violations;
  }

  /**
   * Check if a category is enabled in policy
   */
  private isCategoryEnabled(category: string): boolean {
    if (!this.policy.categories) return true; // Default to enabled if no categories specified
    const categoryKey = category as keyof typeof this.policy.categories;
    return this.policy.categories[categoryKey] !== false;
  }

  /**
   * Determine overall status from violations
   */
  private determineStatus(
    violations: SafetyViolation[],
  ): 'safe' | 'warning' | 'paused' | 'blocked' {
    if (violations.length === 0) return 'safe';

    // If any block-level violation, status is blocked
    if (violations.some((v) => v.severity === 'block')) return 'blocked';

    // If any pause-level violation, status is paused
    if (violations.some((v) => v.severity === 'pause')) return 'paused';

    // Otherwise (warn-level only)
    return 'warning';
  }

  /**
   * Validate scan result and potentially throw error based on policy mode
   * Returns true if safe to proceed, false if user denial/block
   */
  public validateScanResult(result: SafetyScanResult): boolean {
    if (result.status === 'safe') return true;

    if (result.status === 'blocked') {
      throw new SafetyViolationError(result.violations, result.stepId, 'block');
    }

    // For warn and paused status, caller decides behavior
    return true;
  }

  /**
   * Format violations for user display
   */
  public formatViolationsForDisplay(violations: SafetyViolation[]): string {
    if (violations.length === 0) return '';

    const grouped = this.groupViolationsByCategory(violations);
    const lines: string[] = ['\n⚠️  Safety Violations Detected:\n'];

    for (const [category, categoryViolations] of Object.entries(grouped)) {
      lines.push(`📌 ${category.toUpperCase()}`);

      for (const v of categoryViolations) {
        const severityEmoji =
          v.severity === 'block' ? '🔴' : v.severity === 'pause' ? '🟠' : '🟡';
        lines.push(`  ${severityEmoji} [${v.line}:${v.severity.toUpperCase()}] ${v.pattern}`);
        lines.push(`     Match: "${v.match.substring(0, 80)}${v.match.length > 80 ? '...' : ''}"`);
        lines.push(`     Fix: ${v.remediation}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Group violations by category for display
   */
  private groupViolationsByCategory(
    violations: SafetyViolation[],
  ): Record<string, SafetyViolation[]> {
    return violations.reduce(
      (acc, v) => {
        if (!acc[v.category]) acc[v.category] = [];
        acc[v.category].push(v);
        return acc;
      },
      {} as Record<string, SafetyViolation[]>,
    );
  }

  /**
   * Merge/override policy (for step-level overrides)
   */
  public mergePolicy(overridePolicy: SafetyPolicy): void {
    this.policy = {
      ...this.policy,
      ...overridePolicy,
      categories: {
        ...this.policy.categories,
        ...(overridePolicy.categories || {}),
      },
    };

    // Recompile allowlist if changed
    if (overridePolicy.allowPatterns) {
      this.compileAllowlist(overridePolicy.allowPatterns);
    }
  }

  /**
   * Check if should pause (human-in-the-loop)
   */
  public shouldPause(result: SafetyScanResult): boolean {
    if (!this.policy.enabled) return false;
    if (this.policy.mode === 'block') return false; // block doesn't pause, just fails

    // Pause if mode is 'pause' and violations exist
    if (this.policy.mode === 'pause') {
      return result.violations.length > 0;
    }

    // Don't pause for 'warn' mode
    return false;
  }

  /**
   * Get policy configuration
   */
  public getPolicy(): SafetyPolicy {
    return this.policy;
  }
}

/**
 * Parse user input for pause-mode confirmation
 */
export function parsePauseDecision(input: string): 'allow' | 'deny' | 'inspect' | null {
  const normalized = input.toLowerCase().trim();

  if (normalized === 'yes' || normalized === 'y' || normalized === 'allow') return 'allow';
  if (normalized === 'no' || normalized === 'n' || normalized === 'deny') return 'deny';
  if (normalized === 'inspect' || normalized === 'i' || normalized === 'show') return 'inspect';

  return null;
}

/**
 * Helper to prompt user for decision (node/bun compatible)
 * Note: In actual implementation, integrate with readline or prompts library
 */
export async function promptUserForDecision(message: string): Promise<string> {
  // This is a placeholder; actual implementation depends on CLI framework
  console.log(message);
  console.log('(yes/no/inspect): ');

  // For bun: use sync readline or prompt package
  // For now, throw to indicate caller must implement
  throw new Error('Human-in-the-loop prompting requires async readline integration');
}
