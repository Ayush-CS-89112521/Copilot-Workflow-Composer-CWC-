
import * as fs from "fs";
import * as path from "path";

export interface ApiEntry {
    id: string;
    name: string;
    url: string;
    category: string;
    description: string;
    authType: string;
    https: boolean;
    cors: string;
    source: string;
    lastUpdated: string;
    protocols?: string[];
}

export interface ApiRegistry {
    version: string;
    lastUpdated: string;
    source: string;
    entries: ApiEntry[];
}

export class ApiDiscoveryService {
    private registry: ApiRegistry | null = null;
    private registryLoadedAt: Date | null = null;
    private apiIndex: Map<string, ApiEntry> = new Map();
    private cacheTTL: number = 5 * 60 * 1000; // 5 minutes
    private registryPath: string;

    constructor(registryPath?: string) {
        this.registryPath = registryPath || path.resolve(process.cwd(), 'data', 'api-registry.json');
    }

    async loadRegistry(): Promise<ApiRegistry> {
        if (this.registry && this.registryLoadedAt) {
            const age = Date.now() - this.registryLoadedAt.getTime();
            if (age < this.cacheTTL) {
                return this.registry;
            }
        }

        if (!fs.existsSync(this.registryPath)) {
            throw new Error(
                `API Registry not found at ${this.registryPath}. ` +
                `Run 'bun scripts/parse-public-apis.ts' to generate it.`
            );
        }

        const content = fs.readFileSync(this.registryPath, 'utf-8');
        this.registry = JSON.parse(content) as ApiRegistry;
        this.registryLoadedAt = new Date();

        this.apiIndex.clear();
        for (const api of this.registry.entries) {
            this.apiIndex.set(api.id.toLowerCase(), api);
        }

        return this.registry;
    }

    async findApi(id: string): Promise<ApiEntry | null> {
        if (!this.registry) {
            await this.loadRegistry();
        }
        return this.apiIndex.get(id.toLowerCase()) || null;
    }

    async searchApis(
        query: string,
        options?: {
            category?: string;
            authType?: string;
            https?: boolean;
            limit?: number;
        }
    ): Promise<Array<ApiEntry & { score: number }>> {
        if (!this.registry) {
            await this.loadRegistry();
        }

        const queryLower = query.toLowerCase();
        const results: Array<ApiEntry & { score: number }> = [];

        for (const api of this.registry!.entries) {
            // Apply filters
            if (options?.category && api.category !== options.category) continue;
            if (options?.authType && api.authType !== options.authType) continue;
            if (options?.https !== undefined && api.https !== options.https) continue;

            // Calculate similarity score
            const score = this.calculateSimilarity(queryLower, api);

            if (score > 0) {
                results.push({ ...api, score });
            }
        }

        // Sort by score descending
        results.sort((a, b) => b.score - a.score);

        // Apply limit
        return options?.limit ? results.slice(0, options.limit) : results;
    }

    async getCategories(): Promise<string[]> {
        if (!this.registry) {
            await this.loadRegistry();
        }
        const categories = new Set(this.registry!.entries.map(e => e.category));
        return Array.from(categories).sort();
    }

    private calculateSimilarity(query: string, api: ApiEntry): number {
        const tokens = query.split(/\s+/);
        let matches = 0;

        // Check exact match
        if (api.name.toLowerCase() === query || api.id === query) return 1.0;

        // Check name contains
        if (api.name.toLowerCase().includes(query)) matches += 0.5;

        // Check description
        if (api.description.toLowerCase().includes(query)) matches += 0.3;

        // Check category
        if (api.category.toLowerCase().includes(query)) matches += 0.2;

        // Check tokens
        for (const token of tokens) {
            if (api.name.toLowerCase().includes(token)) matches += 0.1;
            if (api.description.toLowerCase().includes(token)) matches += 0.05;
        }

        // Normalize (clamped to 1.0)
        return Math.min(matches, 1.0);
    }
}
