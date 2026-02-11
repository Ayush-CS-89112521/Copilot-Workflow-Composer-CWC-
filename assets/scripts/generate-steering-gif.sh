#!/bin/bash
# Steering Demo Generator - Python + VHS Support
# Primary: Python PIL-based static image (no dependencies)
# Optional: VHS-based animated GIF (use with --vhs flag)
# Usage: ./generate-steering-gif.sh [--vhs]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_GENERATOR="${SCRIPT_DIR}/generate-steering-demo.py"
TAPE_FILE="${SCRIPT_DIR}/steering-demo.tape"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🎛️  Steering Demo Generator${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Check if --vhs flag is passed
if [ "$1" = "--vhs" ]; then
    echo -e "${YELLOW}Using VHS mode (requires vhs, ffmpeg, gifsicle)${NC}"
    echo ""
    
    if ! command -v vhs &> /dev/null; then
        echo -e "${YELLOW}❌ vhs not found${NC}"
        echo -e "${BLUE}Install from: https://github.com/charmbracelet/vhs${NC}"
        echo ""
        echo -e "${YELLOW}💡 FASTER ALTERNATIVE:${NC}"
        echo "   Run without --vhs flag to generate static PNG:"
        echo "   ./generate-steering-gif.sh"
        exit 1
    fi
    
    echo -e "${YELLOW}1️⃣  Generating from VHS tape...${NC}"
    cd "$SCRIPT_DIR"
    vhs < "$TAPE_FILE" || {
        echo -e "${YELLOW}⚠️  VHS generation failed${NC}"
        echo -e "${BLUE}Using Python fallback...${NC}"
        python3 "$PYTHON_GENERATOR"
        exit $?
    }
    
    if [ -f "output.gif" ]; then
        mv output.gif steering-demo.gif
        SIZE=$(du -h steering-demo.gif | cut -f1)
        echo -e "${GREEN}✅ GIF generated: steering-demo.gif (${SIZE})${NC}"
    fi
else
    # Use Python generator (default, no dependencies)
    echo -e "${YELLOW}Using Python generator (no external dependencies)${NC}"
    echo ""
    
    if ! command -v python3 &> /dev/null; then
        echo -e "${YELLOW}❌ Python 3 not found${NC}"
        exit 1
    fi
    
    python3 "$PYTHON_GENERATOR"
fi

echo ""
echo -e "${BLUE}✨ Demo generation complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. View: open steering-demo.{png,gif}"
echo "  2. Add to README: ![Steering Demo](steering-demo.png)"
echo "  3. Commit: git add steering-demo.*"
echo "  4. Push: git push origin main"
echo ""
