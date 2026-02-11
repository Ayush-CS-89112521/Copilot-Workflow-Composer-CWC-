/**
 * Temporal Activities
 * 
 * Activities are the building blocks of workflows.
 * They can be non-deterministic and interact with external services.
 */

import { KnowledgeBase } from '../../rag/knowledge-base.js';
import { ClaudeScraper } from '../../scraping/claude-scraper.js';
import { ArchitectAgent } from '../../agents/architect.js';
import { BuilderAgent } from '../../agents/builder.js';
import type { PrunedToolIndex } from '../../types/index.js';

// Initialize services
let knowledgeBase: KnowledgeBase | null = null;
let scraper: ClaudeScraper | null = null;
let architect: ArchitectAgent | null = null;
let builder: BuilderAgent | null = null;

async function getKnowledgeBase(): Promise<KnowledgeBase> {
    if (!knowledgeBase) {
        knowledgeBase = new KnowledgeBase();
        await knowledgeBase.connect();
    }
    return knowledgeBase;
}

function getScraper(): ClaudeScraper {
    if (!scraper) {
        scraper = new ClaudeScraper();
    }
    return scraper;
}

function getArchitect(): ArchitectAgent {
    if (!architect) {
        architect = new ArchitectAgent();
    }
    return architect;
}

function getBuilder(): BuilderAgent {
    if (!builder) {
        builder = new BuilderAgent();
    }
    return builder;
}

/**
 * Query RAG knowledge base for relevant context
 */
export async function queryRAGActivity(request: string): Promise<any> {
    try {
        const kb = await getKnowledgeBase();
        const context = await kb.queryContext(request, {
            limit: 5,
            threshold: 0.7
        });

        // Analyze context to determine if external docs are needed
        const needsExternalDocs = context.length < 2 ||
            context.every(c => c.similarity < 0.8);

        // Extract potential documentation URLs from request
        const urlMatch = request.match(/https?:\/\/[^\s]+/);
        const documentationUrl = urlMatch ? urlMatch[0] : null;

        // Extract topic from request
        const topicMatch = request.match(/\b(express|react|node|typescript|python|api|rest|graphql)\b/i);
        const topic = topicMatch ? topicMatch[0] : 'general';

        return {
            similarWorkflows: context,
            needsExternalDocs,
            documentationUrl,
            topic,
            confidence: context.length > 0 ? context[0].similarity : 0
        };
    } catch (error) {
        console.error('RAG query failed:', error);
        return {
            similarWorkflows: [],
            needsExternalDocs: false,
            confidence: 0
        };
    }
}

/**
 * Scrape documentation from a URL
 */
export async function scrapeDocumentationActivity(
    url: string,
    topic: string
): Promise<any> {
    try {
        const webScraper = getScraper();
        const docs = await webScraper.scrapeDocumentation(url, topic);

        // Store in knowledge base for future use
        const kb = await getKnowledgeBase();
        await kb.addWebScrapedDocs(url, topic, JSON.stringify(docs));

        return docs;
    } catch (error) {
        console.error('Documentation scraping failed:', error);
        return null;
    }
}

/**
 * Generate plan using Architect agent with context
 */
export async function generatePlanActivity(
    request: string,
    context: any
): Promise<any> {
    try {
        const architectAgent = getArchitect();

        // Load tool index (simplified for now)
        const toolIndex: PrunedToolIndex = {
            tools: [],
            categories: [],
            totalTools: 0,
            prunedFrom: 0
        };

        // Generate plan with context
        const plan = await architectAgent.plan(request, toolIndex);

        // Enhance plan with context if available
        if (context?.similarWorkflows?.length > 0) {
            plan.context_used = {
                similar_workflows: context.similarWorkflows.length,
                confidence: context.confidence,
                external_docs: context.externalDocs ? 'yes' : 'no'
            };
        }

        return plan;
    } catch (error) {
        console.error('Plan generation failed:', error);
        throw error;
    }
}

/**
 * Execute a single workflow step
 */
export async function executeStepActivity(
    step: any,
    options: any
): Promise<any> {
    try {
        const builderAgent = getBuilder();

        // Execute step (simplified for now)
        const startTime = Date.now();

        // Simulate execution
        const result = {
            success: true,
            output: `Executed step: ${step.name || step.id}`,
            duration: Date.now() - startTime
        };

        return result;
    } catch (error) {
        console.error('Step execution failed:', error);
        throw error;
    }
}

/**
 * Store workflow results in knowledge base
 */
export async function storeResultsActivity(data: {
    request: string;
    plan: any;
    results: any[];
    context: any;
    success: boolean;
}): Promise<void> {
    try {
        const kb = await getKnowledgeBase();

        // Store workflow execution
        await kb.addWorkflow(
            data.request,
            {
                success: data.success,
                stats: {
                    totalSteps: data.plan.steps?.length || 0,
                    successfulSteps: data.results.filter((r: any) => r.status === 'success').length,
                    failedSteps: data.results.filter((r: any) => r.status === 'failed').length
                },
                errors: data.results.filter((r: any) => r.status === 'failed'),
                executionTime: data.results.reduce((sum: number, r: any) => sum + (r.duration || 0), 0)
            },
            JSON.stringify(data.context)
        );

        // Store error resolutions if any
        for (const result of data.results) {
            if (result.status === 'failed' && result.resolution) {
                await kb.addErrorResolution(
                    result.error,
                    result.resolution,
                    data.request
                );
            }
        }
    } catch (error) {
        console.error('Result storage failed:', error);
        throw error;
    }
}

/**
 * Search Stack Overflow for error solutions
 */
export async function searchStackOverflowActivity(
    errorMessage: string
): Promise<any> {
    try {
        const webScraper = getScraper();
        const solutions = await webScraper.searchStackOverflow(errorMessage);

        // Store solutions in knowledge base
        if (solutions.length > 0) {
            const kb = await getKnowledgeBase();
            for (const solution of solutions) {
                await kb.addErrorResolution(
                    errorMessage,
                    solution.answer,
                    `Stack Overflow: ${solution.link}`
                );
            }
        }

        return solutions;
    } catch (error) {
        console.error('Stack Overflow search failed:', error);
        return [];
    }
}

/**
 * Get package information from npm
 */
export async function getPackageInfoActivity(
    packageName: string
): Promise<any> {
    try {
        const webScraper = getScraper();
        return await webScraper.getPackageInfo(packageName);
    } catch (error) {
        console.error('Package info retrieval failed:', error);
        return null;
    }
}

/**
 * Cleanup function to close connections
 */
export async function cleanup(): Promise<void> {
    if (knowledgeBase) {
        await knowledgeBase.disconnect();
        knowledgeBase = null;
    }
    if (scraper) {
        scraper.clearCache();
        scraper = null;
    }
}
