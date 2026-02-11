/**
 * Temporal Worker
 * 
 * Hosts and executes workflows and activities.
 * Polls task queues and processes tasks.
 */

import { Worker } from '@temporalio/worker';
import * as activities from './activities/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
    try {
        console.log('🚀 Starting Temporal worker...');

        const worker = await Worker.create({
            workflowsPath: join(__dirname, 'workflows'),
            activities,
            taskQueue: 'cwc-workflows',
            maxConcurrentActivityTaskExecutions: 10,
            maxConcurrentWorkflowTaskExecutions: 10
        });

        console.log('✅ Temporal worker started successfully');
        console.log('📋 Task queue: cwc-workflows');
        console.log('🔄 Polling for tasks...\n');

        // Run the worker
        await worker.run();
    } catch (error) {
        console.error('❌ Worker failed to start:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down worker...');
    await activities.cleanup();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down worker...');
    await activities.cleanup();
    process.exit(0);
});

run().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
