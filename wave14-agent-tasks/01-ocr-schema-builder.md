# Agent 1: OCR Schema Builder

## Role
Create 5 new database tables for OCR document processing, line item extraction, payment matching rules, matches, and a document processing queue, plus migration 0026.

## Priority: WAVE 14 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0026_ocr_payment_matching.sql`
**Purpose**: DDL for 5 new OCR and payment matching tables
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` exactly

```sql
-- Migration 0026: AI Document Processing & Payment Matching
-- Tables: ocr_documents, ocr_line_items, payment_match_rules,
--         payment_matches, document_queue
```

- [ ] Create `ocr_documents` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `user_id` TEXT NOT NULL REFERENCES users(id)
  - `account_id` TEXT REFERENCES accounts(id)
  - `file_name` TEXT NOT NULL
  - `file_path` TEXT NOT NULL (path in server/uploads/)
  - `file_size` INTEGER NOT NULL (bytes)
  - `mime_type` TEXT NOT NULL (e.g., 'application/pdf', 'image/png', 'image/jpeg')
  - `document_type` TEXT CHECK (document_type IN ('invoice', 'receipt', 'bill', 'credit_note', 'statement', 'quote', 'purchase_order', 'unknown'))
  - `document_number` TEXT (invoice/receipt number extracted by OCR)
  - `vendor_name` TEXT (extracted vendor/supplier name)
  - `vendor_abn` TEXT (extracted ABN if present)
  - `document_date` TEXT (extracted date from document)
  - `due_date` TEXT (extracted due date, for invoices/bills)
  - `subtotal` REAL (extracted subtotal before GST)
  - `gst_amount` REAL (extracted GST amount)
  - `total_amount` REAL (extracted total amount)
  - `currency` TEXT DEFAULT 'AUD'
  - `extracted_data` TEXT (JSON: full raw OCR extraction payload)
  - `confidence_score` REAL DEFAULT 0 (0.0-1.0 overall extraction confidence)
  - `status` TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'extracted', 'verified', 'matched', 'failed', 'archived'))
  - `error_message` TEXT
  - `processed_at` TEXT
  - `created_at` TEXT DEFAULT (datetime('now'))
  - `updated_at` TEXT DEFAULT (datetime('now'))
  - INDEX on (user_id, status)
  - INDEX on (vendor_name, document_date)

- [ ] Create `ocr_line_items` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `document_id` TEXT NOT NULL REFERENCES ocr_documents(id) ON DELETE CASCADE
  - `line_number` INTEGER NOT NULL
  - `description` TEXT NOT NULL
  - `quantity` REAL DEFAULT 1
  - `unit_price` REAL
  - `amount` REAL NOT NULL
  - `gst_amount` REAL DEFAULT 0
  - `gst_inclusive` INTEGER DEFAULT 1 (boolean: is amount GST-inclusive?)
  - `category` TEXT (mapped category from categories.ts)
  - `account_code` TEXT (chart of accounts mapping)
  - `confidence_score` REAL DEFAULT 0
  - INDEX on (document_id)

- [ ] Create `payment_match_rules` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `user_id` TEXT NOT NULL REFERENCES users(id)
  - `name` TEXT NOT NULL (e.g., "Telstra Monthly", "Office Rent")
  - `rule_type` TEXT NOT NULL CHECK (rule_type IN ('exact_amount', 'amount_range', 'vendor_match', 'recurring', 'composite'))
  - `vendor_pattern` TEXT (regex or substring for vendor matching)
  - `amount_exact` REAL (for exact_amount rules)
  - `amount_min` REAL (for amount_range rules)
  - `amount_max` REAL (for amount_range rules)
  - `amount_tolerance` REAL DEFAULT 0.01 (acceptable variance in dollars)
  - `date_tolerance_days` INTEGER DEFAULT 7 (acceptable date difference)
  - `category_filter` TEXT (restrict to specific transaction category)
  - `priority` INTEGER DEFAULT 100 (lower = higher priority, for rule ordering)
  - `is_active` INTEGER DEFAULT 1
  - `match_count` INTEGER DEFAULT 0 (how many times this rule has matched)
  - `last_matched_at` TEXT
  - `created_at` TEXT DEFAULT (datetime('now'))
  - INDEX on (user_id, is_active)

- [ ] Create `payment_matches` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `document_id` TEXT NOT NULL REFERENCES ocr_documents(id)
  - `transaction_id` TEXT NOT NULL REFERENCES transactions(id)
  - `rule_id` TEXT REFERENCES payment_match_rules(id) (NULL if manual or AI match)
  - `match_score` REAL NOT NULL (0.0-1.0 confidence score)
  - `match_method` TEXT NOT NULL CHECK (match_method IN ('auto_rule', 'auto_ai', 'manual', 'suggested'))
  - `amount_difference` REAL DEFAULT 0 (document total - transaction amount)
  - `date_difference` INTEGER DEFAULT 0 (days between document date and transaction date)
  - `status` TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected'))
  - `confirmed_by` TEXT (user who confirmed, or 'auto' for auto-matched)
  - `confirmed_at` TEXT
  - `notes` TEXT
  - `created_at` TEXT DEFAULT (datetime('now'))
  - INDEX on (document_id)
  - INDEX on (transaction_id)
  - UNIQUE(document_id, transaction_id)

- [ ] Create `document_queue` table:
  - `id` TEXT PRIMARY KEY (UUID)
  - `user_id` TEXT NOT NULL REFERENCES users(id)
  - `document_id` TEXT NOT NULL REFERENCES ocr_documents(id)
  - `action` TEXT NOT NULL CHECK (action IN ('ocr_extract', 'classify', 'match', 'verify', 'reprocess'))
  - `priority` INTEGER DEFAULT 100 (lower = higher priority)
  - `status` TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'))
  - `attempts` INTEGER DEFAULT 0
  - `max_attempts` INTEGER DEFAULT 3
  - `error_message` TEXT
  - `scheduled_at` TEXT DEFAULT (datetime('now'))
  - `started_at` TEXT
  - `completed_at` TEXT
  - `created_at` TEXT DEFAULT (datetime('now'))
  - INDEX on (status, priority, scheduled_at)

## Files to MODIFY

### 2. `server/src/schema.ts` (after existing tables, near line ~975)
- [ ] Add 5 new `sqliteTable` definitions matching the migration columns exactly
- [ ] Use `text()` for TEXT, `integer()` for INTEGER, `real()` for REAL, `integer({mode:'boolean'})` for BOOLEAN
- [ ] Add foreign key references: `ocrDocuments.userId` -> `users.id`, `ocrDocuments.accountId` -> `accounts.id`, `ocrLineItems.documentId` -> `ocrDocuments.id`, `paymentMatches.transactionId` -> `transactions.id`, etc.
- [ ] Export all 5 tables: `ocrDocuments`, `ocrLineItems`, `paymentMatchRules`, `paymentMatches`, `documentQueue`

### 3. `server/src/db/postgres-schema.ts`
- [ ] Add 5 matching `pgTable` definitions with PostgreSQL-specific types
- [ ] Add indexes in the third argument of pgTable
- [ ] Export all 5 tables with identical names to schema.ts

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 5 new tables exported from both schema files
- [ ] Migration SQL is syntactically valid
- [ ] Foreign key references point to existing tables (users, accounts, transactions, ocr_documents)
- [ ] CHECK constraints cover all valid enum values
- [ ] Cascade deletes: ocr_line_items deleted when ocr_documents deleted
- [ ] Create marker file: `.agent-done-W14-01`

## Dependencies
- **None** -- can start immediately
- **Schema lock**: Only this agent may modify schema.ts and postgres-schema.ts during Wave 14
