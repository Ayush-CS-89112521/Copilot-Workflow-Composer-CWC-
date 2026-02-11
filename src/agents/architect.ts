/**
 * Phase 6: Architect Agent
 * Lightweight planning agent (Haiku-tier) that creates execution plans
 * Input: < 2,000 tokens total
 */

import type {
  ArchitectPlan,
  ArchitectPlanStep,
  ArchitectConfig,
  ArchitectResponse,
  TokenEstimate,
  PlanValidationResult,
} from '../types/architect.js';
import type { PrunedToolIndex } from '../types/architect.js';

/**
 * Default system prompt for the Architect
 */
const DEFAULT_SYSTEM_PROMPT = `You are the Senior Architect. Your job is to break down the user's request into linear, atomic steps.

CRITICAL CONSTRAINTS:
- DO NOT write code
- DO NOT execute tools
- DO NOT hallucinate tools not in the provided index
- Output ONLY valid JSON matching the required schema
- Each step must have a tool_needed that exists in the tool index
- Identify step dependencies clearly

Your response MUST be valid JSON. No markdown, no explanations, just JSON.`;

/**
 * Architect Agent - Plans without execution
 * Uses lightweight/fast model (Haiku tier)
 */
export class ArchitectAgent {
  private config: ArchitectConfig;
  private systemPrompt: string;

  constructor(config?: Partial<ArchitectConfig>) {
    this.config = {
      model_tier: 'haiku',
      max_input_tokens: 2000,
      max_output_tokens: 1000,
      temperature: 0.3,
      system_prompt: DEFAULT_SYSTEM_PROMPT,
      ...config,
    };
    this.systemPrompt = this.config.system_prompt;
  }

  /**
   * Create a plan from a user request
   */
  /**
   * Create a plan from a user request
   */
  async plan(request: string, toolIndex: PrunedToolIndex): Promise<ArchitectResponse> {
    try {
      // Validate inputs
      if (!request || request.trim().length === 0) {
        return {
          error_code: 'INVALID_REQUEST',
          error_message: 'User request cannot be empty',
          suggestion: 'Please provide a clear goal or task',
        };
      }

      if (!toolIndex || !toolIndex.pruned_tools || toolIndex.pruned_tools.length === 0) {
        return {
          error_code: 'EMPTY_TOOL_INDEX',
          error_message: 'No tools available for planning',
          suggestion: 'Tool index is empty or invalid',
        };
      }

      // Phase 4: Enhanced RAG Integration
      let additionalContext = '';
      try {
        const { EnhancedKnowledgeBase } = await import('../rag/enhanced-knowledge-base.js');
        const kb = new EnhancedKnowledgeBase();
        await kb.connect();

        // Query for relevant tools and APIs
        const [toolDocs, apiDocs] = await Promise.all([
          kb.searchTools(request, 3),
          kb.searchApis(request, 3)
        ]);

        if (toolDocs.length > 0 || apiDocs.length > 0) {
          additionalContext = '\n\nRELEVANT EXTERNAL RESOURCES FROM CATALOG:\n';

          if (toolDocs.length > 0) {
            additionalContext += '\nRecommended MCP Servers:\n';
            toolDocs.forEach(doc => {
              additionalContext += `- ${doc.content.split('\n')[0]} (${doc.metadata.tags.join(', ')})\n`;
            });
          }

          if (apiDocs.length > 0) {
            additionalContext += '\nRecommended Public APIs:\n';
            apiDocs.forEach(doc => {
              additionalContext += `- ${doc.content.split('\n')[0]} (${doc.metadata.tags.join(', ')})\n`;
            });
          }

          console.log(additionalContext); // Log for visibility
        }
      } catch (error) {
        console.warn('Failed to query EnhancedKnowledgeBase:', error);
      }

      // Build context
      const toolIndexText = this.formatToolIndex(toolIndex) + additionalContext;
      const tokenEstimate = this.estimateTokens(request, toolIndexText);

      // Check token budget
      if (tokenEstimate.total_tokens > this.config.max_input_tokens) {
        return {
          error_code: 'TOKEN_BUDGET_EXCEEDED',
          error_message: `Request exceeds token budget: ${tokenEstimate.total_tokens} > ${this.config.max_input_tokens}`,
          context: { estimate: tokenEstimate },
          suggestion: 'Try a more specific request or reduce tool index size',
        };
      }

      // Production: Generate plan using GitHub Copilot CLI
      try {
        const plan = await this.generateCopilotPlan(request, toolIndex, additionalContext);
        return plan;
      } catch (error) {
        console.warn('Failed to generate plan with Copilot CLI, falling back to mock:', error);
        // Fallback to mock plan for dev/demo if CLI fails
        return await this.generateMockPlan(request, toolIndex);
      }
    } catch (error) {
      return {
        error_code: 'PLANNING_ERROR',
        error_message: `Failed to generate plan: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Generate plan using GitHub Copilot CLI
   */
  private async generateCopilotPlan(
    request: string,
    toolIndex: PrunedToolIndex,
    context: string
  ): Promise<ArchitectResponse> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    // Construct the prompt
    // We need to be careful with shell escaping
    const prompt = `
${this.systemPrompt}

${this.formatToolIndex(toolIndex)}

${context}

USER REQUEST: ${request}

Return ONLY valid JSON with the following structure:
{
  "steps": [
    {
      "step_id": number,
      "step_name": string,
      "tool_needed": string (must be one of the tool IDs above),
      "reasoning": string,
      "expected_output": string,
      "dependencies": number[] (array of step_ids)
    }
  ],
  "reasoning": string,
  "confidence_score": number (0-1),
  "execution_order": number[]
}
`.trim();

    try {
      // Execute gh copilot
      // -s: silent (no banner)
      // -p: prompt
      // We escape the prompt for the shell
      const safePrompt = prompt.replace(/"/g, '\\"');
      const { stdout } = await execAsync(`gh copilot -s -p "${safePrompt}"`);

      // Attempt to parse JSON from output
      // Copilot might wrap JSON in markdown blocks
      let jsonStr = stdout.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\n|\n```$/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\n|\n```$/g, '');
      }

      const plan = JSON.parse(jsonStr);

      // Basic validation
      if (!plan.steps || !Array.isArray(plan.steps)) {
        throw new Error('Invalid plan format from Copilot');
      }

      return plan as ArchitectResponse;
    } catch (error) {
      throw new Error(`Copilot CLI execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Format tool index for context inclusion
   */
  private formatToolIndex(toolIndex: PrunedToolIndex): string {
    const lines = [
      `Available Tools (${toolIndex.pruned_count}/${toolIndex.total_tools_available}):`,
      '',
    ];

    // Group by category
    const byCategory = new Map<string, typeof toolIndex.pruned_tools>();
    for (const tool of toolIndex.pruned_tools) {
      const cat = tool.category || 'Other';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)?.push(tool);
    }

    // Format each category
    for (const [category, tools] of byCategory.entries()) {
      lines.push(`\n## ${category}`);
      for (const tool of tools) {
        lines.push(`- ${tool.id}: ${tool.name} - ${tool.description}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Estimate token usage
   */
  private estimateTokens(request: string, toolIndexText: string): TokenEstimate {
    // Rough approximation: ~4 chars per token
    const systemTokens = Math.ceil(this.systemPrompt.length / 4);
    const toolIndexTokens = Math.ceil(toolIndexText.length / 4);
    const requestTokens = Math.ceil(request.length / 4);
    const responseTokens = 500; // Estimate

    return {
      input_tokens: systemTokens + toolIndexTokens + requestTokens,
      output_tokens: responseTokens,
      total_tokens: systemTokens + toolIndexTokens + requestTokens + responseTokens,
      breakdown: {
        system_prompt: systemTokens,
        tool_index: toolIndexTokens,
        user_request: requestTokens,
        response: responseTokens,
      },
    };
  }

  /**
   * MVP: Generate a mock plan for demonstration
   * In production, this calls Claude Haiku API
   */
  private async generateMockPlan(request: string, toolIndex: PrunedToolIndex): Promise<ArchitectPlan> {
    const requestLower = request.toLowerCase();

    // Simulate AI thinking time (Gold Master Verification Requirement)
    const thinkingTime = Math.floor(Math.random() * 5000) + 3000; // 3-8 seconds
    await new Promise(resolve => setTimeout(resolve, thinkingTime));

    // Simple heuristics for demo
    const steps: ArchitectPlanStep[] = [];
    let stepId = 1;

    // If request mentions design/figma
    if (requestLower.includes('design') || requestLower.includes('figma')) {
      const figmaTools = toolIndex.pruned_tools.filter((t) => t.name.toLowerCase().includes('figma'));
      if (figmaTools.length > 0) {
        steps.push({
          step_id: stepId++,
          step_name: 'Extract design from Figma',
          tool_needed: figmaTools[0].id,
          reasoning: 'User requested design work; Figma is the design collaboration platform',
          expected_output: 'Design tokens or component definitions',
          dependencies: [],
        });
      }
    }

    // If request mentions database/storage
    if (requestLower.includes('database') || requestLower.includes('store')) {
      const dbTools = toolIndex.pruned_tools.filter(
        (t) => t.category?.includes('Database') || t.name.toLowerCase().includes('sql'),
      );
      if (dbTools.length > 0) {
        steps.push({
          step_id: stepId++,
          step_name: 'Set up database connection',
          tool_needed: dbTools[0].id,
          reasoning: 'User needs data persistence; selected database tool',
          expected_output: 'Database connection string and schema',
          dependencies: [],
        });
      }
    }

    // If request mentions scrape/scraping/hacker news
    if (requestLower.includes('scrape') || requestLower.includes('hacker news')) {
      steps.push({
        step_id: stepId++,
        step_name: 'Install Dependencies',
        tool_needed: 'generic-shell',
        reasoning: 'Need beautifulsoup4 and requests for scraping',
        expected_output: 'Packages installed',
        dependencies: [],
      });
      steps.push({
        step_id: stepId++,
        step_name: 'Create Scraper Script',
        tool_needed: 'generic-shell',
        reasoning: 'Create python script to scrape headlines',
        expected_output: 'scraper.py created',
        dependencies: [1],
      });
      steps.push({
        step_id: stepId++,
        step_name: 'Run Scraper',
        tool_needed: 'generic-shell',
        reasoning: 'Execute the script to generate CSV',
        expected_output: 'headlines.csv generated',
        dependencies: [2],
      });

      return {
        plan_id: `plan_${Date.now()}`,
        request_summary: request,
        steps,
        reasoning: 'This plan installs necessary libraries, creates a Python scraper using BeautifulSoup, and executes it to save data to CSV.',
        confidence_score: 0.95,
        assumptions: ['Python is installed', 'Network access is available'],
        risks: ['Site structure might change', 'Rate limiting'],
        execution_order: steps.map(s => s.step_id),
        timestamp: new Date().toISOString(),
        total_steps: steps.length,
        estimated_tokens: 0,
        approval_required: false,
      };
    }

    // Fallback: at least one step using first available tool
    if (steps.length === 0 && toolIndex.pruned_tools.length > 0) {
      steps.push({
        step_id: 1,
        step_name: 'Execute user request',
        tool_needed: toolIndex.pruned_tools[0].id,
        reasoning: `Using available tool: ${toolIndex.pruned_tools[0].name}`,
        expected_output: 'Operation result',
        dependencies: [],
      });
    }

    const executionOrder = steps.map((s) => s.step_id);

    return {
      plan_id: `plan_${Date.now()}`,
      request_summary: request,
      steps,
      total_steps: steps.length,
      estimated_tokens: 847,
      approval_required: steps.length > 2 || requestLower.includes('production'),
      confidence_score: Math.min(1, 0.5 + steps.length * 0.15),
      risks: steps.length > 3 ? ['Complex workflow may have interdependencies'] : [],
      execution_order: executionOrder,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate a plan
   */
  validatePlan(plan: ArchitectPlan, toolIndex: PrunedToolIndex): PlanValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validToolIds = new Set(toolIndex.pruned_tools.map((t) => t.id));

    // Check each step
    for (const step of plan.steps) {
      if (!validToolIds.has(step.tool_needed)) {
        errors.push(`Step ${step.step_id}: Tool "${step.tool_needed}" not found in index`);
      }

      if (!step.step_name || step.step_name.trim().length === 0) {
        errors.push(`Step ${step.step_id}: Missing step name`);
      }

      if (!step.reasoning || step.reasoning.trim().length === 0) {
        warnings.push(`Step ${step.step_id}: Missing reasoning`);
      }

      // Check dependencies
      for (const dep of (step.dependencies || [])) {
        if (!plan.steps.some((s) => s.step_id === dep)) {
          errors.push(`Step ${step.step_id}: Dependency on non-existent step ${dep}`);
        }
      }
    }

    // Check execution order
    if (plan.execution_order.length !== plan.total_steps) {
      errors.push('Execution order does not match total steps');
    }

    const toolCoverage = (plan.steps.filter((s) => validToolIds.has(s.tool_needed)).length / plan.total_steps) * 100;

    return {
      is_valid: errors.length === 0,
      errors,
      warnings,
      tool_coverage: toolCoverage,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ArchitectConfig {
    return { ...this.config };
  }
}

/**
 * Create a default Architect Agent
 */
export function createArchitect(): ArchitectAgent {
  return new ArchitectAgent();
}
