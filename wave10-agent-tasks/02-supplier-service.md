# Agent 2: Supplier Service Builder

## Role
Build the supplier management service with CRUD operations, bank details handling, and supplier search.

## Priority: WAVE 10 (Start Immediately)

## Files to CREATE

### 1. `server/src/services/suppliers.ts`
**Purpose**: Supplier lifecycle management service
**Pattern**: Follow `server/src/services/accounts.ts` for CRUD service pattern

**Class**: `SupplierService`

**Methods**:

- [ ] `listSuppliers(userId: string, options?: ListOptions): Promise<{ data: Supplier[]; total: number }>`
  - Paginated list with default page=1, limit=50
  - Filterable by: isActive, search (businessName, contactName, abn)
  - Sort by businessName ASC default
  - Mask bankAccountNumber in listing (show last 4 digits only)

- [ ] `getSupplier(supplierId: string): Promise<SupplierDetail>`
  - Full supplier detail including:
    - Supplier record (with masked bank details)
    - Recent bills (last 10)
    - Total outstanding amount
    - Average days to payment
    - Total spend to date

- [ ] `createSupplier(userId: string, data: CreateSupplierInput): Promise<Supplier>`
  - Generate UUID for id
  - **REVISION NOTE (D02 COMP-04 — ABN Validation)**: Validate ABN using the EXISTING `services/enrichment/abn-lookup.ts` service:
    1. ABN format validation (11-digit mod-89 check digit algorithm) — ALWAYS enforce
    2. ABN lookup against ABR (Australian Business Register) via `ABNLookupService.lookupABN()` — perform if network available
    3. If ABR lookup succeeds: auto-populate `businessName` from ABR if not provided by user
    4. If ABR lookup fails (network error): WARN but allow creation (ABR may be temporarily unavailable)
    5. If ABN format is invalid: REJECT with validation error
  - Encrypt bankAccountNumber before storing (application-level encryption)
  - Default paymentTermsDays to 30 if not provided
  - Set createdAt to current timestamp

- [ ] `updateSupplier(supplierId: string, data: UpdateSupplierInput): Promise<Supplier>`
  - Partial update — only provided fields are changed
  - Re-encrypt bankAccountNumber if changed
  - Validate supplier belongs to user

- [ ] `archiveSupplier(supplierId: string): Promise<void>`
  - Soft delete: set isActive = false
  - Do NOT hard delete — bills/POs reference this supplier
  - Check for outstanding bills before archiving (warn but allow)

- [ ] `searchSuppliers(userId: string, query: string): Promise<Supplier[]>`
  - Full-text search across businessName, contactName, abn
  - Used by autocomplete in bill entry and PO creation
  - Returns max 10 results

- [ ] `getSupplierBankDetails(supplierId: string): Promise<{ bsb: string; accountNumber: string; accountName: string } | null>`
  - Decrypt and return bank details for payment processing
  - Only used internally by payment run service
  - DO NOT expose via API directly

**Interfaces**:

```typescript
interface CreateSupplierInput {
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  abn?: string;
  paymentTermsDays?: number;
  bankBsb?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  notes?: string;
}

interface UpdateSupplierInput {
  businessName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  abn?: string;
  paymentTermsDays?: number;
  bankBsb?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  notes?: string;
}

interface SupplierDetail extends Supplier {
  recentBills: Array<{
    id: string;
    billNumber: string;
    totalAmountCents: number;
    status: string;
    dueDate: string;
  }>;
  totalOutstandingCents: number;
  averageDaysToPayment: number;
  totalSpendCents: number;
}

interface ListOptions {
  page?: number;
  limit?: number;
  isActive?: boolean;
  search?: string;
  sortBy?: 'businessName' | 'createdAt' | 'totalSpend';
  sortOrder?: 'asc' | 'desc';
}
```

**Encryption approach**:
```typescript
// REVISION NOTE (D02 SEC-05): Use AES-256-GCM (authenticated encryption), NOT AES-256-CBC.
// This matches the encryption pattern used for employee bank details in Wave 4.
// Use a SEPARATE encryption key (BANK_ENCRYPTION_KEY) — not the TFN key.
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const BANK_ENCRYPTION_KEY = process.env.BANK_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
if (!BANK_ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('BANK_ENCRYPTION_KEY must be set in production');
}
const ENCRYPTION_KEY = BANK_ENCRYPTION_KEY || 'default-32-char-encryption-key!!'; // 32 bytes
const IV_LENGTH = 12; // GCM uses 12-byte IV (not 16)
const AUTH_TAG_LENGTH = 16;

function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv:authTag:encrypted (all hex)
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  const parts = text.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encryptedText = Buffer.from(parts[2], 'hex');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber) return '';
  return '****' + accountNumber.slice(-4);
}
```

**REVISION NOTE (D02 SEC-05)**: Key changes from original spec:
1. **AES-256-GCM** instead of AES-256-CBC — GCM provides authenticated encryption (integrity + confidentiality)
2. **Separate key**: Use `BANK_ENCRYPTION_KEY` env var (falls back to `ENCRYPTION_KEY` for dev, but production MUST set it)
3. **Fail fast**: Throw on missing key in production (`NODE_ENV=production`)
4. **12-byte IV**: GCM standard is 12 bytes (not 16)
5. **Auth tag stored**: Format includes authentication tag for tamper detection

**Implementation notes**:
- All monetary calculations in cents (INTEGER) — never floating point
- **REVISION NOTE (D02 COMP-04)**: ABN validation is NOT optional — use the existing `ABNLookupService` from `server/src/services/enrichment/abn-lookup.ts`. The mod-89 check digit validation MUST be applied on every create/update. The ABR online lookup is best-effort (warn on failure, don't block).
- Bank BSB format: 3 digits, dash, 3 digits (e.g., 062-000)
- Use `wrapPgDb()` for all DB queries
- Ensure encrypted fields can be round-tripped: encrypt on save, decrypt on read

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Supplier CRUD creates, reads, updates, and archives correctly
- [ ] Bank account number is encrypted in storage and decrypted on read
- [ ] Account number is masked in list responses (show last 4 only)
- [ ] Search finds suppliers by name and ABN
- [ ] Pagination returns correct total count
- [ ] Create marker file: `.agent-done-W10-02`

## Dependencies
- **None** — can start immediately (service uses interfaces, not schema imports directly)
- **Runtime dependency**: Requires `suppliers` table (from Agent 1 migration)
