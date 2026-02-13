# Agent 10: Testing & Validation Agent

## Role
Run the full verification plan for Wave 14 AI Document Processing & Payment Matching. Verify OCR extraction accuracy, match scoring correctness, batch processing reliability, and end-to-end workflow.

## Priority: WAVE 14 FINAL (After ALL Wave 14 agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-W14-01` through `.agent-done-W14-09` before starting.

## Verification Tasks

### 1. Compilation
- [ ] Run `cd server && npx tsc --noEmit` -- zero errors
- [ ] Run `cd client && npx tsc --noEmit` -- zero errors
- [ ] Run `docker compose config` -- validates without errors

### 2. Schema & Migration
- [ ] Run migration 0026 against DB:
  ```bash
  docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0026_ocr_payment_matching.sql
  ```
- [ ] Verify 5 new tables exist:
  ```bash
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt ocr_documents"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt ocr_line_items"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt payment_match_rules"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt payment_matches"
  docker compose exec postgres psql -U app_user -d ai_accountant -c "\dt document_queue"
  ```
- [ ] Verify foreign keys are valid:
  ```bash
  docker compose exec postgres psql -U app_user -d ai_accountant -c "SELECT conname, conrelid::regclass, confrelid::regclass FROM pg_constraint WHERE contype = 'f' AND conrelid::regclass::text LIKE 'ocr_%' OR conrelid::regclass::text LIKE 'payment_%' OR conrelid::regclass::text = 'document_queue';"
  ```
- [ ] Verify CHECK constraints on status and type columns
- [ ] Verify CASCADE delete: deleting an ocr_document removes its line items

### 3. OCR Document Upload
- [ ] Upload a test PDF:
  ```bash
  curl -X POST localhost:3501/api/documents/upload \
    -F "file=@statements/test-invoice.pdf" \
    -F "userId=default"
  ```
  (Use any available PDF from `./statements/` directory)
- [ ] Verify: document record created with status 'pending'
- [ ] Verify: file saved to `server/uploads/default/` directory
- [ ] Verify: mimeType correctly detected
- [ ] Verify: fileSize matches actual file size

### 4. OCR Processing
- [ ] Process the uploaded document:
  ```bash
  curl -X POST localhost:3501/api/documents/{id}/process
  ```
- [ ] Verify: status updated to 'extracted' (or 'failed' with error message)
- [ ] Verify: extracted fields populated (documentType, vendorName, totalAmount at minimum)
- [ ] Verify: confidenceScore is between 0.0 and 1.0
- [ ] Verify: extractedData contains full JSON payload
- [ ] Verify: processedAt timestamp is set

### 5. Line Item Extraction
- [ ] Fetch line items:
  ```bash
  curl localhost:3501/api/documents/{id}/line-items
  ```
- [ ] Verify: at least 1 line item returned
- [ ] Verify: each line item has description, amount, lineNumber
- [ ] Verify: line items sum approximately equals document subtotal (within $0.01)
- [ ] Verify: GST amounts are reasonable (~10% of subtotal for GST-registered vendors)

### 6. Document Classification
- [ ] Classify document:
  ```bash
  curl -X POST localhost:3501/api/documents/{id}/classify
  ```
- [ ] Verify: returns valid document type (invoice, receipt, bill, credit_note, statement, quote, purchase_order)

### 7. Match Candidate Discovery
- [ ] Find match candidates (requires existing transactions in DB):
  ```bash
  curl "localhost:3501/api/matches/candidates/{documentId}?amountTolerance=1.00&dateTolerance=30"
  ```
- [ ] Verify: returns array of candidates (may be empty if no transactions match)
- [ ] Verify: each candidate has transactionId, score.overallScore between 0.0-1.0
- [ ] Verify: candidates sorted by score.overallScore DESC
- [ ] Verify: score factors sum weights: 0.40 + 0.25 + 0.20 + 0.15 = 1.00

### 8. Match Scoring
- [ ] Score a specific pair (use a known transaction ID):
  ```bash
  curl -X POST localhost:3501/api/matches/score \
    -H "Content-Type: application/json" \
    -d '{"documentId":"{docId}","transactionId":"{txId}"}'
  ```
- [ ] Verify: overallScore between 0.0 and 1.0
- [ ] Verify: individual factor scores between 0.0 and 1.0
- [ ] Verify: amountDifference = |doc.totalAmount - |tx.amount||
- [ ] Verify: dateDifference >= 0 (absolute days)

### 9. Auto-Matching
- [ ] Run auto-match:
  ```bash
  curl -X POST localhost:3501/api/matches/auto \
    -H "Content-Type: application/json" \
    -d '{"userId":"default","autoMatchThreshold":0.85,"suggestThreshold":0.60}'
  ```
- [ ] Verify: returns { matched, suggested, unmatched } counts
- [ ] Verify: matched + suggested + unmatched = total unmatched documents
- [ ] Verify: matched documents have status 'matched'
- [ ] Verify: suggested matches have status 'suggested'

### 10. Match Confirmation & Rejection
- [ ] Confirm a suggested match:
  ```bash
  curl -X PATCH localhost:3501/api/matches/{matchId}/confirm \
    -H "Content-Type: application/json" \
    -d '{"confirmedBy":"test-agent"}'
  ```
- [ ] Verify: match status = 'confirmed', confirmedAt is set
- [ ] Verify: associated document status = 'matched'

- [ ] Reject a match:
  ```bash
  curl -X PATCH localhost:3501/api/matches/{matchId}/reject \
    -H "Content-Type: application/json" \
    -d '{"reason":"Wrong transaction"}'
  ```
- [ ] Verify: match status = 'rejected', notes contains reason
- [ ] Verify: associated document status reset to 'extracted'

### 11. Matching Rules
- [ ] Create a rule:
  ```bash
  curl -X POST localhost:3501/api/match-rules \
    -H "Content-Type: application/json" \
    -d '{"userId":"default","name":"Test Rule","ruleType":"vendor_match","vendorPattern":"TELSTRA","amountTolerance":1.00,"dateToleranceDays":14,"priority":50}'
  ```
- [ ] Verify: rule created with all fields
- [ ] List rules: `curl "localhost:3501/api/match-rules?userId=default"` -- verify test rule appears
- [ ] Delete rule: `curl -X DELETE localhost:3501/api/match-rules/{ruleId}`

### 12. Match Statistics
- [ ] Fetch stats:
  ```bash
  curl "localhost:3501/api/matches/stats?userId=default"
  ```
- [ ] Verify: totalDocuments >= 0
- [ ] Verify: matchRate = matched / totalDocuments * 100 (or 0 if no documents)
- [ ] Verify: averageConfidence between 0.0 and 1.0 (or 0 if no matches)
- [ ] Verify: topVendors is array with name and count

### 13. Batch Processing
- [ ] Upload 3 documents, then batch process:
  ```bash
  curl -X POST localhost:3501/api/documents/batch-process \
    -H "Content-Type: application/json" \
    -d '{"userId":"default","documentIds":["{id1}","{id2}","{id3}"]}'
  ```
- [ ] Verify: returns { processed, failed, errors }
- [ ] Verify: processed + failed = 3
- [ ] Verify: failed documents have error messages

### 14. Agent Registration
- [ ] Verify 2 new agents in types.ts: `ocr_processing`, `payment_matching`
- [ ] Verify 2 new entries in config.ts `AGENT_TOKEN_BUDGETS`
- [ ] Verify 2 new entries in config.ts `AGENT_MODELS` (ocr_processing = Sonnet, payment_matching = Haiku)
- [ ] Verify 2 new imports in orchestrator.ts

### 15. Cognee Datasets
- [ ] Verify `COGNEE_DATASETS` has 17 entries (15 from Wave 13 + 2 new: ocrExtractions, matchingPatterns)
- [ ] Verify 2 new indexing helpers exist on CogneeTools class
- [ ] Verify 2 new search helpers exist on CogneeTools class
- [ ] Verify batch indexing method exists

### 16. Frontend
- [ ] Navigate to Documents tab -- DocumentsDashboard renders
- [ ] Navigate to Matching tab -- MatchingDashboard renders
- [ ] Documents: upload area accepts drag-and-drop files
- [ ] Documents: viewer shows extracted data and line items
- [ ] Matching: review panel shows two-column layout with candidates
- [ ] Matching: rule manager allows CRUD operations
- [ ] Matching: auto-match shows results with threshold controls
- [ ] Matching: statistics show charts and counts
- [ ] Styling matches existing components (dark theme, gold #FFCC00 accents, neu-raised/neu-inset)

### 17. Generate Verification Report
```
GOLDLEDGER WAVE 14 VERIFICATION REPORT
=======================================
Date: [timestamp]
Schema:           [PASS/FAIL] - 5 tables created, FK valid, CASCADE works
OCR Upload:       [PASS/FAIL] - file saved, record created
OCR Processing:   [PASS/FAIL] - Vision API extraction works
Line Items:       [PASS/FAIL] - items extracted, sums match
Classification:   [PASS/FAIL] - valid document type returned
Match Discovery:  [PASS/FAIL] - candidates scored and sorted
Match Scoring:    [PASS/FAIL] - factors weighted correctly
Auto-Match:       [PASS/FAIL] - thresholds respected
Confirm/Reject:   [PASS/FAIL] - status transitions correct
Rules:            [PASS/FAIL] - CRUD works
Statistics:       [PASS/FAIL] - accurate counts
Batch Process:    [PASS/FAIL] - handles failures gracefully
Agents:           [PASS/FAIL] - 2 new agents registered
Cognee:           [PASS/FAIL] - 2 new datasets configured
Frontend:         [PASS/FAIL] - 10 components render
Build:            [PASS/FAIL] - server + client compile clean
```

- [ ] Create marker file: `.agent-done-W14-10`

## Dependencies
- **Requires**: ALL Wave 14 agents (`.agent-done-W14-01` through `.agent-done-W14-09`)
- **Docker must be running**: `docker compose up -d`
- **Requires ANTHROPIC_API_KEY**: OCR processing uses Claude Vision API
