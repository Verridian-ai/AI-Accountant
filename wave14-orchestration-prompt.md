# Wave 14 — AI Document Processing & Payment Matching — Orchestration Prompt

You are the **Team Lead** for Wave 14: AI Document Processing & Payment Matching. You coordinate 10 specialized agents to add AI-powered OCR for receipt/invoice scanning and an intelligent payment matching engine.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts`

## Current State (After Wave 13)
- 19 Claude agents
- Financial reporting and budgeting modules operational
- Invoices (Wave 7) and Bills (Wave 10) available for matching
- 15 migrations (0009–0025) applied

## Dependencies
- **Requires**: Wave 7 (invoices) and Wave 10 (bills) for matching targets
- **Estimated Complexity**: MEDIUM-HIGH

## Database Schema Changes

### New Tables (5 tables)
| Table | Columns |
|-------|---------|
| `ocr_documents` | id, userId, fileName, fileType (pdf/jpg/png), filePath, fileSize, status (pending/processing/completed/failed), documentType (receipt/invoice/bill/statement), extractedData (JSON), confidence, processedAt, uploadedAt |
| `ocr_line_items` | id, documentId, description, quantity, unitPrice, amount, gstAmount, category, confidence |
| `payment_match_rules` | id, userId, ruleType (amount_exact/amount_tolerance/reference/date_range/combined), priority, tolerance, isActive |
| `payment_matches` | id, transactionId, matchedType (invoice/bill/ocr_document), matchedId, matchScore, matchMethod (auto/suggested/manual), status (pending/confirmed/rejected), matchedAt |
| `document_queue` | id, userId, documentId, queueType (ocr/categorize/match), status (queued/processing/completed/failed), retryCount, errorMessage, createdAt, processedAt |

**Migration**: `docker/migrations/0026_ai_ocr_payment_matching.sql`

## API Endpoints (18 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/ocr/upload | Upload document for OCR |
| POST | /api/ocr/batch-upload | Batch upload multiple documents |
| GET | /api/ocr/documents | List processed documents |
| GET | /api/ocr/documents/:id | Get OCR result with line items |
| POST | /api/ocr/documents/:id/reprocess | Re-run OCR on document |
| POST | /api/ocr/documents/:id/confirm | Confirm OCR extraction |
| PATCH | /api/ocr/documents/:id/correct | Manual correction of OCR data |
| GET | /api/matching/suggestions | Get match suggestions for unmatched transactions |
| POST | /api/matching/auto-match | Run auto-matching engine |
| POST | /api/matching/confirm | Confirm a suggested match |
| POST | /api/matching/reject | Reject a suggested match |
| POST | /api/matching/manual | Create manual match |
| GET | /api/matching/rules | List matching rules |
| POST | /api/matching/rules | Create matching rule |
| PATCH | /api/matching/rules/:id | Update matching rule |
| GET | /api/matching/stats | Match rate statistics |
| GET | /api/documents/queue | Document processing queue status |
| POST | /api/documents/queue/retry | Retry failed documents |

## UI Components
### `client/src/features/documents/` — New feature folder
- DocumentUploader.tsx — Drag-and-drop upload with preview
- DocumentList.tsx — Processed documents with status badges
- OCRResultViewer.tsx — Side-by-side: original image + extracted data
- OCRCorrection.tsx — Manual correction editor for OCR results
- DocumentQueue.tsx — Processing queue with status and retry

### `client/src/features/matching/` — New feature folder
- MatchingDashboard.tsx — Overview: match rate, unmatched count, suggestions
- MatchSuggestions.tsx — Ranked suggestions with confidence scores
- MatchRuleEditor.tsx — Matching rule configuration
- UnmatchedTransactions.tsx — List of transactions needing matches
- MatchHistory.tsx — Confirmed match history with audit trail

**Navigation**: Add `documents` to TabId type

## New Claude Agents (2)
1. **`ocr_processing_agent`** — Processes uploaded images/PDFs, extracts structured data (vendor, date, amounts, line items, GST), classifies document type. Uses Claude Vision API. Tools: `extract_document_data`, `classify_document`, `extract_line_items`, `validate_extraction`.
2. **`payment_matching_agent`** — Matches bank transactions to invoices/bills/receipts using amount, date, reference, and AI reasoning. Tools: `find_match_candidates`, `score_match`, `apply_matching_rules`, `learn_matching_pattern`.

## Cognee Integration
- **New datasets**: `ocr_extractions`, `matching_patterns`
- Index OCR results for "Find all receipts from Officeworks"
- Index matching patterns for improved auto-matching over time
- Use `CHUNKS_LEXICAL` for reference number matching
- Use `GRAPH_COMPLETION` for complex multi-transaction matching

## Testing Criteria
- [ ] Upload receipt image, OCR extracts vendor + date + amount
- [ ] Upload invoice PDF, OCR extracts line items with GST
- [ ] Batch upload processes 10 documents concurrently
- [ ] Auto-match: exact amount + date within 3 days → confidence > 90%
- [ ] Auto-match: reference number match → confidence > 95%
- [ ] Suggested matches ranked by confidence descending
- [ ] Manual match overrides auto-match
- [ ] Match rate statistics accurate
- [ ] Failed OCR can be retried via queue
- [ ] Chat answers "What receipts did I upload this month?"
- [ ] `cd server && npx tsc --noEmit` passes clean

## Debate Findings Applied (D01–D05)

| Finding | Source | Resolution |
|---------|--------|------------|
| OCR upload path traversal risk | D02 API-03 | MANDATORY: Generate server-side UUIDs for filenames. Store in flat directory. Validate file type via magic bytes (not just extension). Block path separators in uploaded filenames |
| OCR batch upload takes 60-600s — must be async | D03 §4.1 | ALL OCR endpoints (POST /api/ocr/upload, /api/ocr/batch-upload) MUST return jobId immediately and process in background. Limit to 3 concurrent Claude Vision calls |
| File size limits needed | D03 §Wave14 | Max 10MB per document, 50MB per batch. Reject oversized files with 413 status |
| Uploaded documents must be encrypted at rest | D02 FIN-02 | Store uploaded files with 0600 permissions. Use randomly-generated filenames (UUID), never user-controlled names |
| Wave 14 data dependency only on Waves 7+10, not 11-13 | D04 D01 | Clarified: Wave 14's true data dependency is Waves 7 (invoices) and 10 (bills) for matching targets. The "After Wave 13" current state describes sequential ordering, not hard data dependency. Wave 14 CAN run in parallel with Waves 11-13 if only data dependencies are honored |
| Dual schema rule reminder | D04 S02 | ENFORCED: Every table in BOTH schema.ts AND postgres-schema.ts |

## Team Structure — 10 Agents

### Agent 1: ocr-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave14-agent-tasks/01-ocr-schema-builder.md`

### Agent 2: ocr-service-builder [PRIORITY: WAVE 1]
**Task file**: `wave14-agent-tasks/02-ocr-service-builder.md`
**Creates**: server/src/services/ocr-processing.ts

### Agent 3: matching-engine-builder [PRIORITY: WAVE 1]
**Task file**: `wave14-agent-tasks/03-matching-engine-builder.md`
**Creates**: server/src/services/payment-matching.ts

### Agent 4: ocr-agent-builder [DEPENDS ON: Agent 2]
**Task file**: `wave14-agent-tasks/04-ocr-agent-builder.md`
**Creates**: server/src/services/claude/agents/ocr-processing-agent.ts

### Agent 5: matching-agent-builder [DEPENDS ON: Agent 3]
**Task file**: `wave14-agent-tasks/05-matching-agent-builder.md`
**Creates**: server/src/services/claude/agents/payment-matching-agent.ts

### Agent 6: cognee-datasets-builder [DEPENDS ON: Agent 1]
**Task file**: `wave14-agent-tasks/06-cognee-datasets-builder.md`

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5]
**Task file**: `wave14-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: ui-documents-builder [DEPENDS ON: Agent 7]
**Task file**: `wave14-agent-tasks/08-ui-documents-builder.md`

### Agent 9: ui-matching-builder [DEPENDS ON: Agent 7]
**Task file**: `wave14-agent-tasks/09-ui-matching-builder.md`

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave14-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7
Sub-wave 4 (After 3):  Agent 8 + Agent 9
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave14-agent-tasks/`.
