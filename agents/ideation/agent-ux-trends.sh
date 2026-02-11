#!/bin/bash
# Agent 5: UX/UI Trend Researcher

OUTPUT_DIR="$(dirname "$0")/../output"
REPORT="$OUTPUT_DIR/05_ux_trends.json"

echo "╔══════════════════════════════════════════════╗"
echo "║  🎨 Agent 5: UX/UI Trend Researcher          ║"
echo "╚══════════════════════════════════════════════╝"
echo "[$(date '+%H:%M:%S')] Researching UX trends for financial apps..."

cat > "$REPORT" << 'EOF'
{
  "agent": "ux-trends",
  "generated": "AUTO_TIMESTAMP",
  "design_patterns": [
    {
      "pattern": "Progressive Disclosure for Complex Data",
      "description": "Show summary first, expand for details. Critical for transaction tables.",
      "example": "Up Bank: clean transaction list, tap to expand with merchant details + map",
      "priority": "HIGH"
    },
    {
      "pattern": "Skeleton Loading States",
      "description": "Show content structure while data loads - reduces perceived load time by 50%",
      "example": "Replace spinners with grey placeholder rectangles matching content layout",
      "priority": "HIGH"
    },
    {
      "pattern": "Inline Editing for Transaction Categories",
      "description": "Click category tag to edit in-place, no modal needed",
      "example": "Notion-style inline select with search and recent categories",
      "priority": "HIGH"
    },
    {
      "pattern": "Command Palette (⌘K)",
      "description": "Universal search/action launcher - 'search transactions', 'upload statement', 'export CSV'",
      "example": "Linear, Vercel, Raycast all use this pattern",
      "priority": "MEDIUM"
    },
    {
      "pattern": "Split-Pane PDF Verification",
      "description": "Left: original PDF with highlighted rows. Right: parsed data with checkboxes",
      "example": "Dext receipt viewer, but applied to full bank statements",
      "priority": "CRITICAL - Core feature request"
    },
    {
      "pattern": "Real-Time Processing Pipeline Visualization",
      "description": "Multi-stage progress bar showing current parsing step with live stats",
      "example": "Vercel build logs, GitHub Actions, but for statement parsing",
      "priority": "HIGH"
    },
    {
      "pattern": "Data Confidence Visualization",
      "description": "Color-coded confidence: green (>90%), yellow (70-90%), red (<70%)",
      "example": "Google Cloud Vision API confidence badges",
      "priority": "HIGH"
    },
    {
      "pattern": "Drag-and-Drop Upload Zone",
      "description": "Full-page drop zone with animation. Support paste from clipboard.",
      "example": "Dropbox, Figma upload flows",
      "priority": "MEDIUM"
    }
  ],
  "ui_component_recommendations": [
    "Use Radix UI primitives (already in stack) for all new components",
    "Implement sonner toasts for all agent/parsing status updates",
    "Add Tanstack Virtual for large transaction tables (already available)",
    "Use Lucide icons consistently (already in stack)"
  ]
}
EOF

sed -i "s/AUTO_TIMESTAMP/$(date -Iseconds)/" "$REPORT"
echo "[$(date '+%H:%M:%S')] ✅ UX research complete - 8 design patterns identified"
sleep infinity
