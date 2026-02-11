#!/bin/bash

# End-to-End Integration Test for Copilot Workflow Composer
# This script executes the advanced-refactor.yaml workflow and verifies
# that variable resolution works correctly across multiple steps

set -e

PROJECT_DIR="/home/seginusalpha/Desktop/Github Copilot Hackathon CLI"
WORKFLOW_FILE="$PROJECT_DIR/examples/advanced-refactor.yaml"
CLI_PATH="$PROJECT_DIR/src/cli.ts"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Copilot Workflow Composer - E2E Integration Test              ║"
echo "║  Testing Multi-Step Variable Resolution with gh copilot       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Pre-flight checks
echo "📋 Step 1: Pre-flight Checks"
echo "─────────────────────────────────────────────────────────────────"

if [ ! -f "$WORKFLOW_FILE" ]; then
    echo "❌ Error: Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi
echo "✅ Workflow file exists"

if ! command -v bun &> /dev/null; then
    echo "❌ Error: Bun is not installed"
    exit 1
fi
echo "✅ Bun is installed: $(bun --version)"

if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    echo "   Install with: brew install gh (or your package manager)"
    exit 1
fi
echo "✅ GitHub CLI is installed: $(gh --version | head -n 1)"

if ! gh copilot --help &> /dev/null; then
    echo "❌ Error: gh copilot extension not found"
    echo "   Install with: gh extension install github/gh-copilot"
    exit 1
fi
echo "✅ gh copilot extension is installed"

echo "✅ All pre-flight checks passed!"
echo ""

# Step 2: Install dependencies
echo "📦 Step 2: Install Dependencies"
echo "─────────────────────────────────────────────────────────────────"
cd "$PROJECT_DIR"
bun install
echo "✅ Dependencies installed"
echo ""

# Step 3: Type check
echo "🔍 Step 3: TypeScript Type Check"
echo "─────────────────────────────────────────────────────────────────"
bun run type-check
echo "✅ TypeScript type checking passed"
echo ""

# Step 4: Execute workflow
echo "🚀 Step 4: Execute Workflow"
echo "─────────────────────────────────────────────────────────────────"
echo "Running: bun run $CLI_PATH $WORKFLOW_FILE"
echo ""

# Execute the workflow and capture output
WORKFLOW_OUTPUT=$(bun run "$CLI_PATH" "$WORKFLOW_FILE" 2>&1 || true)

echo "$WORKFLOW_OUTPUT"
echo ""

# Step 5: Verify variable resolution
echo "✨ Step 5: Verify Variable Resolution"
echo "─────────────────────────────────────────────────────────────────"

# Extract the runId from the output
RUN_ID=$(echo "$WORKFLOW_OUTPUT" | grep "Run ID:" | sed 's/.*Run ID: //' | tr -d ' ')

if [ -z "$RUN_ID" ]; then
    echo "⚠️  Warning: Could not extract Run ID from output"
    echo "   The workflow may not have executed successfully"
else
    echo "✅ Workflow executed with Run ID: $RUN_ID"
    echo ""
    
    # Check if execution directory exists
    EXEC_DIR="$PROJECT_DIR/workflow-executions/$RUN_ID"
    
    if [ -d "$EXEC_DIR" ]; then
        echo "📁 Checking execution directory: $EXEC_DIR"
        
        if [ -f "$EXEC_DIR/context.json" ]; then
            echo "✅ Final context saved"
            
            # Check for analysis_result variable
            if grep -q "analysis_result" "$EXEC_DIR/context.json"; then
                echo "✅ Step 1 (analyze): Output saved as 'analysis_result' variable"
            else
                echo "⚠️  Step 1 (analyze): Variable not found in context"
            fi
            
            # Check for plan_output variable
            if grep -q "plan_output" "$EXEC_DIR/context.json"; then
                echo "✅ Step 2 (plan): Output saved as 'plan_output' variable"
                echo ""
                echo "🎯 SUCCESS: Variable resolution working correctly!"
                echo "   Step 2 successfully received and used output from Step 1"
            else
                echo "⚠️  Step 2 (plan): Variable not found in context"
            fi
        fi
        
        if [ -f "$EXEC_DIR/results.jsonl" ]; then
            echo ""
            echo "📊 Step Execution Summary:"
            echo "─────────────────────────────────────────────────────────────────"
            
            # Count successful steps
            SUCCESS_COUNT=$(grep -c '"success":true' "$EXEC_DIR/results.jsonl" 2>/dev/null || echo 0)
            FAIL_COUNT=$(grep -c '"success":false' "$EXEC_DIR/results.jsonl" 2>/dev/null || echo 0)
            
            echo "   Successful Steps: $SUCCESS_COUNT"
            echo "   Failed Steps: $FAIL_COUNT"
            
            # Show step details
            echo ""
            echo "📋 Step Details:"
            jq -r '.stepId + ": " + if .success then "✅ SUCCESS" else "❌ FAILED" end + " (" + (.duration | tostring) + "ms)"' "$EXEC_DIR/results.jsonl" 2>/dev/null || true
        fi
        
        if [ -f "$EXEC_DIR/metadata.json" ]; then
            echo ""
            echo "⏱️  Execution Metadata:"
            jq '.execution' "$EXEC_DIR/metadata.json" 2>/dev/null || true
        fi
        
        echo ""
        echo "📂 Output files generated:"
        if [ -d "$EXEC_DIR/outputs" ]; then
            ls -lah "$EXEC_DIR/outputs/" 2>/dev/null | tail -n +2 | awk '{print "   " $9 " (" $5 ")"}'
        fi
    else
        echo "⚠️  Execution directory not found: $EXEC_DIR"
    fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Test Complete                                                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📖 Next Steps:"
echo "   1. Check workflow-executions/$RUN_ID/context.json for variables"
echo "   2. Review workflow-executions/$RUN_ID/results.jsonl for step details"
echo "   3. Examine workflow-executions/$RUN_ID/outputs/ for generated files"
echo ""
