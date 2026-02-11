/**
 * UIManager - Configuration and abstraction layer for UI components
 * Provides singleton access to UI configuration and component instances
 * Enables graceful degradation for non-interactive and silent modes
 */

import { SpinnerManager } from './spinner-manager.js';
import { ProgressHeader } from './progress-header.js';
import { TerminalUI } from './terminal-ui.js';

/**
 * UI Configuration options
 */
export interface UIConfig {
  /** Is running in interactive terminal (TTY) */
  interactive: boolean;
  /** Show animated spinners (can be disabled with NO_SPINNERS env var) */
  showSpinners: boolean;
  /** Show colored output (can be disabled with NO_COLORS env var) */
  showColors: boolean;
  /** Show progress header (disabled in CI mode) */
  showProgress: boolean;
  /** Show framed boxes (can be disabled with NO_FRAMES env var) */
  showFrames: boolean;
  /** Silent mode - suppress all output */
  silent: boolean;
}

/**
 * Singleton UIManager for centralized UI configuration and component access
 */
export class UIManager {
  private static instance: UIManager;
  private config: UIConfig;
  private spinnerManager: SpinnerManager | null = null;
  private progressHeader: ProgressHeader | null = null;

  /**
   * Get or create singleton instance
   */
  static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  /**
   * Reset singleton (mainly for testing)
   */
  static reset(): void {
    UIManager.instance = null as any;
  }

  /**
   * Private constructor - use getInstance()
   */
  private constructor() {
    this.config = this.readConfig();
  }

  /**
   * Read configuration from environment variables and terminal state
   */
  private readConfig(): UIConfig {
    const isCI = Boolean(process.env.CI);
    const isTTY = process.stdin.isTTY === true;

    return {
      interactive: isTTY && !isCI,
      showSpinners: process.env.NO_SPINNERS !== '1' && !Boolean(process.env.SILENT),
      showColors: process.env.NO_COLORS !== '1' && !Boolean(process.env.SILENT),
      showProgress: !isCI && !Boolean(process.env.NO_PROGRESS),
      showFrames: process.env.NO_FRAMES !== '1' && !Boolean(process.env.SILENT),
      silent: Boolean(process.env.SILENT),
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): UIConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (mainly for testing)
   */
  setConfig(overrides: Partial<UIConfig>): void {
    this.config = { ...this.config, ...overrides };
  }

  /**
   * Get or create SpinnerManager instance
   */
  getSpinnerManager(): SpinnerManager {
    if (!this.spinnerManager) {
      this.spinnerManager = new SpinnerManager(this.config.interactive && this.config.showSpinners);
    }
    return this.spinnerManager;
  }

  /**
   * Get or create ProgressHeader instance
   */
  getProgressHeader(totalSteps: number): ProgressHeader {
    if (!this.progressHeader) {
      this.progressHeader = new ProgressHeader(totalSteps, this.config.showProgress);
    }
    return this.progressHeader;
  }

  /**
   * Format text with semantic color (respects showColors config)
   */
  format(
    text: string,
    style: 'success' | 'error' | 'warning' | 'subtle' | 'info' | 'highlight'
  ): string {
    if (!this.config.showColors) {
      return text; // Return plain text if colors disabled
    }
    return TerminalUI.colors[style](text);
  }

  /**
   * Create framed box (respects showFrames config)
   */
  frameBox(content: string[], title?: string): string {
    if (!this.config.showFrames) {
      // Return plain text if frames disabled
      return (title ? [`${title}`, ...content] : content).join('\n');
    }
    return TerminalUI.frame.box(content, title);
  }

  /**
   * Create header (respects showFrames config)
   */
  header(title: string, subtitle?: string): string {
    if (!this.config.showFrames) {
      // Return plain text if frames disabled
      const lines = [title];
      if (subtitle) lines.push(subtitle);
      return lines.join('\n');
    }
    return TerminalUI.frame.header(title, subtitle);
  }

  /**
   * Log output (respects silent config)
   */
  log(...args: unknown[]): void {
    if (!this.config.silent) {
      console.log(...args);
    }
  }

  /**
   * Log error (respects silent config)
   */
  error(...args: unknown[]): void {
    if (!this.config.silent) {
      console.error(...args);
    }
  }
}
