# CBA Overhaul — Integration Test Plan

> Comprehensive test plan for the GoldLedger (CBA Statements Parse) v2.0 overhaul.
> Covers batch upload, multi-account, transfer detection, GST/BAS, credit cards, and full E2E.

---

## Test Environment

| Component | Details |
|-----------|---------|
| **Server** | Hono API on port 3501 (Node.js + Python agents) |
| **Client** | Vite React on port 5173 (dev) / nginx on port 8080 (Docker) |
| **Database** | PostgreSQL 17 + pgvector (Docker) or SQLite (dev) |
| **Cognee** | Knowledge graph on port 8000 (Docker) |
| **Test Data** | 29 PDF statements in `./statements/` |
| **Test Runner** | Vitest (both server and client) |
| **Docker** | `docker compose up --build -d` from project root |

### Prerequisites
- Docker installed and running
- `.env` file with `POSTGRES_PASSWORD`, `VITE_OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`
- Node.js 20.19+ for local dev testing
- 29 PDF statements in `./statements/` directory

---

## A. Batch Upload Tests

### A1. Single File Upload (Baseline)
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| A1.1 | Upload one CBA statement via `POST /api/statements/upload` | Returns `{ message, id }`, status 200 | P0 |
| A1.2 | Statement record created with `PENDING` status | DB has statement row with correct hash, filename | P0 |
| A1.3 | Pipeline processes statement to `COMPLETED` | SSE emits `processing_complete`, status updates to `COMPLETED` | P0 |
| A1.4 | Transactions extracted with correct dates, amounts, descriptions | Transaction count > 0, amounts in cents, dates in YYYY-MM-DD | P0 |
| A1.5 | Duplicate upload rejected | Returns 409 with `existingFilename` and `uploadedOn` | P0 |
| A1.6 | Invalid file (non-PDF) rejected | Returns 400 or processing fails with `PDF_READ_ERROR` | P1 |

### A2. Batch Upload (All 29 PDFs)
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| A2.1 | Upload all 29 PDFs sequentially | All 29 accepted (or duplicates rejected) | P0 |
| A2.2 | Bank detection accuracy | Each statement correctly identified as CBA (or appropriate bank) | P0 |
| A2.3 | Account type detection | Transaction accounts vs credit cards correctly identified | P0 |
| A2.4 | Transaction extraction completeness | Total transactions across all statements > 0, no empty statements | P0 |
| A2.5 | Account auto-creation | Accounts table has entries with BSB, account numbers, bank names | P0 |
| A2.6 | Statement-to-account linking | `statement_accounts` table links each statement to an account | P0 |
| A2.7 | Duplicate handling (overlapping periods) | Overlapping date ranges detected, duplicate transactions flagged | P1 |
| A2.8 | Performance: time to process all 29 | Log total time; target < 5 minutes for all 29 | P1 |
| A2.9 | Memory usage during batch | No OOM errors, memory stays under 2GB | P1 |

### A3. Bank Detection
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| A3.1 | CBA statement detection | `bankId: 'cba'`, confidence >= 0.7 | P0 |
| A3.2 | Detection confidence scoring | High confidence (>0.7) for clear CBA PDFs | P0 |
| A3.3 | Fallback to AI if bank unknown | AI vision/text parsing used when no bank parser matches | P1 |

---

## B. Transfer Detection Tests

### B1. Cross-Account Matching
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| B1.1 | Matching debit/credit across accounts | Transfer detected when amount matches within $5, date within 3 days | P0 |
| B1.2 | Confidence scoring | High confidence for exact amount + same day; lower for approximate | P0 |
| B1.3 | Manual transfer linking via `POST /api/transfers` | Link created, both transactions marked `isTransfer: true` | P0 |
| B1.4 | Transfer deletion via `DELETE /api/transfers/:id` | Link removed, both transactions unmarked | P0 |
| B1.5 | Transfer exclusion from totals | Transfers not counted in income/expense summaries | P0 |

### B2. Credit Card Payments
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| B2.1 | Credit card payment from transaction account detected | Payment to CC linked as transfer | P1 |
| B2.2 | CC payment appears as debit in source, credit in CC | Amounts match (within tolerance for fees) | P1 |

### B3. Transfer API Endpoints
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| B3.1 | `GET /api/transfers` returns all transfer links | JSON array with source/destination transaction details | P0 |
| B3.2 | Transfer link includes source and destination accounts | `sourceAccountId`, `destinationAccountId` populated | P0 |
| B3.3 | `POST /api/agents/transfers/analyze` cross-account analysis | Returns transfers, netFlows, flowDiagram | P1 |

---

## C. GST Calculation Tests

### C1. GST Classification
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| C1.1 | Business expenses classified with GST category | `gstCategory` field populated (taxable_10, gst_free, etc.) | P0 |
| C1.2 | GST amount calculation (10% rule) | GST = amount / 11 for taxable items | P0 |
| C1.3 | Bank fees classified as input-taxed | `gstCategory: 'input_taxed'`, no GST credit | P0 |
| C1.4 | Wages classified as N-T (not reportable) | `gstCategory: 'not_reportable'` | P0 |
| C1.5 | Personal expenses excluded from GST | Personal account transactions have no GST treatment | P0 |
| C1.6 | Capital purchases (>$1000) flagged | Items over $1000 GST-exclusive classified at G10 | P1 |

### C2. BAS Pre-Fill
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| C2.1 | BAS calculation for a quarter | Returns G1, G10, G11, 1A, 1B, net GST | P0 |
| C2.2 | G1 = total sales (GST-inclusive) | Sum of all income transactions | P0 |
| C2.3 | 1A = GST on sales | Taxable sales / 11 | P0 |
| C2.4 | 1B = GST on purchases | Sum of GST credits on business purchases | P0 |
| C2.5 | G10 = capital purchases | Sum of capital items (GST-inclusive) | P1 |
| C2.6 | G11 = non-capital purchases | Sum of operating expenses (GST-inclusive) | P1 |
| C2.7 | Net GST = 1A - 1B | Correct arithmetic | P0 |
| C2.8 | Quarter boundaries correct | Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun | P0 |

### C3. BAS API Endpoints
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| C3.1 | `POST /api/agents/bas/calculate` | Returns BAS labels for specified quarter | P0 |
| C3.2 | Invalid quarter rejected | Returns 400 for missing year/quarter | P0 |
| C3.3 | Empty quarter returns zero values | All labels = 0 when no transactions in range | P1 |

### C4. Merchant Intelligence
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| C4.1 | Merchant memory persists categorization | Re-uploaded merchant uses previous category | P1 |
| C4.2 | Merchant memory update via `PATCH /api/merchant-memory/:id` | Memory entry updated, future transactions use new category | P1 |
| C4.3 | `GET /api/merchant-memory` returns all learned patterns | JSON array of merchant patterns with categories | P1 |

---

## D. Credit Card Tests

### D1. Credit Card Parsing
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| D1.1 | Credit card statement detected | `accountType: 'credit_card'` set on account | P0 |
| D1.2 | Credit card transactions extracted | Purchases (debits), payments (credits), fees parsed | P0 |
| D1.3 | Interest charges identified | Transactions with 'interest' in description flagged | P1 |
| D1.4 | Balance tracking | Opening/closing balance extracted from statement | P1 |

### D2. Credit Card Analytics
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| D2.1 | `GET /api/accounts/:id/credit-analytics` | Returns utilization, interest, spending metrics | P0 |
| D2.2 | Non-credit-card account returns 400 | Error: 'Account is not a credit card' | P0 |
| D2.3 | Total interest paid calculated | Sum of interest/fee transactions | P1 |
| D2.4 | Average monthly spending calculated | Total spending / unique months | P1 |

### D3. Credit Card GST
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| D3.1 | Business credit card purchases GST-flagged | GST applicable for business expenses on CC | P1 |
| D3.2 | CC interest classified as input-taxed | No GST credit on CC interest charges | P1 |

---

## E. API Endpoint Tests (Regression + New)

### E1. Authentication
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E1.1 | `POST /auth/register` creates user | Returns `{ token, user }` | P0 |
| E1.2 | `POST /auth/login` authenticates | Returns `{ token, user }` with valid credentials | P0 |
| E1.3 | `GET /auth/me` returns current user | Returns `{ user }` with valid token | P0 |
| E1.4 | Protected endpoints reject without token | Returns 401 | P0 |
| E1.5 | Duplicate username rejected | Returns 400 | P1 |

### E2. Transaction CRUD
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E2.1 | `GET /api/transactions` returns paginated list | `{ transactions, total }` with correct pagination | P0 |
| E2.2 | `PATCH /api/transactions/:id` updates transaction | Category, amount, description updatable | P0 |
| E2.3 | `DELETE /api/transactions/:id` removes transaction | Transaction deleted, history recorded | P0 |
| E2.4 | `POST /api/transactions/:id/split` splits transaction | Original zeroed, new split transactions created | P1 |
| E2.5 | `GET /api/transactions/export` CSV export | Valid CSV with correct headers | P1 |
| E2.6 | `GET /api/transactions/export?format=xlsx` Excel export | Valid XLSX file | P1 |

### E3. Statement Management
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E3.1 | `GET /api/statements` lists uploaded statements | Array of statement objects | P0 |
| E3.2 | `POST /api/statements/:id/reprocess` re-parses | Old transactions deleted, new pipeline run started | P0 |
| E3.3 | `GET /api/statements/gap-analysis` finds gaps | Returns gaps, overlaps, balance mismatches | P1 |

### E4. Account Management
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E4.1 | `GET /api/accounts` lists accounts | Array of account objects with balances | P0 |
| E4.2 | `POST /api/accounts` creates account | Returns created account, 201 status | P0 |
| E4.3 | `PATCH /api/accounts/:id` updates account | Nickname, type, bank updateable | P0 |
| E4.4 | `GET /api/accounts/:id/balance-history` | Balance history array | P1 |

### E5. Chat & AI
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E5.1 | `POST /api/chat` with valid query | Returns `{ answer }` with financial insight | P0 |
| E5.2 | Empty query rejected | Returns 400 with helpful message | P0 |
| E5.3 | Chat uses Cognee RAG context | RAG search attempted, results included in context | P1 |

### E6. Business Profile
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E6.1 | `GET /api/business-profile` returns profile | Profile with ABN validation, entity types | P0 |
| E6.2 | `POST /api/business-profile` creates/updates | ABN validated, profile saved | P0 |
| E6.3 | `POST /api/validate-abn` validates ABN | Returns `{ isValid, error }` | P1 |
| E6.4 | Invalid ABN rejected | Validation error returned | P1 |

### E7. Settings
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E7.1 | `GET /api/settings` returns user settings | Model preferences returned | P0 |
| E7.2 | `PATCH /api/settings` updates models | Settings persisted | P0 |

### E8. Agent Endpoints
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E8.1 | `GET /api/agents` lists available agents | Agent info returned | P0 |
| E8.2 | `POST /api/agents/:type/run` executes agent | Result returned with agent output | P1 |
| E8.3 | `POST /api/agents/analyze` budget analysis | Returns insights, breakdown | P1 |
| E8.4 | `POST /api/agents/reconcile` runs reconciliation | Returns duplicates, balance continuity | P1 |

### E9. Pending Categorizations
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E9.1 | `GET /api/pending-categorizations` | Returns pending items with transaction details | P0 |
| E9.2 | `POST /api/pending-categorizations/:id/resolve` approve | Category confirmed, confidence set to 1.0 | P0 |
| E9.3 | Resolve with modify updates merchant memory | New category persisted, memory updated | P1 |

### E10. Reconciliation
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E10.1 | `GET /api/reconciliation-alerts` | Returns unresolved alerts | P0 |
| E10.2 | `POST /api/reconciliation-alerts/:id/resolve` | Alert marked resolved with notes | P0 |

### E11. Debt Management
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E11.1 | `POST /api/debt-recommendations` | Returns aggressive, moderate, minimum strategies | P1 |
| E11.2 | Invalid budget rejected | Returns 400 for negative/zero budget | P1 |

### E12. Health & Infra
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| E12.1 | `GET /health` returns healthy | `{ status: 'healthy', timestamp }` | P0 |
| E12.2 | `GET /` returns API running message | Text response | P0 |
| E12.3 | `GET /api/events` SSE stream | Event stream connection established | P0 |
| E12.4 | `GET /api/vertex-ai/models` lists models | Model list returned | P2 |

---

## F. Docker Deployment Tests

### F1. Service Health
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| F1.1 | `docker compose up -d` starts all services | 4 containers running (postgres, cognee, server, client) | P0 |
| F1.2 | PostgreSQL healthcheck passes | `pg_isready` succeeds | P0 |
| F1.3 | Cognee responds at `:8000/api/v1/health` | Health status OK | P0 |
| F1.4 | Server responds at `:3501/health` | `{ status: 'healthy' }` | P0 |
| F1.5 | Client accessible at `:8080` | Nginx serves React app | P0 |
| F1.6 | Nginx proxies `/api/` to server | API calls from client reach server | P0 |

### F2. Database Setup
| ID | Test Case | Expected Result | Priority |
|----|-----------|-----------------|----------|
| F2.1 | CBA schema applied to `ai_accountant` DB | Tables created from migration SQL | P0 |
| F2.2 | Cognee DB (`cognee_db`) created | Separate database for Cognee | P0 |
| F2.3 | pgvector extension enabled | `CREATE EXTENSION vector` succeeds | P0 |
| F2.4 | Data persists across container restarts | Volumes retain data | P1 |

---

## G. Existing Test Suite

### G1. Existing Tests
| ID | Test Case | File | Priority |
|----|-----------|------|----------|
| G1.1 | Pipeline unit tests pass | `server/src/services/pipeline.test.ts` | P0 |
| G1.2 | AI service unit tests pass | `server/src/services/ai.test.ts` | P0 |
| G1.3 | Account service tests pass | `server/src/services/accounts.test.ts` | P0 |
| G1.4 | ABN validation tests pass | `server/src/utils/abn.test.ts` | P0 |
| G1.5 | `npm test` in server passes | All vitest tests green | P0 |

---

## Test Execution Order

1. **Phase 1 — Environment Setup**
   - Start Docker services (F1)
   - Verify database setup (F2)
   - Run existing test suite (G1)

2. **Phase 2 — Authentication & Baseline**
   - Register test user (E1)
   - Verify settings endpoints (E7)
   - Set up business profile (E6)

3. **Phase 3 — Statement Upload**
   - Single file upload test (A1)
   - Batch upload all 29 PDFs (A2)
   - Verify bank detection (A3)

4. **Phase 4 — Data Integrity**
   - Transaction CRUD (E2)
   - Statement management (E3)
   - Account management (E4)

5. **Phase 5 — Intelligence Features**
   - Transfer detection (B1, B2, B3)
   - GST classification (C1)
   - BAS calculation (C2, C3)
   - Merchant intelligence (C4)

6. **Phase 6 — Credit Card Features**
   - Credit card parsing (D1)
   - Credit card analytics (D2)
   - Credit card GST (D3)

7. **Phase 7 — AI & Advanced**
   - Chat endpoint (E5)
   - Agent endpoints (E8)
   - Pending categorizations (E9)
   - Reconciliation (E10)
   - Debt management (E11)

8. **Phase 8 — Final Validation**
   - Health checks (E12)
   - SSE events working (E12.3)
   - Full E2E flow: upload → parse → categorize → GST → BAS report

---

## Issue Severity Classification

| Level | Definition | Example |
|-------|------------|---------|
| **P0 — Blocker** | Core functionality broken, no workaround | Upload fails, DB connection error, auth broken |
| **P1 — Important** | Feature partially works, workaround exists | GST calculation off by small amount, transfer detection misses some |
| **P2 — Nice-to-have** | Cosmetic or minor functional issue | UI alignment, slow performance on edge case |

---

## Performance Benchmarks

| Metric | Target | Method |
|--------|--------|--------|
| Single PDF parse time | < 30 seconds | Measure from upload to COMPLETED status |
| Batch 29 PDF parse time | < 5 minutes | Total wall-clock time for all 29 |
| API response time (GET) | < 200ms | Measure GET /api/transactions response |
| API response time (POST) | < 500ms | Measure non-AI POST endpoints |
| Chat response time | < 10 seconds | Measure POST /api/chat latency |
| BAS calculation time | < 5 seconds | Measure POST /api/agents/bas/calculate |
| Docker startup time | < 60 seconds | Time from `docker compose up` to all healthy |
| Memory usage (server) | < 512MB | Monitor container stats during batch upload |

---

*Created: February 2026*
*Test Plan Version: 1.0*
