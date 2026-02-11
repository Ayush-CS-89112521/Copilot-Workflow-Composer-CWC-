/**
 * Context Compressor - Manages variable lifecycle and prevents unbounded context growth
 * Strategy: Keep full outputs for last N steps, compress older steps, auto-evict very large vars
 * 
 * For long-running workflows (10+ steps), prevents re-embedding large outputs repeatedly
 */

/**
 * Variable compression metadata
 */
export interface CompressedVariableMetadata {
  /** Original variable type */
  type: 'json' | 'code' | 'markdown' | 'text' | 'binary';
  /** Original size in bytes */
  originalSize: number;
  /** Current (compressed) size in bytes */
  currentSize: number;
  /** Compression ratio (current/original) */
  compressionRatio: number;
  /** When variable was created (ms since epoch) */
  createdAt: number;
  /** Number of steps since creation */
  ageInSteps: number;
  /** How many times this variable was referenced */
  referenceCount: number;
  /** Whether variable is compressed to summary */
  isCompressed: boolean;
  /** Archive path if variable is evicted to disk */
  archivePath?: string;
}

/**
 * Represents a variable with optional compression metadata
 */
export interface ManagedVariable {
  /** Variable value (summary if compressed) */
  value: unknown;
  /** Metadata about the variable */
  metadata: CompressedVariableMetadata;
  /** Full value if compressed (kept separate from summary) */
  fullValue?: unknown;
}

/**
 * Context compression config
 */
export interface CompressionConfig {
  /** Keep full outputs for last N steps (default: 5) */
  keepFullSteps: number;
  /** Auto-compress variables larger than this (bytes, default: 50KB) */
  compressionThreshold: number;
  /** Auto-evict variables larger than this (bytes, default: 5MB) */
  evictionThreshold: number;
  /** Aggressiveness: 'min' (aggressive), 'balanced' (default), 'quality' (no compression) */
  level: 'min' | 'balanced' | 'quality';
}

/**
 * Default compression config
 */
const DEFAULT_CONFIG: CompressionConfig = {
  keepFullSteps: 5,
  compressionThreshold: 51200, // 50KB
  evictionThreshold: 5242880, // 5MB
  level: 'balanced',
};

/**
 * Compression level -> config mapping
 */
const LEVEL_CONFIGS: Record<string, Partial<CompressionConfig>> = {
  min: {
    keepFullSteps: 2,
    compressionThreshold: 10240, // 10KB
    evictionThreshold: 1048576, // 1MB
  },
  balanced: {
    keepFullSteps: 5,
    compressionThreshold: 51200, // 50KB
    evictionThreshold: 5242880, // 5MB
  },
  quality: {
    keepFullSteps: 10,
    compressionThreshold: Infinity, // Never compress
    evictionThreshold: Infinity, // Never evict
  },
};

/**
 * Create compression config from level
 */
export function createCompressionConfig(
  level: 'min' | 'balanced' | 'quality' = 'balanced'
): CompressionConfig {
  return { ...DEFAULT_CONFIG, ...LEVEL_CONFIGS[level] };
}

/**
 * Detect variable type from value
 */
function detectVariableType(value: unknown): 'json' | 'code' | 'markdown' | 'text' | 'binary' {
  if (value === null || value === undefined) {
    return 'text';
  }

  const typeStr = typeof value;

  if (typeStr === 'object') {
    // Check if it's JSON-like
    try {
      JSON.stringify(value);
      return 'json';
    } catch {
      return 'binary';
    }
  }

  const str = String(value);

  // Check for code
  if (
    str.includes('function ') ||
    str.includes('class ') ||
    str.includes('interface ') ||
    str.match(/^#!/)
  ) {
    return 'code';
  }

  // Check for markdown
  if (str.match(/^#+\s/) || str.includes('```')) {
    return 'markdown';
  }

  return 'text';
}

/**
 * Estimate size of variable in bytes
 */
function estimateSize(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const typeStr = typeof value;

  if (typeStr === 'string') {
    return (value as string).length;
  }

  if (typeStr === 'object') {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1024; // Fallback estimate
    }
  }

  return String(value).length;
}

/**
 * Create a summary of variable value (aggressive compression)
 * Used when variable needs to be evicted or compressed
 */
function createSummary(value: unknown, type: string): string {
  if (typeof value === 'string') {
    const str = value as string;
    return `[${type}, ${str.length} bytes] ${str.substring(0, 100)}...`;
  }

  if (type === 'json' && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return `[json object, ${keys.length} fields, ~${estimateSize(value)} bytes]`;
  }

  return `[${type}, ${estimateSize(value)} bytes]`;
}

/**
 * Create managed variable with metadata
 */
export function createManagedVariable(
  value: unknown,
  options?: {
    type?: 'json' | 'code' | 'markdown' | 'text' | 'binary';
    createdAt?: number;
    referenceCount?: number;
  }
): ManagedVariable {
  const type = options?.type || detectVariableType(value);
  const originalSize = estimateSize(value);

  return {
    value,
    metadata: {
      type,
      originalSize,
      currentSize: originalSize,
      compressionRatio: 1.0,
      createdAt: options?.createdAt || Date.now(),
      ageInSteps: 0,
      referenceCount: options?.referenceCount || 0,
      isCompressed: false,
    },
  };
}

/**
 * Check if variable should be compressed based on size and config
 */
export function shouldCompress(variable: ManagedVariable, config: CompressionConfig): boolean {
  if (config.level === 'quality') {
    return false; // Never compress in quality mode
  }

  return variable.metadata.currentSize >= config.compressionThreshold;
}

/**
 * Check if variable should be evicted based on size and config
 */
export function shouldEvict(variable: ManagedVariable, config: CompressionConfig): boolean {
  if (config.level === 'quality') {
    return false; // Never evict in quality mode
  }

  return variable.metadata.originalSize >= config.evictionThreshold;
}

/**
 * Compress a variable to summary format
 * Keeps full value in separate field for audit purposes
 */
export function compressVariable(variable: ManagedVariable): ManagedVariable {
  if (variable.metadata.isCompressed) {
    return variable; // Already compressed
  }

  const summary = createSummary(variable.value, variable.metadata.type);

  return {
    value: summary,
    fullValue: variable.value,
    metadata: {
      ...variable.metadata,
      currentSize: summary.length,
      compressionRatio: summary.length / variable.metadata.originalSize,
      isCompressed: true,
    },
  };
}

/**
 * Update variable age based on number of steps passed
 */
export function updateVariableAge(variable: ManagedVariable, currentStepIndex: number): void {
  // Assuming variables created at step 0, calculate age
  const creationStep = 0; // Simplified - in real code would track creation step
  variable.metadata.ageInSteps = currentStepIndex - creationStep;
}

/**
 * Track reference to a variable (for popularity metrics)
 */
export function trackVariableReference(variable: ManagedVariable): void {
  variable.metadata.referenceCount++;
}

/**
 * Get compression status report for display
 */
export function getCompressionReport(
  variables: Map<string, ManagedVariable>
): {
  totalVariables: number;
  compressedVariables: number;
  totalOriginalSize: number;
  totalCurrentSize: number;
  averageCompressionRatio: number;
} {
  let totalOriginal = 0;
  let totalCurrent = 0;
  let compressedCount = 0;

  for (const variable of variables.values()) {
    totalOriginal += variable.metadata.originalSize;
    totalCurrent += variable.metadata.currentSize;
    if (variable.metadata.isCompressed) {
      compressedCount++;
    }
  }

  const avgRatio = totalOriginal > 0 ? totalCurrent / totalOriginal : 1.0;

  return {
    totalVariables: variables.size,
    compressedVariables: compressedCount,
    totalOriginalSize: totalOriginal,
    totalCurrentSize: totalCurrent,
    averageCompressionRatio: avgRatio,
  };
}

/**
 * Format compression report for logging
 */
export function formatCompressionReport(report: ReturnType<typeof getCompressionReport>): string {
  const ratio = Math.round(report.averageCompressionRatio * 100);
  const savedBytes = report.totalOriginalSize - report.totalCurrentSize;
  const savedKB = (savedBytes / 1024).toFixed(1);

  return (
    `Variables: ${report.totalVariables} ` +
    `(${report.compressedVariables} compressed) | ` +
    `Size: ${report.totalCurrentSize} bytes ` +
    `(${ratio}% of original, saved ${savedKB}KB)`
  );
}
