
import { createArchitect } from '../src/agents/architect.js';
import type { PrunedToolIndex } from '../src/types/architect.js';

async function main() {
    console.log('🤖 Verifying Architect Agent with GitHub Copilot CLI...');

    const agent = createArchitect();

    const toolIndex: PrunedToolIndex = {
        total_tools_available: 5,
        pruned_count: 2,
        pruned_tools: [
            {
                id: 'generic-shell',
                name: 'Generic Shell',
                description: 'Execute shell commands',
                category: 'System',
                scope: 'local_service'
            },
            {
                id: 'fs-read',
                name: 'File System Read',
                description: 'Read files from the system',
                category: 'Filesystem',
                scope: 'local_service'
            }
        ],
        generated_at: new Date().toISOString(),
        token_estimate: 100
    };

    const request = 'List all files in the current directory and read package.json';

    try {
        const plan = await agent.plan(request, toolIndex);
        console.log('\n✅ Plan Generated Successfully:');
        console.log(JSON.stringify(plan, null, 2));

        if ('error_code' in plan) {
            console.error('❌ Plan Error:', plan.error_message);
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
}

main();
