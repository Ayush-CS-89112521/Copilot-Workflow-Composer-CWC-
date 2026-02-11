/**
 * Git Safety Lock
 * Prevents dangerous git operations (force push to main, reset --hard, etc.)
 * 
 * Hard-blocks operations unless explicitly allowed with flags
 * Integrates with Layer 5 pattern detection
 */

/**
 * Git command context for validation
 */
export interface GitCommandContext {
  command: string;  // e.g., 'push', 'reset', 'rebase'
  args: string[];   // Command arguments
  targetBranch?: string;  // Branch being targeted (if applicable)
  cwd?: string;     // Working directory
}

/**
 * Configuration for Git Safety Lock
 */
export interface GitSafetyLockConfig {
  allowMainPush?: boolean;
  blockForcePush?: boolean;
  blockRebasePublic?: boolean;
  blockResetHard?: boolean;
}

/**
 * Validates git commands before execution
 */
export class GitSafetyLock {
  private readonly config: GitSafetyLockConfig;

  constructor(config: GitSafetyLockConfig = {}) {
    this.config = {
      allowMainPush: config.allowMainPush ?? false,
      blockForcePush: config.blockForcePush ?? true,
      blockRebasePublic: config.blockRebasePublic ?? true,
      blockResetHard: config.blockResetHard ?? true,
    };
  }

  /**
   * Validate a git command before execution
   * Throws SafetyViolation if operation is blocked
   */
  validateCommand(context: GitCommandContext): void {
    const { command, args, targetBranch } = context;

    // Normalize command
    const cmd = command.toLowerCase().trim();

    // Block protected branch writes
    if (['push', 'force-push'].includes(cmd)) {
      this.validatePushCommand(args, targetBranch);
    }

    // Block reset --hard
    if (cmd === 'reset' && this.config.blockResetHard) {
      this.validateResetCommand(args);
    }

    // Block public rebases
    if (cmd === 'rebase' && this.config.blockRebasePublic) {
      this.validateRebaseCommand(args);
    }

    // Block merge --no-ff without review
    if (cmd === 'merge') {
      this.validateMergeCommand(args);
    }

    // Block tag -d on shared tags
    if (cmd === 'tag' && args.includes('-d')) {
      this.validateTagDelete(args);
    }
  }

  /**
   * Validate push operations
   */
  private validatePushCommand(args: string[], targetBranch?: string): void {
    const isForcePush = args.includes('-f') || args.includes('--force') || args.includes('-f+');

    // Detect target branch from args
    const branch =
      targetBranch || this.extractBranchFromArgs(args) || 'unknown';

    // Block force push
    if (isForcePush && this.config.blockForcePush) {
      throw new Error(
        `Force push is blocked for safety. Force pushes overwrite remote history. ` +
        `Use --allow-force-push to override.`
      );
    }

    // Block push to main/master
    const isProtectedBranch =
      !targetBranch || ['main', 'master', 'production'].includes(branch);

    if (isProtectedBranch && !this.config.allowMainPush) {
      throw new Error(
        `Push to protected branch blocked: ${branch}. ` +
        'Use --allow-main-push flag to override.'
      );
    }
  }

  /**
   * Validate reset operations
   */
  private validateResetCommand(args: string[]): void {
    if (args.includes('--hard')) {
      throw new Error(
        `git reset --hard is blocked for safety. ` +
        `Use --soft or --mixed instead to preserve uncommitted changes.`
      );
    }
  }

  /**
   * Validate rebase operations on public branches
   */
  private validateRebaseCommand(args: string[]): void {
    const isInteractiveRebase = args.includes('-i') || args.includes('--interactive');

    if (isInteractiveRebase) {
      throw new Error(
        `Interactive rebase is blocked for safety. ` +
        `Interactive rebase changes history and should be used carefully on shared branches.`
      );
    }
  }

  /**
   * Validate merge operations
   */
  private validateMergeCommand(args: string[]): void {
    if (args.includes('--no-ff')) {
      // Allow merge commits, this is safe
      return;
    }

    // Fast-forward merges are OK
    return;
  }

  /**
   * Validate tag deletion (shared tags should not be deleted)
   */
  private validateTagDelete(args: string[]): void {
    const tagIndex = args.indexOf('-d');
    if (tagIndex >= 0 && tagIndex + 1 < args.length) {
      const tag = args[tagIndex + 1];

      if (this.isSharedTag(tag)) {
        throw new Error(
          `Cannot delete shared tag: ${tag}. ` +
          `Shared tags should not be deleted. Use with caution.`
        );
      }
    }
  }

  /**
   * Extract branch name from push arguments
   * Pattern: git push [remote] [branch]
   */
  private extractBranchFromArgs(args: string[]): string | undefined {
    // Look for branch name pattern
    // git push origin main -> branch = 'main'
    // git push -> use current branch
    const lastArg = args[args.length - 1];

    if (lastArg && !lastArg.startsWith('-') && lastArg !== 'origin') {
      return lastArg;
    }

    return undefined;
  }

  /**
   * Check if tag appears to be shared (has version pattern, etc.)
   */
  private isSharedTag(tag: string): boolean {
    // Shared tags are typically version tags
    const versionPattern = /^v?\d+\.\d+\.\d+/;
    return versionPattern.test(tag);
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<GitSafetyLockConfig>): void {
    Object.assign(this.config, config);
  }
}

/**
 * Create Git Safety Lock with sensible defaults
 */
export function createGitSafetyLock(allowMainPush: boolean = false): GitSafetyLock {
  return new GitSafetyLock({
    allowMainPush,
    blockForcePush: true,
    blockRebasePublic: true,
    blockResetHard: true,
  });
}
