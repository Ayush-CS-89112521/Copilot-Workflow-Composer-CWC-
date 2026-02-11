/**
 * Tool Discovery Types
 * 
 * Types for the Runtime Tool Discovery Layer integration with MCP registry
 */

export interface ToolDescriptor {
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

export interface MCPCatalog {
  version: string;
  generatedAt: string;
  source: string;
  toolCount: number;
  categories: string[];
  languageDistribution: Record<string, number>;
  scopeDistribution: Record<string, number>;
  tools: ToolDescriptor[];
}

export interface ToolAvailabilityCheck {
  toolId: string;
  found: boolean;
  metadata?: ToolDescriptor | undefined;
  missingEnvVars: string[];
  mcpCommand?: string | undefined;                 // Suggested MCP server command
  timestamp: string;
  cacheHit: boolean;
}

export interface ToolDiscoveryContext {
  /**
   * Resolved tool metadata from catalog
   */
  toolMetadata: Map<string, ToolDescriptor>;
  
  /**
   * Environment validation results
   */
  availability: Map<string, ToolAvailabilityCheck>;
  
  /**
   * Timestamp of catalog load
   */
  catalogLoadedAt: string;
  
  /**
   * Cache TTL in milliseconds (default 5 minutes)
   */
  cacheTTL: number;
}

export interface ToolVariableResolutionResult {
  resolved: boolean;
  toolId?: string | undefined;
  metadata?: ToolDescriptor | undefined;
  endpoint?: string | undefined;
  requiredEnvVars?: string[] | undefined;
  mcpCommand?: string | undefined;
  error?: string | undefined;
}
