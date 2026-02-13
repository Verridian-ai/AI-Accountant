# Agent 7: API Endpoints Builder

## Role
Wire 18 new API routes in server/src/index.ts for OCR document processing, payment matching, match rules, and match statistics.

## Priority: WAVE 14 (After Agents 2, 3 complete)

## Wait Condition
Check for `.agent-done-W14-02` and `.agent-done-W14-03` marker files before starting.

## File to MODIFY

### `server/src/index.ts`
**Current state**: ~4,707+ lines (grows with Wave 13 additions)
**Insert location**: After the Wave 13 routes (reports/budgets/forecasts), before the claude-agents mount section

- [ ] Add imports for 2 new services after existing imports:
```typescript
import { OCRProcessingService } from './services/ocr-processing.js';
import { PaymentMatchingService } from './services/payment-matching.js';
```

- [ ] Instantiate 2 services after existing service instantiation:
```typescript
const ocrService = new OCRProcessingService();
const matchingService = new PaymentMatchingService();
```

### OCR Document Routes (8 endpoints)

- [ ] `POST /api/documents/upload` -- Upload a document for OCR processing
  - Multipart form data: `file` (the document), `userId`, `accountId` (optional)
  - Handler: Parse multipart body, call `ocrService.uploadDocument(userId, file, accountId)`
  - Return: created document record with status 'pending'

- [ ] `POST /api/documents/:id/process` -- Process a document with OCR
  - Handler: `ocrService.processDocument(id)`
  - Return: updated document with extracted data

- [ ] `POST /api/documents/:id/classify` -- Classify document type
  - Handler: `ocrService.classifyDocument(id)`
  - Return: `{ documentType: string }`

- [ ] `GET /api/documents/:id/line-items` -- Get extracted line items
  - Handler: `ocrService.extractLineItems(id)`
  - Return: array of line items with categories

- [ ] `GET /api/documents` -- List documents for user
  - Query params: `userId`, `status` (optional), `documentType` (optional)
  - Handler: `ocrService.listDocuments(userId, status, documentType)`

- [ ] `GET /api/documents/:id` -- Get document details
  - Handler: `ocrService.getDocument(id)`

- [ ] `DELETE /api/documents/:id` -- Delete document and file
  - Handler: `ocrService.deleteDocument(id)`

- [ ] `POST /api/documents/batch-process` -- Process multiple documents
  - Body: `{ userId: string, documentIds: string[] }`
  - Handler: `ocrService.processBatch(userId, documentIds)`
  - Return: `{ processed: number, failed: number, errors: string[] }`

### Payment Matching Routes (7 endpoints)

- [ ] `GET /api/matches/candidates/:documentId` -- Find match candidates for a document
  - Query params: `amountTolerance`, `dateTolerance`, `limit`
  - Handler: `matchingService.findMatchCandidates(documentId, options)`
  - Return: array of candidates sorted by score DESC

- [ ] `POST /api/matches/score` -- Score a specific document-transaction pair
  - Body: `{ documentId: string, transactionId: string }`
  - Handler: Fetch document and transaction, call `matchingService.scoreMatch(doc, tx)`
  - Return: detailed match score with per-factor breakdown

- [ ] `POST /api/matches/auto` -- Run auto-matching for all unmatched documents
  - Body: `{ userId: string, autoMatchThreshold?: number, suggestThreshold?: number }`
  - Handler: `matchingService.autoMatch(userId, options)`
  - Return: `{ matched, suggested, unmatched, details }`

- [ ] `PATCH /api/matches/:id/confirm` -- Confirm a suggested match
  - Body: `{ confirmedBy?: string }`
  - Handler: `matchingService.confirmMatch(id, confirmedBy)`
  - Trigger: `matchingService.learnFromConfirmation(id)` asynchronously
  - Return: updated match record

- [ ] `PATCH /api/matches/:id/reject` -- Reject a suggested match
  - Body: `{ reason?: string }`
  - Handler: `matchingService.rejectMatch(id, reason)`
  - Return: updated match record

- [ ] `GET /api/matches/stats` -- Get matching statistics
  - Query params: `userId`
  - Handler: `matchingService.getMatchStats(userId)`
  - Return: stats object with totals, rates, top vendors, rule effectiveness

- [ ] `POST /api/matches/:matchId/learn` -- Manually trigger pattern learning from a match
  - Handler: `matchingService.learnFromConfirmation(matchId)`
  - Return: `{ learned: true }`

### Match Rules Routes (3 endpoints)

- [ ] `POST /api/match-rules` -- Create a matching rule
  - Body: `{ userId, name, ruleType, vendorPattern?, amountExact?, amountMin?, amountMax?, amountTolerance?, dateToleranceDays?, categoryFilter?, priority? }`
  - Handler: `matchingService.createRule(userId, params)`
  - Return: created rule record

- [ ] `GET /api/match-rules` -- List matching rules
  - Query params: `userId`, `isActive` (optional boolean)
  - Handler: `matchingService.listRules(userId, isActive)`

- [ ] `DELETE /api/match-rules/:id` -- Delete a matching rule
  - Handler: `matchingService.deleteRule(id)`

### Route Pattern (follow existing pattern from server/src/index.ts):
```typescript
app.post('/api/documents/upload', async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body['file'];
        const userId = (body['userId'] as string) ?? 'default';
        const accountId = body['accountId'] as string | undefined;
        if (!file || typeof file === 'string') {
            return c.json({ error: 'File is required' }, 400);
        }
        const result = await ocrService.uploadDocument(userId, file as File, accountId);
        return c.json(result);
    } catch (err) {
        console.error('Document upload failed:', err);
        return c.json({ error: 'Failed to upload document' }, 500);
    }
});

app.get('/api/matches/candidates/:documentId', async (c) => {
    try {
        const documentId = c.req.param('documentId');
        const amountTolerance = parseFloat(c.req.query('amountTolerance') ?? '0.01');
        const dateTolerance = parseInt(c.req.query('dateTolerance') ?? '7');
        const limit = parseInt(c.req.query('limit') ?? '10');
        const candidates = await matchingService.findMatchCandidates(documentId, {
            amountTolerance, dateTolerance, limit,
        });
        return c.json(candidates);
    } catch (err) {
        console.error('Match candidate search failed:', err);
        return c.json({ error: 'Failed to find match candidates' }, 500);
    }
});
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 18 routes are accessible (test with curl after Docker rebuild)
- [ ] No route path conflicts with existing routes (check for `/api/documents/`, `/api/matches/`, `/api/match-rules/`)
- [ ] File upload endpoint handles multipart correctly
- [ ] Auto-match endpoint returns summary with counts
- [ ] Match confirm/reject update status correctly
- [ ] Create marker file: `.agent-done-W14-07`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W14-02`), Agent 3 (`.agent-done-W14-03`)
- **IMPORTANT**: Only this agent modifies server/src/index.ts during Wave 14
