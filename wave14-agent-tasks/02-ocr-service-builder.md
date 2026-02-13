# Agent 2: OCR Service Builder

## Role
Build the OCR document processing service that uses Claude Vision API for intelligent data extraction from invoices, receipts, bills, and other financial documents.

## Priority: WAVE 14 (After Agent 1 completes schema)

## Wait Condition
Check for `.agent-done-W14-01` marker file before starting.

## Files to CREATE

### 1. `server/src/services/ocr-processing.ts`
**Purpose**: Full OCR pipeline: upload, Vision API extraction, line item parsing, document classification
**Pattern**: Follow `server/src/services/pipeline.ts` (service class with async processing methods)

- [ ] Create `OCRProcessingService` class with the following methods:

#### Document Upload
- `uploadDocument(userId: string, file: File, accountId?: string): Promise<OCRDocument>`
  - Save file to `server/uploads/{userId}/{uuid}-{originalName}`
  - Create directory if not exists using `fs.mkdir` with `{ recursive: true }`
  - Insert record into `ocr_documents` table with status 'pending'
  - Validate mime type: accept 'application/pdf', 'image/png', 'image/jpeg', 'image/webp'
  - Validate file size: reject > 10MB
  - Return the created document record

#### Document Processing
- `processDocument(documentId: string): Promise<OCRDocument>`
  - Update status to 'processing'
  - Read file from disk as base64
  - Call Claude Vision API via Anthropic SDK:
    ```typescript
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: base64Data },
          },
          {
            type: 'text',
            text: `Extract all financial data from this document. Return a JSON object with:
            {
              "documentType": "invoice|receipt|bill|credit_note|statement|quote|purchase_order",
              "documentNumber": "string or null",
              "vendorName": "string or null",
              "vendorAbn": "string or null (11-digit ABN if visible)",
              "documentDate": "YYYY-MM-DD or null",
              "dueDate": "YYYY-MM-DD or null",
              "subtotal": number or null,
              "gstAmount": number or null,
              "totalAmount": number,
              "currency": "AUD",
              "lineItems": [
                {
                  "lineNumber": 1,
                  "description": "string",
                  "quantity": number,
                  "unitPrice": number or null,
                  "amount": number,
                  "gstAmount": number or null,
                  "gstInclusive": boolean
                }
              ],
              "confidence": 0.0-1.0
            }
            Return ONLY valid JSON, no markdown.`,
          },
        ],
      }],
    });
    ```
  - Parse JSON response (with try/catch for malformed JSON)
  - Update `ocr_documents` record with extracted fields
  - Insert line items into `ocr_line_items` table
  - Update status to 'extracted' (or 'failed' on error)
  - Set `processed_at` timestamp
  - Return updated document

#### Line Item Extraction
- `extractLineItems(documentId: string): Promise<OCRLineItem[]>`
  - Fetch existing line items from `ocr_line_items` table
  - If none exist, call `processDocument()` first
  - For each line item, attempt category mapping:
    - Match description against existing `merchant_memory` patterns
    - Fallback: use keyword matching against category names from categories.ts
  - Update `category` field on each line item
  - Return enriched line items

#### Document Classification
- `classifyDocument(documentId: string): Promise<string>`
  - If already classified (document_type is not 'unknown'), return existing type
  - Read file and send to Claude Vision with classification-specific prompt:
    ```
    Classify this financial document into exactly one of:
    invoice, receipt, bill, credit_note, statement, quote, purchase_order.
    Return only the classification word, nothing else.
    ```
  - Update document_type in `ocr_documents` table
  - Return classification

#### Batch Processing
- `processBatch(userId: string, documentIds: string[]): Promise<{ processed: number; failed: number; errors: string[] }>`
  - Process documents sequentially with 1-second delay between calls (rate limiting)
  - Track successes and failures
  - Return summary

#### Queue Management
- `enqueueDocument(documentId: string, action: string, priority?: number): Promise<void>`
  - Insert into `document_queue` table
  - Default priority: 100

- `processQueue(limit?: number): Promise<void>`
  - Fetch next `limit` (default 10) queued items ordered by priority ASC, scheduled_at ASC
  - For each: update status to 'processing', increment attempts, call appropriate handler
  - On success: status = 'completed', set completed_at
  - On failure: if attempts < max_attempts, status = 'queued' (retry); else status = 'failed'

#### Utility
- `getDocument(documentId: string): Promise<OCRDocument | null>`
- `listDocuments(userId: string, status?: string, documentType?: string): Promise<OCRDocument[]>`
- `deleteDocument(documentId: string): Promise<void>` -- remove file from disk + DB records

### 2. Type definitions at top of file:
```typescript
export interface OCRDocument {
  id: string;
  userId: string;
  accountId?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: string;
  documentNumber?: string;
  vendorName?: string;
  vendorAbn?: string;
  documentDate?: string;
  dueDate?: string;
  subtotal?: number;
  gstAmount?: number;
  totalAmount?: number;
  currency: string;
  extractedData?: any;
  confidenceScore: number;
  status: string;
  errorMessage?: string;
  processedAt?: string;
  createdAt: string;
}

export interface OCRLineItem {
  id: string;
  documentId: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unitPrice?: number;
  amount: number;
  gstAmount: number;
  gstInclusive: boolean;
  category?: string;
  accountCode?: string;
  confidenceScore: number;
}

export interface OCRExtractionResult {
  documentType: string;
  documentNumber?: string;
  vendorName?: string;
  vendorAbn?: string;
  documentDate?: string;
  dueDate?: string;
  subtotal?: number;
  gstAmount?: number;
  totalAmount: number;
  currency: string;
  lineItems: Array<{
    lineNumber: number;
    description: string;
    quantity: number;
    unitPrice?: number;
    amount: number;
    gstAmount?: number;
    gstInclusive: boolean;
  }>;
  confidence: number;
}
```

## Files to MODIFY
None -- standalone service file. Uses Anthropic SDK already imported in the project.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `OCRProcessingService` can be instantiated
- [ ] `uploadDocument()` saves file to disk and creates DB record
- [ ] `processDocument()` calls Claude Vision API and parses JSON response
- [ ] `extractLineItems()` returns line items with category mappings
- [ ] `classifyDocument()` returns valid document type
- [ ] `processBatch()` handles failures gracefully without crashing
- [ ] Queue processing respects priority and retry logic
- [ ] Create marker file: `.agent-done-W14-02`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W14-01`) -- schema tables must exist
- **Reuses**: Anthropic SDK (already configured in project), schema.ts (ocrDocuments, ocrLineItems, documentQueue), categories.ts, merchant_memory table
