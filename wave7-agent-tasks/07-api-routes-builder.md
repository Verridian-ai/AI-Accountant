# Agent 7: API Routes Builder

## Role
Create the invoicing routes file with 17 API endpoints and mount it in the main server index.

## Priority: SUB-WAVE 3 (After Agents 2, 3, 4, 5)

## Files to CREATE

### 1. `server/src/routes/invoicing-routes.ts`
**Purpose**: All 17 customer and invoice API endpoints in a dedicated Hono route file
**Pattern**: Follow `server/src/routes/pipeline.ts` for route file structure

#### Route Structure:

```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
// Import services...

const invoicingRoutes = new Hono();
```

#### Endpoints to implement:

**Customer Endpoints (7)**:

- [ ] `GET /customers` — List customers
  - Query params: `offset`, `limit`, `search`, `isActive`
  - Response: `{ data: Customer[], total: number }`
  - Zod validation for query params

  > **REVISION NOTE (D03 — Server-Side Pagination)**:
  > All list endpoints (`/api/customers` and `/api/invoices`) MUST use server-side pagination with `offset/limit` (NOT `page/limit`) to match existing codebase convention. Enforce max limit of 100 per request. Include total count in response.
  > ```typescript
  > const paginationSchema = z.object({
  >   offset: z.coerce.number().int().min(0).default(0),
  >   limit: z.coerce.number().int().min(1).max(100).default(50),
  > });
  > ```

- [ ] `POST /customers` — Create customer
  - Body: CreateCustomerInput (Zod validated)
  - Response: Customer object
  - Calls `CustomerService.createCustomer()`

- [ ] `GET /customers/:id` — Get customer detail
  - Response: CustomerWithBalance (includes outstanding balance)
  - Calls `CustomerService.getCustomerWithBalance()`

- [ ] `PATCH /customers/:id` — Update customer
  - Body: Partial<CreateCustomerInput> (Zod validated)
  - Response: Updated Customer
  - Calls `CustomerService.updateCustomer()`

- [ ] `DELETE /customers/:id` — Archive customer
  - Soft delete (set isActive=false)
  - Response: `{ success: true }`
  - Calls `CustomerService.archiveCustomer()`

- [ ] `GET /customers/:id/contacts` — List contacts
  - Response: CustomerContact[]
  - Calls `CustomerService.listContacts()`

- [ ] `POST /customers/:id/contacts` — Add contact
  - Body: CreateContactInput (Zod validated)
  - Response: CustomerContact
  - Calls `CustomerService.addContact()`

**Invoice Endpoints (10)**:

- [ ] `GET /invoices` — List invoices
  - Query params: `offset`, `limit`, `status`, `customerId`, `dateFrom`, `dateTo`
  - Response: `{ data: InvoiceWithCustomer[], total: number }`

- [ ] `POST /invoices` — Create invoice
  - Body: CreateInvoiceInput with lineItems array (Zod validated)
  - Response: InvoiceWithLines
  - Calls `InvoicingService.createInvoice()`

- [ ] `GET /invoices/:id` — Get invoice detail
  - Response: InvoiceWithLines (includes lines + customer)
  - Calls `InvoicingService.getInvoice()`

- [ ] `PATCH /invoices/:id` — Update draft invoice
  - Body: UpdateInvoiceInput (Zod validated)
  - Only allowed for draft invoices
  - Response: InvoiceWithLines

- [ ] `POST /invoices/:id/send` — Send invoice
  - Changes status draft → sent
  - Response: Invoice
  - Calls `InvoicingService.sendInvoice()`

- [ ] `POST /invoices/:id/void` — Void invoice
  - Response: Invoice
  - Calls `InvoicingService.voidInvoice()`

- [ ] `GET /invoices/:id/pdf` — Download invoice PDF
  - Generate PDF if not exists, or serve existing
  - Response: PDF file (application/pdf content-type)
  - Calls `InvoicePDFService.generateInvoicePDF()`

- [ ] `POST /invoices/:id/payment` — Record payment
  - Body: RecordPaymentInput (Zod validated)
  - Response: InvoicePayment
  - Calls `InvoicingService.recordPayment()`

- [ ] `POST /invoices/credit-note` — Create credit note
  - Body: CreateCreditNoteInput (Zod validated)
  - Response: InvoiceWithLines
  - Calls `InvoicingService.createCreditNote()`

- [ ] `GET /invoices/next-number` — Get next invoice number
  - Response: `{ nextNumber: string }`
  - Calls `InvoicingService.getNextInvoiceNumber()`
  - **IMPORTANT**: Register this route BEFORE `/invoices/:id` to avoid route conflict

#### Zod Schemas to define:

```typescript
const createCustomerSchema = z.object({
  businessName: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().default('AU'),
  abn: z.string().regex(/^\d{11}$/).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  notes: z.string().optional(),
});

const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().positive(),
    unitPriceCents: z.number().int().min(0),
    gstRate: z.number().min(0).max(1).default(0.1),
    accountCode: z.string().optional(),
    taxCode: z.string().optional(),
  })).min(1),
});

const recordPaymentSchema = z.object({
  paymentDate: z.string().min(1),
  amountCents: z.number().int().positive(),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});
```

Export the routes:
```typescript
export default invoicingRoutes;
```

## Files to MODIFY

### 2. `server/src/index.ts`
**Purpose**: Mount the invoicing routes

**Add import**:
```typescript
import invoicingRoutes from './routes/invoicing-routes.js';
```

**Add route mounting** (near other `app.route()` calls):
```typescript
app.route('/api', invoicingRoutes);
```

**Add schema imports** (if needed for inline access):
```typescript
import { customers, customerContacts, invoices, invoiceLines, invoiceNumberSequences, invoicePayments } from './schema.js';
```

## Verification
- [ ] All 17 endpoints respond correctly (can test with curl)
- [ ] Zod validation rejects invalid input with 400 status
- [ ] Pagination returns `{ data, total }` format
- [ ] PDF endpoint returns `content-type: application/pdf`
- [ ] `/invoices/next-number` is registered before `/invoices/:id`
- [ ] No route collisions with existing endpoints
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W07-07`

## Dependencies
- **Agent 2**: CustomerService must exist
- **Agent 3**: InvoicingService must exist
- **Agent 4**: InvoicePDFService must exist
- **Agent 5**: InvoiceAgent must be registered (for potential agent dispatch)
