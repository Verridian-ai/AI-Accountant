# Parser Correctness & Determinism Audit

**Auditor:** Teammate 3 — Parser Correctness & Determinism Engineer
**Date:** 2026-02-11
**Scope:** All bank parsers, format parsers, credit card parsers, detector, registry, pipeline integration

---

## Executive Summary

The parser subsystem is architecturally sound with a well-designed base class hierarchy, registry pattern, and multi-tier fallback pipeline. However, the audit reveals **17 issues** across correctness, determinism, and provenance categories. The CBA parser is the only parser with production-grade, battle-tested parsing logic; the remaining 7 bank parsers are structural clones with generic regex patterns unlikely to survive contact with real PDF text. There are **no provenance fields** (parser_version, extraction_hash, statement_id binding) anywhere in the parser output.

### Severity Summary
| Severity | Count | Description |
|----------|-------|-------------|
| CRITICAL | 3 | Data correctness risks, silent data loss |
| HIGH     | 6 | Determinism violations, sign convention bugs |
| MEDIUM   | 5 | Edge case failures, detection ambiguity |
| LOW      | 3 | Missing provenance, minor UX issues |

---

## 1. Bank Parser Audit

### 1.1 CBA Parser (`banks/cba.ts`)

**Status: Production-grade for CBA Business Transaction Account statements**

#### Strengths
- Sophisticated multi-line transaction parsing handling CBA's unusual pdf-parse output format (`:96-:418`)
- Balance continuity self-correction algorithm at `:403-:416` — recalculates amounts from balance deltas when regex extraction fails
- Extensive skippable-line detection (`:232-:257`) prevents false positive transactions
- Year inference from statement period (`:176-:184`) handles fiscal year boundaries

#### Issues

**[CBA-1] CRITICAL — `new Date().getFullYear()` fallback introduces non-determinism**
`cba.ts:265` — When no statement period is found, `statementYear` defaults to `new Date().getFullYear()`. This means the same PDF parsed on different dates can produce different transaction dates. A statement from Dec 2024 parsed on Jan 1 2025 vs Dec 31 2024 may assign different years.
```typescript
const statementYear = period?.startYear || new Date().getFullYear();
```

**[CBA-2] HIGH — Debit fallback regex too aggressive**
`cba.ts:130` — The fallback regex `(\d{1,3}\.\d{2})$` matches the last decimal number, which is intended for cases where reference numbers are concatenated. But for amounts like `$1,372.76` where the comma is already stripped, this would extract `372.76` instead of `1372.76`. The balance-continuity correction at `:403-:416` mitigates this, but only when the previous transaction's balance is correct — the first transaction after an opening balance has no correction.

**[CBA-3] MEDIUM — CR/DR suffix on opening/closing balance is optional**
`cba.ts:456-:463` — The regex captures an optional CR/DR suffix. If absent, the balance is treated as unsigned. For overdrawn accounts (DR balance), this would produce the wrong sign. The `parseAmount` function would return a positive number when it should be negative.

**[CBA-4] LOW — `rawAmount` loses sign information**
`cba.ts:377` — `rawAmount: String(Math.abs(ab.amount))` discards sign, making audit trail reconstruction harder.

---

### 1.2 ANZ Parser (`banks/anz.ts`)

**Status: Structural scaffold, not battle-tested**

**[ANZ-1] HIGH — Sign convention ambiguity for single-amount column**
`anz.ts:148-:162` — When there are 3 values, the parser assumes debit/credit/balance columns. When 2 values, it's amount/balance. But `parseAmount` in `base-parser.ts:118-:151` only applies sign when CR/DR suffix or parentheses are present. For ANZ statements using negative signs for debits (common), the sign is preserved correctly. But for statements using separate debit/credit columns without CR/DR suffixes, the debit amount parsed by `parseAmount` returns a positive number, and the `debit && debit !== 0 ? -Math.abs(debit) : credit ?? 0` logic at `:154` negates it. **Problem:** If both debit and credit columns contain non-zero values (which shouldn't happen but can in malformed PDF extraction), the credit is silently discarded.

**[ANZ-2] MEDIUM — Transaction section detection won't end**
`anz.ts:101-:106` — The `Closing Balance` / `Total` detection uses `continue` instead of `break` or setting `inTransactionSection = false`. This means lines after the closing balance that happen to match the transaction regex will still be parsed (e.g., footer dates could produce phantom transactions).

---

### 1.3 Westpac Parser (`banks/westpac.ts`)

**Status: Structural scaffold, mirrors ANZ approach**

**[WPC-1] HIGH — Same section-end bug as ANZ**
`westpac.ts:98-:103` — Closing/Total line detection uses `continue` instead of terminating the section. Same issue as ANZ-2.

**[WPC-2] MEDIUM — Regex allows empty amount captures**
`westpac.ts:128` — The regex pattern uses `(-?\$?[\d,]+\.\d{2})?` with `?` making all three value groups optional. If a description contains a date-like pattern at the start, it could match with zero amount values, producing `null` amounts that are then filtered. This is fail-safe but loses transactions silently.

---

### 1.4 NAB Parser (`banks/nab.ts`)

**Status: Structural scaffold**

**[NAB-1] MEDIUM — BSB prefix `08` is not exclusive to NAB**
`nab.ts:29` — BSB `08xxxx` matches NAB, but some other institutions share this range. Combined with the `NAB` text match (`:27`), false positives are unlikely, but the `minHeaderMatches: 2` threshold means a document mentioning "NAB" and containing "08xxxx" anywhere would match.

---

### 1.5 St.George, Bendigo, ING, Macquarie Parsers

**Status: Near-identical structural scaffolds**

These 4 parsers are functionally identical copies differing only in:
- `bankId`, `bankName`, `displayName`
- `headerPatterns` (different bank names and BSB prefixes)
- `accountTypes` (different product names)

All share the same issues:
- Section-end `continue` bug (same as ANZ-2)
- No multi-line transaction handling (only CBA has this)
- No balance continuity correction
- No merchant name extraction

**[GENERIC-1] HIGH — St.George `extractAccountInfo` doesn't extract balances or statement period**
`stgeorge.ts:164-:192` — Unlike other parsers that at least attempt balance extraction, St.George's implementation returns only account number and type. Opening/closing balance and statement period are silently null.

**[GENERIC-2] MEDIUM — Bendigo, ING, Macquarie have the same missing balance/period extraction**
`bendigo.ts:143-:171`, `ing.ts:147-:175`, `macquarie.ts:145-:173` — Identical issue to GENERIC-1.

---

## 2. Format Parser Audit

### 2.1 CSV Parser (`formats/csv-parser.ts`)

**Status: Well-structured with proper edge case handling**

#### Strengths
- File size limit (10MB) prevents memory exhaustion (`:211`)
- Detection content limit (10KB) prevents ReDoS (`:213`)
- Bank-specific column configuration supports both named and indexed columns
- Handles accounting-format parenthesized negatives (`:476-:479`)
- Date validation via `new Date()` constructor (`:565-:572`)

#### Issues

**[CSV-1] HIGH — CBA `positiveIsCredit: false` sign inversion is backwards**
`csv-parser.ts:58,416-:419` — CBA config sets `positiveIsCredit: false`, meaning "positive amounts are debits". The code then inverts: `amountCents = -amountCents`. But CBA CSV exports use **negative** for debits and **positive** for credits already. This double-inversion would make all amounts have the wrong sign. If CBA CSV uses the standard convention (negative=debit), then `positiveIsCredit` should be `true`, not `false`.

**[CSV-2] LOW — Native `Date()` fallback is locale-dependent**
`csv-parser.ts:516-:519` — `new Date(cleaned)` parsing is implementation-dependent and can produce different results on different Node.js versions or locale settings, violating determinism.

### 2.2 OFX Parser (`formats/ofx-parser.ts`)

**Status: Solid implementation with good edge case handling**

#### Strengths
- Handles both XML and SGML (tag-soup) OFX variants (`:347-:354`)
- UTF-8 BOM removal (`:219`)
- Timezone info stripping from dates (`:435`)
- Proper account type mapping including investment accounts (`:232-:257`)
- Generates synthetic FITID when missing (`:372`) — deterministic based on date+amount

#### Issues

**[OFX-1] LOW — `success` flag logic inconsistent**
`ofx-parser.ts:194` — `result.success = result.transactions.length > 0 || result.errors.length === 0`. A file with 0 transactions and 0 errors (e.g., a valid OFX with only balance info, no transactions) would return `success: true`, which is misleading.

### 2.3 QIF Parser (`formats/qif-parser.ts`)

**Status: Comprehensive with locale-aware date handling**

#### Strengths
- Explicit US vs AU date format detection via heuristic analysis (`:586-:624`)
- Configurable preference via `setDateFormatPreference()` (`:270`)
- Handles Quicken-specific date variants with apostrophe years (`:195-:212`)
- Split transaction support (S, E, $ fields) (`:560-:568`)
- Proper year expansion with 50-year cutoff (`:233-:236`)

#### Issues

**[QIF-1] HIGH — Date format auto-detection is fragile for ambiguous dates**
`qif-parser.ts:586-:624` — When all dates in the sample have both components <= 12 (e.g., `5/3/23`, `8/7/23`), the heuristic falls back to comparing first vs second component magnitude. If first > second, it scores AU+1. This is essentially random for many transaction sets. Defaulting to AU is reasonable for this app, but there's no mechanism to flag ambiguous detection to the user.

---

## 3. Credit Card Parser Audit

### 3.1 CBA Credit Card Parser (`documents/credit-card/cba-credit.ts`)

**Status: Well-designed with comprehensive feature extraction**

#### Strengths
- Three transaction line format parsers (dual-date, standard, month-name) at `:284-:393`
- Foreign currency continuation line parsing (`:414-:495`)
- Transaction type classification from description (`:538-:592` in base)
- Exhaustive account info extraction (credit limit, APR, rewards, etc.) (`:500-:703`)

#### Issues

**[CC-1] CRITICAL — Year inference uses `new Date()` for dual-date format**
`cba-credit.ts:293-:307` — The `inferYear` function uses `new Date()` to determine the current year, meaning the same PDF parsed on different dates produces different transaction dates. This is the same non-determinism issue as CBA-1 but more severe because credit card statements commonly span December-January boundaries.

**[CC-2] HIGH — Credit card amount sign convention is inverted vs bank convention**
`base-credit-parser.ts:43` declares: "positive for charges, negative for payments/credits". But the CBA credit card parser at `cba-credit.ts:315,345,375` calls `this.parseAmount(rawAmount)` which uses `base-parser.ts:parseAmount()`. That function treats `-` as debit (negative) and unsigned as positive. For credit cards, charges ARE debits (money you owe increases), so a $50 purchase should be positive. The `parseAmount` function returns unsigned amounts as positive, which accidentally gives the correct sign for purchases. But `parseAmount` with CR suffix returns positive (credit = positive), which for credit card payments should be negative (reduces what you owe). This means payments with CR suffix get the WRONG sign.

**[CC-3] MEDIUM — Transaction type fallback assumes negative=payment**
`base-credit-parser.ts:586-:588` — `if (amount < 0) { return 'payment'; }` — This assumes all negative amounts are payments, but refunds can also be negative. Combined with CC-2, if the sign convention is wrong, purchases could be classified as payments.

---

## 4. Detector & Registry Audit

### 4.1 Detector (`detector.ts`)

**Status: Clean dispatch layer with useful analysis functions**

#### Issues

**[DET-1] MEDIUM — Duplicate credit card detection patterns**
`detector.ts:118-:129` defines `CREDIT_CARD_PATTERNS` for `hasCreditCardIndicators()`, while `documents/credit-card/base-credit-parser.ts` has a separate set of `creditCardIndicators` in each parser config. These can diverge, producing inconsistent detection results depending on which code path is called.

**[DET-2] LOW — `isCreditCardStatement()` and `hasCreditCardIndicators()` overlap**
`detector.ts:106-:113` and `:134-:151` — Two functions testing the same thing with different logic. `isCreditCardStatement` delegates to the credit card parser registry, while `hasCreditCardIndicators` uses hardcoded patterns. The pipeline uses `hasCreditCardIndicators` (`:256`) but `detector.ts` also exports `isCreditCardStatement`. Callers may use the wrong one.

### 4.2 Registry (`registry.ts`)

**Status: Clean singleton pattern with proper lazy initialization**

#### Strengths
- Priority-based parser ordering (CBA=100, Big4=90, others=70-80) (`:41-:48`)
- Proper confidence-based fallback with configurable `minConfidence` (`:133`)
- Lazy initialization via `ensureInitialized()` (`:231-:235`)

#### Issues

**[REG-1] MEDIUM — `bankwest` and `suncorp` declared in `BankId` type but no parsers registered**
`types.ts:20-:21` — `bankwest` and `suncorp` are valid `BankId` values, but no parser exists for them. `getParser('bankwest')` returns `undefined`, and `forceBankId: 'bankwest'` fails with "No parser found" error (`:147`). Not a bug per se, but type safety creates false expectations.

---

## 5. Determinism Assessment

### 5.1 Non-Deterministic Elements

| Source | Location | Impact |
|--------|----------|--------|
| `new Date().getFullYear()` | `cba.ts:265` | Transaction year depends on parse date |
| `new Date()` in `inferYear` | `cba-credit.ts:300-:306` | Transaction year depends on parse date |
| `Date.now()` for `processingTimeMs` | `base-parser.ts:213,255` | Metadata varies per run |
| `Date()` fallback in CSV parser | `csv-parser.ts:517` | Date parsing varies by locale |

### 5.2 Deterministic Elements (Good)

- All regex patterns are stateless and compiled
- `parseAmount` is pure functional
- `parseDate` is pure functional
- Transaction ordering is preserved from PDF line order (no sorting by parsers)
- OFX synthetic FITID is derived from `${dtposted}-${trnamt}` (deterministic)
- Balance continuity correction in CBA parser is deterministic given input

### 5.3 Same PDF Content -> Same Result?

**NO** — Due to `new Date()` dependencies in CBA and CBA credit card parsers, the same PDF content can produce different results when parsed on different dates. All other parsers are deterministic assuming the same Node.js version/locale.

---

## 6. Provenance Assessment

### 6.1 Missing Provenance Fields

The `StatementParseResult` and `ParsedTransaction` types contain **no provenance fields**:

| Missing Field | Purpose | Status |
|---------------|---------|--------|
| `parser_version` | Track which code version produced the result | NOT PRESENT |
| `extraction_hash` | Content hash for deduplication/verification | NOT PRESENT |
| `statement_id` binding | Link parsed data back to source statement | NOT IN PARSER (done in pipeline) |
| `parse_timestamp` | When parsing occurred | NOT PRESENT |
| `pdf_content_hash` | Hash of input for reproducibility | NOT PRESENT |
| `raw_text_hash` | Hash of extracted PDF text | NOT PRESENT |

### 6.2 What IS tracked

- `parserUsed: string` — Which bank parser was used (e.g., "cba", "ai_required")
- `detectionConfidence: number` — How confident the bank detection was
- `processingTimeMs: number` — Wall-clock time (non-deterministic)
- `parseWarnings/parseErrors: string[]` — Human-readable diagnostics
- `lineNumber` on transactions — Source line in PDF text

### 6.3 Pipeline Provenance

The pipeline (`pipeline.ts`) does compute a hash at the PDF level and binds results to `statementId`, but this happens outside the parser layer. The parsers themselves have no awareness of which statement they're parsing.

---

## 7. Edge Case Assessment

### 7.1 Overlapping Date Ranges

**Not handled.** If two statements for the same account are uploaded with overlapping date ranges, the pipeline does not check for duplicate transactions. The parsers have no deduplication logic. Duplicate detection would need to happen at the persistence layer.

### 7.2 Partial Statement Parsing

**Partially handled.** CBA parser stops at "Fee Summary" / "Important Information" sections (`:346-:350`). Other parsers don't have equivalent section boundaries, so footer content could produce spurious transactions.

### 7.3 Multi-Page Continuations

**CBA only.** CBA parser's `isSkippableLine` (`:232-:257`) filters page headers/footers (Statement N, Page N, barcodes). Other parsers rely solely on the transaction line regex to filter, which is less robust.

### 7.4 Duplicate Detection

**Not implemented in parsers.** Base parser computes `dateCount` map at `:240-:243` but never uses it (the warning is never emitted). This is dead code.

---

## 8. Pipeline Integration Assessment

### 8.1 Parser Invocation Flow (`pipeline.ts`)

The pipeline follows this cascade:
1. Extract PDF text via `pdf-parse` (`:131-:156`)
2. Extract account info via AI service (`:177`) — NOT from parsers
3. Check credit card indicators (`:256`)
4. If credit card: try `parseCreditCardStatement()` (`:301`)
5. If no results: try `parserRegistry.parseStatement()` with `fallbackToAI: false` (`:342`)
6. If no results: try Claude agents (orchestrator)
7. If no results: try legacy AI service

**[PIPE-1] CRITICAL — Account info extraction uses AI, not parsers**
`pipeline.ts:177` — Account number, bank name, account type, and balances are extracted by `aiService.extractAccountInfo()`, NOT by the bank parsers' `extractAccountInfo()` method. The parsers' account extraction is never called by the pipeline. This means:
- The sophisticated account detection in CBA parser (BSB patterns, account type matching) is unused
- The pipeline relies entirely on AI for account metadata
- If the AI is unavailable, account info defaults to null across the board

**[PIPE-2] HIGH — Bank parser results don't carry bank detection info into pipeline**
`pipeline.ts:344` — When the bank parser succeeds, the pipeline logs `parseResult.bankId` but doesn't update `accountDetection.detectedInfo.bankName`. The AI-extracted bank name (from step 2) is used instead. If the AI gets the bank wrong but the regex parser gets it right, the wrong bank name persists.

---

## 9. Recommendations (Priority-Ordered)

### Critical

1. **Add `extractionDate` parameter** to CBA parser and CBA credit card parser to replace `new Date()` calls. Pass the statement upload date or a fixed reference date for deterministic parsing.

2. **Invoke parser `extractAccountInfo()` in pipeline** when bank parser succeeds (confidence >= HIGH). Use parser-extracted account info as primary, AI as fallback.

3. **Fix CSV CBA sign convention** — Change `positiveIsCredit` to `true` for CBA if CBA CSVs follow standard negative=debit convention.

### High

4. **Fix section-end bugs** in ANZ, Westpac, St.George, Bendigo, ING, Macquarie parsers — change `continue` to `inTransactionSection = false; continue` when hitting Closing/Total lines.

5. **Add provenance fields** to `StatementParseResult`: `parserVersion`, `inputContentHash` (SHA-256 of pdfText), `parseTimestamp`.

6. **Verify credit card amount sign convention** with real CBA credit card PDFs. The current implementation may produce wrong signs for payments/credits marked with CR suffix.

### Medium

7. Remove or complete the dead `dateCount` code in `base-parser.ts:240-:243`.
8. Unify credit card detection between `detector.ts` and `base-credit-parser.ts`.
9. Add balance/period extraction to St.George, Bendigo, ING, Macquarie parsers.

### Low

10. Add Bankwest and Suncorp parsers or remove from `BankId` type.
11. Replace `Date()` fallback in CSV parser with explicit format-only parsing.
12. Preserve sign info in `rawAmount` field for audit trail.

---

## Appendix: File Reference Matrix

| File | Lines | Status | Issues |
|------|-------|--------|--------|
| `parsers/types.ts` | 244 | Clean | REG-1 |
| `parsers/base-parser.ts` | 331 | Good | Dead code at :240 |
| `parsers/banks/cba.ts` | 492 | Production | CBA-1, CBA-2, CBA-3, CBA-4 |
| `parsers/banks/anz.ts` | 255 | Scaffold | ANZ-1, ANZ-2 |
| `parsers/banks/westpac.ts` | 253 | Scaffold | WPC-1, WPC-2 |
| `parsers/banks/nab.ts` | 233 | Scaffold | NAB-1 |
| `parsers/banks/stgeorge.ts` | 193 | Scaffold | GENERIC-1 |
| `parsers/banks/bendigo.ts` | 172 | Scaffold | GENERIC-2 |
| `parsers/banks/ing.ts` | 176 | Scaffold | GENERIC-2 |
| `parsers/banks/macquarie.ts` | 174 | Scaffold | GENERIC-2 |
| `parsers/banks/index.ts` | 15 | Clean | None |
| `parsers/formats/csv-parser.ts` | 617 | Good | CSV-1, CSV-2 |
| `parsers/formats/ofx-parser.ts` | 531 | Good | OFX-1 |
| `parsers/formats/qif-parser.ts` | 776 | Good | QIF-1 |
| `parsers/documents/credit-card/index.ts` | 155 | Clean | None |
| `parsers/documents/credit-card/base-credit-parser.ts` | 673 | Good | CC-2, CC-3, DET-1 |
| `parsers/documents/credit-card/cba-credit.ts` | 733 | Good | CC-1 |
| `parsers/detector.ts` | 285 | Clean | DET-1, DET-2 |
| `parsers/registry.ts` | 243 | Clean | REG-1 |
| `pipeline.ts` | 350+ | Good | PIPE-1, PIPE-2 |
