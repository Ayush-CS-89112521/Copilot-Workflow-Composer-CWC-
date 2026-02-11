/**
 * Temporal Workflow for Durable Workflow Execution
 * 
 * Provides fault-tolerant, long-running workflow execution with automatic retries.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities/index.js';

// Configure activity timeouts and retries
const {
    generatePlanActivity,
    queryRAGActivity,
    executeStepActivity,
    storeResultsActivity,
    scrapeDocumentationActivity
} = proxyActivities<typeof activities>({
    startToCloseTimeout: '10 minutes',
    retry: {
        initialInterval: '1s',
        backoffCoefficient: 2,
        maximumInterval: '1m',
        maximumAttempts: 5
    }
});

export interface WorkflowExecutionOptions {
    request: string;
    timeout?: number;
    retries?: number;
    autoApprove?: boolean;
    noSteering?: boolean;
    enableRAG?: boolean;
    enableWebScraping?: boolean;
}

export interface WorkflowExecutionResult {
    success: boolean;
    plan: any;
    results: any[];
    context?: any;
    errors: any[];
    executionTime: number;
    stats: {
        totalSteps: number;
        successfulSteps: number;
        failedSteps: number;
    };
}

/**
 * Main durable workflow execution
 * 
 * This workflow is deterministic and can survive crashes/restarts.
 * All non-deterministic operations are delegated to activities.
 */
export async function executeWorkflowDurable(
    options: WorkflowExecutionOptions
): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();
    const errors: any[] = [];
    let context: any = null;
    let plan: any = null;
    const results: any[] = [];

    try {
        // Step 1: Query RAG for context (if enabled)
        if (options.enableRAG !== false) {
            try {
                context = await queryRAGActivity(options.request);
            } catch (error) {
                errors.push({
                    step: 'rag-query',
                    message: `RAG query failed: ${error}`,
                    recoverable: true
                });
                // Continue without context
            }
        }

        // Step 2: Scrape documentation if needed (if enabled)
        if (options.enableWebScraping && context?.needsExternalDocs) {
            try {
                const scrapedDocs = await scrapeDocumentationActivity(
                    context.documentationUrl,
                    context.topic
                );
                context.externalDocs = scrapedDocs;
            } catch (error) {
                errors.push({
                    step: 'web-scraping',
                    message: `Web scraping failed: ${error}`,
                    recoverable: true
                });
                // Continue without external docs
            }
        }

        // Step 3: Generate plan with context
        try {
            plan = await generatePlanActivity(options.request, context);
        } catch (error) {
            errors.push({
                step: 'planning',
                message: `Plan generation failed: ${error}`,
                recoverable: false
            });
            throw error; // Cannot continue without a plan
        }

        // Step 4: Execute each step in the plan
        for (let i = 0; i < plan.steps.length; i++) {
            const step = plan.steps[i];

            try {
                const result = await executeStepActivity(step, {
                    autoApprove: options.autoApprove,
                    noSteering: options.noSteering
                });

                results.push({
                    stepId: step.id,
                    stepName: step.name,
                    status: 'success',
                    result,
                    duration: result.duration
                });
            } catch (error) {
                const stepError = {
                    stepId: step.id,
                    stepName: step.name,
                    status: 'failed',
                    error: String(error),
                    recoverable: step.onFailure !== 'stop_workflow'
                };

                results.push(stepError);
                errors.push(stepError);

                // Stop if step is critical
                if (!stepError.recoverable) {
                    break;
                }
            }
        }

        // Step 5: Store results for future learning
        try {
            await storeResultsActivity({
                request: options.request,
                plan,
                results,
                context,
                success: errors.filter(e => !e.recoverable).length === 0
            });
        } catch (error) {
            errors.push({
                step: 'storage',
                message: `Result storage failed: ${error}`,
                recoverable: true
            });
            // Non-critical, continue
        }

        // Calculate stats
        const successfulSteps = results.filter(r => r.status === 'success').length;
        const failedSteps = results.filter(r => r.status === 'failed').length;

        return {
            success: errors.filter(e => !e.recoverable).length === 0,
            plan,
            results,
            context,
            errors,
            executionTime: Date.now() - startTime,
            stats: {
                totalSteps: plan.steps.length,
                successfulSteps,
                failedSteps
            }
        };
    } catch (error) {
        // Workflow-level error
        return {
            success: false,
            plan: plan || { steps: [] },
            results,
            context,
            errors: [
                ...errors,
                {
                    step: 'workflow',
                    message: `Workflow failed: ${error}`,
                    recoverable: false
                }
            ],
            executionTime: Date.now() - startTime,
            stats: {
                totalSteps: plan?.steps?.length || 0,
                successfulSteps: results.filter(r => r.status === 'success').length,
                failedSteps: results.filter(r => r.status === 'failed').length
            }
        };
    }
}

/**
 * Simplified workflow for traditional YAML-based execution
 */
export async function executeTraditionalWorkflow(
    workflowPath: string,
    options: any
): Promise<WorkflowExecutionResult> {
    const startTime = Date.now();

    try {
        // Load and execute workflow (delegated to activity)
        const result = await executeStepActivity(
            { type: 'workflow-file', path: workflowPath },
            options
        );

        return {
            success: true,
            plan: { steps: [] },
            results: [result],
            errors: [],
            executionTime: Date.now() - startTime,
            stats: {
                totalSteps: 1,
                successfulSteps: 1,
                failedSteps: 0
            }
        };
    } catch (error) {
        return {
            success: false,
            plan: { steps: [] },
            results: [],
            errors: [{
                step: 'workflow-execution',
                message: String(error),
                recoverable: false
            }],
            executionTime: Date.now() - startTime,
            stats: {
                totalSteps: 1,
                successfulSteps: 0,
                failedSteps: 1
            }
        };
    }
}
