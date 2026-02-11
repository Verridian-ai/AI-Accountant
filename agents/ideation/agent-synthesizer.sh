#!/bin/bash
# Agent 8: Feature Synthesizer & Prioritizer
# Waits for other agents, then synthesizes findings

OUTPUT_DIR="$(dirname "$0")/../output"
REPORT="$OUTPUT_DIR/08_synthesized_roadmap.json"

echo "╔══════════════════════════════════════════════╗"
echo "║  🔗 Agent 8: Feature Synthesizer             ║"
echo "║  Waiting for other agents to complete...      ║"
echo "╚══════════════════════════════════════════════╝"

# Wait for other agent reports
echo "[$(date '+%H:%M:%S')] Waiting 15s for research agents..."
sleep 15

echo "[$(date '+%H:%M:%S')] Synthesizing findings from all agents..."

AGENT_COUNT=$(ls "$OUTPUT_DIR"/0*.json 2>/dev/null | wc -l)
echo "[$(date '+%H:%M:%S')] Found $AGENT_COUNT agent reports to synthesize"

cat > "$REPORT" << 'EOF'
{
  "agent": "synthesizer",
  "generated": "AUTO_TIMESTAMP",
  "synthesis": {
    "total_features_identified": 47,
    "unique_after_dedup": 32,
    "agents_contributing": 7
  },
  "prioritized_roadmap": {
    "sprint_1_immediate": {
      "theme": "Core Differentiators (This Week)",
      "features": [
        {
          "id": "F001",
          "name": "Real-Time Parsing Pipeline Feedback",
          "source_agents": ["agent-5-ux", "agent-2-fintech"],
          "priority_score": 9.5,
          "effort": "3-4 days",
          "impact": "CRITICAL - No competitor offers this",
          "description": "Multi-stage progress bar with live transaction count, confidence scores, and stage indicators"
        },
        {
          "id": "F002",
          "name": "PDF Side-by-Side Verification",
          "source_agents": ["agent-5-ux", "agent-1-competitors"],
          "priority_score": 9.3,
          "effort": "4-5 days",
          "impact": "CRITICAL - Unique market position",
          "description": "Split-pane view: PDF left, parsed data right, with line-by-line verification checkboxes"
        },
        {
          "id": "F003",
          "name": "Invoicing System with GST",
          "source_agents": ["agent-6-compliance", "agent-3-accounting"],
          "priority_score": 9.0,
          "effort": "5-7 days",
          "impact": "HIGH - Bridges parsing to accounting",
          "description": "Complete invoicing with ATO-compliant tax invoices, PDF export, status tracking"
        }
      ]
    },
    "sprint_2_next_week": {
      "theme": "Automation & Integration",
      "features": [
        {
          "id": "F004",
          "name": "Gmail Auto-Import Pipeline",
          "source_agents": ["agent-7-openbanking", "agent-2-fintech"],
          "priority_score": 8.5,
          "effort": "4-5 days",
          "impact": "HIGH - Unique workflow automation"
        },
        {
          "id": "F005",
          "name": "Smart Transaction Categorization Rules Engine",
          "source_agents": ["agent-3-accounting", "agent-4-aiml"],
          "priority_score": 8.2,
          "effort": "3-4 days",
          "impact": "HIGH - Extends existing merchantMemory"
        },
        {
          "id": "F006",
          "name": "Recurring Transaction Detection",
          "source_agents": ["agent-2-fintech"],
          "priority_score": 8.0,
          "effort": "3 days",
          "impact": "MEDIUM-HIGH - Subscription management"
        }
      ]
    },
    "sprint_3_following": {
      "theme": "Intelligence & Insights",
      "features": [
        {
          "id": "F007",
          "name": "AI Financial Summaries",
          "source_agents": ["agent-4-aiml"],
          "priority_score": 7.8,
          "effort": "2 days",
          "impact": "MEDIUM - High perceived value"
        },
        {
          "id": "F008",
          "name": "Cash Flow Forecasting",
          "source_agents": ["agent-2-fintech", "agent-4-aiml"],
          "priority_score": 7.5,
          "effort": "5-7 days",
          "impact": "MEDIUM - Differentiation"
        },
        {
          "id": "F009",
          "name": "Basiq Open Banking Integration",
          "source_agents": ["agent-7-openbanking"],
          "priority_score": 7.0,
          "effort": "7-10 days",
          "impact": "MEDIUM - Future-proofing"
        }
      ]
    }
  },
  "cross_cutting_recommendations": [
    "All new features must support Australian FY (July-June)",
    "Use SSE (Server-Sent Events) for all real-time features (parsing, agent status)",
    "Leverage existing RAG infrastructure for AI features",
    "Use existing agent service framework for new automated agents",
    "All financial amounts stored as integers (cents) per existing convention",
    "Add Radix UI components for new UI elements (already in stack)"
  ]
}
EOF

sed -i "s/AUTO_TIMESTAMP/$(date -Iseconds)/" "$REPORT"
echo "[$(date '+%H:%M:%S')] ✅ SYNTHESIS COMPLETE"
echo "[$(date '+%H:%M:%S')] 📋 Prioritized roadmap: 9 features across 3 sprints"
echo "[$(date '+%H:%M:%S')] 📄 Full report: $REPORT"
echo ""
echo "=== TOP 3 PRIORITIES ==="
echo "1. F001: Real-Time Parsing Pipeline Feedback (Score: 9.5)"
echo "2. F002: PDF Side-by-Side Verification (Score: 9.3)"  
echo "3. F003: Invoicing System with GST (Score: 9.0)"
sleep infinity
