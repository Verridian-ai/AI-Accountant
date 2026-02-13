# Agent 4: OCR Agent Builder

## Role
Build the `ocr_processing` Claude agent with tools for extracting document data, classifying documents, extracting line items, and validating extractions.

## Priority: WAVE 14 (After Agents 1 and 2 complete)

## Wait Condition
Check for `.agent-done-W14-01` and `.agent-done-W14-02` marker files before starting.

## Files to CREATE

### 1. `server/src/services/claude/agents/ocr-processing.ts`
**Purpose**: AI agent that orchestrates OCR processing with intelligent extraction, classification, and validation
**Pattern**: Follow `server/src/services/claude/agents/tax-strategy.ts` exactly (extends ClaudeAgent)

- [ ] Create `OCRProcessingAgent extends ClaudeAgent<OCRProcessingInput, OCRProcessingOutput>` with:

#### System Prompt
```
You are an expert document processing agent for an Australian small business accounting platform.
You extract, classify, and validate financial documents including invoices, receipts, bills, and credit notes.

Key responsibilities:
- Extract all financial data from documents with high accuracy
- Classify documents into correct types (invoice, receipt, bill, etc.)
- Extract individual line items with descriptions, quantities, and amounts
- Validate extracted data for consistency (line items sum to subtotal, subtotal + GST = total)
- Identify and flag potential extraction errors or inconsistencies
- Handle Australian-specific formats: ABN (11 digits), GST (10%), AUD currency
- Recognize common Australian vendors and their document formats

Quality rules:
- Always validate GST: if GST-registered (ABN present), GST should be ~10% of subtotal
- Line items should sum to subtotal within $0.01 tolerance
- Dates should be in YYYY-MM-DD format
- ABN format: XX XXX XXX XXX (11 digits, may appear with or without spaces)
```

#### Tools (4 total)

##### `extract_document_data`
- **Description**: Extract all financial data from an uploaded document using Vision API
- **Input schema**: `{ documentId: string }`
- **Handler**: Call `ocrService.processDocument(documentId)`
- **Returns**: Full extraction result with document metadata, amounts, vendor info, and line items

##### `classify_document`
- **Description**: Classify a document into a specific financial document type
- **Input schema**: `{ documentId: string }`
- **Handler**: Call `ocrService.classifyDocument(documentId)`
- **Returns**: Document type classification with confidence

##### `extract_line_items`
- **Description**: Extract and categorize individual line items from a document
- **Input schema**: `{ documentId: string }`
- **Handler**: Call `ocrService.extractLineItems(documentId)`
- **Returns**: Array of line items with descriptions, amounts, GST, and category mappings

##### `validate_extraction`
- **Description**: Validate extracted data for mathematical consistency and completeness
- **Input schema**: `{ documentId: string }`
- **Handler**:
  1. Fetch document and line items from DB
  2. Run validation checks:
    - `lineItemsSum`: sum of line item amounts vs subtotal (tolerance $0.01)
    - `gstCalculation`: GST should be ~10% of subtotal if vendor is GST-registered
    - `totalCheck`: subtotal + GST = total (tolerance $0.01)
    - `dateValidity`: document_date is valid ISO date, due_date >= document_date
    - `abnFormat`: if ABN present, is exactly 11 digits
    - `requiredFields`: documentType, totalAmount, at least 1 line item
  3. Return validation result:
    ```typescript
    {
      isValid: boolean,
      checks: Array<{ name: string, passed: boolean, expected?: any, actual?: any, message?: string }>,
      warnings: string[],
      suggestedFixes: Array<{ field: string, currentValue: any, suggestedValue: any, reason: string }>
    }
    ```
- **Returns**: Validation report with pass/fail per check and suggested fixes

#### Tool Handler Wiring
```typescript
import { OCRProcessingService } from '../../ocr-processing.js';

const ocrService = new OCRProcessingService();

// In tool handler switch:
case 'extract_document_data':
  return await ocrService.processDocument(input.documentId);
case 'classify_document':
  return await ocrService.classifyDocument(input.documentId);
case 'extract_line_items':
  return await ocrService.extractLineItems(input.documentId);
case 'validate_extraction':
  return await validateExtraction(input.documentId); // local helper function
```

## Files to MODIFY

### 2. `server/src/services/claude/types.ts` (AgentType union)
**BEFORE** (after Agent 4/5 of Wave 13 adds financial_reporting and budgeting):
```typescript
export type AgentType =
  // ... existing entries
  | 'budgeting';
```
**AFTER**:
```typescript
export type AgentType =
  // ... existing entries
  | 'budgeting'
  | 'ocr_processing'
  | 'payment_matching';
```

- [ ] Add 2 new AgentType entries: `'ocr_processing'` and `'payment_matching'`
- [ ] Add 4 new I/O interfaces:
```typescript
export interface OCRProcessingInput {
  documentId: string;
  action: 'extract' | 'classify' | 'extract_line_items' | 'validate';
}

export interface OCRProcessingOutput {
  document?: any;
  lineItems?: any[];
  classification?: string;
  validation?: {
    isValid: boolean;
    checks: Array<{ name: string; passed: boolean; message?: string }>;
    warnings: string[];
    suggestedFixes: any[];
  };
}

export interface PaymentMatchingInput {
  documentId?: string;
  userId?: string;
  action: 'find_candidates' | 'score_match' | 'apply_rules' | 'learn_pattern';
  transactionId?: string;
}

export interface PaymentMatchingOutput {
  candidates?: any[];
  score?: any;
  matchResult?: any;
  learnedPattern?: any;
}
```

### 3. `server/src/services/claude/config.ts`
- [ ] Add `ocr_processing` entry to `AGENT_TOKEN_BUDGETS`:
  ```typescript
  ocr_processing: {
    maxInputTokens: 100_000,
    maxOutputTokens: 8_000,
    maxToolCalls: 10,
    warningThresholdPercent: 80,
  },
  ```
- [ ] Add `payment_matching` entry to `AGENT_TOKEN_BUDGETS`:
  ```typescript
  payment_matching: {
    maxInputTokens: 50_000,
    maxOutputTokens: 4_000,
    maxToolCalls: 12,
    warningThresholdPercent: 80,
  },
  ```
- [ ] Add 2 entries to `AGENT_MODELS`:
  ```typescript
  ocr_processing: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
  payment_matching: 'claude-haiku-4-5-20251001',
  ```

### 4. `server/src/services/claude/orchestrator.ts`
- [ ] Add import: `import { OCRProcessingAgent } from './agents/ocr-processing.js';`
- [ ] Add import for types: `OCRProcessingInput`, `OCRProcessingOutput`
- [ ] Register agent in the agent registry

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `OCRProcessingAgent` can be instantiated
- [ ] All 4 tools are registered with valid input schemas
- [ ] `validate_extraction` checks mathematical consistency of extracted amounts
- [ ] Agent type 'ocr_processing' appears in types.ts, config.ts, and orchestrator.ts
- [ ] Create marker file: `.agent-done-W14-04`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W14-01`), Agent 2 (`.agent-done-W14-02`)
- **Reuses**: base-agent.ts, ocr-processing.ts, types.ts, config.ts, orchestrator.ts
- **Coordinate with**: Agent 5 on types.ts and config.ts modifications (both add to same union type)
