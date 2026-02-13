# Wave 9 — AR Aging & Multi-Currency — Orchestration Prompt

You are the **Team Lead** for Wave 9: AR Aging & Multi-Currency. You coordinate 10 specialized agents to add accounts receivable aging analysis, multi-currency support, invoice template branding, and customer statement generation to GoldLedger.

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Implementation plan**: `docs/Agent planning chat.md` (Wave 9, lines ~1240–1270)
- **Existing agents pattern**: `server/src/services/claude/agents/payroll-agent.ts`
- **Base class**: `server/src/services/claude/base-agent.ts` (ClaudeAgent<TInput, TOutput>)
- **Docker stack**: `docker-compose.yml` (5 services: postgres, redis, cognee, server, client)

## Current State (After Wave 8)
- 12 Claude agents (11 original + invoice_agent from Wave 7)
- SQLite + PostgreSQL dual schema synchronized
- Customer invoicing module operational (customers, invoices, invoice_payments, invoice_lines, invoice_number_sequences)
- Recurring invoices, payment gateways, dunning sequences, and customer subscriptions from Wave 8
- Cognee datasets: customer_profiles, invoice_history, payment_patterns
- 10 migrations (0009–0020) applied

## Dependencies
- **Requires**: Wave 8 complete (recurring invoices, payment processing, dunning for AR analysis)
- **Estimated Complexity**: MEDIUM

## Database Schema Changes

### New Tables (4 tables)
| Table | Columns |
|-------|---------|
| `currencies` | id, code (UNIQUE), name, symbol, decimalPlaces (default 2), isActive (default true) |
| `exchange_rates` | id, fromCurrency (FK→currencies.code), toCurrency (FK→currencies.code), rate, effectiveDate, source ('manual'\|'api'), createdAt |
| `invoice_templates` | id, userId (FK→users), name, logoPath, headerHtml, footerHtml, colorScheme (JSON), isDefault (default false), createdAt |
| `customer_statements` | id, customerId (FK→customers), periodStart, periodEnd, openingBalance (INTEGER cents), closingBalance (INTEGER cents), pdfPath, generatedAt |

**Migration**: `docker/migrations/0021_ar_multicurrency.sql`

## API Endpoints (12 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/ar/aging | AR aging report (all customers, bucketed: current/30/60/90+) |
| GET | /api/ar/aging/:customerId | Customer-specific aging detail |
| GET | /api/ar/summary | AR summary (total outstanding, overdue amounts) |
| GET | /api/currencies | List supported currencies |
| GET | /api/exchange-rates/:from/:to | Get exchange rate for currency pair |
| POST | /api/exchange-rates/refresh | Refresh rates from external API |
| GET | /api/invoice-templates | List invoice templates |
| POST | /api/invoice-templates | Create invoice template |
| PATCH | /api/invoice-templates/:id | Update invoice template |
| POST | /api/invoice-templates/:id/logo | Upload logo for template |
| GET | /api/customers/:id/statement | Generate statement of account for customer |
| GET | /api/gst/sales-summary | GST on sales report (aggregated from invoices) |

## UI Components
### `client/src/features/invoicing/components/` — Extend existing invoicing feature folder
- ARAgingReport.tsx — AR aging buckets visualization (current/30/60/90+ days) with customer drill-down
- CustomerStatement.tsx — Statement of account viewer with PDF generation
- MultiCurrencySelector.tsx — Currency picker component for invoices
- ExchangeRateManager.tsx — Exchange rate dashboard with manual entry and API refresh
- InvoiceTemplateEditor.tsx — WYSIWYG invoice template customization (header, footer, colors)
- LogoUploader.tsx — Logo upload with preview and resize
- GSTSalesReport.tsx — GST collected on sales summary report

**Navigation**: No new tab — these components are sub-views under existing `invoicing` tab

## New Claude Agents (0)
No new agents in this wave. Existing agents may be enhanced with AR-related tools.

## Cognee Integration
- **New dataset**: `ar_aging_patterns` (GRAPH_COMPLETION)
- Index aging data for "Which customers always pay late?"
- Cross-reference with `payment_patterns` dataset (Wave 8) for payment behavior analysis
- Use GRAPH_COMPLETION for reasoning about payment trends and risk assessment
- Add `indexARAgingData()` and `searchARAgingPatterns()` to CogneeTools

## Testing Criteria
- [ ] Aging buckets correctly categorize invoices (current, 1-30, 31-60, 61-90, 90+ days)
- [ ] Multi-currency conversion uses correct exchange rate for invoice date
- [ ] Exchange rate API refresh stores new rates and uses cache (Redis TTL)
- [ ] Invoice template renders with custom logo, header, footer, and color scheme
- [ ] Customer statement includes all invoices and payments for period with correct balances
- [ ] GST sales report aggregates correctly from invoice line items
- [ ] Opening balance = previous period closing balance (statement continuity)
- [ ] Chat answers "Who owes me the most?" via Cognee AR aging search
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `cd client && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: multicurrency-schema-builder [PRIORITY: WAVE 1]
**Role**: Create currencies, exchange_rates, invoice_templates, and customer_statements tables in dual schema + migration SQL
**Task file**: `wave9-agent-tasks/01-multicurrency-schema.md`
**Creates**: docker/migrations/0021_ar_multicurrency.sql
**Modifies**: server/src/schema.ts, server/src/db/postgres-schema.ts
**Dependencies**: None — can start immediately

### Agent 2: ar-aging-engine [PRIORITY: WAVE 1]
**Role**: Build AR aging calculation service with bucket categorization and aging report generation
**Task file**: `wave9-agent-tasks/02-ar-aging-engine.md`
**Creates**: server/src/services/ar-aging.ts
**Dependencies**: None — can start immediately

### Agent 3: multicurrency-service [PRIORITY: WAVE 1]
**Role**: Build multi-currency service with exchange rate fetching, caching, and conversion logic
**Task file**: `wave9-agent-tasks/03-multicurrency-service.md`
**Creates**: server/src/services/multicurrency.ts
**Dependencies**: None — can start immediately

### Agent 4: invoice-template-service [DEPENDS ON: Agent 1]
**Role**: Build invoice template service with logo upload, HTML rendering, and PDF generation
**Task file**: `wave9-agent-tasks/04-invoice-template-service.md`
**Creates**: server/src/services/invoice-templates.ts
**Dependencies**: Agent 1 must complete schema first

### Agent 5: customer-statement-service [DEPENDS ON: Agent 1]
**Role**: Build customer statement of account service with period calculations and PDF output
**Task file**: `wave9-agent-tasks/05-customer-statement-service.md`
**Creates**: server/src/services/customer-statements.ts
**Dependencies**: Agent 1 must complete schema first

### Agent 6: cognee-ar-datasets [DEPENDS ON: Agent 1]
**Role**: Configure Cognee datasets for AR aging patterns and extend CogneeTools
**Task file**: `wave9-agent-tasks/06-cognee-ar-datasets.md`
**Modifies**: server/src/services/claude/cognee-tools.ts, server/src/services/cognee_client.ts
**Dependencies**: Schema must exist

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 2, 3, 4, 5]
**Role**: Wire 12 new API routes in server/src/index.ts
**Task file**: `wave9-agent-tasks/07-api-endpoints-builder.md`
**Modifies**: server/src/index.ts
**Dependencies**: All backend services must exist

### Agent 8: ui-ar-aging-builder [DEPENDS ON: Agent 7]
**Role**: Build AR aging and GST sales report UI components
**Task file**: `wave9-agent-tasks/08-ui-ar-aging-builder.md`
**Creates**: ARAgingReport.tsx, GSTSalesReport.tsx, CustomerStatement.tsx in client/src/features/invoicing/components/
**Modifies**: client/src/api.ts, client/src/App.tsx
**Dependencies**: API routes must exist

### Agent 9: ui-template-currency-builder [DEPENDS ON: Agent 7]
**Role**: Build invoice template editor, currency selector, exchange rate manager, and logo uploader UI
**Task file**: `wave9-agent-tasks/09-ui-template-currency-builder.md`
**Creates**: InvoiceTemplateEditor.tsx, MultiCurrencySelector.tsx, ExchangeRateManager.tsx, LogoUploader.tsx in client/src/features/invoicing/components/
**Modifies**: client/src/api.ts
**Dependencies**: API routes must exist

### Agent 10: testing-validation [DEPENDS ON: All]
**Role**: Run verification plan and documentation updates
**Task file**: `wave9-agent-tasks/10-testing-validation.md`
**Dependencies**: All agents must complete

## Coordination Rules

1. **Schema lock**: Only Agent 1 modifies schema.ts and postgres-schema.ts
2. **cognee-tools.ts lock**: Only Agent 6 modifies cognee-tools.ts
3. **index.ts lock**: Only Agent 7 modifies server/src/index.ts
4. **api.ts lock**: Only Agents 8 and 9 modify client/src/api.ts (Agent 8 first, then Agent 9)
5. **Pattern compliance**: Follow existing invoicing service patterns from Wave 7/8
6. **Dual schema**: Every table in BOTH schema.ts AND postgres-schema.ts
7. **Test before done**: `cd server && npx tsc --noEmit` must pass
8. **Marker naming**: Use `.agent-done-W09-{NN}` format (wave-prefixed to avoid collisions with other waves)
9. **Zod validation**: All new API endpoints MUST use Zod schemas for request body validation via `zValidator` middleware
10. **Index discipline**: Migration SQL MUST include CREATE INDEX for query patterns — at minimum: `exchange_rates(from_currency, to_currency, effective_date)` UNIQUE, `customer_statements(customer_id, period_start)`
11. **Pagination standard**: All list endpoints MUST support `?offset=0&limit=50` pagination (NOT `?page=`), returning `{ data: T[], total: number }`. Max limit=100. This matches the existing codebase convention. **REVISION NOTE (D01-CRIT-03)**: Standardized from page-based to offset-based pagination across all waves.
12. **Exchange rate caching**: **REVISION NOTE (D03 S3)**: Cache exchange rates in Redis with **1-hour TTL**. Fallback chain: (1) Redis cache, (2) last known rate from `exchange_rates` DB table, (3) error with clear message. Store ALL fetched rates in DB for audit trail. Log staleness warnings when rates >24 hours old.
13. **Monetary amounts in cents**: All monetary fields stored as INTEGER (cents) — no floating-point currency
14. **Multi-currency GST (ATO)**: **REVISION NOTE (D02)**: GST on foreign currency invoices MUST be calculated at the exchange rate on the DATE OF SUPPLY (per ATO GSTR 2001/2), NOT the current rate. `convertAmount()` MUST accept and enforce a date parameter for GST conversions.
15. **PDF generation DRY**: **REVISION NOTE (D01)**: Customer statement PDF generation (Agent 5) MUST reuse the `pdf-lib` infrastructure from Wave 7's invoice PDF service. Extract shared PDF utilities into `pdf-utils.ts` if needed — do NOT create a separate PDF pipeline.
16. **Rate limiting (REVISION NOTE: D01-DC-04 / D02-SEC-06)**: All new API endpoints MUST use the existing rate limiter middleware. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min.
17. **Code splitting (REVISION NOTE: D03-S6)**: All new UI feature components MUST be lazy-loaded via React.lazy() + Suspense. Each feature folder is a separate chunk. List components with 100+ potential rows MUST use @tanstack/react-virtual.

## Debate Findings Applied

| Finding | Source | Resolution |
|---------|--------|------------|
| Marker naming collision | D05 §6 (P0) | Fixed: `.agent-done-W09-{NN}` format |
| Missing indexes | D03 §2.2 | Added index discipline to coordination rules + migration |
| Zod validation missing | D02 API-01 | Added Zod requirement to coordination rules |
| Pagination not standardized | D03 §4.3 | Added pagination standard to coordination rules |
| GST sales-summary near-miss | R06 §3.1 | `/api/gst/sales-summary` does NOT collide with existing `/api/gst/summary` — different paths |
| Exchange rate floating-point risk | D02 §Wave9 | All monetary amounts stored as INTEGER cents; exchange rates as REAL for precision |
| **Exchange rate caching** | **D03 S3 (REVISION)** | **Cache in Redis with 1-hour TTL, fallback to last known rate if API down, store historical rates in exchange_rates table for audit trail** |
| **Multi-currency GST** | **D02 (REVISION)** | **GST on foreign currency invoices must use exchange rate on DATE OF SUPPLY (ATO requirement GSTR 2001/2), not current rate** |
| **AR aging query performance** | **D03 (REVISION)** | **AR aging queries must use INDEXED date columns and aggregate in SQL (CASE WHEN), not fetch-and-calculate in JS** |
| **Statement PDF DRY** | **D01 (REVISION)** | **Customer statement PDF generation must reuse Wave 7 pdf-lib infrastructure, not create separate approach** |
| **Exchange rate API error handling** | **D03 S3 (REVISION)** | **Fallback chain: Redis cache → DB last known rate → error. Log staleness warnings >24h. Notify user via SSE when using stale rates.** |

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5 + Agent 6
Sub-wave 3 (After 2):  Agent 7
Sub-wave 4 (After 3):  Agent 8 + Agent 9
Sub-wave 5 (After 4):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates and begin coordinating their work according to the sub-wave execution order above. Read each agent's task file from `wave9-agent-tasks/` for detailed atomic tasks.
