/**
 * SpinnerManager - Centralized spinner lifecycle management
 * Provides consistent spinner formatting and state transitions across execution
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';

/**
 * Spinner state
 */
interface SpinnerState {
  stepId: string;
  agent: string;
  status: 'idle' | 'running' | 'success' | 'skipped' | 'alert' | 'failed';
  elapsedMs: number;
  details?: string;
}

/**
 * Manages spinner lifecycle for workflow steps
 * Handles all state transitions and formatting
 */
export class SpinnerManager {
  private spinner: Ora | null = null;
  private state: SpinnerState = {
    stepId: '',
    agent: '',
    status: 'idle',
    elapsedMs: 0,
  };
  private startTime: number = 0;
  private updateInterval: NodeJS.Timeout | null = null;
  private isEnabled: boolean;

  constructor(isEnabled: boolean = true) {
    this.isEnabled = isEnabled;
  }

  /**
   * Start spinner for a new step
   * @param stepId - ID of the step being executed
   * @param agent - Agent being invoked (e.g., 'suggest', 'explain')
   */
  public start(stepId: string, agent: string = 'unknown'): void {
    if (!this.isEnabled) return;

    this.cleanup();

    this.startTime = Date.now();
    this.state = {
      stepId,
      agent,
      status: 'running',
      elapsedMs: 0,
    };

    const text = this.formatSpinnerText();
    this.spinner = ora(text).start();

    // Update elapsed time every 100ms
    this.updateInterval = setInterval(() => {
      if (this.state.status === 'running') {
        this.state.elapsedMs = Date.now() - this.startTime;
        if (this.spinner) {
          this.spinner.text = this.formatSpinnerText();
        }
      }
    }, 100);
  }

  /**
   * Update spinner with additional details
   * @param details - Additional context to display (e.g., output size)
   */
  public update(details: string): void {
    if (!this.isEnabled || !this.spinner) return;

    this.state.details = details;
    this.spinner.text = this.formatSpinnerText();
  }

  /**
   * Mark step as succeeded
   * @param message - Optional message to display
   */
  public succeed(message?: string): void {
    this.cleanup();
    if (!this.spinner) return;

    this.state.status = 'success';
    const elapsed = this.formatElapsed();
    this.spinner.succeed(
      chalk.green(`✓ [${this.state.stepId}] ${message || 'Completed'} ${elapsed}`)
    );
  }

  /**
   * Mark step as skipped due to when condition
   * @param reason - Reason for skipping
   */
  public skip(reason: string): void {
    this.cleanup();
    if (!this.spinner) return;

    this.state.status = 'skipped';
    const elapsed = this.formatElapsed();
    this.spinner.warn(
      chalk.dim(`⏭  [${this.state.stepId}] Skipped (${reason}) ${elapsed}`)
    );
  }

  /**
   * Mark step as alerted (usually by resource watchdog)
   * @param alertMessage - Alert message from watchdog
   */
  public alert(alertMessage: string): void {
    this.cleanup();
    if (!this.spinner) return;

    this.state.status = 'alert';
    const elapsed = this.formatElapsed();
    this.spinner.warn(chalk.yellow(`⚠  [${this.state.stepId}] ${alertMessage} ${elapsed}`));
  }

  /**
   * Mark step as failed
   * @param error - Error message
   */
  public fail(error: string): void {
    this.cleanup();
    if (!this.spinner) return;

    this.state.status = 'failed';
    const elapsed = this.formatElapsed();
    this.spinner.fail(chalk.red(`✗ [${this.state.stepId}] ${error} ${elapsed}`));
  }

  /**
   * Stop spinner without status change (cleanup only)
   */
  public stop(): void {
    this.cleanup();
    if (this.spinner && this.state.status === 'running') {
      this.spinner.stop();
    }
  }

  /**
   * Check if spinner is currently running
   */
  public isRunning(): boolean {
    return this.state.status === 'running' && this.spinner !== null;
  }

  /**
   * Get current spinner state (for testing)
   */
  public getState(): Readonly<SpinnerState> {
    return Object.freeze({ ...this.state });
  }

  /**
   * Format spinner text with dynamic updates
   */
  private formatSpinnerText(): string {
    const elapsed = this.formatElapsed();
    const details = this.state.details ? ` (${this.state.details})` : '';

    return `[${this.state.stepId}] Invoking ${this.state.agent} agent...${details} ${elapsed}`;
  }

  /**
   * Format elapsed time
   */
  private formatElapsed(): string {
    const secs = (this.state.elapsedMs / 1000).toFixed(1);
    return chalk.dim(`(${secs}s)`);
  }

  /**
   * Cleanup resources (stop intervals, etc.)
   */
  private cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}
