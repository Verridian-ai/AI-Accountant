# Agent 7: API Endpoints Builder

## Role
Wire 12 new API routes for AR aging, currencies, exchange rates, invoice templates, customer statements, and GST sales in server/src/index.ts.

## Priority: WAVE 9 (After Agents 2, 3, 4, 5)

## Files to MODIFY

### 1. `server/src/index.ts`
**Purpose**: Add 12 new API endpoints
**Pattern**: Follow existing endpoint patterns in index.ts — use Zod validation, pagination, error handling

**Add these routes** (group them together with a section comment):

```typescript
// ============================================================================
// AR AGING & MULTI-CURRENCY (Wave 9)
// ============================================================================
```

#### AR Aging Endpoints (3)

- [ ] `GET /api/ar/aging` — AR aging report
  - Query params: `?asOfDate=YYYY-MM-DD` (optional, default today)
  - Handler: `arAgingService.getAgingReport(userId, asOfDate)`
  - Response: `{ data: ARAgingReport }`

- [ ] `GET /api/ar/aging/:customerId` — Customer-specific aging
  - Params: `customerId`
  - Query params: `?asOfDate=YYYY-MM-DD` (optional)
  - Handler: `arAgingService.getCustomerAging(userId, customerId, asOfDate)`
  - Response: `{ data: CustomerAgingDetail }`

- [ ] `GET /api/ar/summary` — AR summary
  - Handler: `arAgingService.getARSummary(userId)`
  - Response: `{ data: ARSummary }`

#### Currency Endpoints (3)

- [ ] `GET /api/currencies` — List currencies
  - Handler: `multiCurrencyService.listCurrencies()`
  - Response: `{ data: Currency[] }`

- [ ] `GET /api/exchange-rates/:from/:to` — Get exchange rate
  - Params: `from` (ISO currency code), `to` (ISO currency code)
  - Query params: `?date=YYYY-MM-DD` (optional)
  - Handler: `multiCurrencyService.getExchangeRate(from, to, date)`
  - Response: `{ data: ExchangeRate | null }`

- [ ] `POST /api/exchange-rates/refresh` — Refresh rates from API
  - Body (Zod): `{ baseCurrency?: string }` (optional, default AUD)
  - Handler: `multiCurrencyService.refreshRatesFromAPI(baseCurrency)`
  - Response: `{ data: RefreshResult }`

#### Invoice Template Endpoints (4)

- [ ] `GET /api/invoice-templates` — List templates
  - Handler: `invoiceTemplateService.listTemplates(userId)`
  - Response: `{ data: InvoiceTemplate[] }`

- [ ] `POST /api/invoice-templates` — Create template
  - Body (Zod): `{ name: string, headerHtml?: string, footerHtml?: string, colorScheme?: object, isDefault?: boolean }`
  - Handler: `invoiceTemplateService.createTemplate(userId, body)`
  - Response: `{ data: InvoiceTemplate }` (201)

- [ ] `PATCH /api/invoice-templates/:id` — Update template
  - Body (Zod): Partial of create body
  - Handler: `invoiceTemplateService.updateTemplate(id, body)`
  - Response: `{ data: InvoiceTemplate }`

- [ ] `POST /api/invoice-templates/:id/logo` — Upload logo
  - Content-Type: multipart/form-data
  - File field: `logo` (max 2MB, image/png | image/jpeg | image/svg+xml)
  - Handler: `invoiceTemplateService.uploadLogo(id, file)`
  - Response: `{ data: { logoPath: string } }`

#### Customer Statement & GST Endpoints (2)

- [ ] `GET /api/customers/:id/statement` — Generate statement
  - Query params: `?periodStart=YYYY-MM-DD&periodEnd=YYYY-MM-DD` (required)
  - Handler: `customerStatementService.generateStatement(id, periodStart, periodEnd)`
  - Response: `{ data: CustomerStatementData }`

- [ ] `GET /api/gst/sales-summary` — GST on sales report
  - Query params: `?periodStart=YYYY-MM-DD&periodEnd=YYYY-MM-DD` (required)
  - Handler: `arAgingService.getGSTSalesReport(userId, periodStart, periodEnd)`
  - Response: `{ data: GSTSalesReport }`
  - **IMPORTANT**: Path is `/api/gst/sales-summary` NOT `/api/gst/summary` (that already exists)

### 2. Service Imports
**Add at top of index.ts**:
```typescript
import { ARAgingService } from './services/ar-aging.js';
import { MultiCurrencyService } from './services/multicurrency.js';
import { InvoiceTemplateService } from './services/invoice-templates.js';
import { CustomerStatementService } from './services/customer-statements.js';
```

**Instantiate services**:
```typescript
const arAgingService = new ARAgingService(db);
const multiCurrencyService = new MultiCurrencyService(db);
const invoiceTemplateService = new InvoiceTemplateService(db);
const customerStatementService = new CustomerStatementService(db);
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] All 12 endpoints return correct response shapes
- [ ] Zod validation rejects invalid request bodies
- [ ] Logo upload endpoint handles multipart/form-data correctly
- [ ] `/api/gst/sales-summary` does NOT conflict with existing `/api/gst/summary`
- [ ] Create marker file: `.agent-done-W09-07`

## Dependencies
- **Agents 2, 3, 4, 5** must complete their services first
- **Agent 1** must complete schema (for type imports in services)
