/**
 * RAG Knowledge Base
 * 
 * Manages vector embeddings and similarity search for workflow context.
 * Uses PostgreSQL with pgvector for efficient vector operations.
 */

import { Client } from 'pg';
import type { WorkflowExecutionResult } from '../types/index.js';

export interface KnowledgeEntry {
    id: string;
    content: string;
    embedding: number[];
    metadata: {
        type: 'workflow' | 'error' | 'documentation' | 'tool' | 'web-scraped';
        source: string;
        timestamp: Date;
        tags: string[];
        confidence?: number;
        success?: boolean;
    };
}

export interface QueryResult {
    content: string;
    similarity: number;
    metadata: KnowledgeEntry['metadata'];
}

export class KnowledgeBase {
    private client: Client;
    private embeddingCache: Map<string, number[]>;
    private isMemoryMode: boolean = false;
    private memoryEntries: KnowledgeEntry[] = [];

    constructor(connectionString?: string) {
        this.client = new Client({
            connectionString: connectionString || process.env.DATABASE_URL || 'postgresql://localhost:5432/cwc_knowledge'
        });
        this.embeddingCache = new Map();
    }

    async connect(): Promise<void> {
        try {
            await this.client.connect();
            await this.ensureSchema();
            this.isMemoryMode = false;
            console.log('✅ Connected to PostgreSQL Knowledge Base');
        } catch (error) {
            this.isMemoryMode = true;
            console.warn('⚠️ PostgreSQL connection failed, falling back to In-Memory Mode:', (error as Error).message);
        }
    }

    async disconnect(): Promise<void> {
        if (!this.isMemoryMode) {
            await this.client.end();
        }
    }

    private async ensureSchema(): Promise<void> {
        if (this.isMemoryMode) return;
        // Create extension if not exists
        await this.client.query('CREATE EXTENSION IF NOT EXISTS vector;');

        // Create table if not exists
        await this.client.query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        embedding vector(384),
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

        // Create index for vector similarity search
        try {
            await this.client.query(`
          CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx 
          ON knowledge_base USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100);
        `);
        } catch (error) {
            console.warn('Warning: Could not create index (likely vector dimension mismatch with existing table)', error);
        }

        // Create function for similarity search
        await this.client.query(`
      CREATE OR REPLACE FUNCTION match_documents(
        query_embedding vector(384),
        match_threshold float,
        match_count int
      )
      RETURNS TABLE (
        id uuid,
        content text,
        metadata jsonb,
        similarity float
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          knowledge_base.id,
          knowledge_base.content,
          knowledge_base.metadata,
          1 - (knowledge_base.embedding <=> query_embedding) as similarity
        FROM knowledge_base
        WHERE 1 - (knowledge_base.embedding <=> query_embedding) > match_threshold
        ORDER BY knowledge_base.embedding <=> query_embedding
        LIMIT match_count;
      END;
      $$;
    `);
    }

    /**
     * Add a workflow execution to the knowledge base
     */
    async addWorkflow(
        workflowName: string,
        result: WorkflowExecutionResult,
        additionalContext?: string
    ): Promise<void> {
        const content = this.formatWorkflowContent(workflowName, result, additionalContext);
        const embedding = await this.generateEmbedding(content);
        const metadata = {
            type: 'workflow' as const,
            source: workflowName,
            timestamp: new Date(),
            tags: this.extractTags(workflowName, result),
            success: result.success,
            confidence: (result.stats?.successfulSteps ?? 0) / (result.stats?.totalSteps ?? 1)
        };

        if (this.isMemoryMode) {
            this.memoryEntries.push({
                id: Math.random().toString(36).substring(2),
                content,
                embedding,
                metadata
            });
            return;
        }

        await this.client.query(
            `INSERT INTO knowledge_base (content, embedding, metadata) VALUES ($1, $2, $3)`,
            [content, JSON.stringify(embedding), JSON.stringify(metadata)]
        );
    }

    /**
     * Add error resolution to the knowledge base
     */
    async addErrorResolution(
        error: string,
        resolution: string,
        context?: string
    ): Promise<void> {
        const content = `Error: ${error}\nResolution: ${resolution}\nContext: ${context || 'N/A'}`;
        const embedding = await this.generateEmbedding(content);
        const metadata = {
            type: 'error' as const,
            source: 'error-resolution',
            timestamp: new Date(),
            tags: ['error', 'resolution'],
            confidence: 0.9
        };

        if (this.isMemoryMode) {
            this.memoryEntries.push({
                id: Math.random().toString(36).substring(2),
                content,
                embedding,
                metadata
            });
            return;
        }

        await this.client.query(
            `INSERT INTO knowledge_base (content, embedding, metadata) VALUES ($1, $2, $3)`,
            [content, JSON.stringify(embedding), JSON.stringify(metadata)]
        );
    }

    /**
     * Add web-scraped documentation to the knowledge base
     */
    async addWebScrapedDocs(
        url: string,
        topic: string,
        content: string
    ): Promise<void> {
        const embedding = await this.generateEmbedding(content);
        const metadata = {
            type: 'web-scraped' as const,
            source: url,
            timestamp: new Date(),
            tags: [topic, 'documentation', 'web-scraped'],
            confidence: 0.85
        };

        if (this.isMemoryMode) {
            this.memoryEntries.push({
                id: Math.random().toString(36).substring(2),
                content,
                embedding,
                metadata
            });
            return;
        }

        await this.client.query(
            `INSERT INTO knowledge_base (content, embedding, metadata) VALUES ($1, $2, $3)`,
            [content, JSON.stringify(embedding), JSON.stringify(metadata)]
        );
    }

    /**
     * Query the knowledge base for relevant context
     */
    async queryContext(
        query: string,
        options: {
            limit?: number;
            threshold?: number;
            type?: KnowledgeEntry['metadata']['type'];
        } = {}
    ): Promise<QueryResult[]> {
        const { limit = 5, threshold = 0.7, type } = options;

        // Generate query embedding
        const queryEmbedding = await this.generateEmbedding(query);

        if (this.isMemoryMode) {
            return this.matchDocumentsInMemory(queryEmbedding, threshold, limit, type);
        }

        // Search for similar documents
        const result = await this.client.query(
            `SELECT * FROM match_documents($1::vector, $2, $3)`,
            [JSON.stringify(queryEmbedding), threshold, limit]
        );

        // Filter by type if specified
        let results = result.rows;
        if (type) {
            results = results.filter((row: any) => row.metadata.type === type);
        }

        return results.map((row: any) => ({
            content: row.content,
            similarity: row.similarity,
            metadata: row.metadata
        }));
    }

    /**
     * Match documents using in-memory cosine similarity
     */
    private matchDocumentsInMemory(
        queryEmbedding: number[],
        threshold: number,
        limit: number,
        type?: KnowledgeEntry['metadata']['type']
    ): QueryResult[] {
        let entries = this.memoryEntries;
        if (type) {
            entries = entries.filter(e => e.metadata.type === type);
        }

        return entries
            .map(entry => ({
                content: entry.content,
                metadata: entry.metadata,
                similarity: this.cosineSimilarity(queryEmbedding, entry.embedding)
            }))
            .filter(r => r.similarity >= threshold)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit);
    }

    /**
     * Compute cosine similarity between two vectors
     */
    private cosineSimilarity(v1: number[], v2: number[]): number {
        let dotProduct = 0;
        let mag1 = 0;
        let mag2 = 0;
        for (let i = 0; i < v1.length; i++) {
            dotProduct += v1[i] * v2[i];
            mag1 += v1[i] * v1[i];
            mag2 += v2[i] * v2[i];
        }
        return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2) || 1);
    }

    /**
     * Generate embedding for text (using Xenova local model only)
     */
    private async generateEmbedding(text: string): Promise<number[]> {
        // Check cache first
        if (this.embeddingCache.has(text)) {
            return this.embeddingCache.get(text)!;
        }

        try {
            // Use local embedding model (Xenova/all-MiniLM-L6-v2)
            // Dimensions: 384
            // Speed: ~10ms on CPU
            // Cost: Free
            return await this.generateLocalEmbedding(text);
        } catch (error) {
            console.warn('Local embedding failed, falling back to hash:', error);
            return this.generateFallbackEmbedding(text);
        }
    }

    /**
     * Generate embedding using local Xenova model
     */
    private async generateLocalEmbedding(text: string): Promise<number[]> {
        // Dynamic import to avoid build issues if package missing
        const { pipeline } = await import('@xenova/transformers');

        // Singleton pattern: reuse pipeline instance
        // @ts-ignore
        if (!global.embeddingPipeline) {
            // @ts-ignore
            global.embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }

        // @ts-ignore
        const extractor = global.embeddingPipeline;

        // Generate embedding
        const output = await extractor(text, { pooling: 'mean', normalize: true });

        // Convert Tensor to array
        const embedding = Array.from(output.data) as number[];

        this.embeddingCache.set(text, embedding);
        return embedding;
    }

    /**
     * Generate a simple fallback embedding (when local model fails)
     */
    private generateFallbackEmbedding(text: string): number[] {
        const embedding = new Array(384).fill(0);

        // Simple hash-based approach
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i);
            const index = (charCode * (i + 1)) % 384;
            embedding[index] += charCode / 1000;
        }

        // Normalize
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map(val => val / (magnitude || 1));
    }

    /**
     * Format workflow content for storage
     */
    private formatWorkflowContent(
        workflowName: string,
        result: WorkflowExecutionResult,
        additionalContext?: string
    ): string {
        const parts = [
            `Workflow: ${workflowName}`,
            `Success: ${result.success}`,
            `Steps: ${result.stats?.totalSteps || 0}`,
            `Duration: ${result.executionTime || 0}ms`
        ];

        if (result.summary) {
            parts.push(`Summary: ${result.summary}`);
        }

        if (additionalContext) {
            parts.push(`Context: ${additionalContext}`);
        }

        if (result.errors && result.errors.length > 0) {
            parts.push(`Errors: ${result.errors.map(e => e.message).join(', ')}`);
        }

        return parts.join('\n');
    }

    /**
     * Extract tags from workflow name and result
     */
    private extractTags(workflowName: string, result: WorkflowExecutionResult): string[] {
        const tags = ['workflow'];

        // Add success/failure tag
        tags.push(result.success ? 'success' : 'failure');

        // Extract keywords from workflow name
        const keywords = workflowName.toLowerCase().match(/\b\w+\b/g) || [];
        tags.push(...keywords.filter(k => k.length > 3));

        // Add step count category
        const stepCount = result.stats?.totalSteps || 0;
        if (stepCount <= 3) tags.push('simple');
        else if (stepCount <= 10) tags.push('medium');
        else tags.push('complex');

        return [...new Set(tags)]; // Remove duplicates
    }

    /**
     * Get statistics about the knowledge base
     */
    async getStats(): Promise<{
        totalEntries: number;
        byType: Record<string, number>;
        successRate: number;
    }> {
        if (this.isMemoryMode) {
            const byType: Record<string, number> = {};
            let successCount = 0;
            for (const entry of this.memoryEntries) {
                const type = entry.metadata.type;
                byType[type] = (byType[type] || 0) + 1;
                if (entry.metadata.success) successCount++;
            }
            return {
                totalEntries: this.memoryEntries.length,
                byType,
                successRate: this.memoryEntries.length > 0 ? successCount / this.memoryEntries.length : 0
            };
        }

        const totalResult = await this.client.query('SELECT COUNT(*) FROM knowledge_base');
        const total = parseInt(totalResult.rows[0].count);

        const typeResult = await this.client.query(`
      SELECT metadata->>'type' as type, COUNT(*) as count
      FROM knowledge_base
      GROUP BY metadata->>'type'
    `);

        const byType: Record<string, number> = {};
        typeResult.rows.forEach((row: any) => {
            byType[row.type] = parseInt(row.count);
        });

        const successResult = await this.client.query(`
      SELECT COUNT(*) as count
      FROM knowledge_base
      WHERE metadata->>'success' = 'true'
    `);
        const successCount = parseInt(successResult.rows[0].count);

        return {
            totalEntries: total,
            byType,
            successRate: total > 0 ? successCount / total : 0
        };
    }
}
