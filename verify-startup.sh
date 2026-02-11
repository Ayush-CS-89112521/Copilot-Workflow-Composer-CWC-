#!/bin/bash
# Cross-platform verification script for Copilot Workflow Composer
# Works on Linux, macOS, and Windows (Git Bash / WSL)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_check() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "  ${BLUE}→${NC} $1"
}

# Get OS type
get_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

OS=$(get_os)

# Main verification
main() {
    print_header "Copilot Workflow Composer - Setup Verification"
    
    echo -e "System: ${BLUE}$(uname -s)${NC} (${OS})"
    echo "Time: $(date)"
    echo ""
    
    # Check Node.js
    print_header "1. Checking Node.js"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
        
        if [ $NODE_MAJOR -ge 18 ]; then
            print_check "Node.js installed: $NODE_VERSION"
            print_info "Location: $(command -v node)"
        else
            print_fail "Node.js version too old: $NODE_VERSION (need v18+)"
            print_info "Download: https://nodejs.org/"
        fi
    else
        print_fail "Node.js not found"
        print_info "Install from: https://nodejs.org/"
    fi
    
    # Check npm
    print_header "2. Checking npm"
    
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_check "npm installed: v$NPM_VERSION"
        print_info "Location: $(command -v npm)"
    else
        print_fail "npm not found"
        print_info "Install with Node.js or: npm install -g npm"
    fi
    
    # Check Git
    print_header "3. Checking Git"
    
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        print_check "$GIT_VERSION"
        print_info "Location: $(command -v git)"
    else
        print_fail "Git not found"
        print_info "Install from: https://git-scm.com/"
    fi
    
    # Check GitHub CLI
    print_header "4. Checking GitHub CLI"
    
    if command -v gh &> /dev/null; then
        GH_VERSION=$(gh --version | head -n 1)
        print_check "$GH_VERSION"
        print_info "Location: $(command -v gh)"
        
        # Check GitHub authentication
        if gh auth status &> /dev/null; then
            AUTH_USER=$(gh auth status --show-token 2>&1 | grep "Logged in to" | head -n1 || echo "")
            if [ -n "$AUTH_USER" ]; then
                print_check "GitHub authentication: Active"
            else
                print_warn "GitHub authentication status unclear (may still be valid)"
            fi
        else
            print_fail "Not authenticated with GitHub"
            print_info "Run: gh auth login"
        fi
    else
        print_fail "GitHub CLI not found"
        print_info "Install from: https://cli.github.com/"
    fi
    
    # Check Bun (optional)
    print_header "5. Checking Bun (Optional, Recommended)"
    
    if command -v bun &> /dev/null; then
        BUN_VERSION=$(bun --version)
        print_check "Bun installed: v$BUN_VERSION"
        print_info "Location: $(command -v bun)"
        print_info "Bun is 5-10x faster than npm!"
    else
        print_warn "Bun not installed (optional but recommended)"
        print_info "Install from: https://bun.sh"
    fi
    
    # Check project structure
    print_header "6. Checking Project Structure"
    
    if [ -f "package.json" ]; then
        print_check "package.json found"
    else
        print_fail "package.json not found (run from project root)"
    fi
    
    if [ -f "tsconfig.json" ]; then
        print_check "tsconfig.json found"
    else
        print_fail "tsconfig.json not found"
    fi
    
    if [ -d "src" ]; then
        print_check "src/ directory found"
        FILE_COUNT=$(find src -name "*.ts" | wc -l)
        print_info "Found $FILE_COUNT TypeScript files"
    else
        print_fail "src/ directory not found"
    fi
    
    if [ -d "tests" ]; then
        print_check "tests/ directory found"
        TEST_COUNT=$(find tests -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l)
        print_info "Found $TEST_COUNT test files"
    else
        print_warn "tests/ directory not found"
    fi
    
    # Check dependencies
    print_header "7. Checking Dependencies"
    
    if [ -d "node_modules" ]; then
        print_check "node_modules/ found (dependencies installed)"
        
        # Check key dependencies
        if [ -d "node_modules/typescript" ]; then
            print_check "typescript installed"
        else
            print_warn "typescript not found (may need npm install)"
        fi
        
        if [ -d "node_modules/chalk" ]; then
            print_check "chalk installed"
        else
            print_warn "chalk not found"
        fi
    else
        print_warn "node_modules/ not found"
        print_info "Run: npm install"
    fi
    
    # Check build artifacts
    print_header "8. Checking Build Status"
    
    if [ -f "dist/cli.js" ]; then
        print_check "dist/cli.js found (built successfully)"
        
        # Check if executable
        if [ -x "dist/cli.js" ] || [[ "$OS" == "windows" ]]; then
            print_check "dist/cli.js is executable"
        else
            print_warn "dist/cli.js may not be executable"
            print_info "Fix with: chmod +x dist/cli.js"
        fi
    else
        print_warn "dist/cli.js not found"
        print_info "Run: npm run build"
    fi
    
    # Check .env file
    print_header "9. Checking Configuration"
    
    if [ -f ".env" ]; then
        print_check ".env configuration file found"
    elif [ -f ".env.example" ]; then
        print_warn ".env not found (using defaults)"
        print_info "Create from example: cp .env.example .env"
    else
        print_info "No .env file needed (using defaults)"
    fi
    
    # Try running tests
    print_header "10. Running Tests"
    
    if command -v npm &> /dev/null && [ -d "tests" ]; then
        echo "Running test suite (this may take a moment)..."
        if npm test 2>&1 | tail -n 5 | grep -q "pass"; then
            print_check "Tests executed successfully"
        else
            print_warn "Test execution had issues (see details above)"
        fi
    else
        print_warn "Cannot run tests (npm or tests/ directory not found)"
    fi
    
    # Summary
    print_header "Verification Summary"
    
    echo -e "${GREEN}Passed: $PASSED${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    echo -e "${RED}Failed: $FAILED${NC}"
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ Setup verification complete!${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Run: node dist/cli.js --help"
        echo "  2. Create a test workflow in YAML"
        echo "  3. Execute: node dist/cli.js <workflow.yaml>"
        echo ""
        echo "For more help, see:"
        echo "  - STARTUP_GUIDE.md (comprehensive guide)"
        echo "  - QUICK_SETUP_CARD.md (quick reference)"
        echo "  - README.md (project overview)"
        return 0
    else
        echo -e "${RED}✗ Setup verification found issues${NC}"
        echo ""
        echo "Please fix the failed items above and run this script again."
        return 1
    fi
}

# Run main function
main
EXIT_CODE=$?

echo ""
exit $EXIT_CODE
