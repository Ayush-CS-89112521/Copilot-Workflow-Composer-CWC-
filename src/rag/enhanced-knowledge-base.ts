
import { SimpleKnowledgeBase, KnowledgeEntry, QueryResult } from './simple-knowledge-base.js';
import { readFile } from 'fs/promises';
import { join } from 'path';

export class EnhancedKnowledgeBase extends SimpleKnowledgeBase {
    private mcpCatalogPath: string;
    private apiRegistryPath: string;

    constructor(dataDir?: string) {
        super(dataDir);
        this.mcpCatalogPath = join(process.cwd(), 'data', 'mcp-catalog.json');
        this.apiRegistryPath = join(process.cwd(), 'data', 'api-registry.json');
    }

    /**
     * Connect to knowledge base and load external resources
     */
    async connect(): Promise<void> {
        await super.connect();
        await this.indexMcpServers();
        await this.indexPublicApis();
    }

    /**
     * Index MCP Servers from catalog
     */
    async indexMcpServers(): Promise<void> {
        try {
            const data = await readFile(this.mcpCatalogPath, 'utf-8');
            const catalog = JSON.parse(data);

            // @ts-ignore
            const servers = catalog.tools || [];

            console.log(`🧠 Indexing ${servers.length} MCP servers...`);

            for (const server of servers) {
                const entry: KnowledgeEntry = {
                    id: `mcp-${server.name.replace(/\//g, '-')}`,
                    content: `
MCP Server: ${server.name}
Description: ${server.description}
Category: ${server.category}
Languages: ${server.languages?.join(', ')}
Tags: ${server.tags?.join(', ') || ''}
Install: ${server.installation || 'npx ' + server.id.split('/').pop()}
                    `.trim(),
                    metadata: {
                        type: 'tool',
                        source: 'mcp-catalog',
                        timestamp: new Date(),
                        tags: ['mcp', 'tool', server.category],
                        confidence: 1.0
                    }
                };
                this.entries.push(entry);
            }
        } catch (error) {
            console.warn('⚠️ Failed to index MCP servers (catalog might be missing):', error);
        }
    }

    /**
     * Index Public APIs from registry
     */
    async indexPublicApis(): Promise<void> {
        try {
            const data = await readFile(this.apiRegistryPath, 'utf-8');
            const registry = JSON.parse(data);

            // @ts-ignore
            const apis = registry.entries || []; // Assuming registry structure has 'entries'

            console.log(`🧠 Indexing ${apis.length} Public APIs...`);

            for (const api of apis) {
                const entry: KnowledgeEntry = {
                    id: `api-${api.id}`,
                    content: `
Public API: ${api.name}
Description: ${api.description}
Category: ${api.category}
Auth Type: ${api.authType}
URL: ${api.url}
HTTPS: ${api.https ? 'Yes' : 'No'}
CORS: ${api.cors}
                    `.trim(),
                    metadata: {
                        type: 'documentation', // Treated as docs for planning
                        source: 'api-registry',
                        timestamp: new Date(),
                        tags: ['api', 'public-api', api.category],
                        confidence: 1.0
                    }
                };
                this.entries.push(entry);
            }
        } catch (error) {
            console.warn('⚠️ Failed to index Public APIs (registry might be missing):', error);
        }
    }

    /**
     * Search specifically for tools (MCP servers)
     */
    async searchTools(query: string, limit: number = 3): Promise<QueryResult[]> {
        return this.queryContext(query, {
            limit,
            type: 'tool',
            threshold: 0.01 // Lower threshold for discovery
        });
    }

    /**
     * Search specifically for APIs
     */
    async searchApis(query: string, limit: number = 3): Promise<QueryResult[]> {
        return this.queryContext(query, {
            limit,
            type: 'documentation',
            threshold: 0.01
        });
    }
}
