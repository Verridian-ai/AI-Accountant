#!/bin/bash
# Agent 7: Open Banking & API Researcher

OUTPUT_DIR="$(dirname "$0")/../output"
REPORT="$OUTPUT_DIR/07_open_banking.json"

echo "╔══════════════════════════════════════════════╗"
echo "║  🏦 Agent 7: Open Banking & API Researcher   ║"
echo "╚══════════════════════════════════════════════╝"
echo "[$(date '+%H:%M:%S')] Researching Open Banking CDR and API opportunities..."

cat > "$REPORT" << 'EOF'
{
  "agent": "open-banking",
  "generated": "AUTO_TIMESTAMP",
  "cdr_analysis": {
    "what_is_cdr": "Consumer Data Right - Australia's Open Banking regime managed by ACCC",
    "current_status": "Live for Big 4 banks + most ADIs since July 2023",
    "data_available": [
      "Account balances and details",
      "Transaction history (up to 7 years)",
      "Direct debits and scheduled payments",
      "Payee information",
      "Product details and interest rates"
    ],
    "accreditation_levels": {
      "unrestricted": "Full ADR - can receive and use data (complex, 6-12 months)",
      "sponsored": "Use a sponsor ADR - faster path (2-3 months)",
      "representative": "Act under an existing ADR - fastest (1 month)"
    },
    "recommendation": "Partner with a CDR gateway provider (Basiq, Frollo, Adatree) rather than seeking own accreditation"
  },
  "api_integration_opportunities": [
    {
      "provider": "Basiq",
      "type": "CDR Gateway + Screen Scraping",
      "features": ["Transaction data via API", "Account linking", "Balance checks", "Income verification"],
      "pricing": "From $0.50/connection/month",
      "recommendation": "BEST FIT - Australian-focused, CDR-ready, easy integration"
    },
    {
      "provider": "Frollo",
      "type": "CDR-native Open Banking",
      "features": ["CDR data access", "Financial wellness tools", "Budgeting API", "PFM widgets"],
      "pricing": "Custom enterprise pricing",
      "recommendation": "Good for CDR-first approach, more expensive"
    },
    {
      "provider": "Plaid (AU)",
      "type": "Global financial data",
      "features": ["Transaction enrichment", "Identity verification", "Income verification"],
      "pricing": "Usage-based",
      "recommendation": "Limited AU coverage compared to Basiq"
    }
  ],
  "strategic_recommendation": {
    "phase_1": "Gmail auto-import (no external API dependency, immediate value)",
    "phase_2": "Basiq integration for live transaction feeds (replaces PDF parsing need)",
    "phase_3": "CDR accreditation for premium tier (direct bank API access)",
    "key_insight": "Gmail import is a bridge technology - CDR/Open Banking is the future but PDF parsing remains essential for historical data"
  }
}
EOF

sed -i "s/AUTO_TIMESTAMP/$(date -Iseconds)/" "$REPORT"
echo "[$(date '+%H:%M:%S')] ✅ Open Banking research complete"
sleep infinity
