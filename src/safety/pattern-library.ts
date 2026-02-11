/**
 * Safety Guardrail Pattern Library
 * Pre-built detection patterns for dangerous shell commands and credential exfiltration
 * 
 * Layer 5: Category-specific pattern tuning
 * - Different tool categories have different risk profiles
 * - Adjusts confidence thresholds and pattern selection per tool type
 * - Pre-computed optimization tables for performance
 */

export interface PatternRule {
  /** Pattern name/description */
  name: string;
  /** Regex pattern to match */
  pattern: RegExp;
  /** Category of danger */
  category: 'destructive' | 'exfiltration' | 'privilege' | 'filesystem' | 'custom';
  /** Severity level */
  severity: 'warn' | 'pause' | 'block';
  /** Confidence score (0-1) when matched */
  confidence: number;
  /** Remediation suggestion for user */
  remediation: string;
}

/**
 * Layer 5: Category-specific confidence adjustments
 * Tunes pattern detection confidence based on tool type
 * 
 * Heuristics:
 * - Database tools: SQL patterns more important (higher priority)
 * - Browser tools: XSS/JavaScript patterns more important
 * - File tools: Filesystem patterns more important
 * - Network tools: Exfiltration patterns more important
 * 
 * @internal
 */
export interface CategoryTuning {
  category: string;                    // Tool category from MCP registry
  patternPriorities: Record<string, number>;  // Adjust confidence by ±0.1
  confidenceThreshold?: number;        // Override default 0.6 threshold
  prioritizedPatterns?: string[];      // Patterns to check first
  disabledPatterns?: string[];         // Patterns to skip for this category
}

/**
 * Pre-computed category-specific tuning table (Layer 5 optimization)
 * @internal
 */
const CATEGORY_TUNING_TABLE: Record<string, CategoryTuning> = {
  'Database': {
    category: 'Database',
    patternPriorities: {
      'Credential patterns in command': 0.95,  // +0.05 (SQL credentials critical)
      'Data exfiltration via curl/wget': 0.80, // +0.10
      'Recursive delete with force flag': 0.85 // Normal priority
    },
    confidenceThreshold: 0.55,  // Lower threshold for DB tools
    prioritizedPatterns: [
      'Credential patterns in command',
      'SSH key operations',
      'Data exfiltration via curl/wget'
    ]
  },
  'Browser Automation': {
    category: 'Browser Automation',
    patternPriorities: {
      'Credential patterns in command': 0.92,  // High for browser automation
      'Data exfiltration via curl/wget': 0.75,
      'Recursive delete with force flag': 0.70  // Lower - less relevant
    },
    prioritizedPatterns: [
      'Curl piped to bash',
      'Credential patterns in command'
    ]
  },
  'File Management': {
    category: 'File Management',
    patternPriorities: {
      'Direct device write': 0.99,              // Critical
      'Recursive delete with force flag': 0.95, // +0.05
      'Truncate or overwrite files': 0.90,      // Higher
      'Partition table operations': 0.98        // Critical
    },
    prioritizedPatterns: [
      'Recursive delete with force flag',
      'Direct device write',
      'Partition table operations'
    ]
  },
  'Network Tools': {
    category: 'Network Tools',
    patternPriorities: {
      'Data exfiltration via curl/wget': 0.90, // +0.20
      'Curl piped to bash': 0.99,               // Maximum
      'SSH key operations': 0.92,               // Higher
      'Recursive delete with force flag': 0.65  // Lower
    },
    prioritizedPatterns: [
      'Curl piped to bash',
      'Data exfiltration via curl/wget',
      'SSH key operations'
    ]
  },
  'Cloud Services': {
    category: 'Cloud Services',
    patternPriorities: {
      'Credential patterns in command': 0.98,  // Highest - API keys critical
      'Data exfiltration via curl/wget': 0.85,
      'SSH key operations': 0.95,               // Cloud auth critical
      'Direct device write': 0.60               // Not applicable
    },
    confidenceThreshold: 0.50,  // Lower threshold for cloud services
    prioritizedPatterns: [
      'Credential patterns in command',
      'SSH key operations'
    ]
  }
};

/**
 * Get category-specific tuning (Layer 5 integration)
 * Returns confidence adjustment for a pattern given the tool category
 * 
 * @param patternName - Name of the pattern rule
 * @param toolCategory - Tool category from MCP registry
 * @returns Adjusted confidence multiplier (e.g., 0.95 means 95% of base confidence)
 */
export function getCategoryTuning(
  patternName: string, 
  toolCategory?: string
): number {
  if (!toolCategory) return 1.0; // No tuning
  
  const tuning = CATEGORY_TUNING_TABLE[toolCategory];
  if (!tuning) return 1.0; // No tuning for unknown category
  
  return tuning.patternPriorities[patternName] ?? 1.0;
}

/**
 * Get confidence threshold for a tool category (Layer 5)
 * Lower threshold = more sensitive detection for high-risk categories
 */
export function getCategoryConfidenceThreshold(toolCategory?: string): number {
  if (!toolCategory) return 0.6; // Default
  
  const tuning = CATEGORY_TUNING_TABLE[toolCategory];
  return tuning.confidenceThreshold ?? 0.6;
}

/**
 * Get prioritized patterns for a tool category (Layer 5)
 * Patterns are checked in order for performance optimization
 */
export function getPrioritizedPatterns(toolCategory?: string): string[] {
  if (!toolCategory) return []; // Return empty, use default order
  
  const tuning = CATEGORY_TUNING_TABLE[toolCategory];
  return tuning.prioritizedPatterns ?? [];
}

/**
 * Check if a pattern should be disabled for a tool category (Layer 5)
 * Some patterns don't apply to certain tool types
 */
export function isPatternDisabledForCategory(
  patternName: string,
  toolCategory?: string
): boolean {
  if (!toolCategory) return false;
  
  const tuning = CATEGORY_TUNING_TABLE[toolCategory];
  if (!tuning?.disabledPatterns) return false;
  
  return tuning.disabledPatterns.includes(patternName);
}

/**
 * Destructive command patterns (data deletion, format operations)
 */
export const DESTRUCTIVE_PATTERNS: PatternRule[] = [
  {
    name: 'Recursive delete with force flag',
    pattern: /rm\s+(-[a-z]*r[a-z]*|-[a-z]*f[a-z]*.*-[a-z]*r|-r.*-f)\s+/i,
    category: 'destructive',
    severity: 'block',
    confidence: 0.95,
    remediation: 'Use `rm -i` for interactive deletion or `rm /safe/path/*` with explicit paths',
  },
  {
    name: 'mkfs/format operations',
    pattern: /\bmkfs|format|mkswap|mkext\d\s+/i,
    category: 'destructive',
    severity: 'block',
    confidence: 0.98,
    remediation: 'Filesystem operations require explicit confirmation - verify path is correct',
  },
  {
    name: 'dd overwrite operations',
    pattern: /\bdd\s+.*(of=|obs=).*(if=|ibs=)?/i,
    category: 'destructive',
    severity: 'pause',
    confidence: 0.85,
    remediation: 'dd is low-level; ensure source and destination are correct before executing',
  },
  {
    name: 'Truncate or overwrite files',
    pattern: /\b(truncate|fallocate|shred)\s+|>\s*\//i,
    category: 'destructive',
    severity: 'pause',
    confidence: 0.8,
    remediation: 'Verify file path and that backup exists before truncating',
  },
];

/**
 * Exfiltration patterns (credential leaks, data theft, command injection)
 */
export const EXFILTRATION_PATTERNS: PatternRule[] = [
  {
    name: 'Curl piped to bash',
    pattern: /curl\s+[^\s]*\s*\|\s*(bash|sh|bash\s+-c)/i,
    category: 'exfiltration',
    severity: 'block',
    confidence: 0.99,
    remediation: 'Never pipe curl directly to bash - download, verify, and execute separately',
  },
  {
    name: 'Wget piped to bash',
    pattern: /wget\s+[^\s]*\s*\|\s*(bash|sh)/i,
    category: 'exfiltration',
    severity: 'block',
    confidence: 0.98,
    remediation: 'Download with wget, then execute separately after verification',
  },
  {
    name: 'Credential patterns in command',
    pattern: /password\s*=|passwd|pwd|secret|token|api[_-]?key|bearer\s|auth\s|credentials?/i,
    category: 'exfiltration',
    severity: 'block',
    confidence: 0.92,
    remediation: 'Never hardcode credentials - use environment variables or secure vaults',
  },
  {
    name: 'Data exfiltration via curl/wget',
    pattern: /curl|wget|nc|netcat|socat.*POST|https?:\/\/.*-d\s|--data/i,
    category: 'exfiltration',
    severity: 'pause',
    confidence: 0.7,
    remediation: 'Verify destination URL and data being sent are legitimate',
  },
  {
    name: 'SSH key operations',
    pattern: /ssh-keygen|ssh-keyscan|authorized_keys|\.ssh\/id_|private[_-]?key/i,
    category: 'exfiltration',
    severity: 'pause',
    confidence: 0.85,
    remediation: 'SSH key operations should be explicit and intentional - verify target host',
  },
];

/**
 * Privilege escalation patterns
 */
export const PRIVILEGE_PATTERNS: PatternRule[] = [
  {
    name: 'Sudo without password',
    pattern: /sudo\s+(?!-[a-z]*[ulH]|-l).*NOPASSWD|sudo\s+-u\s+root|sudo\s+su/i,
    category: 'privilege',
    severity: 'pause',
    confidence: 0.9,
    remediation: 'Verify you need root access and understand what command is being elevated',
  },
  {
    name: 'Chmod 777 (world writable)',
    pattern: /chmod\s+777|chmod\s+\+[a-z]*x|chmod\s+a\+[a-z]*x/i,
    category: 'privilege',
    severity: 'warn',
    confidence: 0.85,
    remediation: 'Use restrictive permissions like `chmod 755` or `chmod 644` instead',
  },
  {
    name: 'User/group manipulation',
    pattern: /useradd|userdel|usermod|groupadd|groupdel|groupmod/i,
    category: 'privilege',
    severity: 'pause',
    confidence: 0.8,
    remediation: 'User/group changes are system-wide - ensure this is intended',
  },
];

/**
 * Filesystem manipulation patterns
 */
export const FILESYSTEM_PATTERNS: PatternRule[] = [
  {
    name: 'Direct device write',
    pattern: />\s*\/dev\/(sda|sdb|hda|hdb|nvme|mmcblk)/i,
    category: 'filesystem',
    severity: 'block',
    confidence: 0.99,
    remediation: 'Writing directly to device files destroys data - use proper partition tools',
  },
  {
    name: 'Partition table operations',
    pattern: /\b(fdisk|gdisk|parted|partprobe|sfdisk)\s+/i,
    category: 'filesystem',
    severity: 'block',
    confidence: 0.95,
    remediation: 'Partition operations are irreversible - ensure correct device before executing',
  },
  {
    name: 'Kernel module operations',
    pattern: /\b(insmod|rmmod|modprobe)\s+/i,
    category: 'filesystem',
    severity: 'pause',
    confidence: 0.8,
    remediation: 'Kernel module changes can cause system instability - verify you need this',
  },
];

/**
 * Combined pattern library for easy access
 */
export const PATTERN_LIBRARY: PatternRule[] = [
  ...DESTRUCTIVE_PATTERNS,
  ...EXFILTRATION_PATTERNS,
  ...PRIVILEGE_PATTERNS,
  ...FILESYSTEM_PATTERNS,
];

/**
 * Get patterns by category
 */
export function getPatternsForCategory(
  category: 'destructive' | 'exfiltration' | 'privilege' | 'filesystem',
): PatternRule[] {
  return PATTERN_LIBRARY.filter((p) => p.category === category);
}

/**
 * Heuristic: Detect piped/chained dangerous commands
 * Returns true if line contains pipe with bash/sh/eval/source
 */
export function detectDangerousPipe(line: string): boolean {
  const pipedToExecPattern = /\|\s*(bash|sh|ksh|zsh|eval|source|xargs\s+bash)/i;
  return pipedToExecPattern.test(line);
}

/**
 * Heuristic: Detect obfuscated patterns (reversed, hex-encoded, base64)
 * Basic detection for common obfuscation techniques
 */
export function detectObfuscation(line: string): boolean {
  // Hex-encoded patterns: \x or \u
  if (/\\x[0-9a-f]{2}|\\u[0-9a-f]{4}/i.test(line)) return true;

  // Base64-like strings (4+ chars in base64 alphabet)
  if (/[A-Za-z0-9+/]{16,}={0,2}/.test(line)) return true;

  // Reversed command execution indicators
  if (/eval\s*\(\s*['\"].*?['\"].*?\)/i.test(line)) return true;

  return false;
}

/**
 * Whitelist patterns that are safe and should skip scanning
 * Users can add their own patterns via SafetyPolicy.allowPatterns
 */
export const DEFAULT_ALLOWLIST: string[] = [
  // Safe cleanup operations
  '^rm\\s+(-i|-v)?\\s+/tmp/.+',
  '^rm\\s+(-i|-v)?\\s+/var/cache/.+',
  '^rm\\s+(-i|-v)?\\s+\\*\\.tmp',
  '^rm\\s+(-i|-v)?\\s+\\.\\/.+/(build|dist|node_modules)',

  // Safe read operations
  '^cat\\s+/proc/',
  '^cat\\s+/etc/os-release',
  '^curl\\s+https://[a-z0-9.-]+\\.example\\.com',

  // Safe package management
  '^apt-get\\s+install',
  '^npm\\s+install',
  '^pip\\s+install',
  '^brew\\s+install',
];
