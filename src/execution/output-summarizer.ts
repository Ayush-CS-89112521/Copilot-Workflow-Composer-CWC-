/**
 * Output Summarizer - Detects large outputs and creates compressed summaries
 * Strategy: For outputs >5KB, extract key information and create 1KB summary
 * while preserving full output for audit/archival purposes
 */

/**
 * Metadata about a summarized output
 */
export interface SummaryMetadata {
  /** Original output size in bytes */
  originalSize: number;
  /** Summary size in bytes */
  summarySize: number;
  /** Compression ratio (summary/original) */
  compressionRatio: number;
  /** Output type detected: 'json', 'code', 'markdown', 'text' */
  type: 'json' | 'code' | 'markdown' | 'text';
  /** Whether output was summarized */
  isSummarized: boolean;
}

/**
 * Result from summarization process
 */
export interface SummarizedOutput {
  /** The summary (or original if no summarization needed) */
  summary: string;
  /** Full original output (preserved for audit) */
  full: string;
  /** Metadata about the summarization */
  metadata: SummaryMetadata;
}

/**
 * Detect output type from content analysis
 * 
 * @param output - Output content
 * @returns Type: 'json', 'code', 'markdown', or 'text'
 */
function detectOutputType(output: string): 'json' | 'code' | 'markdown' | 'text' {
  const trimmed = output.trim();

  // Check for JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }

  // Check for code (contains common code indicators)
  if (
    trimmed.includes('function ') ||
    trimmed.includes('const ') ||
    trimmed.includes('let ') ||
    trimmed.includes('class ') ||
    trimmed.includes('interface ') ||
    trimmed.match(/^#!/) ||
    trimmed.includes('import ') ||
    trimmed.includes('export ')
  ) {
    return 'code';
  }

  // Check for markdown (contains markdown syntax)
  if (trimmed.match(/^#+ /) || trimmed.includes('```') || trimmed.includes('[') && trimmed.includes('](')) {
    return 'markdown';
  }

  return 'text';
}

/**
 * Summarize JSON output to extract key fields
 * Strategy: Extract schema + first 5 fields + value types
 * 
 * @param json - JSON string or object
 * @returns Summarized JSON (max 1KB)
 */
function summarizeJson(json: string): string {
  try {
    const obj = typeof json === 'string' ? JSON.parse(json) : json;

    // Handle arrays
    if (Array.isArray(obj)) {
      const sample = obj.slice(0, 2); // Take first 2 items
      return JSON.stringify(
        {
          type: 'array',
          length: obj.length,
          sample,
          note: `Array with ${obj.length} items, showing first ${sample.length}`,
        },
        null,
        2
      );
    }

    // Handle objects
    const keys = Object.keys(obj).slice(0, 5); // First 5 fields
    const summary: Record<string, unknown> = {
      _schema: {
        totalFields: Object.keys(obj).length,
        shown: keys.length,
      },
    };

    // Add field info
    for (const key of keys) {
      const value = obj[key];
      const type = Array.isArray(value) ? `array[${value.length}]` : typeof value;
      summary[key] = { type, value: value };
    }

    return JSON.stringify(summary, null, 2);
  } catch {
    return json.substring(0, 1024); // Fallback: truncate
  }
}

/**
 * Summarize code to extract function signatures and key sections
 * Strategy: Extract first N lines + function declarations
 * 
 * @param code - Code string
 * @returns Summarized code (max 1KB)
 */
function summarizeCode(code: string): string {
  const lines = code.split('\n');

  // Extract function/class declarations
  const signatures = lines.filter(
    (line) =>
      line.match(/^\s*(export\s+)?(async\s+)?(function|class|const|let|interface|type)\s/) ||
      line.match(/^\s*\/\/\s*/) // Comments
  );

  // Take first 20 lines + signatures
  const summary = [
    ...lines.slice(0, 10),
    '...',
    ...signatures.slice(0, 10),
  ].join('\n');

  return summary.substring(0, 1024);
}

/**
 * Summarize markdown to extract structure
 * Strategy: Extract headers + first line of each section
 * 
 * @param markdown - Markdown string
 * @returns Summarized markdown (max 1KB)
 */
function summarizeMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  const summary: string[] = [];

  for (const line of lines) {
    // Include headers
    if (line.match(/^#+\s/)) {
      summary.push(line);
    }
    // Include first non-empty line after each header
    else if (summary.length > 0 && summary[summary.length - 1].match(/^#+\s/) && line.trim()) {
      summary.push(line);
    }
  }

  return summary.join('\n').substring(0, 1024);
}

/**
 * Summarize plain text output
 * Strategy: Take first lines up to 1KB
 * 
 * @param text - Text string
 * @returns Summarized text (max 1KB)
 */
function summarizeText(text: string): string {
  const truncated = text.substring(0, 1024);
  return truncated.endsWith('\n') ? truncated : truncated + '\n[truncated...]';
}

/**
 * Summarize output based on type and size
 * 
 * @param output - Output content to summarize
 * @returns Summarized output with metadata
 */
export function summarizeOutput(output: string): SummarizedOutput {
  const originalSize = output.length;

  // Don't summarize small outputs
  if (originalSize < 5120) {
    // < 5KB
    return {
      summary: output,
      full: output,
      metadata: {
        originalSize,
        summarySize: originalSize,
        compressionRatio: 1.0,
        type: detectOutputType(output),
        isSummarized: false,
      },
    };
  }

  // Detect type and summarize accordingly
  const type = detectOutputType(output);
  let summary = '';

  switch (type) {
    case 'json':
      summary = summarizeJson(output);
      break;
    case 'code':
      summary = summarizeCode(output);
      break;
    case 'markdown':
      summary = summarizeMarkdown(output);
      break;
    default:
      summary = summarizeText(output);
  }

  const summarySize = summary.length;

  return {
    summary,
    full: output,
    metadata: {
      originalSize,
      summarySize,
      compressionRatio: summarySize / originalSize,
      type,
      isSummarized: true,
    },
  };
}

/**
 * Estimate whether output should be summarized
 * Returns true if output >5KB
 * 
 * @param output - Output content
 * @returns Whether to summarize
 */
export function shouldSummarize(output: string): boolean {
  return output.length > 5120; // 5KB
}

/**
 * Get compression ratio for output
 * Used for reporting and monitoring
 * 
 * @param summarized - Summarized output result
 * @returns Compression ratio as percentage
 */
export function getCompressionRatio(summarized: SummarizedOutput): number {
  return Math.round(summarized.metadata.compressionRatio * 100);
}

/**
 * Format summary stats for logging
 * 
 * @param summarized - Summarized output result
 * @returns Formatted string for display
 */
export function formatSummaryStats(summarized: SummarizedOutput): string {
  const { metadata } = summarized;
  if (!metadata.isSummarized) {
    return `(${metadata.originalSize} bytes, no compression needed)`;
  }

  const ratio = getCompressionRatio(summarized);
  return `(${metadata.originalSize} → ${metadata.summarySize} bytes, ${ratio}% of original, type: ${metadata.type})`;
}
