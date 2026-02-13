# GoldLedger Wave 8: Recurring Invoices & Payment Processing

## Architecture References
- **Client**: React 18 + TypeScript, Tailwind CSS (neumorphic dark theme, gold #FFCC00 accent)
- **Server**: Hono + Drizzle ORM, PostgreSQL (wrapPgDb proxy → SQLite-like API)
- **Schema pattern**: `sqliteTable()` in `schema.ts` + `pgTable()` in `postgres-schema.ts` (dual)
- **Agent pattern**: `ClaudeAgent<TInput, TOutput>` in `base-agent.ts`
- **Cognee**: `CogneeClient` singleton → `CogneeTools` wrapper → agent tools
- **PDF**: `pdf-lib` (pure JS, no Chromium)
- **Payments**: Stripe SDK (`stripe: ^20.2.0` already in `server/package.json`)

## Current State (After Wave 7)
Wave 7 delivered the complete Customer Management & Invoice Generation system:
- **6 tables**: `customers`, `customer_contacts`, `invoices`, `invoice_lines`, `invoice_number_sequences`, `invoice_payments`
- **Migration**: `docker/migrations/0019_customers_invoices.sql`
- **3 services**: `customers.ts` (CustomerService), `invoicing.ts` (InvoicingService), `invoice-pdf.ts` (InvoicePDFService)
- **1 agent**: `invoice_agent` (Haiku 4.5, 7 tools)
- **17 API endpoints**: 7 customer + 10 invoice via `invoicing-routes.ts`
- **8 UI components**: InvoicingDashboard, CustomerList, CustomerDetail, CustomerForm, InvoiceList, InvoiceEditor, InvoicePreview, InvoicePDF
- **2 Cognee datasets**: `customer_profiles` (CHUNKS), `invoice_history` (GRAPH_COMPLETION)
- **Navigation tab**: 'invoicing' in App.tsx + BottomNavigation.tsx

## Wave 8 Dependencies
- **Wave 7 MUST be complete** — Wave 8 extends Wave 7's tables, services, routes, and UI
- All Wave 7 tables (`customers`, `invoices`, `invoice_payments`) must exist
- The `InvoicingService` and `invoicing-routes.ts` must be operational
- The `invoicingApi` object in `client/src/api.ts` must have all customer + invoice methods

## Database Schema (5 New Tables)

### Migration: `docker/migrations/0020_recurring_payments.sql`

#### 1. `recurring_invoices`
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| userId | TEXT | FK → users.id, NOT NULL |
| customerId | TEXT | FK → customers.id, NOT NULL |
| frequency | TEXT | NOT NULL ('weekly'|'fortnightly'|'monthly'|'quarterly'|'annually') |
| nextGenerationDate | TEXT | NOT NULL |
| endDate | TEXT | NULL (null = no end) |
| templateInvoiceId | TEXT | FK → invoices.id, NULL |
| isActive | INTEGER | DEFAULT 1 (boolean) |
| lastGeneratedAt | TEXT | NULL |
| createdAt | TEXT | DEFAULT CURRENT_TIMESTAMP |

#### 2. `payment_gateways`
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| userId | TEXT | FK → users.id, NOT NULL |
| provider | TEXT | NOT NULL ('stripe'|'paypal'|'bank_transfer') |
| config | TEXT | NOT NULL (encrypted JSON) |
| isActive | INTEGER | DEFAULT 1 (boolean) |
| createdAt | TEXT | DEFAULT CURRENT_TIMESTAMP |

#### 3. `dunning_sequences`
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| userId | TEXT | FK → users.id, NOT NULL |
| name | TEXT | NOT NULL |
| steps | TEXT | NOT NULL (JSON: [{daysAfterDue, action, template}]) |
| isActive | INTEGER | DEFAULT 1 (boolean) |
| createdAt | TEXT | DEFAULT CURRENT_TIMESTAMP |

#### 4. `dunning_history`
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| invoiceId | TEXT | FK → invoices.id, NOT NULL |
| sequenceId | TEXT | FK → dunning_sequences.id, NOT NULL |
| stepNumber | INTEGER | NOT NULL |
| sentAt | TEXT | NOT NULL |
| action | TEXT | NOT NULL ('email'|'sms'|'phone'|'suspend') |
| result | TEXT | NULL |
| createdAt | TEXT | DEFAULT CURRENT_TIMESTAMP |

#### 5. `customer_subscriptions`
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| customerId | TEXT | FK → customers.id, NOT NULL |
| name | TEXT | NOT NULL |
| amount | INTEGER | NOT NULL (cents) |
| frequency | TEXT | NOT NULL |
| startDate | TEXT | NOT NULL |
| endDate | TEXT | NULL |
| status | TEXT | DEFAULT 'active' ('active'|'paused'|'cancelled') |
| recurringInvoiceId | TEXT | FK → recurring_invoices.id, NULL |
| createdAt | TEXT | DEFAULT CURRENT_TIMESTAMP |

### Foreign Key Map
```
recurring_invoices.userId → users.id
recurring_invoices.customerId → customers.id
recurring_invoices.templateInvoiceId → invoices.id
payment_gateways.userId → users.id
dunning_sequences.userId → users.id
dunning_history.invoiceId → invoices.id
dunning_history.sequenceId → dunning_sequences.id
customer_subscriptions.customerId → customers.id
customer_subscriptions.recurringInvoiceId → recurring_invoices.id
```

### Indexes
```sql
CREATE INDEX idx_recurring_invoices_user_active ON recurring_invoices(user_id, is_active);
CREATE INDEX idx_recurring_invoices_next_date ON recurring_invoices(next_generation_date);
CREATE INDEX idx_dunning_history_invoice ON dunning_history(invoice_id);
CREATE INDEX idx_dunning_history_sequence ON dunning_history(sequence_id);
CREATE INDEX idx_customer_subscriptions_customer ON customer_subscriptions(customer_id);
CREATE INDEX idx_customer_subscriptions_status ON customer_subscriptions(status);
```

## API Endpoints (13 Net New)

### Recurring Invoices (5) — extends `invoicing-routes.ts`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/invoices/recurring` | List recurring invoices |
| POST | `/api/invoices/recurring` | Create recurring schedule |
| PATCH | `/api/invoices/recurring/:id` | Update schedule |
| DELETE | `/api/invoices/recurring/:id` | Cancel schedule |
| POST | `/api/invoices/recurring/:id/generate` | Manually generate next invoice |

### Payment Gateways (2) — new `payments-routes.ts`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payments/gateways` | List payment gateways |
| POST | `/api/payments/gateways` | Configure gateway |

### Payment Processing (1) — `payments-routes.ts`
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/payments/process/:invoiceId` | Process payment via gateway |

### Dunning (3) — `payments-routes.ts`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dunning/sequences` | List dunning sequences |
| POST | `/api/dunning/sequences` | Create dunning sequence |
| POST | `/api/dunning/send-reminders` | Trigger reminder batch |

### Customer Subscriptions (2) — extends `invoicing-routes.ts`
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/customers/:id/subscriptions` | List subscriptions |
| POST | `/api/customers/:id/subscriptions` | Create subscription |

## UI Components (5 New)

All in `client/src/features/invoicing/components/`:

| Component | Description |
|-----------|-------------|
| `RecurringInvoiceManager.tsx` | Create/manage recurring schedules; frequency, customer, template; next-generation dates |
| `SubscriptionManager.tsx` | Customer subscription lifecycle; active/paused/cancelled; links to recurring invoices |
| `PaymentGatewaySetup.tsx` | Configure Stripe/PayPal/bank transfer; connection status; API key management |
| `DunningManager.tsx` | Build payment reminder sequences; define steps; preview and activate |
| `PaymentHistory.tsx` | Payment timeline per customer; methods, linked invoices, running balance |

### Navigation
- No new top-level tab (extends existing 'invoicing' tab)
- Add sub-tabs to InvoicingDashboard: `'recurring' | 'subscriptions' | 'payments' | 'dunning'`

## Claude Agents
- **No new agents** — extends existing `invoice_agent` from Wave 7 with 4 new tools:
  - `manage_recurring_invoice` — Create/update/cancel recurring schedules
  - `process_payment` — Trigger gateway payment processing
  - `manage_dunning` — Configure and send dunning reminders
  - `manage_subscription` — Create/update/cancel customer subscriptions

## Cognee Integration
- **1 new dataset**: `payment_patterns` (GRAPH_COMPLETION)
- **2 new CogneeTools methods**: `indexPaymentPattern()`, `searchPaymentPatterns()`
- **1 new _moduleToDataset mapping**: `'payments' → COGNEE_DATASETS.paymentPatterns`

## Infrastructure
- **Stripe SDK**: Already installed (`stripe: ^20.2.0` in `server/package.json`)
- **New env vars**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_GATEWAY`, `PAYMENT_ENCRYPTION_KEY` (**REQUIRED** — AES-256 key for gateway config encryption, fail-fast if missing)
- **Client env**: `VITE_STRIPE_PUBLISHABLE_KEY` (optional, for Stripe Elements)
- **Scheduling**: Use `node-cron` polling (every 5 min) for recurring invoice generation — NOT `setTimeout`/`setInterval` (unreliable, lost on restart). Process missed invoices on startup. **(REVISION NOTE: D03 S8)**
- **New dependency**: `node-cron` — add to `server/package.json`
- **No new Docker services** — uses existing stack

## Testing Criteria (10)
1. `cd server && npx tsc --noEmit` — ZERO new errors
2. `cd client && npx tsc --noEmit` — ZERO new errors
3. Migration `0020_recurring_payments.sql` is valid PostgreSQL
4. All 5 schema tables in both `schema.ts` and `postgres-schema.ts`
5. Recurring invoice generates child invoices with correct amounts
6. Dunning sequence sends reminders at correct intervals
7. Payment gateway processes payment and updates invoice status
8. Subscription creates linked recurring invoices
9. All 13 API endpoints respond with correct status codes
10. 5 UI components render with neumorphic dark theme

## Team Structure (10 Agents)

### SUB-WAVE 1 (Parallel — No dependencies)
- **Agent 1**: Recurring Invoice Schema Builder — migration + dual schema definitions
- **Agent 6**: Cognee Payment Patterns Builder — dataset + CogneeTools methods

### SUB-WAVE 2 (After Agent 1)
- **Agent 2**: Recurring Invoice Service Builder — RecurringInvoiceService class
- **Agent 3**: Payment Gateway Builder — PaymentGatewayService + Stripe adapter
- **Agent 4**: Dunning Service Builder — DunningService class
- **Agent 5**: Subscription Service Builder — SubscriptionService class

### SUB-WAVE 3 (After Agents 2, 3, 4, 5)
- **Agent 7**: API Routes Builder — 13 endpoints in invoicing-routes.ts + payments-routes.ts

### SUB-WAVE 4 (After Agent 7)
- **Agent 8**: UI Recurring Invoice Builder — RecurringInvoiceManager + SubscriptionManager + api.ts extensions
- **Agent 9**: UI Payment & Dunning Builder — PaymentGatewaySetup + DunningManager + PaymentHistory + api.ts + InvoicingDashboard sub-tabs

### SUB-WAVE 5 (After ALL agents complete)
- **Agent 10**: Testing & Validation Agent — tsc checks, schema verification, integration tests

## Coordination Rules

1. **Migration 0020 depends on migration 0019** — Wave 7 tables must exist first
2. **Agent 1 MUST complete before Agents 2-5** — schema types needed for service files
3. **Agent 6 can run in parallel with Agent 1** — Cognee changes are independent of schema
4. **Agents 2-5 can run in parallel** — each creates an independent service file
5. **Agent 7 depends on Agents 2-5** — routes need all services
6. **Agent 7 creates TWO route files**: extends `invoicing-routes.ts` + creates `payments-routes.ts`
7. **Agents 8-9 coordinate on api.ts edits** — Agent 8 adds recurring/subscription methods first, Agent 9 adds payment/dunning methods
8. **Agent 9 modifies InvoicingDashboard.tsx** — adds 'recurring', 'subscriptions', 'payments', 'dunning' sub-tabs
9. **Agent 10 runs LAST** — validates everything
10. **Marker file naming**: `.agent-done-W08-{NN}` (01 through 10)
11. **Wave completion marker**: `.agent-done-wave8`
12. **All monetary values in INTEGER (cents)** — never use floats
13. **Stripe integration uses server-side only** — no client-side Stripe Elements in Wave 8 (optional later)
14. **Dunning steps stored as JSON array** — each step: `{ daysAfterDue: number, action: string, template: string }`
15. **REVISION NOTE (D02 CRIT-05)**: Payment gateway API keys MUST be encrypted at rest using AES-256-GCM with `PAYMENT_ENCRYPTION_KEY`. Keys decrypted only in-memory for API calls. Never logged or included in error messages. Server MUST fail-fast if `PAYMENT_ENCRYPTION_KEY` is missing.
16. **REVISION NOTE (D02)**: All payment operations MUST use idempotency keys (Stripe `idempotency_key` parameter + server-side dedup) to prevent double-charging.
17. **REVISION NOTE (D02)**: Stripe webhook endpoints MUST verify signatures via `stripe.webhooks.constructEvent()` before processing any event. Reject unverified webhooks with 400.
18. **REVISION NOTE (D03 S8)**: Recurring invoice scheduler MUST use `node-cron` polling (not setTimeout/setInterval). On server startup, catch up missed generations. `lastGeneratedAt` prevents double-generation.
19. **REVISION NOTE (D03 S9)**: Dunning email sends rate-limited: max 3 per customer per day, max 10 per batch. Large batches return 202 Accepted with job ID.
20. **Rate limiting (REVISION NOTE: D01-DC-04 / D02-SEC-06)**: All new API endpoints MUST use the existing rate limiter middleware. Tiered limits: read endpoints 100 req/min, write endpoints 30 req/min, AI/streaming endpoints 20 req/min, sensitive endpoints (TFN/payment/STP) 10 req/min.
21. **Code splitting (REVISION NOTE: D03-S6)**: All new UI feature components MUST be lazy-loaded via `React.lazy()` + `Suspense`. Each feature folder is a separate chunk. List components with 100+ potential rows MUST use `@tanstack/react-virtual`.

## Execution Priority Order

```
SUB-WAVE 1:  [Agent 1] ──┬── [Agent 6]
                          │
SUB-WAVE 2:  [Agent 2] ──┤── [Agent 3] ──┤── [Agent 4] ──┤── [Agent 5]
                          │
SUB-WAVE 3:              [Agent 7]
                          │
SUB-WAVE 4:  [Agent 8] ──┤── [Agent 9]
                          │
SUB-WAVE 5:              [Agent 10]
```
