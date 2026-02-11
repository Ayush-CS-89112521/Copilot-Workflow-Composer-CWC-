#!/bin/bash

# Quick Test Command - Copy & Run This

cd "/home/seginusalpha/Desktop/Github Copilot Hackathon CLI" && \
bun install && \
bun run type-check && \
echo "" && \
echo "🚀 Executing workflow..." && \
bun run src/cli.ts examples/advanced-refactor.yaml

# After execution, verify variable resolution:
# 1. Get the RUN_ID from the output
# 2. Run:
#    cat ./workflow-executions/{RUN_ID}/context.json | jq '.variables'
#
# Expected:
# {
#   "analysis_result": "JSON analysis from step 1",
#   "plan_output": "JSON plan from step 2"
# }
#
# If both variables exist, variable resolution is working! ✅
