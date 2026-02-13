# Agent 3: Bank Reconciliation Engine Builder

## Role
Build the automated bank reconciliation service with multi-strategy matching, confidence scoring, session management, and configurable matching rules.

## Priority: WAVE 11 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/bank-reconciliation.ts`
**Purpose**: Auto-matching engine that reconciles bank transactions against ledger entries with confidence scoring
**Pattern**: Follow `server/src/services/accounts.ts` — export singleton, Drizzle queries
**Reference**: Schema tables `bankReconSessions`, `bankReconMatches`, `bankReconRules`, `transactions`, `journalEntries`, `journalEntryLines` from `schema.ts`

- [ ] Create `BankReconciliationService` class with the following methods:

#### Session Management
- [ ] `startSession(userId: string, accountId: string, periodStart: string, periodEnd: string, statementBalanceCents?: number): Promise<BankReconSession>` — Create new reconciliation session:
  1. Generate UUID
  2. Query transactions for the account in date range to get `totalUnmatched` count
  3. Calculate `ledgerBalanceCents` from journal entries for the account
  4. Set `differenceCents = statementBalanceCents - ledgerBalanceCents` (if provided)
  5. Insert into `bank_recon_sessions` with status='open'

- [ ] `getSession(sessionId: string, userId: string): Promise<BankReconSession & { matches: BankReconMatch[] }>` — Get session with all matches

- [ ] `listSessions(userId: string, filters?: { accountId?: string; status?: string }): Promise<BankReconSession[]>` — List user's sessions

- [ ] `completeSession(sessionId: string, userId: string): Promise<BankReconSession>` — Set status='completed', set completedAt, compute final stats (totalMatched, totalUnmatched)

- [ ] `abandonSession(sessionId: string, userId: string): Promise<void>` — Set status='abandoned', undo all pending matches

#### Auto-Matching Engine
- [ ] `autoMatch(sessionId: string, userId: string): Promise<{ matched: number; suggested: number; unmatched: number }>` — Main auto-matching pipeline:
  1. Load all unmatched bank transactions for the session's account and date range
  2. Load all unmatched ledger entries (journal_entry_lines) for the same period
  3. For each bank transaction, run all active match rules in priority order:
     - **amount_exact**: Match where `|bank.amount - ledger.amount| == 0`
     - **amount_date**: Match where amounts equal AND dates within `date_window_days` (default 3)
     - **reference_number**: Match where bank description contains ledger reference string
     - **description_pattern**: Match where bank description matches configured regex pattern
     - **combined**: Weighted score combining amount proximity (40%), date proximity (30%), description similarity (30%)
  4. For each potential match, compute confidence score (0-1):
     - `>= 0.95` → auto-confirm (insert as match_type='auto', status='confirmed')
     - `>= 0.70` → suggest (insert as match_type='suggested', status='pending')
     - `< 0.70` → skip (leave as unmatched)
  5. Update session stats (autoMatched, totalMatched, totalUnmatched)
  6. Return counts

- [ ] `suggestMatches(sessionId: string, bankTransactionId: string): Promise<Array<{ ledgerEntryId: string; confidence: number; matchReasons: string[] }>>` — For a specific unmatched bank transaction, return top 5 candidate ledger entries ranked by confidence

#### Match Scoring Functions (private)
- [ ] `private scoreAmountMatch(bankAmountCents: number, ledgerAmountCents: number, toleranceCents: number): number` — Returns 0-1 score: 1.0 if exact, linearly decreasing to 0 at tolerance boundary
- [ ] `private scoreDateMatch(bankDate: string, ledgerDate: string, windowDays: number): number` — Returns 0-1 score: 1.0 if same day, linearly decreasing to 0 at window boundary
- [ ] `private scoreDescriptionMatch(bankDescription: string, ledgerReference: string): number` — Levenshtein distance normalized to 0-1 score, with bonus for exact substring match
- [ ] `private scoreCombined(amountScore: number, dateScore: number, descriptionScore: number, weights: { amount: number; date: number; description: number }): number` — Weighted sum

#### Match Operations
- [ ] `confirmMatch(matchId: string, userId: string): Promise<BankReconMatch>` — Set status='confirmed', confirmedBy, confirmedAt; update session stats
- [ ] `rejectMatch(matchId: string, userId: string): Promise<void>` — Set status='rejected'
- [ ] `undoMatch(matchId: string, userId: string): Promise<void>` — Set status='undone'; decrement session match counts
- [ ] `createManualMatch(sessionId: string, bankTransactionId: string, ledgerEntryId: string, userId: string): Promise<BankReconMatch>` — Insert match_type='manual', confidence=1.0, status='confirmed'

#### Rule Management
- [ ] `getMatchRules(userId: string): Promise<BankReconRule[]>` — List all rules for user, ordered by priority
- [ ] `createMatchRule(userId: string, data: { name: string; description?: string; matchType: string; matchConfig: object; autoConfirm?: boolean; priority?: number }): Promise<BankReconRule>` — Insert new rule, validate matchType is one of the 5 types
- [ ] `updateMatchRule(ruleId: string, userId: string, updates: Partial<...>): Promise<BankReconRule>` — Update rule
- [ ] `deleteMatchRule(ruleId: string, userId: string): Promise<void>` — Soft-delete (set isActive=false)
- [ ] `seedDefaultRules(userId: string): Promise<void>` — Create 3 default rules if none exist: amount_exact (priority=100, autoConfirm=true), amount_date (priority=90), combined (priority=50)

#### Helper Utilities
- [ ] `private levenshteinDistance(a: string, b: string): number` — Standard Levenshtein distance implementation
- [ ] `private normalizeDescription(desc: string): string` — Lowercase, strip whitespace, remove common bank prefixes (EFTPOS, DIRECT DEBIT, etc.)

- [ ] Export singleton: `export const bankReconciliationService = new BankReconciliationService();`

#### Helper imports
```typescript
import { db, bankReconSessions, bankReconMatches, bankReconRules, transactions, journalEntries, journalEntryLines } from '../schema.js';
import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import type { BankReconSession, BankReconMatch, BankReconRule } from '../schema.js';
```

## Files to MODIFY

*None* — this is a standalone service file.

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `BankReconciliationService.startSession()` creates a valid session
- [ ] `BankReconciliationService.autoMatch()` correctly matches transactions with exact amounts
- [ ] `BankReconciliationService.suggestMatches()` returns ranked candidates
- [ ] `BankReconciliationService.confirmMatch()` updates match status and session stats
- [ ] `BankReconciliationService.undoMatch()` reverses a confirmed match
- [ ] `BankReconciliationService.seedDefaultRules()` creates 3 default matching rules
- [ ] Score functions return values between 0 and 1
- [ ] Create marker file: `.agent-done-W11-03`

## Dependencies
- **None** — can start immediately (uses schema types that Agent 1 creates, but can define local types as fallback)
- **Reuses**: schema.ts (bankReconSessions, bankReconMatches, bankReconRules, transactions, journalEntries), drizzle-orm
