# Agent 1: Inventory Schema Builder

## Role
Create inventory/warehouse and bank reconciliation tables in the dual schema system (SQLite + PostgreSQL) plus PostgreSQL migration 0023.

## Priority: WAVE 11 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0023_inventory_bank_recon.sql`
**Purpose**: PostgreSQL migration adding 7 new tables for inventory management and bank reconciliation
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` — use `CREATE TABLE IF NOT EXISTS`, include indexes

- [ ] Create `inventory_items` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `sku TEXT NOT NULL` (stock keeping unit)
  - `name TEXT NOT NULL`
  - `description TEXT`
  - `category TEXT` (product category)
  - `unit_of_measure TEXT NOT NULL DEFAULT 'each'` (each, kg, litre, metre, etc.)
  - `cost_method TEXT NOT NULL DEFAULT 'weighted_average'` (weighted_average, fifo, lifo, specific)
  - `current_cost_cents INTEGER NOT NULL DEFAULT 0` (weighted average unit cost in cents)
  - `sale_price_cents INTEGER DEFAULT 0`
  - `gst_applicable BOOLEAN DEFAULT true`
  - `reorder_point INTEGER DEFAULT 0`
  - `reorder_quantity INTEGER DEFAULT 0`
  - `supplier_name TEXT`
  - `supplier_abn TEXT`
  - `is_active BOOLEAN DEFAULT true`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, sku)` UNIQUE
  - INDEX on `(user_id, category)`

- [ ] Create `warehouses` table:
  - `id TEXT PRIMARY KEY`
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `name TEXT NOT NULL`
  - `location TEXT`
  - `is_default BOOLEAN DEFAULT false`
  - `is_active BOOLEAN DEFAULT true`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, name)` UNIQUE

- [ ] Create `inventory_stock` table:
  - `id TEXT PRIMARY KEY`
  - `item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE`
  - `warehouse_id TEXT NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE`
  - `quantity_on_hand REAL NOT NULL DEFAULT 0`
  - `quantity_reserved REAL DEFAULT 0`
  - `quantity_available REAL GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED` (or compute in app)
  - `last_counted_at TIMESTAMPTZ`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - UNIQUE INDEX on `(item_id, warehouse_id)`

- [ ] Create `inventory_movements` table:
  - `id TEXT PRIMARY KEY`
  - `item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE`
  - `warehouse_id TEXT NOT NULL REFERENCES warehouses(id)`
  - `movement_type TEXT NOT NULL` (purchase, sale, adjustment, transfer_in, transfer_out, return, write_off)
  - `quantity REAL NOT NULL` (positive for in, negative for out)
  - `unit_cost_cents INTEGER NOT NULL DEFAULT 0`
  - `total_cost_cents INTEGER NOT NULL DEFAULT 0`
  - `reference_id TEXT` (transaction_id, PO number, etc.)
  - `reference_type TEXT` (transaction, purchase_order, manual)
  - `notes TEXT`
  - `movement_date TEXT NOT NULL`
  - `created_by TEXT REFERENCES users(id)`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(item_id, movement_date)`
  - INDEX on `(warehouse_id, movement_date)`

- [ ] Create `bank_recon_rules` table:
  - `id TEXT PRIMARY KEY`
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `name TEXT NOT NULL`
  - `description TEXT`
  - `match_type TEXT NOT NULL` (amount_exact, amount_date, reference_number, description_pattern, combined)
  - `match_config TEXT NOT NULL` (JSON: tolerance_cents, date_window_days, pattern, field_weights)
  - `auto_confirm BOOLEAN DEFAULT false`
  - `priority INTEGER DEFAULT 0`
  - `is_active BOOLEAN DEFAULT true`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, is_active)`

- [ ] Create `bank_recon_sessions` table:
  - `id TEXT PRIMARY KEY`
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`
  - `session_name TEXT`
  - `status TEXT NOT NULL DEFAULT 'open'` (open, in_progress, completed, abandoned)
  - `period_start TEXT NOT NULL`
  - `period_end TEXT NOT NULL`
  - `statement_balance_cents INTEGER`
  - `ledger_balance_cents INTEGER`
  - `difference_cents INTEGER`
  - `total_matched INTEGER DEFAULT 0`
  - `total_unmatched INTEGER DEFAULT 0`
  - `auto_matched INTEGER DEFAULT 0`
  - `manual_matched INTEGER DEFAULT 0`
  - `started_at TIMESTAMPTZ DEFAULT NOW()`
  - `completed_at TIMESTAMPTZ`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, account_id, status)`

- [ ] Create `bank_recon_matches` table:
  - `id TEXT PRIMARY KEY`
  - `session_id TEXT NOT NULL REFERENCES bank_recon_sessions(id) ON DELETE CASCADE`
  - `bank_transaction_id TEXT NOT NULL REFERENCES transactions(id)`
  - `ledger_entry_id TEXT` (references journal_entries.id or NULL for unmatched)
  - `match_type TEXT NOT NULL` (auto, suggested, manual, unmatched)
  - `confidence REAL DEFAULT 0`
  - `match_rule_id TEXT REFERENCES bank_recon_rules(id)`
  - `match_reasons TEXT` (JSON array of reasons)
  - `status TEXT NOT NULL DEFAULT 'pending'` (pending, confirmed, rejected, undone)
  - `confirmed_by TEXT REFERENCES users(id)`
  - `confirmed_at TIMESTAMPTZ`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(session_id, status)`
  - INDEX on `(bank_transaction_id)`

## Files to MODIFY

### 2. `server/src/schema.ts` (after line 968, before TYPE EXPORTS section at line 974)
**BEFORE** (lines 968-974):
```typescript
// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Users & Auth
export type User = typeof users.$inferSelect;
```
**AFTER**:
```typescript
// ============================================================================
// INVENTORY MANAGEMENT
// ============================================================================

export const inventoryItems = sqliteTable('inventory_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  unitOfMeasure: text('unit_of_measure').notNull().default('each'),
  costMethod: text('cost_method').notNull().default('weighted_average'),
  currentCostCents: integer('current_cost_cents').notNull().default(0),
  salePriceCents: integer('sale_price_cents').default(0),
  gstApplicable: integer('gst_applicable', { mode: 'boolean' }).default(true),
  reorderPoint: integer('reorder_point').default(0),
  reorderQuantity: integer('reorder_quantity').default(0),
  supplierName: text('supplier_name'),
  supplierAbn: text('supplier_abn'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const warehouses = sqliteTable('warehouses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  location: text('location'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const inventoryStock = sqliteTable('inventory_stock', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  warehouseId: text('warehouse_id').notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  quantityOnHand: real('quantity_on_hand').notNull().default(0),
  quantityReserved: real('quantity_reserved').default(0),
  lastCountedAt: text('last_counted_at'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const inventoryMovements = sqliteTable('inventory_movements', {
  id: text('id').primaryKey(),
  itemId: text('item_id').notNull().references(() => inventoryItems.id, { onDelete: 'cascade' }),
  warehouseId: text('warehouse_id').notNull().references(() => warehouses.id),
  movementType: text('movement_type').notNull(),
  quantity: real('quantity').notNull(),
  unitCostCents: integer('unit_cost_cents').notNull().default(0),
  totalCostCents: integer('total_cost_cents').notNull().default(0),
  referenceId: text('reference_id'),
  referenceType: text('reference_type'),
  notes: text('notes'),
  movementDate: text('movement_date').notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// BANK RECONCILIATION
// ============================================================================

export const bankReconRules = sqliteTable('bank_recon_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  matchType: text('match_type').notNull(),
  matchConfig: text('match_config').notNull(),
  autoConfirm: integer('auto_confirm', { mode: 'boolean' }).default(false),
  priority: integer('priority').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const bankReconSessions = sqliteTable('bank_recon_sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  sessionName: text('session_name'),
  status: text('status').notNull().default('open'),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  statementBalanceCents: integer('statement_balance_cents'),
  ledgerBalanceCents: integer('ledger_balance_cents'),
  differenceCents: integer('difference_cents'),
  totalMatched: integer('total_matched').default(0),
  totalUnmatched: integer('total_unmatched').default(0),
  autoMatched: integer('auto_matched').default(0),
  manualMatched: integer('manual_matched').default(0),
  startedAt: text('started_at').notNull().default('CURRENT_TIMESTAMP'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const bankReconMatches = sqliteTable('bank_recon_matches', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => bankReconSessions.id, { onDelete: 'cascade' }),
  bankTransactionId: text('bank_transaction_id').notNull().references(() => transactions.id),
  ledgerEntryId: text('ledger_entry_id'),
  matchType: text('match_type').notNull(),
  confidence: real('confidence').default(0),
  matchRuleId: text('match_rule_id').references(() => bankReconRules.id),
  matchReasons: text('match_reasons'),
  status: text('status').notNull().default('pending'),
  confirmedBy: text('confirmed_by').references(() => users.id),
  confirmedAt: text('confirmed_at'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Users & Auth
export type User = typeof users.$inferSelect;
```

- [ ] Add 7 new `sqliteTable()` definitions between the ECONOMIC DATA CACHE section and TYPE EXPORTS section
- [ ] Add type exports at the end of the TYPE EXPORTS section (after line 1077):

```typescript
// Inventory
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;
export type InventoryStockRecord = typeof inventoryStock.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;

// Bank Reconciliation
export type BankReconRule = typeof bankReconRules.$inferSelect;
export type NewBankReconRule = typeof bankReconRules.$inferInsert;
export type BankReconSession = typeof bankReconSessions.$inferSelect;
export type NewBankReconSession = typeof bankReconSessions.$inferInsert;
export type BankReconMatch = typeof bankReconMatches.$inferSelect;
export type NewBankReconMatch = typeof bankReconMatches.$inferInsert;
```

### 3. `server/src/db/postgres-schema.ts`
**Purpose**: Add matching pgTable definitions for all 7 new tables
**Pattern**: Follow existing tables in postgres-schema.ts — use `pgTable()`, `timestamp(..., { withTimezone: true })`, `boolean()`, include indexes

- [ ] Add `inventoryItems` pgTable with same columns as SQLite version but using PG types
- [ ] Add `warehouses` pgTable
- [ ] Add `inventoryStock` pgTable
- [ ] Add `inventoryMovements` pgTable
- [ ] Add `bankReconRules` pgTable
- [ ] Add `bankReconSessions` pgTable
- [ ] Add `bankReconMatches` pgTable
- [ ] Add matching type exports

### 4. `server/src/index.ts` (line 8)
**BEFORE**:
```typescript
import { db, transactions, statements, users, userSettings, transactionHistory, accounts, merchantMemory, pendingCategorization, transferLinks, accountBalanceHistory, reconciliationAlerts, statementAccounts, businessProfiles, wagePayments } from './schema.js'
```
**AFTER**:
```typescript
import { db, transactions, statements, users, userSettings, transactionHistory, accounts, merchantMemory, pendingCategorization, transferLinks, accountBalanceHistory, reconciliationAlerts, statementAccounts, businessProfiles, wagePayments, inventoryItems, warehouses, inventoryStock, inventoryMovements, bankReconRules, bankReconSessions, bankReconMatches } from './schema.js'
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean (no new errors from schema additions)
- [ ] Migration file `0023_inventory_bank_recon.sql` is valid PostgreSQL syntax
- [ ] All 7 sqliteTable definitions compile correctly
- [ ] All 14 type exports (7 select + 7 insert) resolve correctly
- [ ] Create marker file: `.agent-done-W11-01`

## Dependencies
- **None** — can start immediately
- **Reuses**: schema.ts patterns, postgres-schema.ts patterns, migration conventions
