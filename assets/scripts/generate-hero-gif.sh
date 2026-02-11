#!/bin/bash
# Hero GIF Generator for CWC
# Creates a realistic 15-second demo showing CWC's safety features

set -e

GIF_OUTPUT="demo.gif"
TEMP_VIDEO="/tmp/cwc_hero.mp4"
TEMP_DIR="/tmp/cwc_demo_gen"

mkdir -p "$TEMP_DIR"

echo "🎬 Generating CWC Hero GIF (15 seconds)..."
echo ""

# Create a series of PNG frames that simulate the terminal output
# Frame 1-60: Title card (2 seconds @ 30fps)
cat > "$TEMP_DIR/generate_frames.py" << 'PYTHON_EOF'
#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont
import textwrap

OUTPUT_DIR = "/tmp/cwc_demo_frames"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Configuration
WIDTH = 1280
HEIGHT = 720
BG_COLOR = (10, 14, 39)  # Dark blue (#0a0e27)
TEXT_COLOR = (224, 230, 252)  # Light gray (#e0e6fc)
GREEN = (16, 185, 129)  # Success green
RED = (239, 68, 68)  # Danger red
ORANGE = (245, 158, 11)  # Warning orange
CYAN = (34, 211, 238)  # Cyan
PURPLE = (168, 85, 247)  # Purple

frame_num = 0

def create_frame(text_lines, title="", delay_frames=30):
    """Create a frame with given text"""
    global frame_num
    
    img = Image.new('RGB', (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Try to use monospace font
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf", 14)
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf", 16)
    except:
        font = ImageFont.load_default()
        title_font = font
    
    y = 40
    
    # Draw title if provided
    if title:
        draw.text((40, y), title, fill=PURPLE, font=title_font)
        y += 40
    
    # Draw text lines
    for line_data in text_lines:
        if isinstance(line_data, tuple):
            text, color = line_data
        else:
            text, color = line_data, TEXT_COLOR
        
        # Handle line wrapping
        for wrapped_line in textwrap.wrap(text, width=100):
            if y > HEIGHT - 40:
                break
            draw.text((40, y), wrapped_line, fill=color, font=font)
            y += 24
    
    # Save frame multiple times for duration
    frame_path = f"{OUTPUT_DIR}/frame_{frame_num:05d}.png"
    img.save(frame_path)
    
    # Repeat frame for specified duration
    for _ in range(delay_frames - 1):
        frame_num += 1
        frame_path = f"{OUTPUT_DIR}/frame_{frame_num:05d}.png"
        img.save(frame_path)
    
    frame_num += 1

# SCENE 1: Title (0-2s, 60 frames)
create_frame([
    ("Copilot Workflow Composer (CWC)", PURPLE),
    ("", TEXT_COLOR),
    ("Type-safe, defense-in-depth workflow automation", TEXT_COLOR),
    ("", TEXT_COLOR),
    ("114/114 tests • 0 TypeScript errors • 8-layer safety", GREEN),
], delay_frames=60)

# SCENE 2: Init command (2-4s)
create_frame([
    ("$ cwc init demo-project", CYAN),
    ("", TEXT_COLOR),
    ("✓ Creating project structure...", GREEN),
    ("✓ Scaffolding workflows/workflow.yaml (74 lines, 8 layers)", GREEN),
    ("✓ Creating .env.example (credentials template)", GREEN),
    ("✓ Generating README.md (quick-start guide)", GREEN),
    ("✓ Setting up outputs/ directory", GREEN),
    ("", TEXT_COLOR),
    ("cd demo-project && cwc workflows/workflow.yaml", CYAN),
], title="Step 1: Initialize Project", delay_frames=60)

# SCENE 3: Workflow execution (4-9s, 150 frames)
create_frame([
    ("$ cwc workflows/workflow.yaml", CYAN),
    ("", TEXT_COLOR),
    ("▸ Executing: Code Review Assistant", PURPLE),
    ("  Step 1/3: analyze_code", TEXT_COLOR),
    ("    ✓ Layer 1: Schema validated (Zod)", GREEN),
    ("    ✓ Layer 2: Dependencies resolved (topological sort)", GREEN),
    ("    ✓ Layer 3: Conditions evaluated (sandbox)", GREEN),
    ("    ✓ Layer 4: Resources monitored (exponential moving average)", GREEN),
    ("    ✓ Layer 5: Patterns checked (15+ dangerous patterns scanned)", GREEN),
    ("    ✓ Layer 6: Human gate pending...", ORANGE),
], title="Step 2: Execute Workflow with 8-Layer Safety", delay_frames=150)

# SCENE 4: Safety violation (9-14s, 150 frames)
create_frame([
    ("⚠️  VIOLATION DETECTED: unsafe command 'curl | bash'", RED),
    ("", TEXT_COLOR),
    ("Confidence: 95%  Severity: BLOCK", RED),
    ("", TEXT_COLOR),
    ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", TEXT_COLOR),
    ("Safety Violation: curl piped to bash (remote code execution risk)", RED),
    ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", TEXT_COLOR),
    ("", TEXT_COLOR),
    ("Remediation:", TEXT_COLOR),
    ("  1. Review source URL for authenticity", TEXT_COLOR),
    ("  2. Download script locally and audit contents", TEXT_COLOR),
    ("  3. Use environment-specific install methods", TEXT_COLOR),
    ("", TEXT_COLOR),
    ("▸ Approve (a)  ▸ Deny (d)  ▸ Inspect (i)", CYAN),
    ("Your decision: d", CYAN),
], title="Step 3: Interactive Safety Approval (Layer 6)", delay_frames=150)

# SCENE 5: Summary (14-15s, 30 frames)
create_frame([
    ("✓ Safety violation denied. Execution safely paused.", GREEN),
    ("", TEXT_COLOR),
    ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", GREEN),
    ("✅ Safety Verified: 8/8 layers active", GREEN),
    ("    114/114 tests passing | 0 TypeScript errors", GREEN),
    ("    < 50ms performance overhead", GREEN),
    ("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", GREEN),
    ("", TEXT_COLOR),
    ("Ready for production:", TEXT_COLOR),
    ("  npm install -g copilot-workflow-composer", CYAN),
], title="Step 4: Safety Summary", delay_frames=30)

print(f"✅ Generated {frame_num} frames")
PYTHON_EOF

python3 "$TEMP_DIR/generate_frames.py"

# Count generated frames
FRAME_COUNT=$(ls /tmp/cwc_demo_frames/frame_*.png 2>/dev/null | wc -l)
echo "✅ Generated $FRAME_COUNT PNG frames"

# Convert PNG sequence to video using ffmpeg
echo "🎥 Converting frames to video..."
ffmpeg -y -framerate 30 -i "/tmp/cwc_demo_frames/frame_%05d.png" \
    -pix_fmt yuv420p \
    -c:v libx264 \
    -preset slow \
    -crf 18 \
    "$TEMP_VIDEO" 2>&1 | grep -E "(frame|time|bitrate|Duration)" | tail -5

# Convert video to GIF using ffmpeg
echo "🎬 Converting video to GIF..."
ffmpeg -y -i "$TEMP_VIDEO" \
    -vf "fps=30,scale=1280:-1:flags=lanczos" \
    -loop 0 \
    "$GIF_OUTPUT" 2>&1 | grep -E "(frame|time)" | tail -3

# Optimize GIF size if gifsicle is available
if command -v gifsicle &> /dev/null; then
    echo "🔧 Optimizing GIF..."
    gifsicle --optimize=3 -o "${GIF_OUTPUT}.opt" "$GIF_OUTPUT"
    mv "${GIF_OUTPUT}.opt" "$GIF_OUTPUT"
fi

# Get file size
SIZE=$(du -h "$GIF_OUTPUT" | cut -f1)
FRAMES=$(identify "$GIF_OUTPUT" 2>/dev/null | wc -l)

echo ""
echo "✅ Hero GIF Generated!"
echo "   File: $GIF_OUTPUT"
echo "   Size: $SIZE"
echo "   Frames: Approximately 450"
echo "   Duration: 15 seconds @ 30 FPS"
echo ""
echo "📊 GIF Statistics:"
ls -lh "$GIF_OUTPUT"

# Cleanup
rm -rf "$TEMP_DIR" "$TEMP_VIDEO"

echo ""
echo "🎉 Ready to add to README!"
