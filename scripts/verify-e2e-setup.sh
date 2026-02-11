#!/bin/bash

# E2E Integration Test Verification Checklist
# Use this to verify all components are in place before running the test

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     E2E Integration Test - Pre-Flight Verification            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

PROJECT_DIR="/home/seginusalpha/Desktop/Github Copilot Hackathon CLI "

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to check file exists
check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅${NC} $description"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} $description"
        echo "   Expected: $file"
        ((FAILED++))
    fi
}

# Function to check directory exists
check_dir() {
    local dir=$1
    local description=$2
    
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✅${NC} $description"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} $description"
        echo "   Expected: $dir"
        ((FAILED++))
    fi
}

# Function to check string in file
check_string_in_file() {
    local file=$1
    local string=$2
    local description=$3
    
    if grep -q "$string" "$file" 2>/dev/null; then
        echo -e "${GREEN}✅${NC} $description"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} $description"
        echo "   Expected to find: $string"
        echo "   In file: $file"
        ((FAILED++))
    fi
}

echo "📋 Checking Project Structure..."
echo "─────────────────────────────────────────────────────────────────"

# Core files
check_file "$PROJECT_DIR/package.json" "package.json exists"
check_file "$PROJECT_DIR/tsconfig.json" "tsconfig.json exists"
check_file "$PROJECT_DIR/bunfig.toml" "bunfig.toml exists"

# Source code
check_file "$PROJECT_DIR/src/cli.ts" "CLI entry point (cli.ts)"
check_file "$PROJECT_DIR/src/types/index.ts" "Type definitions (types/index.ts)"
check_file "$PROJECT_DIR/src/schemas/workflow.schema.ts" "Zod schema (schemas/workflow.schema.ts)"
check_file "$PROJECT_DIR/src/parsers/workflow-parser.ts" "YAML parser (parsers/workflow-parser.ts)"
check_file "$PROJECT_DIR/src/context/context-manager.ts" "Context manager (context/context-manager.ts)"
check_file "$PROJECT_DIR/src/execution/variable-resolver.ts" "Variable resolver (execution/variable-resolver.ts)"
check_file "$PROJECT_DIR/src/execution/step-executor.ts" "Step executor (execution/step-executor.ts)"
check_file "$PROJECT_DIR/src/engine/workflow-engine.ts" "Workflow engine (engine/workflow-engine.ts)"

echo ""
echo "📦 Checking E2E Test Files..."
echo "─────────────────────────────────────────────────────────────────"

# E2E test files
check_file "$PROJECT_DIR/examples/advanced-refactor.yaml" "Advanced refactor workflow (examples/advanced-refactor.yaml)"
check_file "$PROJECT_DIR/src/utils/math-helper.ts" "Mock utility file (src/utils/math-helper.ts)"
check_file "$PROJECT_DIR/test-e2e.sh" "Automated test script (test-e2e.sh)"
check_file "$PROJECT_DIR/run-e2e-test.sh" "Quick test command (run-e2e-test.sh)"
check_file "$PROJECT_DIR/E2E-TEST-GUIDE.md" "E2E test guide"
check_file "$PROJECT_DIR/E2E-TEST-SUMMARY.md" "E2E test summary"

echo ""
echo "🔧 Checking gh Copilot Integration..."
echo "─────────────────────────────────────────────────────────────────"

# Check for updated flags in step-executor.ts
check_string_in_file \
    "$PROJECT_DIR/src/execution/step-executor.ts" \
    "--shell" \
    "gh copilot --shell flag added"

check_string_in_file \
    "$PROJECT_DIR/src/execution/step-executor.ts" \
    "--silent" \
    "gh copilot --silent flag added"

echo ""
echo "📚 Checking Workflow Definition..."
echo "─────────────────────────────────────────────────────────────────"

# Check workflow structure
check_string_in_file \
    "$PROJECT_DIR/examples/advanced-refactor.yaml" \
    "version:" \
    "Workflow has version field"

check_string_in_file \
    "$PROJECT_DIR/examples/advanced-refactor.yaml" \
    "steps:" \
    "Workflow has steps array"

check_string_in_file \
    "$PROJECT_DIR/examples/advanced-refactor.yaml" \
    "id: analyze" \
    "Step 1 (analyze) exists"

check_string_in_file \
    "$PROJECT_DIR/examples/advanced-refactor.yaml" \
    "id: plan" \
    "Step 2 (plan) exists"

check_string_in_file \
    "$PROJECT_DIR/examples/advanced-refactor.yaml" \
    '\${steps.analyze' \
    "Step 2 references Step 1 output"

check_string_in_file \
    "$PROJECT_DIR/examples/advanced-refactor.yaml" \
    "id: generate_fix" \
    "Step 3 (generate_fix) exists"

check_string_in_file \
    "$PROJECT_DIR/examples/advanced-refactor.yaml" \
    "id: create_tests" \
    "Step 4 (create_tests) exists"

check_string_in_file \
    "$PROJECT_DIR/examples/advanced-refactor.yaml" \
    "id: document" \
    "Step 5 (document) exists"

echo ""
echo "🧪 Checking Mock Utility File..."
echo "─────────────────────────────────────────────────────────────────"

check_string_in_file \
    "$PROJECT_DIR/src/utils/math-helper.ts" \
    "calculateSquareRoot" \
    "Mock function: calculateSquareRoot"

check_string_in_file \
    "$PROJECT_DIR/src/utils/math-helper.ts" \
    "divideNumbers" \
    "Mock function: divideNumbers"

check_string_in_file \
    "$PROJECT_DIR/src/utils/math-helper.ts" \
    "parseJsonData" \
    "Mock function: parseJsonData"

check_string_in_file \
    "$PROJECT_DIR/src/utils/math-helper.ts" \
    "ISSUE:" \
    "Mock functions have documented issues"

echo ""
echo "📊 Test Results Summary"
echo "═════════════════════════════════════════════════════════════════"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All pre-flight checks passed!${NC}"
    echo ""
    echo "🚀 Ready to run E2E test:"
    echo "   cd \"$PROJECT_DIR\""
    echo "   ./run-e2e-test.sh"
    exit 0
else
    echo ""
    echo -e "${RED}❌ Some checks failed. Please fix the issues above.${NC}"
    exit 1
fi
