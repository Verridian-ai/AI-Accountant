# Agent 2: Customer Service Builder

## Role
Build the customer management service with full CRUD operations, search, and contact management.

## Priority: SUB-WAVE 1 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/customers.ts`
**Purpose**: Customer lifecycle management — CRUD, contact management, search, and data validation
**Pattern**: Follow `server/src/services/accounts.ts` for DB access via `wrapPgDb()` proxy

#### Class: `CustomerService`

**Constructor**: Accepts `db` parameter (the wrapped PG/SQLite database)

**Methods**:

- [ ] `listCustomers(userId: string, options: { offset?: number; limit?: number; search?: string; isActive?: boolean }): Promise<{ data: Customer[]; total: number }>`
  - Paginated list with optional text search on businessName, contactName, email
  - Default: offset=0, limit=50, isActive=true. Max limit=100.
  - Returns `{ data: Customer[], total: number }`
  - **REVISION NOTE (D01 CRIT-03)**: Uses offset/limit (not page/limit) to match existing codebase convention.

- [ ] `getCustomer(userId: string, customerId: string): Promise<Customer | null>`
  - Fetch single customer with userId ownership check

- [ ] `createCustomer(userId: string, data: CreateCustomerInput): Promise<Customer>`
  - Generate UUID for id
  - Validate ABN format if provided (11 digits)
  - Set createdAt to ISO timestamp
  - Return created customer

  > **REVISION NOTE (D02 COMP-04 — ABN Validation via ABR Lookup)**:
  > Customer ABN MUST be validated using the existing ABN lookup service before saving:
  > 1. Import and use `server/src/services/enrichment/abn-lookup.ts` for real-time ABR verification.
  > 2. First validate ABN format locally (11-digit mod-89 check digit algorithm).
  > 3. Then call ABN lookup service to verify against Australian Business Register (ABR).
  > 4. **Warn but do NOT block** if ABR lookup fails (service may be temporarily unavailable).
  > 5. Store ABN validation result (e.g., `abnVerified: boolean`) for reference.
  > ```typescript
  > import { ABNLookupService } from './enrichment/abn-lookup.js';
  > // In createCustomer():
  > if (data.abn) {
  >   const abnService = new ABNLookupService();
  >   const validation = await abnService.lookupABN(data.abn).catch(() => null);
  >   if (validation && !validation.isValid) {
  >     // Warn: ABN not found in ABR — allow save but flag
  >   }
  > }
  > ```

- [ ] `updateCustomer(userId: string, customerId: string, data: Partial<CreateCustomerInput>): Promise<Customer>`
  - Ownership check (userId must match)
  - Partial update — only provided fields
  - Return updated customer

- [ ] `archiveCustomer(userId: string, customerId: string): Promise<void>`
  - Soft delete: set isActive = false
  - Do NOT hard delete (invoices may reference this customer)

- [ ] `listContacts(customerId: string): Promise<CustomerContact[]>`
  - All contacts for a customer

- [ ] `addContact(customerId: string, data: CreateContactInput): Promise<CustomerContact>`
  - Generate UUID for id
  - If isPrimary=true, unset isPrimary on other contacts for same customer
  - Return created contact

- [ ] `getCustomerWithBalance(userId: string, customerId: string): Promise<CustomerWithBalance>`
  - Customer record + calculated outstanding balance from unpaid invoices
  - Outstanding = SUM(amount_due) WHERE status IN ('sent','viewed','overdue')

- [ ] `searchCustomers(userId: string, query: string): Promise<Customer[]>`
  - Full-text search across businessName, contactName, email, abn
  - Used by invoice editor customer selector

**Types** (export from this file):

```typescript
export interface CreateCustomerInput {
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  abn?: string;
  paymentTermsDays?: number;
  notes?: string;
}

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface CustomerWithBalance {
  customer: Customer;
  outstandingBalanceCents: number;
  overdueBalanceCents: number;
  invoiceCount: number;
}
```

**Database access pattern**:
```typescript
// Use the same pattern as existing services
import { db } from '../schema.js';
// Access via: db.select().from(customers).where(...)
// Or via raw SQL through wrapPgDb() if needed
```

**Important implementation notes**:
- All monetary values in cents (INTEGER)
- ABN validation: strip spaces, check 11 digits, verify checksum if possible
- Country default: 'AU' (Australian-focused platform)
- State should accept AU state codes: NSW, VIC, QLD, SA, WA, TAS, NT, ACT

## Verification
- [ ] All methods handle userId ownership correctly (no cross-user data access)
- [ ] Pagination returns `{ data, total }` format
- [ ] ABN validation rejects invalid formats
- [ ] Soft delete (archive) preserves referential integrity
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W07-02`

## Dependencies
- **None** — can start immediately
- **Schema tables used**: `customers`, `customer_contacts`, `invoices` (for balance calc)
- **Note**: Schema may not exist yet when you start. Define your types locally and import from schema once Agent 1 completes. Use the `any` type for db if needed.
