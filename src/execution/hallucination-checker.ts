/**
 * Hallucination Checker
 * Validates that requested tools exist in MCP catalog before invocation
 * 
 * Problem: Agent "hallucinates" tool names that don't exist
 * Solution: Cross-reference against mcp-catalog.json before execution
 * Action: Fail fast with helpful suggestions
 */

/**
 * Tool descriptor from MCP catalog
 */
export interface ToolDescriptor {
  id: string;
  name: string;
  description?: string;
  category?: string;
  schema?: Record<string, unknown>;
}

/**
 * Validation result from schema check
 */
export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Mock tool discovery service interface
 * (In production, this would connect to actual tool catalog)
 */
export interface IToolCatalog {
  lookupTool(toolName: string): ToolDescriptor | undefined;
  findClosestMatches(toolName: string, limit: number): ToolDescriptor[];
  listAll(): ToolDescriptor[];
}

/**
 * Checks for hallucinated tool names and validates arguments
 */
export class HallucinationChecker {
  constructor(private catalog: IToolCatalog) {}

  /**
   * Validate that tool exists and arguments match schema
   * Throws HallucinationDetectedError if tool doesn't exist or args are invalid
   */
  validateTool(toolName: string, args?: Record<string, unknown>): ToolDescriptor {
    const tool = this.catalog.lookupTool(toolName);

    if (!tool) {
      // Tool doesn't exist - agent is hallucinating
      const suggestions = this.catalog.findClosestMatches(toolName, 3);

      throw new HallucinationDetectedError(
        `Tool '${toolName}' does not exist in MCP catalog`,
        {
          requestedTool: toolName,
          suggestions: suggestions.map(t => ({ id: t.id, name: t.name })),
          availableToolCount: this.catalog.listAll().length,
          didYouMean: suggestions.length > 0
            ? `Did you mean: ${suggestions[0].id}?`
            : 'No similar tools found.',
        }
      );
    }

    // Validate arguments if schema is available
    if (args && tool.schema) {
      const validation = this.validateSchema(tool.schema, args);

      if (!validation.valid) {
        throw new HallucinationDetectedError(
          `Tool '${toolName}' argument validation failed`,
          {
            tool: toolName,
            providedArgs: args,
            schemaErrors: validation.errors,
            expectedSchema: tool.schema,
          }
        );
      }
    }

    return tool;
  }

  /**
   * Basic schema validation (simplified)
   * In production, would use proper JSON Schema validator
   */
  private validateSchema(
    schema: Record<string, unknown>,
    args: Record<string, unknown>
  ): SchemaValidationResult {
    const errors: string[] = [];

    // Check for required fields
    const required = (schema.required as string[]) || [];
    for (const field of required) {
      if (!(field in args)) {
        errors.push(`Missing required argument: ${field}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : [],
    };
  }

  /**
   * Find closest matching tools using Levenshtein distance
   * Helps suggest corrections to user
   */
  findSimilarTools(toolName: string, limit: number = 3): ToolDescriptor[] {
    return this.catalog.findClosestMatches(toolName, limit);
  }

  /**
   * Check if tool exists (without throwing)
   */
  toolExists(toolName: string): boolean {
    return this.catalog.lookupTool(toolName) !== undefined;
  }

  /**
   * Get tool info
   */
  getTool(toolName: string): ToolDescriptor | undefined {
    return this.catalog.lookupTool(toolName);
  }

  /**
   * List all available tools
   */
  listAvailableTools(): ToolDescriptor[] {
    return this.catalog.listAll();
  }
}

/**
 * Error thrown when hallucination is detected
 */
export class HallucinationDetectedError extends Error {
  constructor(
    message: string,
    public readonly details: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HallucinationDetectedError';
  }

  /**
   * Format error for user display
   */
  formatForUser(): string {
    const lines: string[] = [
      `❌ ${this.message}`,
      '',
    ];

    if ('requestedTool' in this.details) {
      lines.push(`Requested: '${this.details.requestedTool}'`);
    }

    if ('suggestions' in this.details && Array.isArray(this.details.suggestions)) {
      const suggestions = this.details.suggestions as Array<{ id: string; name: string }>;
      if (suggestions.length > 0) {
        lines.push('');
        lines.push('Did you mean one of these?');
        for (const tool of suggestions) {
          lines.push(`  • ${tool.id} - ${tool.name}`);
        }
      }
    }

    if ('schemaErrors' in this.details && Array.isArray(this.details.schemaErrors)) {
      const errors = this.details.schemaErrors as string[];
      if (errors.length > 0) {
        lines.push('');
        lines.push('Argument validation errors:');
        for (const error of errors) {
          lines.push(`  • ${error}`);
        }
      }
    }

    if ('availableToolCount' in this.details) {
      lines.push('');
      lines.push(`Available tools: ${this.details.availableToolCount}`);
    }

    return lines.join('\n');
  }
}

/**
 * Mock implementation for testing
 */
export class MockToolCatalog implements IToolCatalog {
  private tools: Map<string, ToolDescriptor>;

  constructor(tools: ToolDescriptor[] = []) {
    this.tools = new Map(tools.map(t => [t.id.toLowerCase(), t]));
  }

  lookupTool(toolName: string): ToolDescriptor | undefined {
    return this.tools.get(toolName.toLowerCase());
  }

  findClosestMatches(toolName: string, limit: number): ToolDescriptor[] {
    const allTools = Array.from(this.tools.values());
    
    const distances = allTools
      .map(tool => ({
        tool,
        distance: levenshteinDistance(toolName.toLowerCase(), tool.id.toLowerCase()),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
      .map(({ tool }) => tool);

    return distances;
  }

  listAll(): ToolDescriptor[] {
    return Array.from(this.tools.values());
  }

  addTool(tool: ToolDescriptor): void {
    this.tools.set(tool.id.toLowerCase(), tool);
  }
}

/**
 * Compute Levenshtein distance for string similarity
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(0));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  return matrix[b.length][a.length];
}
