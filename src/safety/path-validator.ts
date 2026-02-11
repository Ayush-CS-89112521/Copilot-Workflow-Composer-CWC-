/**
 * Path Traversal Validator
 * Prevents agents from accessing files outside project boundaries
 * 
 * Blocks:
 * - Directory traversal (../../etc/shadow)
 * - Sensitive system paths (/.ssh/, /.aws/, /etc/shadow)
 * - Unauthorized directories outside whitelist
 */

import { resolve, relative } from 'path';


/**
 * Configuration for path validation
 */
export interface PathValidatorConfig {
  projectRoot: string;
  allowedDirs?: string[];
  blockSensitivePaths?: boolean;
}

/**
 * Validates file paths before operations
 */
export class PathTraversalValidator {
  private readonly projectRoot: string;
  private readonly allowedDirs: Set<string>;
  private readonly blockSensitivePaths: boolean;
  private readonly sensitivePatterns: string[];

  constructor(config: PathValidatorConfig) {
    this.projectRoot = resolve(config.projectRoot);
    this.blockSensitivePaths = config.blockSensitivePaths !== false; // Default: true

    // Build allowed directories set
    this.allowedDirs = new Set(
      (config.allowedDirs || [
        this.projectRoot,
        `${this.projectRoot}/src`,
        `${this.projectRoot}/docs`,
        `${this.projectRoot}/examples`,
        `${this.projectRoot}/data`,
      ]).map(dir => resolve(dir))
    );

    // Sensitive paths to block
    this.sensitivePatterns = [
      '/.ssh/',
      '/.aws/',
      '/.config/',
      '/.gnupg/',
      '/etc/shadow',
      '/etc/passwd',
      '/root/.ssh',
      process.env.HOME || '/root',
    ];
  }

  /**
   * Validate that a target path is within allowed boundaries
   * Throws SafetyViolation if path traversal or unauthorized access detected
   */
  validatePath(targetPath: string, operation: 'read' | 'write' | 'delete' = 'read'): void {
    const resolvedTarget = resolve(targetPath);
    const relativePath = relative(this.projectRoot, resolvedTarget);

    // Check for traversal attempts: ../, ..\ or absolute paths outside project
    if (relativePath.startsWith('..') || !resolvedTarget.startsWith(this.projectRoot)) {
      throw new Error(
        `Path traversal detected: attempting to access ${resolvedTarget} outside project root. ` +
        'Use paths relative to project root only.'
      );
    }

    // Check for sensitive system paths
    if (this.blockSensitivePaths && this.isSensitivePath(resolvedTarget)) {
      throw new Error(
        `Access denied: ${resolvedTarget} is a sensitive system path. ` +
        'Cannot access sensitive system directories or files.'
      );
    }

    // Whitelist check
    const isAllowed = Array.from(this.allowedDirs).some(dir =>
      resolvedTarget.startsWith(dir)
    );

    if (!isAllowed) {
      throw new Error(
        `Access denied: ${resolvedTarget} is not in allowed directories. ` +
        `Currently allowed: ${Array.from(this.allowedDirs).join(', ')}`
      );
    }

    // Additional checks for destructive operations
    if (operation === 'delete') {
      // Warn about deleting important files
      if (this.isImportantFile(resolvedTarget)) {
        throw new Error(
          `Cannot delete important file: ${resolvedTarget}. ` +
          'This file is critical to the project.'
        );
      }
    }
  }

  /**
   * Check if path is a sensitive system path
   */
  private isSensitivePath(path: string): boolean {
    return this.sensitivePatterns.some(pattern => path.includes(pattern));
  }

  /**
   * Check if file is important to project (should not be deleted)
   */
  private isImportantFile(path: string): boolean {
    const importantFiles = [
      'package.json',
      'tsconfig.json',
      'README.md',
      'src/cli.ts',
      'src/engine/workflow-engine.ts',
    ];

    return importantFiles.some(file => path.includes(file));
  }

  /**
   * Add directory to allowed list
   */
  addAllowedDirectory(dirPath: string): void {
    this.allowedDirs.add(resolve(dirPath));
  }

  /**
   * Get currently allowed directories
   */
  getAllowedDirectories(): string[] {
    return Array.from(this.allowedDirs);
  }
}

/**
 * Create validator for current project
 */
export function createPathValidator(projectRoot: string): PathTraversalValidator {
  return new PathTraversalValidator({
    projectRoot,
    blockSensitivePaths: true,
  });
}
