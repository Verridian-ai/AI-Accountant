# Agent 1: Employee Schema Builder

## Role
Create 7 employee/payroll tables in the dual schema system (SQLite + PostgreSQL) plus PostgreSQL migration 0016.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `docker/migrations/0016_employee_management.sql`
**Purpose**: PostgreSQL migration adding 7 new tables for employee management and pay structures
**Pattern**: Follow `docker/migrations/0012_tax_return_platform.sql` — use `CREATE TABLE IF NOT EXISTS`, include indexes

- [ ] Create `employees` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `first_name TEXT NOT NULL`
  - `last_name TEXT NOT NULL`
  - `email TEXT`
  - `phone TEXT`
  - `date_of_birth TEXT`
  - `address TEXT` (JSON: street, city, state, postcode, country)
  - `tax_file_number TEXT` (AES-256-GCM encrypted — NEVER store plaintext)
  - `start_date TEXT NOT NULL`
  - `end_date TEXT`
  - `status TEXT NOT NULL DEFAULT 'active'` ('active', 'terminated', 'on_leave')
  - `employment_type TEXT NOT NULL DEFAULT 'full_time'` ('full_time', 'part_time', 'casual', 'contractor')
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, status)`
  - INDEX on `(user_id, last_name, first_name)`

- [ ] Create `employee_bank_details` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE`
  - `bsb TEXT NOT NULL` (AES-256-GCM encrypted — **REVISION D02: BSB encrypted at rest alongside account_number using same encryption key**)
  - `account_number TEXT NOT NULL` (AES-256-GCM encrypted)
  - `account_name TEXT NOT NULL`
  - `split_percentage REAL NOT NULL DEFAULT 100.0` (for split pay deposits)
  - `is_primary BOOLEAN DEFAULT true`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(employee_id)`
  - CONSTRAINT: sum of split_percentage per employee should equal 100 (enforced in app)

- [ ] Create `employee_super_funds` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE`
  - `fund_name TEXT NOT NULL`
  - `fund_abn TEXT` (11-digit Australian Business Number)
  - `usi TEXT` (Unique Superannuation Identifier)
  - `member_number TEXT`
  - `contribution_rate REAL NOT NULL DEFAULT 11.5` (percentage — 11.5% for FY2025-26)
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(employee_id)`

- [ ] Create `employee_tax_declarations` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE`
  - `tax_free_threshold BOOLEAN DEFAULT true` (claims tax-free threshold at $18,200)
  - `help_debt BOOLEAN DEFAULT false` (has HELP/HECS-HELP debt)
  - `sfss_debt BOOLEAN DEFAULT false` (has Student Financial Supplement Scheme debt)
  - `claim_dependents INTEGER DEFAULT 0` (number of dependents for Zone/Overseas offset)
  - `tax_offset_estimated INTEGER DEFAULT 0` (cents — estimated tax offsets claimed)
  - `effective_date TEXT NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(employee_id, effective_date DESC)`

- [ ] Create `pay_categories` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `name TEXT NOT NULL`
  - `type TEXT NOT NULL` ('ordinary', 'overtime', 'allowance', 'deduction', 'super', 'leave')
  - `rate_type TEXT NOT NULL DEFAULT 'hourly'` ('hourly', 'annual', 'fixed')
  - `default_rate INTEGER DEFAULT 0` (cents — e.g. 3500 = $35.00/hr)
  - `multiplier REAL DEFAULT 1.0` (e.g. 1.5 for time-and-a-half, 2.0 for double time)
  - `is_taxable BOOLEAN DEFAULT true`
  - `is_super_bearing BOOLEAN DEFAULT true` (included in OTE for super calculation)
  - `is_active BOOLEAN DEFAULT true`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(user_id, type)`
  - INDEX on `(user_id, is_active)`

- [ ] Create `pay_structures` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE`
  - `pay_category_id TEXT NOT NULL REFERENCES pay_categories(id)`
  - `rate INTEGER NOT NULL` (cents — override of pay_category default)
  - `hours_per_week REAL` (for hourly employees)
  - `annual_salary INTEGER` (cents — for salaried employees)
  - `effective_date TEXT NOT NULL`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(employee_id, effective_date DESC)`
  - INDEX on `(pay_category_id)`

- [ ] Create `employee_documents` table:
  - `id TEXT PRIMARY KEY` (UUID)
  - `employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE`
  - `document_type TEXT NOT NULL` ('tfn_declaration', 'super_choice', 'contract', 'id', 'visa', 'other')
  - `file_name TEXT NOT NULL`
  - `file_path TEXT NOT NULL`
  - `file_size INTEGER` (bytes)
  - `uploaded_at TIMESTAMPTZ DEFAULT NOW()`
  - INDEX on `(employee_id, document_type)`

## Files to MODIFY

### 2. `server/src/schema.ts`
**Location**: Add BEFORE the `// TYPE EXPORTS` section

```typescript
// ============================================================================
// EMPLOYEE MANAGEMENT (Wave 4)
// ============================================================================

export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  dateOfBirth: text('date_of_birth'),
  address: text('address'), // JSON
  taxFileNumber: text('tax_file_number'), // AES-256-GCM encrypted
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  status: text('status').notNull().default('active'),
  employmentType: text('employment_type').notNull().default('full_time'),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeBankDetails = sqliteTable('employee_bank_details', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  bsb: text('bsb').notNull(), // REVISION (D02): AES-256-GCM encrypted at rest
  accountNumber: text('account_number').notNull(), // AES-256-GCM encrypted
  accountName: text('account_name').notNull(),
  splitPercentage: real('split_percentage').notNull().default(100.0),
  isPrimary: integer('is_primary', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeSuperFunds = sqliteTable('employee_super_funds', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  fundName: text('fund_name').notNull(),
  fundABN: text('fund_abn'),
  usi: text('usi'),
  memberNumber: text('member_number'),
  contributionRate: real('contribution_rate').notNull().default(11.5),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeTaxDeclarations = sqliteTable('employee_tax_declarations', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  taxFreeThreshold: integer('tax_free_threshold', { mode: 'boolean' }).default(true),
  helpDebt: integer('help_debt', { mode: 'boolean' }).default(false),
  sfssDebt: integer('sfss_debt', { mode: 'boolean' }).default(false),
  claimDependents: integer('claim_dependents').default(0),
  taxOffsetEstimated: integer('tax_offset_estimated').default(0),
  effectiveDate: text('effective_date').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const payCategories = sqliteTable('pay_categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  rateType: text('rate_type').notNull().default('hourly'),
  defaultRate: integer('default_rate').default(0),
  multiplier: real('multiplier').default(1.0),
  isTaxable: integer('is_taxable', { mode: 'boolean' }).default(true),
  isSuperBearing: integer('is_super_bearing', { mode: 'boolean' }).default(true),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const payStructures = sqliteTable('pay_structures', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  payCategoryId: text('pay_category_id').notNull().references(() => payCategories.id),
  rate: integer('rate').notNull(),
  hoursPerWeek: real('hours_per_week'),
  annualSalary: integer('annual_salary'),
  effectiveDate: text('effective_date').notNull(),
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const employeeDocuments = sqliteTable('employee_documents', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  documentType: text('document_type').notNull(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  uploadedAt: text('uploaded_at').notNull().default('CURRENT_TIMESTAMP'),
});
```

- [ ] Add type exports in the TYPE EXPORTS section:

```typescript
// Employee Management
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type EmployeeBankDetail = typeof employeeBankDetails.$inferSelect;
export type NewEmployeeBankDetail = typeof employeeBankDetails.$inferInsert;
export type EmployeeSuperFund = typeof employeeSuperFunds.$inferSelect;
export type NewEmployeeSuperFund = typeof employeeSuperFunds.$inferInsert;
export type EmployeeTaxDeclaration = typeof employeeTaxDeclarations.$inferSelect;
export type NewEmployeeTaxDeclaration = typeof employeeTaxDeclarations.$inferInsert;
export type PayCategory = typeof payCategories.$inferSelect;
export type NewPayCategory = typeof payCategories.$inferInsert;
export type PayStructure = typeof payStructures.$inferSelect;
export type NewPayStructure = typeof payStructures.$inferInsert;
export type EmployeeDocument = typeof employeeDocuments.$inferSelect;
export type NewEmployeeDocument = typeof employeeDocuments.$inferInsert;
```

### 3. `server/src/db/postgres-schema.ts`
**Purpose**: Add matching pgTable definitions for all 7 new tables
**Pattern**: Follow existing tables — use `pgTable()`, `timestamp()`, `boolean()`, `doublePrecision()`, include indexes

- [ ] Add `employees` pgTable with PG types (timestamp for dates, boolean for flags)
- [ ] Add `employeeBankDetails` pgTable
- [ ] Add `employeeSuperFunds` pgTable
- [ ] Add `employeeTaxDeclarations` pgTable
- [ ] Add `payCategories` pgTable
- [ ] Add `payStructures` pgTable
- [ ] Add `employeeDocuments` pgTable
- [ ] Add matching type exports

### 4. `server/src/index.ts` (import line)
Add all 7 new table imports to the schema import line:
```typescript
import { ..., employees, employeeBankDetails, employeeSuperFunds, employeeTaxDeclarations, payCategories, payStructures, employeeDocuments } from './schema.js'
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Migration file `0016_employee_management.sql` is valid PostgreSQL syntax
- [ ] All 7 sqliteTable definitions compile correctly
- [ ] All 14 type exports (7 select + 7 insert) resolve correctly
- [ ] `tax_file_number` column is TEXT (stores encrypted ciphertext, not raw TFN)
- [ ] `account_number` column is TEXT (stores encrypted ciphertext)
- [ ] Create marker file: `.agent-done-W04-01`

## Dependencies
- **None** — can start immediately
