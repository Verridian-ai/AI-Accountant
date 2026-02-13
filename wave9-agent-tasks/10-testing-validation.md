# Agent 10: Testing & Validation

## Role
Run the complete verification plan for Wave 9, ensure TypeScript compilation passes, validate all API endpoints, and update documentation.

## Priority: WAVE 9 (After All Agents Complete)

## Verification Plan

### 1. TypeScript Compilation
- [ ] Run `cd server && npx tsc --noEmit` — must pass with zero errors
- [ ] Run `cd client && npx tsc --noEmit` — must pass with zero errors
- [ ] If errors found, identify which agent's code caused them and document fixes needed

### 2. Schema Validation
- [ ] Verify all 4 new tables exist in `server/src/schema.ts` (currencies, exchangeRates, invoiceTemplates, customerStatements)
- [ ] Verify all 4 new tables exist in `server/src/db/postgres-schema.ts` with matching columns
- [ ] Verify 8 type exports (4 select + 4 insert types) in schema.ts
- [ ] Verify migration `docker/migrations/0021_ar_multicurrency.sql` is valid SQL:
  - Valid `CREATE TABLE IF NOT EXISTS` syntax
  - All FK references resolve to existing tables
  - `customer_statements.customer_id` references `customers(id)` (from Wave 7 migration 0019)
  - Indexes are created
  - Currency seed data is included
  - Wrapped in `BEGIN; ... COMMIT;`

### 3. Service Validation
- [ ] Verify `server/src/services/ar-aging.ts` exports `ARAgingService` class with all required methods
- [ ] Verify `server/src/services/multicurrency.ts` exports `MultiCurrencyService` class
- [ ] Verify `server/src/services/invoice-templates.ts` exports `InvoiceTemplateService` class
- [ ] Verify `server/src/services/customer-statements.ts` exports `CustomerStatementService` class
- [ ] Verify all services are imported and instantiated in `server/src/index.ts`

### 4. API Endpoint Validation
- [ ] Verify 12 endpoints exist in index.ts:
  - GET /api/ar/aging
  - GET /api/ar/aging/:customerId
  - GET /api/ar/summary
  - GET /api/currencies
  - GET /api/exchange-rates/:from/:to
  - POST /api/exchange-rates/refresh
  - GET /api/invoice-templates
  - POST /api/invoice-templates
  - PATCH /api/invoice-templates/:id
  - POST /api/invoice-templates/:id/logo
  - GET /api/customers/:id/statement
  - GET /api/gst/sales-summary
- [ ] Verify `/api/gst/sales-summary` does NOT shadow existing `/api/gst/summary`
- [ ] Verify Zod validation schemas exist for POST/PATCH endpoints

### 5. UI Component Validation
- [ ] Verify 7 new .tsx files exist in `client/src/features/invoicing/components/`:
  - ARAgingReport.tsx
  - GSTSalesReport.tsx
  - CustomerStatement.tsx
  - InvoiceTemplateEditor.tsx
  - MultiCurrencySelector.tsx
  - ExchangeRateManager.tsx
  - LogoUploader.tsx
- [ ] Verify all components import from `client/src/api.ts`
- [ ] Verify API functions exist in `client/src/api.ts`
- [ ] Verify components are wired into App.tsx

### 6. Cognee Integration Validation
- [ ] Verify `ar_aging_patterns` added to COGNEE_DATASETS in cognee-tools.ts
- [ ] Verify `indexARAgingData()` method exists on CogneeTools
- [ ] Verify `searchARAgingPatterns()` method exists on CogneeTools

### 7. Coordination Rule Compliance
- [ ] Marker naming: All agents used `.agent-done-W09-{NN}` format
- [ ] Schema lock: Only Agent 1 modified schema.ts and postgres-schema.ts
- [ ] index.ts lock: Only Agent 7 modified server/src/index.ts
- [ ] Monetary amounts are INTEGER (cents), not floating-point
- [ ] Exchange rates use REAL type (acceptable for rates)

### 8. Documentation Updates
- [ ] Update `docs/wave0-master-plan.md` Wave 9 section with completion notes
- [ ] Document new environment variables:
  - `EXCHANGE_RATE_API_KEY`
  - `EXCHANGE_RATE_PROVIDER`
  - `BASE_CURRENCY`
  - `EXCHANGE_RATE_CACHE_TTL`

## Verification
- [ ] All above checks pass
- [ ] Create marker file: `.agent-done-W09-10`
- [ ] Create wave completion marker: `.agent-done-wave9`

## Dependencies
- **All Agents 1-9** must complete before this agent starts
