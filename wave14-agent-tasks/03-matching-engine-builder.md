# Agent 3: Matching Engine Builder

## Role
Build the payment matching engine that finds, scores, and confirms matches between OCR-extracted documents and bank transactions. Supports rule-based, AI-assisted, and manual matching.

## Priority: WAVE 14 (After Agents 1 and 2 complete)

## Wait Condition
Check for `.agent-done-W14-01` and `.agent-done-W14-02` marker files before starting.

## Files to CREATE

### 1. `server/src/services/payment-matching.ts`
**Purpose**: Multi-strategy payment matching engine with scoring, learning, and statistics
**Pattern**: Follow `server/src/services/bas.ts` (service class with Drizzle queries)

- [ ] Create `PaymentMatchingService` class with the following methods:

#### Match Candidate Discovery
- `findMatchCandidates(documentId: string, options?: MatchOptions): Promise<MatchCandidate[]>`
  - Fetch OCR document by ID (total_amount, vendor_name, document_date)
  - Query `transactions` table for potential matches using multi-pass strategy:
    1. **Exact amount match**: transactions where `ABS(amount) = document.totalAmount` within `amountTolerance` (default $0.01)
    2. **Date range filter**: transactions within `dateTolerance` days (default 7) of document_date
    3. **Vendor name match**: transactions where description LIKE `%vendorName%` (fuzzy)
    4. **Category match**: if document has classified line items, filter by matching categories
  - Combine results, deduplicate by transaction_id
  - Score each candidate via `scoreMatch()`
  - Sort by score DESC
  - Return top 10 candidates
  - Options: `{ amountTolerance?: number, dateTolerance?: number, minScore?: number, limit?: number }`

#### Match Scoring
- `scoreMatch(document: OCRDocument, transaction: Transaction): MatchScore`
  - Calculate composite score (0.0 - 1.0) from weighted factors:
    - **Amount match (40% weight)**: `1.0 - (ABS(doc.totalAmount - ABS(tx.amount)) / doc.totalAmount)` clamped to [0, 1]
    - **Date proximity (25% weight)**: `1.0 - (daysDifference / maxDateTolerance)` clamped to [0, 1]
    - **Vendor similarity (20% weight)**: Levenshtein-based similarity between doc.vendorName and tx.description, or 0.5 if no vendor name
    - **Rule bonus (15% weight)**: 1.0 if a matching rule exists and fires, 0.0 otherwise
  - Return: `{ overallScore, factors: { amount, date, vendor, rule }, amountDifference, dateDifference }`

#### String Similarity (internal utility)
- `private calculateSimilarity(a: string, b: string): number`
  - Normalize: lowercase, trim, remove common prefixes ("payment to", "direct debit", etc.)
  - Token overlap: count shared words / max(words_a, words_b)
  - Substring match bonus: +0.2 if a contains b or b contains a
  - Return score between 0.0 and 1.0

#### Auto-Matching
- `autoMatch(userId: string, options?: AutoMatchOptions): Promise<AutoMatchResult>`
  - Fetch all unmatched documents (status = 'extracted') for user
  - For each document:
    1. Find candidates via `findMatchCandidates()`
    2. If top candidate score >= `autoMatchThreshold` (default 0.85): create confirmed match
    3. If top candidate score >= `suggestThreshold` (default 0.60): create suggested match
    4. Otherwise: skip (no match)
  - Apply matching rules first (higher priority)
  - Update document status to 'matched' for confirmed matches
  - Return: `{ matched: number, suggested: number, unmatched: number, details: MatchDetail[] }`
  - Options: `{ autoMatchThreshold?: number, suggestThreshold?: number, applyRules?: boolean }`

#### Match Confirmation
- `confirmMatch(matchId: string, confirmedBy?: string): Promise<PaymentMatch>`
  - Update match status to 'confirmed'
  - Set confirmed_by and confirmed_at
  - Update document status to 'matched'
  - If rule_id exists, increment match_count on the rule
  - Return updated match

- `rejectMatch(matchId: string, reason?: string): Promise<PaymentMatch>`
  - Update match status to 'rejected'
  - Set notes to reason
  - Reset document status to 'extracted' (available for re-matching)
  - Return updated match

#### Rule Management
- `createRule(userId: string, params: CreateRuleParams): Promise<PaymentMatchRule>`
  - Insert into `payment_match_rules` table
  - Validate: amount_exact or (amount_min + amount_max) must be set for amount rules
  - Return created rule

- `listRules(userId: string, isActive?: boolean): Promise<PaymentMatchRule[]>`
  - Order by priority ASC (lower = higher priority)

- `updateRule(ruleId: string, updates: Partial<PaymentMatchRule>): Promise<PaymentMatchRule>`

- `deleteRule(ruleId: string): Promise<void>`

- `applyRules(documentId: string): Promise<MatchCandidate | null>`
  - Fetch active rules for user, ordered by priority
  - For each rule, check if document matches:
    - `exact_amount`: doc.totalAmount within rule.amount_tolerance of rule.amount_exact
    - `amount_range`: doc.totalAmount between rule.amount_min and rule.amount_max
    - `vendor_match`: doc.vendorName matches rule.vendor_pattern (substring or regex)
    - `recurring`: check if similar document matched in previous months
    - `composite`: all conditions must match
  - Return first matching candidate with rule_id set, or null

#### Match Learning
- `learnFromConfirmation(matchId: string): Promise<void>`
  - After a match is confirmed, analyze the pattern
  - If same vendor + similar amount matched 3+ times: auto-create a matching rule
  - Set rule_type to 'recurring', vendor_pattern to vendor name, amount to average of matched amounts
  - Log: "Auto-created matching rule for {vendorName}"

#### Statistics
- `getMatchStats(userId: string): Promise<MatchStats>`
  - Total documents: count all ocr_documents for user
  - Matched: count where status = 'matched'
  - Pending: count where status in ('pending', 'processing', 'extracted')
  - Match rate: matched / total * 100
  - Average confidence: avg(match_score) of confirmed matches
  - Top vendors: most frequently matched vendor names
  - Rule effectiveness: each rule's match_count and last_matched_at
  - Return structured stats object

### 2. Type definitions at top of file:
```typescript
export interface MatchCandidate {
  transactionId: string;
  transactionDate: string;
  transactionDescription: string;
  transactionAmount: number;
  score: MatchScore;
  ruleId?: string;
}

export interface MatchScore {
  overallScore: number;
  factors: {
    amount: number;
    date: number;
    vendor: number;
    rule: number;
  };
  amountDifference: number;
  dateDifference: number;
}

export interface AutoMatchResult {
  matched: number;
  suggested: number;
  unmatched: number;
  details: Array<{
    documentId: string;
    status: 'matched' | 'suggested' | 'unmatched';
    matchId?: string;
    topScore?: number;
  }>;
}

export interface MatchStats {
  totalDocuments: number;
  matched: number;
  pending: number;
  failed: number;
  matchRate: number;
  averageConfidence: number;
  topVendors: Array<{ name: string; count: number }>;
  ruleEffectiveness: Array<{ ruleId: string; name: string; matchCount: number; lastMatched?: string }>;
}

export interface CreateRuleParams {
  name: string;
  ruleType: 'exact_amount' | 'amount_range' | 'vendor_match' | 'recurring' | 'composite';
  vendorPattern?: string;
  amountExact?: number;
  amountMin?: number;
  amountMax?: number;
  amountTolerance?: number;
  dateToleranceDays?: number;
  categoryFilter?: string;
  priority?: number;
}

export interface MatchOptions {
  amountTolerance?: number;
  dateTolerance?: number;
  minScore?: number;
  limit?: number;
}

export interface AutoMatchOptions {
  autoMatchThreshold?: number;
  suggestThreshold?: number;
  applyRules?: boolean;
}
```

## Files to MODIFY
None -- standalone service file.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `PaymentMatchingService` can be instantiated
- [ ] `findMatchCandidates()` returns candidates sorted by score DESC
- [ ] `scoreMatch()` returns composite score between 0.0 and 1.0
- [ ] Score weights sum to 1.0 (0.40 + 0.25 + 0.20 + 0.15)
- [ ] `autoMatch()` respects threshold settings
- [ ] `confirmMatch()` updates both match and document status
- [ ] `rejectMatch()` resets document to 'extracted'
- [ ] `learnFromConfirmation()` creates rules after 3+ similar matches
- [ ] `getMatchStats()` returns accurate counts
- [ ] Create marker file: `.agent-done-W14-03`

## Dependencies
- **Requires**: Agent 1 (`.agent-done-W14-01`), Agent 2 (`.agent-done-W14-02`)
- **Reuses**: schema.ts (ocrDocuments, paymentMatches, paymentMatchRules, transactions), OCRProcessingService types
