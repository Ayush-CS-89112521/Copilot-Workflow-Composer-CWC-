/**
 * TerminalUI - Semantic color palette and formatting utilities
 * Provides consistent "vibe" across the CLI with standardized colors and frames
 */

import chalk from 'chalk';

/**
 * Static utility for terminal formatting
 * All methods are synchronous and return formatted strings
 */
export class TerminalUI {
  /**
   * Semantic color palette
   * Success: Bright Green - for achievements and completions
   * Error: Bold Red - for safety blocks and critical failures
   * Warning: Yellow - for resource spikes and cautions
   * Subtle: Dim Gray - for metadata and skipped steps
   * Info: Cyan - for informational messages
   * Highlight: Bold White - for important information
   */
  static colors = {
    success: chalk.green,
    error: chalk.bold.red,
    warning: chalk.yellow,
    subtle: chalk.dim,
    info: chalk.cyan,
    highlight: chalk.bold.white,
  };

  /**
   * Typography - Pre-formatted text with icons
   */
  static text = {
    // Success messages with ✓ icon
    success: (msg: string): string => {
      return TerminalUI.colors.success(`✓ ${msg}`);
    },

    // Error messages with ✗ icon
    error: (msg: string): string => {
      return TerminalUI.colors.error(`✗ ${msg}`);
    },

    // Warning messages with ⚠ icon
    warning: (msg: string): string => {
      return TerminalUI.colors.warning(`⚠ ${msg}`);
    },

    // Subtle/metadata messages
    subtle: (msg: string): string => {
      return TerminalUI.colors.subtle(msg);
    },

    // Information messages with ℹ icon
    info: (msg: string): string => {
      return TerminalUI.colors.info(`ℹ ${msg}`);
    },

    // Highlighted messages
    highlight: (msg: string): string => {
      return TerminalUI.colors.highlight(msg);
    },
  };

  /**
   * Framing utilities for visual structure
   */
  static frame = {
    /**
     * Create a framed box around content
     * @param content - Array of text lines to frame
     * @param title - Optional title to display at top
     * @returns Framed content as string
     */
    box: (content: string[], title?: string): string => {
      // Calculate width based on longest line + padding
      const maxLen = Math.max(
        ...(content.map((l) => l.length) || [0]),
        title ? title.length : 0
      );
      const width = maxLen + 4; // +4 for padding

      const lines: string[] = [];

      // Top border
      lines.push(chalk.dim('┌' + '─'.repeat(width) + '┐'));

      // Title (if provided)
      if (title) {
        const titlePadded = title.padEnd(width - 2);
        lines.push(chalk.dim('│ ') + chalk.bold(titlePadded) + chalk.dim(' │'));
        lines.push(chalk.dim('├' + '─'.repeat(width) + '┤'));
      }

      // Content
      for (const line of content) {
        const padded = line.padEnd(width - 2);
        lines.push(chalk.dim('│ ') + padded + chalk.dim(' │'));
      }

      // Bottom border
      lines.push(chalk.dim('└' + '─'.repeat(width) + '┘'));

      return lines.join('\n');
    },

    /**
     * Create a separator line
     * @param width - Width of separator line
     * @returns Separator string
     */
    separator: (width: number = 80): string => {
      return chalk.dim('─'.repeat(width));
    },

    /**
     * Create a header with title and optional subtitle
     * @param title - Header title
     * @param subtitle - Optional subtitle
     * @returns Header string with separator
     */
    header: (title: string, subtitle?: string): string => {
      const lines = [chalk.bold.cyan(title)];
      if (subtitle) {
        lines.push(chalk.dim(subtitle));
      }
      lines.push(TerminalUI.frame.separator(80));
      return lines.join('\n');
    },
  };

  /**
   * Progress visualization utilities
   */
  static progress = {
    /**
     * Create a simple progress bar
     * @param current - Current step
     * @param total - Total steps
     * @param width - Width of bar in characters
     * @returns Progress bar string
     */
    bar: (current: number, total: number, width: number = 30): string => {
      const percentage = (current / total) * 100;
      const filled = Math.round((width * current) / total);
      const empty = width - filled;

      const bar =
        chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));

      return `[${bar}] ${chalk.yellow(percentage.toFixed(0))}%`;
    },

    /**
     * Format step counter (X/Y)
     * @param current - Current step
     * @param total - Total steps
     * @returns Counter string
     */
    counter: (current: number, total: number): string => {
      return `${chalk.cyan(`${current}/${total}`)}`;
    },

    /**
     * Calculate and format estimated time remaining
     * @param elapsedMs - Elapsed time in milliseconds
     * @param current - Current step
     * @param total - Total steps
     * @returns ETA string
     */
    eta: (elapsedMs: number, current: number, total: number): string => {
      if (current === 0) return chalk.dim('calculating...');

      const avgMs = elapsedMs / current;
      const remainingMs = avgMs * (total - current);
      const remainingSecs = (remainingMs / 1000).toFixed(1);

      return chalk.dim(`~${remainingSecs}s remaining`);
    },
  };

  /**
   * Table-like output utilities
   */
  static table = {
    /**
     * Format key-value pairs as aligned columns
     * @param pairs - Object with key-value pairs
     * @returns Array of formatted lines
     */
    kvPairs: (pairs: Record<string, string>): string[] => {
      return Object.entries(pairs).map(([k, v]) => {
        return `${chalk.cyan(k.padEnd(20))} ${v}`;
      });
    },

    /**
     * Format rows as columns with headers
     * @param rows - Array of objects
     * @param columnNames - Column names to display
     * @returns Array of formatted lines
     */
    columns: (rows: Record<string, string>[], columnNames: string[]): string[] => {
      // Calculate column widths
      const widths = columnNames.map((col) =>
        Math.max(col.length, ...rows.map((r) => (r[col] || '').length))
      );

      // Header row
      const header = columnNames
        .map((col, i) => chalk.bold(col.padEnd(widths[i])))
        .join('  ');

      // Separator
      const separator = widths.map((w) => '─'.repeat(w)).join('  ');

      // Data rows
      const dataRows = rows.map((row) =>
        columnNames
          .map((col, i) => (row[col] || '').padEnd(widths[i]))
          .join('  ')
      );

      return [header, separator, ...dataRows];
    },
  };
}
