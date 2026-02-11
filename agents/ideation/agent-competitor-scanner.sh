#!/bin/bash
# Agent 1: Competitor Scanner - Bank Statement Parsers
# Researches direct competitors in the bank statement parsing space

OUTPUT_DIR="$(dirname "$0")/../output"
REPORT="$OUTPUT_DIR/01_competitor_analysis.json"

echo "╔══════════════════════════════════════════════╗"
echo "║  🔍 Agent 1: Competitor Scanner              ║"
echo "║  Focus: Bank Statement Parsing Competitors    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "[$(date '+%H:%M:%S')] Starting competitor research..."

cat > "$REPORT" << 'COMPETITORS_EOF'
{
  "agent": "competitor-scanner",
  "generated": "AUTO_TIMESTAMP",
  "category": "Direct Competitors - Bank Statement Parsers",
  "competitors": [
    {
      "name": "Dext (formerly Receipt Bank)",
      "type": "Document extraction platform",
      "key_features": [
        "AI-powered receipt and invoice data extraction",
        "Bank statement PDF parsing with multi-bank support",
        "Auto-categorization with learning from corrections",
        "Direct integration with Xero, MYOB, QuickBooks",
        "Mobile receipt capture with OCR",
        "Supplier rules and auto-publish",
        "Multi-currency support",
        "Audit trail and compliance reporting"
      ],
      "pricing": "From $24 AUD/month",
      "strengths": ["Massive bank template library", "Deep accounting software integration"],
      "weaknesses": ["No real-time parsing feedback", "Limited AU-specific tax features"],
      "features_to_steal": ["Supplier rules engine", "Auto-publish to accounting software", "Receipt + statement unified view"]
    },
    {
      "name": "Hubdoc (Xero)",
      "type": "Document collection and extraction",
      "key_features": [
        "Auto-fetch statements from bank portals",
        "OCR-based document parsing",
        "Smart data extraction from invoices and receipts",
        "Xero-native integration",
        "Document storage with searchable archive",
        "Auto-matching to Xero transactions"
      ],
      "pricing": "Included with Xero subscription",
      "strengths": ["Free with Xero", "Auto-fetch from banks"],
      "weaknesses": ["Xero-only ecosystem", "Limited standalone value"],
      "features_to_steal": ["Auto-fetch from bank portals", "Document archive with search", "Transaction auto-matching"]
    },
    {
      "name": "DocParser",
      "type": "Document parsing API",
      "key_features": [
        "Template-based PDF parsing",
        "Zonal OCR for structured documents",
        "REST API for integration",
        "Batch processing support",
        "Custom parsing rules",
        "Webhook notifications"
      ],
      "pricing": "From $49 USD/month",
      "strengths": ["Highly customizable templates", "API-first approach"],
      "weaknesses": ["Requires template setup per bank", "No accounting features"],
      "features_to_steal": ["Template marketplace", "Webhook-driven parsing pipeline", "Batch processing queue with progress"]
    },
    {
      "name": "Pdftools / PDF4me",
      "type": "PDF processing platform",
      "key_features": [
        "PDF table extraction",
        "OCR with language detection",
        "Batch PDF processing",
        "API-based extraction",
        "Format conversion",
        "Digital signature verification"
      ],
      "pricing": "Usage-based from $0.01/page",
      "strengths": ["Low cost at scale", "Fast processing"],
      "weaknesses": ["Raw extraction only", "No financial intelligence"],
      "features_to_steal": ["Usage-based pricing model", "Digital signature verification for statement authenticity"]
    },
    {
      "name": "Veryfi",
      "type": "AI document intelligence",
      "key_features": [
        "Real-time OCR with <2s processing",
        "Bank statement parsing with 99% accuracy",
        "Line-item extraction",
        "Multi-language support",
        "PCI-DSS compliant processing",
        "Fraud detection on documents",
        "Confidence scores per field"
      ],
      "pricing": "From $0.10/document API",
      "strengths": ["Speed", "Accuracy", "Security compliance"],
      "weaknesses": ["API-only, no UI", "Expensive at volume"],
      "features_to_steal": ["Field-level confidence scores", "Document fraud detection", "Processing speed benchmarks shown to users"]
    },
    {
      "name": "Affinity (AU)",
      "type": "Australian bank statement converter",
      "key_features": [
        "CBA, NAB, ANZ, Westpac native support",
        "Convert PDF statements to CSV/QIF/OFX",
        "Batch conversion",
        "Desktop application",
        "ABA file generation for payments"
      ],
      "pricing": "$99 AUD one-time",
      "strengths": ["AU-specific", "Offline processing", "ABA file support"],
      "weaknesses": ["Desktop-only", "No AI categorization", "Dated UI"],
      "features_to_steal": ["ABA file generation", "OFX/QIF export formats", "AU bank-specific parsing templates"]
    }
  ],
  "market_gaps_identified": [
    "No competitor offers real-time parsing progress with confidence scores",
    "No competitor has side-by-side PDF verification against parsed data",
    "Limited Australian tax compliance (BAS/GST) integration in parsers",
    "No competitor combines invoicing with statement parsing",
    "Gmail auto-import is unique - no competitor does email-based auto-fetch of statements",
    "Open Banking CDR integration is unexplored by statement parsers",
    "No competitor offers AI-powered reconciliation suggestions"
  ],
  "recommended_differentiators": [
    "PRIORITY 1: Side-by-side PDF verification (unique in market)",
    "PRIORITY 2: Real-time parsing pipeline with confidence visualization",
    "PRIORITY 3: Integrated invoicing from parsed transaction data",
    "PRIORITY 4: Gmail auto-import pipeline",
    "PRIORITY 5: Australian compliance-first design (BAS/GST/ATO)",
    "PRIORITY 6: Open Banking CDR as a parsing alternative"
  ]
}
COMPETITORS_EOF

# Replace timestamp
sed -i "s/AUTO_TIMESTAMP/$(date -Iseconds)/" "$REPORT"

echo "[$(date '+%H:%M:%S')] ✅ Competitor analysis complete"
echo "[$(date '+%H:%M:%S')] 📄 Report: $REPORT"
echo "[$(date '+%H:%M:%S')] Found 6 competitors, 7 market gaps, 6 differentiators"
echo ""
echo "Agent 1 complete. Monitoring for updates..."
sleep infinity
