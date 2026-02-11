#!/usr/bin/env bun

/**
 * MCP Registry Compiler
 * 
 * Parses .data/mcp_servers/awesome-mcp-servers/README.md and transforms it into
 * a structured mcp-catalog.json with tool metadata, resource profiles, and
 * enrichment for the Runtime Tool Discovery Layer.
 * 
 * Usage: bun scripts/compile-mcp-registry.ts [--refresh-only]
 * Output: data/mcp-catalog.json
 */

import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────

interface ToolDescriptor {
  id: string;                          // owner/repo
  name: string;                        // Display name
  category: string;                    // Section category
  description: string;                 // Brief description
  repositoryUrl: string;               // GitHub repo URL
  languages: string[];                 // ['typescript', 'python', ...]
  scope: 'local_service' | 'cloud_service' | 'embedded';
  osSupport: string[];                 // ['linux', 'macos', 'windows']
  isOfficial: boolean;                 // Has 🎖️ badge

  // Enriched metadata
  estimatedResourceProfile: {
    cpu: 'light' | 'medium' | 'heavy';
    memory: 'low' | 'medium' | 'high';
    timeoutMultiplier: number;         // 1.0x for local, 2.0x for cloud
  };

  // Tool capability inference from category
  capabilities: string[];

  // Auth metadata (inferred from category)
  inferredAuthType?: 'none' | 'apiKey' | 'oauth' | 'serviceAccount';
  commonEnvVars?: string[];            // Common environment variables
}

interface MCPCatalog {
  version: string;
  generatedAt: string;
  source: string;
  toolCount: number;
  categories: string[];
  languageDistribution: Record<string, number>;
  scopeDistribution: Record<string, number>;
  tools: ToolDescriptor[];
}

// ─────────────────────────────────────────────────────────────────
// RESOURCE PROFILE HEURISTICS
// ─────────────────────────────────────────────────────────────────

const LANGUAGE_RESOURCE_PROFILES: Record<string, { cpu: 'light' | 'medium' | 'heavy'; memory: 'low' | 'medium' | 'high' }> = {
  'typescript': { cpu: 'light', memory: 'medium' },
  'python': { cpu: 'light', memory: 'medium' },
  'go': { cpu: 'medium', memory: 'low' },
  'rust': { cpu: 'medium', memory: 'low' },
  'csharp': { cpu: 'medium', memory: 'medium' },
  'java': { cpu: 'heavy', memory: 'high' },
  'cpp': { cpu: 'heavy', memory: 'high' },
  'c': { cpu: 'heavy', memory: 'high' },
  'ruby': { cpu: 'light', memory: 'medium' },
};

const SCOPE_TIMEOUT_MULTIPLIERS: Record<string, number> = {
  'local_service': 1.0,
  'cloud_service': 2.0,
  'embedded': 0.6,
};

// ─────────────────────────────────────────────────────────────────
// CATEGORY-BASED ENRICHMENT
// ─────────────────────────────────────────────────────────────────

const CATEGORY_ENRICHMENT: Record<string, {
  capabilities: string[];
  inferredAuthType: 'none' | 'apiKey' | 'oauth' | 'serviceAccount';
  commonEnvVars: string[];
}> = {
  'Cloud Platforms': {
    capabilities: ['IAM', 'API Access', 'Resource Management', 'Credential Handling'],
    inferredAuthType: 'serviceAccount',
    commonEnvVars: ['API_KEY', 'CLIENT_ID', 'CLIENT_SECRET', 'REGION', 'PROJECT_ID'],
  },
  'Databases': {
    capabilities: ['Query Execution', 'Schema Management', 'Connection Pooling'],
    inferredAuthType: 'none',
    commonEnvVars: ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'],
  },
  'Browser Automation': {
    capabilities: ['Web Navigation', 'DOM Interaction', 'Screenshot Capture'],
    inferredAuthType: 'none',
    commonEnvVars: ['BROWSER_PATH', 'CHROME_BIN', 'FIREFOX_BIN'],
  },
  'Communication': {
    capabilities: ['Message Sending', 'Webhook Integration', 'Channel Management'],
    inferredAuthType: 'apiKey',
    commonEnvVars: ['API_KEY', 'WEBHOOK_URL', 'BOT_TOKEN', 'CHANNEL_ID'],
  },
  'Version Control': {
    capabilities: ['Repository Management', 'PR/Issue Handling', 'Code Review'],
    inferredAuthType: 'oauth',
    commonEnvVars: ['GITHUB_TOKEN', 'GITLAB_TOKEN', 'GIT_SSH_KEY'],
  },
  'Code Execution': {
    capabilities: ['Script Execution', 'Sandbox Isolation', 'Output Capture'],
    inferredAuthType: 'none',
    commonEnvVars: ['RUNTIME_PATH', 'SANDBOX_CONFIG'],
  },
  'Search & Data Extraction': {
    capabilities: ['Web Search', 'Data Scraping', 'API Aggregation'],
    inferredAuthType: 'apiKey',
    commonEnvVars: ['API_KEY', 'SEARCH_ENDPOINT'],
  },
  'Finance & Fintech': {
    capabilities: ['Payment Processing', 'Transaction Management', 'Account Access'],
    inferredAuthType: 'oauth',
    commonEnvVars: ['API_KEY', 'SECRET_KEY', 'MERCHANT_ID'],
  },
  'Data Science Tools': {
    capabilities: ['Data Analysis', 'ML Model Integration', 'Computation'],
    inferredAuthType: 'none',
    commonEnvVars: ['PYTHON_PATH', 'JUPYTER_URL', 'MODEL_PATH'],
  },
};

// ─────────────────────────────────────────────────────────────────
// PARSING LOGIC
// ─────────────────────────────────────────────────────────────────

/**
 * Map icon codes to language names
 */
function parseLanguageIcons(line: string): string[] {
  const languages: string[] = [];

  if (line.includes('📇')) languages.push('typescript');
  if (line.includes('🐍')) languages.push('python');
  if (line.includes('🏎️')) languages.push('go');
  if (line.includes('🦀')) languages.push('rust');
  if (line.includes('#️⃣')) languages.push('csharp');
  if (line.includes('☕')) languages.push('java');
  if (line.includes('🌊')) languages.push('cpp');
  if (line.includes('💎')) languages.push('ruby');

  return languages;
}

/**
 * Map icon codes to scope
 */
function parseScope(line: string): 'local_service' | 'cloud_service' | 'embedded' {
  if (line.includes('☁️')) return 'cloud_service';
  if (line.includes('📟')) return 'embedded';
  return 'local_service'; // Default
}

/**
 * Parse OS support from icons
 */
function parseOSSupport(line: string): string[] {
  const os: string[] = [];
  if (line.includes('🍎')) os.push('macos');
  if (line.includes('🪟')) os.push('windows');
  if (line.includes('🐧')) os.push('linux');
  return os.length > 0 ? os : ['linux', 'macos', 'windows']; // Default to all if not specified
}

/**
 * Check if tool is official
 */
function isOfficial(line: string): boolean {
  return line.includes('🎖️');
}

/**
 * Extract repository link from markdown line
 */
function extractRepoLink(line: string): { id: string; url: string; name: string } | null {
  // Match pattern: [owner/repo](https://github.com/owner/repo)
  const match = line.match(/\[([^\]]+)\]\(https:\/\/github\.com\/([^\)]+)\)/);
  if (match) {
    return {
      id: match[2], // owner/repo
      url: `https://github.com/${match[2]}`,
      name: match[1], // Display text
    };
  }
  return null;
}

/**
 * Extract tool description (after the repo link)
 */
function extractDescription(line: string): string {
  // Remove leading "- [owner/repo](...) " and get the rest
  const match = line.match(/\]\(https:\/\/[^\)]+\)\s*(.+?)(?:\s*🎖️)?(?:\s*[📇🐍🏎️🦀#️⃣☕🌊💎].*)?\s*$/);
  if (match) {
    return match[1].trim().replace(/\s+$/, '');
  }
  return '';
}

/**
 * Estimate resource profile based on languages
 */
function estimateResourceProfile(
  languages: string[],
  scope: 'local_service' | 'cloud_service' | 'embedded'
): ToolDescriptor['estimatedResourceProfile'] {
  // Start with defaults
  let cpu: 'light' | 'medium' | 'heavy' = 'light';
  let memory: 'low' | 'medium' | 'high' = 'medium';

  // Check each language and take the most demanding
  const cpuOrdering = { 'light': 0, 'medium': 1, 'heavy': 2 };
  const memoryOrdering = { 'low': 0, 'medium': 1, 'high': 2 };

  for (const lang of languages) {
    const profile = LANGUAGE_RESOURCE_PROFILES[lang.toLowerCase()];
    if (profile) {
      if (cpuOrdering[profile.cpu] > cpuOrdering[cpu]) cpu = profile.cpu;
      if (memoryOrdering[profile.memory] > memoryOrdering[memory]) memory = profile.memory;
    }
  }

  // Cloud services tend to be lighter (remote) but with higher timeout
  // Local services with heavy languages need more memory
  const timeoutMultiplier = SCOPE_TIMEOUT_MULTIPLIERS[scope];

  return { cpu, memory, timeoutMultiplier };
}

/**
 * Parse README and extract tools
 */
function parseReadme(filePath: string): ToolDescriptor[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const tools: ToolDescriptor[] = [];
  let currentCategory = '';
  let inServerSection = false;
  let foundServerImplementations = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect "Server Implementations" section start
    if (trimmed.includes('Server Implementations')) {
      foundServerImplementations = true;
      continue;
    }

    // Only process after Server Implementations section
    if (!foundServerImplementations) continue;

    // Detect category headers (### with emoji and name)
    // Pattern: ### 🔗 <a name="..."></a>Category Name
    if (trimmed.startsWith('### ') && trimmed.match(/###\s+[\p{Emoji}]/u)) {
      const categoryMatch = trimmed.match(/###\s+[\p{Emoji}]+\s+(?:<a[^>]+name="[^"]*"><\/a>)?(.+?)(?:\s*$)/u);
      if (categoryMatch) {
        currentCategory = categoryMatch[1].replace(/<[^>]+>/g, '').trim();
        inServerSection = true;
        continue;
      }
    }

    // Stop if we hit a non-category heading
    if (trimmed.startsWith('##') && !trimmed.startsWith('### ')) {
      inServerSection = false;
      continue;
    }

    // Parse tool entries (- [repo](url) ...)
    if (inServerSection && trimmed.startsWith('-') && trimmed.includes('github.com')) {
      const repoInfo = extractRepoLink(trimmed);
      if (!repoInfo) continue;

      const languages = parseLanguageIcons(trimmed);
      const scope = parseScope(trimmed);
      const osSupport = parseOSSupport(trimmed);
      const description = extractDescription(trimmed);
      const official = isOfficial(trimmed);

      const resourceProfile = estimateResourceProfile(languages, scope);

      // Get category enrichment
      const enrichment = CATEGORY_ENRICHMENT[currentCategory] || {
        capabilities: [],
        inferredAuthType: 'none' as const,
        commonEnvVars: [],
      };

      const tool: ToolDescriptor = {
        id: repoInfo.id,
        name: repoInfo.name,
        category: currentCategory,
        description,
        repositoryUrl: repoInfo.url,
        languages: languages.length > 0 ? languages : ['unknown'],
        scope,
        osSupport,
        isOfficial: official,
        estimatedResourceProfile: resourceProfile,
        capabilities: enrichment.capabilities,
        inferredAuthType: enrichment.inferredAuthType,
        commonEnvVars: enrichment.commonEnvVars,
      };

      tools.push(tool);
    }
  }

  return tools;
}

/**
 * Generate catalog metadata
 */
function generateCatalog(tools: ToolDescriptor[]): MCPCatalog {
  // Extract unique categories
  const categories = Array.from(new Set(tools.map(t => t.category))).sort();

  // Language distribution
  const languageDistribution: Record<string, number> = {};
  tools.forEach(tool => {
    tool.languages.forEach(lang => {
      languageDistribution[lang] = (languageDistribution[lang] || 0) + 1;
    });
  });

  // Scope distribution
  const scopeDistribution: Record<string, number> = {
    local_service: 0,
    cloud_service: 0,
    embedded: 0,
  };
  tools.forEach(tool => {
    scopeDistribution[tool.scope]++;
  });

  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    source: '.data/mcp_servers/README.md',
    toolCount: tools.length,
    categories,
    languageDistribution,
    scopeDistribution,
    tools,
  };
}

/**
 * Main execution
 */
async function main() {
  const projectRoot = path.resolve(import.meta.dir, '..');
  const readmePath = path.join(projectRoot, '.data', 'mcp_servers', 'README.md');
  const outputPath = path.join(projectRoot, 'data', 'mcp-catalog.json');

  console.log('🔍 Parsing MCP Registry...');
  console.log(`   Reading: ${readmePath}`);

  if (!fs.existsSync(readmePath)) {
    console.error(`❌ README not found at ${readmePath}`);
    process.exit(1);
  }

  try {
    // Parse tools
    const tools = parseReadme(readmePath);
    console.log(`✅ Parsed ${tools.length} MCP tools`);

    // Generate catalog with metadata
    const catalog = generateCatalog(tools);

    // Write output
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));
    console.log(`✅ Catalog written to ${outputPath}`);

    // Print summary
    console.log('\n📊 Catalog Summary');
    console.log(`   Total Tools: ${catalog.toolCount}`);
    console.log(`   Categories: ${catalog.categories.length}`);
    console.log(`   Languages: ${Object.keys(catalog.languageDistribution).join(', ')}`);
    console.log(`   Scope Distribution:`);
    console.log(`     • Cloud Services: ${catalog.scopeDistribution.cloud_service}`);
    console.log(`     • Local Services: ${catalog.scopeDistribution.local_service}`);
    console.log(`     • Embedded: ${catalog.scopeDistribution.embedded}`);

    console.log('\n✨ Registry compilation complete!');
  } catch (error) {
    console.error('❌ Error compiling registry:', error);
    process.exit(1);
  }
}

main();
