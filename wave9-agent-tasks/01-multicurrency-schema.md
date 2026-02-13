# Agent 1: Multi-Currency Schema Builder

## Role
Create currencies, exchange_rates, invoice_templates, and customer_statements tables in the dual schema system (SQLite + PostgreSQL) plus PostgreSQL migration 0021.

## Priority: WAVE 9 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0021_ar_multicurrency.sql`
**Purpose**: PostgreSQL migration adding 4 new tables for AR aging multi-currency support
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` — use `CREATE TABLE IF NOT EXISTS`, include indexes, wrap in `BEGIN; ... COMMIT;`

- [ ] Create `currencies` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `code TEXT NOT NULL UNIQUE` (ISO 4217: AUD, USD, GBP, NZD, EUR, etc.)
  - `name TEXT NOT NULL` (e.g., 'Australian Dollar')
  - `symbol TEXT NOT NULL` (e.g., '$', '£', '€')
  - `decimal_places INTEGER NOT NULL DEFAULT 2`
  - `is_active BOOLEAN DEFAULT true`
  - INDEX on `(code)` UNIQUE (already enforced by column constraint)

- [ ] Create `exchange_rates` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `from_currency TEXT NOT NULL REFERENCES currencies(code)`
  - `to_currency TEXT NOT NULL REFERENCES currencies(code)`
  - `rate REAL NOT NULL` (e.g., 0.67 for AUD→USD)
  - `effective_date TEXT NOT NULL` (YYYY-MM-DD)
  - `source TEXT NOT NULL DEFAULT 'manual'` ('manual' | 'api')
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - UNIQUE INDEX on `(from_currency, to_currency, effective_date)`
  - INDEX on `(effective_date DESC)`

- [ ] Create `invoice_templates` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `name TEXT NOT NULL`
  - `logo_path TEXT` (path to uploaded logo file)
  - `header_html TEXT` (custom header HTML)
  - `footer_html TEXT` (custom footer HTML)
  - `color_scheme TEXT` (JSON: { primary, secondary, accent, background })
  - `is_default BOOLEAN DEFAULT false`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, is_default)`

- [ ] Create `customer_statements` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE`
  - `period_start TEXT NOT NULL` (YYYY-MM-DD)
  - `period_end TEXT NOT NULL` (YYYY-MM-DD)
  - `opening_balance_cents INTEGER NOT NULL DEFAULT 0`
  - `closing_balance_cents INTEGER NOT NULL DEFAULT 0`
  - `pdf_path TEXT`
  - `generated_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(customer_id, period_start)`
  - INDEX on `(customer_id, generated_at DESC)`

- [ ] Seed default currencies (AUD, USD, GBP, NZD, EUR, JPY, SGD, HKD, CAD, CHF):
  ```sql
  INSERT INTO currencies (id, code, name, symbol, decimal_places, is_active) VALUES
    (gen_random_uuid()::text, 'AUD', 'Australian Dollar', '$', 2, true),
    (gen_random_uuid()::text, 'USD', 'US Dollar', 'US$', 2, true),
    (gen_random_uuid()::text, 'GBP', 'British Pound', '£', 2, true),
    (gen_random_uuid()::text, 'NZD', 'New Zealand Dollar', 'NZ$', 2, true),
    (gen_random_uuid()::text, 'EUR', 'Euro', '€', 2, true),
    (gen_random_uuid()::text, 'JPY', 'Japanese Yen', '¥', 0, true),
    (gen_random_uuid()::text, 'SGD', 'Singapore Dollar', 'S$', 2, true),
    (gen_random_uuid()::text, 'HKD', 'Hong Kong Dollar', 'HK$', 2, true),
    (gen_random_uuid()::text, 'CAD', 'Canadian Dollar', 'C$', 2, true),
    (gen_random_uuid()::text, 'CHF', 'Swiss Franc', 'CHF', 2, true)
  ON CONFLICT (code) DO NOTHING;
  ```

## Files to MODIFY

### 2. `server/src/schema.ts`
**Purpose**: Add 4 new `sqliteTable()` definitions
**Location**: Insert BEFORE the TYPE EXPORTS section

```typescript
// ============================================================================
// AR AGING & MULTI-CURRENCY (Wave 9)
// ============================================================================

export const currencies = sqliteTable('currencies', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  decimalPlaces: integer('decimal_places').notNull().default(2),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
});

export const exchangeRates = sqliteTable('exchange_rates', {
  id: text('id').primaryKey(),
  fromCurrency: text('from_currency').notNull().references(() => currencies.code),
  toCurrency: text('to_currency').notNull().references(() => currencies.code),
  rate: real('rate').notNull(),
  effectiveDate: text('effective_date').notNull(),
  source: text('source').notNull().default('manual'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const invoiceTemplates = sqliteTable('invoice_templates', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  logoPath: text('logo_path'),
  headerHtml: text('header_html'),
  footerHtml: text('footer_html'),
  colorScheme: text('color_scheme'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const customerStatements = sqliteTable('customer_statements', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  openingBalanceCents: integer('opening_balance_cents').notNull().default(0),
  closingBalanceCents: integer('closing_balance_cents').notNull().default(0),
  pdfPath: text('pdf_path'),
  generatedAt: text('generated_at').notNull().default('CURRENT_TIMESTAMP'),
});
```

- [ ] Add type exports at the end of the TYPE EXPORTS section:

```typescript
// AR Aging & Multi-Currency
export type Currency = typeof currencies.$inferSelect;
export type NewCurrency = typeof currencies.$inferInsert;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
export type InvoiceTemplate = typeof invoiceTemplates.$inferSelect;
export type NewInvoiceTemplate = typeof invoiceTemplates.$inferInsert;
export type CustomerStatement = typeof customerStatements.$inferSelect;
export type NewCustomerStatement = typeof customerStatements.$inferInsert;
```

### 3. `server/src/db/postgres-schema.ts`
**Purpose**: Add matching pgTable definitions for all 4 new tables
**Pattern**: Follow existing tables in postgres-schema.ts — use `pgTable()`, `timestamp(..., { withTimezone: true })`, `boolean()`, include indexes

- [ ] Add `currencies` pgTable with PG types (boolean for isActive)
- [ ] Add `exchangeRates` pgTable with PG timestamp for createdAt
- [ ] Add `invoiceTemplates` pgTable with PG boolean for isDefault, timestamp for createdAt
- [ ] Add `customerStatements` pgTable with PG timestamp for generatedAt
- [ ] Add matching type exports

### 4. `server/src/index.ts`
**Purpose**: Add schema imports for new tables
**Modify the import statement** to include: `currencies, exchangeRates, invoiceTemplates, customerStatements`

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean (no new errors from schema additions)
- [ ] Migration file `0021_ar_multicurrency.sql` is valid PostgreSQL syntax
- [ ] All 4 sqliteTable definitions compile correctly
- [ ] All 8 type exports (4 select + 4 insert) resolve correctly
- [ ] Currency seed data includes at least AUD (base currency) + 9 common trading currencies
- [ ] Create marker file: `.agent-done-W09-01`

## Dependencies
- **None** — can start immediately
- **Reuses**: schema.ts patterns, postgres-schema.ts patterns, migration conventions
- **Note**: `customers` table must already exist (from Wave 7 migration 0019) — this migration references it via FK
