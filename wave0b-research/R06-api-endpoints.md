# R06: API Endpoint Map — Complete Inventory & Wave 1-10 Plan

## 1. Current Endpoint Count

### Summary

| Source | Count |
|--------|-------|
| `server/src/index.ts` (inline routes) | **197** |
| `server/src/routes/agents.ts` (mounted at `/api/claude-agents`) | **4** |
| `server/src/routes/pipeline.ts` (mounted at `/api`) | **7** |
| **TOTAL EXISTING ENDPOINTS** | **208** |

### 1.1 Existing Endpoints — Full Inventory (index.ts)

#### Infrastructure & Auth (6)
| # | Method | Path | Line |
|---|--------|------|------|
| 1 | GET | `/` | 195 |
| 2 | GET | `/health` | 200 |
| 3 | POST | `/auth/register` | 113 |
| 4 | POST | `/auth/login` | 135 |
| 5 | GET | `/auth/me` | 154 |
| 6 | GET | `/api/events` (SSE) | 1059 |

#### Vertex AI (2)
| # | Method | Path | Line |
|---|--------|------|------|
| 7 | GET | `/api/vertex-ai/models` | 205 |
| 8 | GET | `/api/vertex-ai/test` | 213 |

#### Transactions (6)
| # | Method | Path | Line |
|---|--------|------|------|
| 9 | GET | `/api/transactions` | 226 |
| 10 | PATCH | `/api/transactions/:id` | 251 |
| 11 | POST | `/api/transactions/:id/split` | 300 |
| 12 | DELETE | `/api/transactions/:id` | 351 |
| 13 | GET | `/api/transactions/export` | 385 |
| 14 | POST | `/api/transactions/categorize-gst` | 2295 |

#### Statements (7)
| # | Method | Path | Line |
|---|--------|------|------|
| 15 | GET | `/api/statements` | 485 |
| 16 | POST | `/api/statements/upload` | 530 |
| 17 | POST | `/api/statements/batch` | 623 |
| 18 | GET | `/api/statements/batch/:jobId` | 681 |
| 19 | POST | `/api/statements/batch/:jobId/cancel` | 719 |
| 20 | POST | `/api/statements/batch/:jobId/retry` | 742 |
| 21 | GET | `/api/statements/gap-analysis` | 1096 |

#### Settings (2)
| # | Method | Path | Line |
|---|--------|------|------|
| 22 | GET | `/api/settings` | 494 |
| 23 | PATCH | `/api/settings` | 516 |

#### Queue (1)
| # | Method | Path | Line |
|---|--------|------|------|
| 24 | GET | `/api/queue/stats` | 765 |

#### Business Profile (4)
| # | Method | Path | Line |
|---|--------|------|------|
| 25 | GET | `/api/business-profile` | 780 |
| 26 | POST | `/api/business-profile` | 817 |
| 27 | POST | `/api/validate-abn` | 925 |
| 28 | GET | `/api/business-profile/reference-data` | 942 |

#### Chat (1)
| # | Method | Path | Line |
|---|--------|------|------|
| 29 | POST | `/api/chat` | 950 |

#### Statements Reprocessing (2)
| # | Method | Path | Line |
|---|--------|------|------|
| 30 | POST | `/api/statements/:id/reprocess` | 1018 |
| 31 | POST | `/api/statements/detect-bank` | 3390 |

#### Accounts (5)
| # | Method | Path | Line |
|---|--------|------|------|
| 32 | GET | `/api/accounts` | 1278 |
| 33 | POST | `/api/accounts` | 1293 |
| 34 | PATCH | `/api/accounts/:id` | 1326 |
| 35 | GET | `/api/accounts/:id/balance-history` | 1626 |
| 36 | GET | `/api/accounts/:id/credit-analytics` | 1693 |

#### Pending Categorizations (2)
| # | Method | Path | Line |
|---|--------|------|------|
| 37 | GET | `/api/pending-categorizations` | 1364 |
| 38 | POST | `/api/pending-categorizations/:id/resolve` | 1386 |

#### Merchant Memory (3)
| # | Method | Path | Line |
|---|--------|------|------|
| 39 | GET | `/api/merchant-memory` | 1455 |
| 40 | PATCH | `/api/merchant-memory/:id` | 1463 |
| 41 | DELETE | `/api/merchant-memory/:id` | 1496 |

#### Transfers (6)
| # | Method | Path | Line |
|---|--------|------|------|
| 42 | GET | `/api/transfers` | 1521 |
| 43 | POST | `/api/transfers` | 1548 |
| 44 | DELETE | `/api/transfers/:id` | 1596 |
| 45 | POST | `/api/transfers/auto-detect` | 3468 |
| 46 | POST | `/api/transfers/bulk-link` | 3552 |
| 47 | GET | `/api/transfers/summary` | 3617 |

#### Reconciliation Alerts (2)
| # | Method | Path | Line |
|---|--------|------|------|
| 48 | GET | `/api/reconciliation-alerts` | 1648 |
| 49 | POST | `/api/reconciliation-alerts/:id/resolve` | 1666 |

#### Debt (1)
| # | Method | Path | Line |
|---|--------|------|------|
| 50 | POST | `/api/debt-recommendations` | 1762 |

#### Agents (7)
| # | Method | Path | Line |
|---|--------|------|------|
| 51 | GET | `/api/agents` | 1890 |
| 52 | GET | `/api/agents/:type` | 1901 |
| 53 | POST | `/api/agents/:type/run` | 1913 |
| 54 | POST | `/api/agents/code/execute` | 1950 |
| 55 | POST | `/api/agents/analyze-finances` | 1978 |
| 56 | POST | `/api/agents/calculate-bas` | 2005 |
| 57 | POST | `/api/agents/calculate-tax` | 2029 |

#### Agent (continued) (1)
| # | Method | Path | Line |
|---|--------|------|------|
| 58 | POST | `/api/agents/reconcile` | 2053 |

#### BAS (8)
| # | Method | Path | Line |
|---|--------|------|------|
| 59 | GET | `/api/bas/quarters` | 2126 |
| 60 | GET | `/api/bas/:quarter/calculate` | 2166 |
| 61 | POST | `/api/bas/:quarter/save` | 2242 |
| 62 | GET | `/api/bas/history` | 2270 |
| 63 | GET | `/api/bas/tax-codes` | 2284 |
| 64 | GET | `/api/bas/calculate` | 2631 |
| 65 | PATCH | `/api/bas/:quarter/status` | 2700 |
| 66 | GET | `/api/bas/compare` | 2729 |

#### BAS Drill-down (1)
| # | Method | Path | Line |
|---|--------|------|------|
| 67 | GET | `/api/bas/:quarter/drill-down/:label` | 2789 |

#### GST (5)
| # | Method | Path | Line |
|---|--------|------|------|
| 68 | GET | `/api/gst/summary` | 2359 |
| 69 | GET | `/api/gst/review-queue` | 2449 |
| 70 | POST | `/api/gst/classify/:id` | 2515 |
| 71 | POST | `/api/gst/bulk-approve` | 2545 |
| 72 | GET | `/api/gst/input-tax-credits` | 2576 |

#### Payroll (existing - 3)
| # | Method | Path | Line |
|---|--------|------|------|
| 73 | GET | `/api/payroll/wages` | 2844 |
| 74 | POST | `/api/payroll/upload-ledger` | 2864 |
| 75 | PATCH | `/api/payroll/wages/:id` | 2922 |

#### Tax (14)
| # | Method | Path | Line |
|---|--------|------|------|
| 76 | GET | `/api/tax/calculate/:year` | 2949 |
| 77 | GET | `/api/tax/brackets/:year` | 3011 |
| 78 | GET | `/api/tax/deductions/:year` | 3025 |
| 79 | POST | `/api/tax/deductions` | 3043 |
| 80 | GET | `/api/tax/assets` | 3077 |
| 81 | POST | `/api/tax/assets` | 3094 |
| 82 | GET | `/api/tax/cgt` | 3128 |
| 83 | POST | `/api/tax/cgt/disposal` | 3149 |
| 84 | GET | `/api/tax/depreciation/assets` | 3202 |
| 85 | POST | `/api/tax/depreciation/assets` | 3219 |
| 86 | GET | `/api/tax/depreciation/calculate/:assetId` | 3256 |
| 87 | GET | `/api/tax/summary/:year` | 3286 |
| 88 | POST | `/api/tax/strategies/generate/:year` | 4424 |
| 89 | GET | `/api/tax/strategies/:year` | 4454 |

#### Tax (continued - returns & equity - 10)
| # | Method | Path | Line |
|---|--------|------|------|
| 90 | PATCH | `/api/tax/strategies/:id/status` | 4470 |
| 91 | GET | `/api/tax/return/sole-trader/:year` | 4332 |
| 92 | GET | `/api/tax/return/personal/:year` | 4344 |
| 93 | GET | `/api/tax/return/company/:year` | 4356 |
| 94 | GET | `/api/tax/return/trust/:year` | 4368 |
| 95 | GET | `/api/tax/return/smsf/:year` | 4380 |
| 96 | GET | `/api/tax/return/summary/:year` | 4392 |
| 97 | POST | `/api/tax/equity/scan/:year` | 4488 |
| 98 | GET | `/api/tax/equity/:year` | 4503 |
| 99 | PATCH | `/api/tax/equity/:id/confirm` | 4515 |

#### Tax (equity event - 1)
| # | Method | Path | Line |
|---|--------|------|------|
| 100 | POST | `/api/tax/equity/event` | 4528 |

#### Banks & Consolidated Accounts (2)
| # | Method | Path | Line |
|---|--------|------|------|
| 101 | GET | `/api/banks` | 3379 |
| 102 | GET | `/api/accounts/consolidated` | 3408 |

#### Reports (consolidated + financial - 8)
| # | Method | Path | Line |
|---|--------|------|------|
| 103 | GET | `/api/reports/consolidated/:period` | 3705 |
| 104 | GET | `/api/reports/pnl` | 6095 |
| 105 | GET | `/api/reports/balance-sheet` | 6112 |
| 106 | GET | `/api/reports/cash-flow` | 6127 |
| 107 | GET | `/api/reports/trial-balance` | 6143 |
| 108 | GET | `/api/reports/compare` | 6158 |
| 109 | POST | `/api/reports/snapshot` | 6177 |
| 110 | GET | `/api/reports/kpis` | 6192 |

#### Admin (1)
| # | Method | Path | Line |
|---|--------|------|------|
| 111 | POST | `/api/admin/ingest-knowledge` | 3792 |

#### Analytics (12)
| # | Method | Path | Line |
|---|--------|------|------|
| 112 | GET | `/api/analytics/category-breakdown` | 3864 |
| 113 | GET | `/api/analytics/recurring-payments` | 3913 |
| 114 | GET | `/api/analytics/spending-trends` | 4003 |
| 115 | GET | `/api/analytics/budget-vs-actual` | 4046 |
| 116 | GET | `/api/analytics/budgets` | 4130 |
| 117 | POST | `/api/analytics/budgets` | 4145 |
| 118 | GET | `/api/analytics/anomalies` | 4155 |
| 119 | POST | `/api/analytics/anomalies/:id/dismiss` | 4251 |
| 120 | GET | `/api/analytics/cash-flow-forecast` | 4256 |
| 121 | POST | `/api/analytics/budget/generate` | 4647 |
| 122 | GET | `/api/analytics/bills` | 4661 |
| 123 | POST | `/api/analytics/projections/revenue` | 4672 |

#### Analytics (continued - 3)
| # | Method | Path | Line |
|---|--------|------|------|
| 124 | POST | `/api/analytics/projections/expenses` | 4686 |
| 125 | POST | `/api/analytics/wealth-projection` | 4700 |
| 126 | POST | `/api/analytics/debt-strategies` | 4711 |

#### Loans (5)
| # | Method | Path | Line |
|---|--------|------|------|
| 127 | POST | `/api/loans/calculate/home` | 4551 |
| 128 | POST | `/api/loans/calculate/car` | 4566 |
| 129 | POST | `/api/loans/calculate/personal` | 4577 |
| 130 | POST | `/api/loans/refinance-savings` | 4588 |
| 131 | POST | `/api/loans/borrowing-capacity` | 4599 |

#### Economic Data (3)
| # | Method | Path | Line |
|---|--------|------|------|
| 132 | GET | `/api/economic/rates` | 4612 |
| 133 | GET | `/api/economic/cpi` | 4625 |
| 134 | GET | `/api/economic/indicators` | 4635 |

#### Inventory (Wave 11 - 13)
| # | Method | Path | Line |
|---|--------|------|------|
| 135 | GET | `/api/inventory/items` | 4730 |
| 136 | POST | `/api/inventory/items` | 4750 |
| 137 | GET | `/api/inventory/items/:id` | 4764 |
| 138 | PUT | `/api/inventory/items/:id` | 4778 |
| 139 | DELETE | `/api/inventory/items/:id` | 4792 |
| 140 | POST | `/api/inventory/items/:id/adjust` | 4805 |
| 141 | POST | `/api/inventory/items/:id/transfer` | 4822 |
| 142 | GET | `/api/inventory/stock` | 4839 |
| 143 | GET | `/api/inventory/movements` | 4859 |
| 144 | GET | `/api/inventory/warehouses` | 4880 |
| 145 | POST | `/api/inventory/warehouses` | 4893 |
| 146 | GET | `/api/inventory/valuation` | 4907 |
| 147 | GET | `/api/recon/sessions` | 4925 |

#### Reconciliation (Wave 11 - 9)
| # | Method | Path | Line |
|---|--------|------|------|
| 148 | POST | `/api/recon/sessions` | 4943 |
| 149 | GET | `/api/recon/sessions/:id` | 4959 |
| 150 | POST | `/api/recon/sessions/:id/auto-match` | 4973 |
| 151 | POST | `/api/recon/sessions/:id/complete` | 4986 |
| 152 | POST | `/api/recon/matches/:id/confirm` | 4999 |
| 153 | POST | `/api/recon/matches/:id/undo` | 5012 |
| 154 | POST | `/api/recon/matches/manual` | 5025 |
| 155 | GET | `/api/recon/rules` | 5041 |
| 156 | POST | `/api/recon/rules` | 5054 |

#### Assets (Wave 12 - 8)
| # | Method | Path | Line |
|---|--------|------|------|
| 157 | POST | `/api/assets` | 5072 |
| 158 | GET | `/api/assets` | 5084 |
| 159 | GET | `/api/assets/schedule/:year` | 5099 |
| 160 | POST | `/api/assets/depreciation/batch/:year` | 5113 |
| 161 | GET | `/api/assets/:id` | 5127 |
| 162 | PATCH | `/api/assets/:id` | 5142 |
| 163 | POST | `/api/assets/:id/depreciation/:year` | 5155 |
| 164 | POST | `/api/assets/:id/dispose` | 5168 |

#### Entities (Wave 12 - 10)
| # | Method | Path | Line |
|---|--------|------|------|
| 165 | POST | `/api/entities` | 5185 |
| 166 | GET | `/api/entities` | 5197 |
| 167 | POST | `/api/entities/inter-entity-transactions` | 5209 |
| 168 | GET | `/api/entities/inter-entity-transactions` | 5221 |
| 169 | PATCH | `/api/entities/inter-entity-transactions/:id/confirm` | 5236 |
| 170 | GET | `/api/entities/:id` | 5249 |
| 171 | PATCH | `/api/entities/:id` | 5262 |
| 172 | PATCH | `/api/entities/:id/settings` | 5276 |
| 173 | POST | `/api/entities/:id/accounts` | 5289 |
| 174 | DELETE | `/api/entities/:id/accounts/:accountId` | 5302 |

#### Consolidation (Wave 13 - 6)
| # | Method | Path | Line |
|---|--------|------|------|
| 175 | POST | `/api/consolidation/generate` | 5319 |
| 176 | GET | `/api/consolidation/snapshots` | 5331 |
| 177 | GET | `/api/consolidation/snapshots/:id` | 5348 |
| 178 | POST | `/api/consolidation/snapshots/:id/finalize` | 5361 |
| 179 | POST | `/api/consolidation/rules` | 5374 |
| 180 | GET | `/api/consolidation/rules` | 5386 |

#### Knowledge / DataPoints (Wave 16 - 16)
| # | Method | Path | Line |
|---|--------|------|------|
| 181 | POST | `/api/knowledge/datapoints` | 5410 |
| 182 | GET | `/api/knowledge/datapoints/:userId` | 5422 |
| 183 | GET | `/api/knowledge/datapoints/detail/:datapointId` | 5439 |
| 184 | POST | `/api/knowledge/datapoints/:datapointId/activate` | 5450 |
| 185 | POST | `/api/knowledge/datapoints/:datapointId/deactivate` | 5461 |
| 186 | POST | `/api/knowledge/ontologies` | 5473 |
| 187 | GET | `/api/knowledge/ontologies/:userId` | 5485 |
| 188 | POST | `/api/knowledge/ontologies/:ontologyId/apply` | 5501 |
| 189 | POST | `/api/knowledge/ontologies/:ontologyId/validate` | 5513 |
| 190 | POST | `/api/knowledge/feedback` | 5526 |
| 191 | GET | `/api/knowledge/feedback/:userId/stats` | 5538 |
| 192 | POST | `/api/knowledge/feedback/:userId/memify` | 5555 |
| 193 | GET | `/api/knowledge/graph/:datasetName` | 5568 |
| 194 | GET | `/api/knowledge/graph/:datasetName/stats` | 5585 |
| 195 | POST | `/api/knowledge/graph/:datasetName/prune` | 5596 |
| 196 | GET | `/api/knowledge/graph/:datasetName/subgraph/:nodeId` | 5608 |

#### Documents / OCR (Wave 14 - 8)
| # | Method | Path | Line |
|---|--------|------|------|
| 197 | POST | `/api/documents/upload` | 5627 |
| 198 | POST | `/api/documents/batch-process` | 5651 |
| 199 | POST | `/api/documents/:id/process` | 5665 |
| 200 | POST | `/api/documents/:id/classify` | 5676 |
| 201 | GET | `/api/documents/:id/line-items` | 5687 |
| 202 | GET | `/api/documents` | 5698 |
| 203 | GET | `/api/documents/:id` | 5711 |
| 204 | DELETE | `/api/documents/:id` | 5725 |

#### Matches / Payment Matching (Wave 14 - 10)
| # | Method | Path | Line |
|---|--------|------|------|
| 205 | GET | `/api/matches/candidates/:documentId` | 5738 |
| 206 | POST | `/api/matches/score` | 5754 |
| 207 | POST | `/api/matches/auto` | 5776 |
| 208 | PATCH | `/api/matches/:id/confirm` | 5792 |
| 209 | PATCH | `/api/matches/:id/reject` | 5808 |
| 210 | GET | `/api/matches/stats` | 5820 |
| 211 | POST | `/api/matches/:matchId/learn` | 5831 |
| 212 | POST | `/api/match-rules` | 5844 |
| 213 | GET | `/api/match-rules` | 5859 |
| 214 | DELETE | `/api/match-rules/:id` | 5872 |

#### Intelligence (Wave 17 - 14)
| # | Method | Path | Line |
|---|--------|------|------|
| 215 | POST | `/api/intelligence/temporal/query` | 5889 |
| 216 | POST | `/api/intelligence/temporal/save` | 5901 |
| 217 | GET | `/api/intelligence/temporal/saved/:userId` | 5913 |
| 218 | GET | `/api/intelligence/temporal/timeline/:userId` | 5926 |
| 219 | POST | `/api/intelligence/insights/scan` | 5944 |
| 220 | GET | `/api/intelligence/insights/detail/:insightId` | 5965 |
| 221 | GET | `/api/intelligence/insights/:userId` | 5977 |
| 222 | PATCH | `/api/intelligence/insights/:insightId/status` | 5996 |
| 223 | GET | `/api/intelligence/connections` | 6013 |
| 224 | POST | `/api/intelligence/correlations` | 6029 |
| 225 | POST | `/api/intelligence/subscriptions` | 6042 |
| 226 | GET | `/api/intelligence/subscriptions/:userId` | 6054 |
| 227 | DELETE | `/api/intelligence/subscriptions/:subscriptionId` | 6070 |
| 228 | GET | `/api/intelligence/cache/health` | 6083 |

#### Budgets (Wave 15 - 7)
| # | Method | Path | Line |
|---|--------|------|------|
| 229 | POST | `/api/budgets` | 6209 |
| 230 | GET | `/api/budgets` | 6221 |
| 231 | GET | `/api/budgets/:id` | 6233 |
| 232 | PUT | `/api/budgets/:id` | 6247 |
| 233 | DELETE | `/api/budgets/:id` | 6259 |
| 234 | POST | `/api/budgets/:id/lines` | 6270 |
| 235 | GET | `/api/budgets/:id/variance` | 6282 |

#### Budgets Variance Summary (1)
| # | Method | Path | Line |
|---|--------|------|------|
| 236 | GET | `/api/budgets/:id/variance/summary` | 6294 |

#### Forecasts (Wave 15 - 5)
| # | Method | Path | Line |
|---|--------|------|------|
| 237 | POST | `/api/forecasts/scenarios` | 6307 |
| 238 | GET | `/api/forecasts/scenarios` | 6319 |
| 239 | GET | `/api/forecasts/scenarios/:id` | 6330 |
| 240 | POST | `/api/forecasts/scenarios/:id/generate` | 6344 |
| 241 | POST | `/api/forecasts/compare` | 6355 |

#### KPIs (2)
| # | Method | Path | Line |
|---|--------|------|------|
| 242 | GET | `/api/kpis/:userId` | 6372 |
| 243 | GET | `/api/kpis/:userId/history` | 6387 |

### 1.2 Existing Endpoints — Route Files

#### `/api/claude-agents/*` (agents.ts) — 4 endpoints
| # | Method | Path (full) | Line |
|---|--------|------------|------|
| 244 | POST | `/api/claude-agents/analyze` | 19 |
| 245 | POST | `/api/claude-agents/bas/calculate` | 49 |
| 246 | POST | `/api/claude-agents/reconcile` | 112 |
| 247 | POST | `/api/claude-agents/transfers/analyze` | 147 |

#### `/api/*` (pipeline.ts) — 7 endpoints
| # | Method | Path (full) | Line |
|---|--------|------------|------|
| 248 | POST | `/api/transfers/detect` | 28 |
| 249 | POST | `/api/enrichment/run` | 140 |
| 250 | POST | `/api/enrichment/batch` | 163 |
| 251 | GET | `/api/bas/prefill` | 196 |
| 252 | POST | `/api/enrichment/transaction/:id` | 266 |
| 253 | GET | `/api/merchants` | 307 |
| 254 | POST | `/api/merchants/batch-resolve` | 350 |

### GRAND TOTAL EXISTING: **254 endpoints**

---

## 2. Per-Wave Endpoint Tables (Waves 1–10)

### Wave 1: Chat→Agent Bridge & Intent Routing (9 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | POST | `/api/chat` | **REWRITE** — Intent-routed agent dispatch | `index.ts` (line 950 rewrite) |
| 2 | POST | `/api/agents/parse` | Statement parser agent | `agent-routes-extended.ts` |
| 3 | POST | `/api/agents/categorize` | Transaction categorizer agent | `agent-routes-extended.ts` |
| 4 | POST | `/api/agents/merchant-intel` | Merchant intelligence agent | `agent-routes-extended.ts` |
| 5 | POST | `/api/agents/payroll/calculate` | Payroll agent | `agent-routes-extended.ts` |
| 6 | POST | `/api/agents/tax/strategy` | Tax strategy agent | `agent-routes-extended.ts` |
| 7 | POST | `/api/agents/tax/claims` | Personal tax claims agent | `agent-routes-extended.ts` |
| 8 | POST | `/api/agents/financial-plan` | Financial planner agent | `agent-routes-extended.ts` |
| 9 | GET | `/api/agents/status` | All agent health/status | `agent-routes-extended.ts` |

**Net new: 8** (1 is a rewrite of existing POST `/api/chat`)

### Wave 2: Transaction Mutation & Streaming (6 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | POST | `/api/chat/stream` | SSE streaming chat endpoint | `index.ts` |
| 2 | POST | `/api/chat/confirm/:actionId` | Confirm pending agent mutation | `index.ts` |
| 3 | POST | `/api/chat/reject/:actionId` | Reject pending agent mutation | `index.ts` |
| 4 | GET | `/api/chat/pending` | List pending confirmations | `index.ts` |
| 5 | GET | `/api/chat/history` | Chat session history | `index.ts` |
| 6 | GET | `/api/agent-audit` | Agent mutation audit log | `index.ts` |

**Net new: 6**

### Wave 3: Multi-User Cognee & Custom DataPoints (4 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | POST | `/api/cognee/init-user` | Initialize Cognee account for user | `index.ts` |
| 2 | POST | `/api/cognee/reindex` | Trigger full reindex of user's data | `index.ts` |
| 3 | GET | `/api/cognee/session` | Get/create active Cognee session | `index.ts` |
| 4 | GET | `/api/cognee/graph/:userId` | User's knowledge graph visualization data | `index.ts` |

**Net new: 4**

### Wave 4: Employee Management & Pay Structures (15 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | GET | `/api/payroll/employees` | List employees | `payroll-routes.ts` |
| 2 | POST | `/api/payroll/employees` | Create employee | `payroll-routes.ts` |
| 3 | GET | `/api/payroll/employees/:id` | Get employee detail | `payroll-routes.ts` |
| 4 | PATCH | `/api/payroll/employees/:id` | Update employee | `payroll-routes.ts` |
| 5 | POST | `/api/payroll/employees/:id/terminate` | Terminate employee | `payroll-routes.ts` |
| 6 | GET | `/api/payroll/employees/:id/bank-details` | Get bank details | `payroll-routes.ts` |
| 7 | POST | `/api/payroll/employees/:id/bank-details` | Add bank details | `payroll-routes.ts` |
| 8 | GET | `/api/payroll/employees/:id/super` | Get super fund | `payroll-routes.ts` |
| 9 | POST | `/api/payroll/employees/:id/super` | Set super fund | `payroll-routes.ts` |
| 10 | GET | `/api/payroll/employees/:id/tax-declaration` | Get tax declaration | `payroll-routes.ts` |
| 11 | POST | `/api/payroll/employees/:id/tax-declaration` | Submit tax declaration | `payroll-routes.ts` |
| 12 | GET | `/api/payroll/pay-categories` | List pay categories | `payroll-routes.ts` |
| 13 | POST | `/api/payroll/pay-categories` | Create pay category | `payroll-routes.ts` |
| 14 | GET | `/api/payroll/pay-structures/:employeeId` | Get pay structure | `payroll-routes.ts` |
| 15 | POST | `/api/payroll/pay-structures` | Set pay structure | `payroll-routes.ts` |

**Net new: 15**

### Wave 5: Pay Run Processing & Leave Management (15 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | GET | `/api/payroll/pay-runs` | List pay runs | `payroll-routes.ts` |
| 2 | POST | `/api/payroll/pay-runs` | Create draft pay run | `payroll-routes.ts` |
| 3 | GET | `/api/payroll/pay-runs/:id` | Get pay run detail | `payroll-routes.ts` |
| 4 | POST | `/api/payroll/pay-runs/:id/calculate` | Calculate pay run | `payroll-routes.ts` |
| 5 | POST | `/api/payroll/pay-runs/:id/process` | Process (finalize) pay run | `payroll-routes.ts` |
| 6 | POST | `/api/payroll/pay-runs/:id/reverse` | Reverse pay run | `payroll-routes.ts` |
| 7 | GET | `/api/payroll/pay-runs/:id/lines` | Get pay run lines | `payroll-routes.ts` |
| 8 | POST | `/api/payroll/pay-runs/:id/lines` | Add/update pay run line | `payroll-routes.ts` |
| 9 | GET | `/api/payroll/leave/types` | List leave types | `payroll-routes.ts` |
| 10 | POST | `/api/payroll/leave/types` | Create leave type | `payroll-routes.ts` |
| 11 | GET | `/api/payroll/leave/balances/:employeeId` | Get leave balances | `payroll-routes.ts` |
| 12 | POST | `/api/payroll/leave/request` | Submit leave request | `payroll-routes.ts` |
| 13 | POST | `/api/payroll/leave/request/:id/approve` | Approve leave | `payroll-routes.ts` |
| 14 | POST | `/api/payroll/leave/request/:id/reject` | Reject leave | `payroll-routes.ts` |
| 15 | GET | `/api/payroll/leave/calendar` | Leave calendar view | `payroll-routes.ts` |

**Net new: 15**

### Wave 6: STP Compliance & Payroll Reporting (18 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | POST | `/api/payroll/stp/generate/:payRunId` | Generate STP event | `payroll-routes.ts` |
| 2 | POST | `/api/payroll/stp/submit/:eventId` | Submit STP to ATO (mock) | `payroll-routes.ts` |
| 3 | GET | `/api/payroll/stp/events` | List STP events | `payroll-routes.ts` |
| 4 | GET | `/api/payroll/stp/ytd/:employeeId` | Employee YTD totals | `payroll-routes.ts` |
| 5 | POST | `/api/payroll/stp/finalise/:year` | EOFY finalisation | `payroll-routes.ts` |
| 6 | GET | `/api/payroll/payslips/:payRunId` | Get payslips for pay run | `payroll-routes.ts` |
| 7 | GET | `/api/payroll/payslips/:payRunId/:employeeId/pdf` | Download payslip PDF | `payroll-routes.ts` |
| 8 | POST | `/api/payroll/payslips/:payRunId/send` | Email payslips | `payroll-routes.ts` |
| 9 | GET | `/api/payroll/awards` | List awards | `payroll-routes.ts` |
| 10 | POST | `/api/payroll/awards` | Create award | `payroll-routes.ts` |
| 11 | GET | `/api/payroll/awards/:id/rates` | Get award rates | `payroll-routes.ts` |
| 12 | GET | `/api/payroll/timesheets` | List timesheets | `payroll-routes.ts` |
| 13 | POST | `/api/payroll/timesheets` | Submit timesheet | `payroll-routes.ts` |
| 14 | POST | `/api/payroll/timesheets/:id/approve` | Approve timesheet | `payroll-routes.ts` |
| 15 | GET | `/api/payroll/reports/payg-summary/:year` | PAYG withholding summary | `payroll-routes.ts` |
| 16 | GET | `/api/payroll/reports/super-report/:period` | Super contributions report | `payroll-routes.ts` |
| 17 | GET | `/api/payroll/reports/leave-report` | Leave balances report | `payroll-routes.ts` |
| 18 | GET | `/api/payroll/reports/payroll-summary/:period` | Payroll cost summary | `payroll-routes.ts` |

**Net new: 18**

### Wave 7: Customer Management & Invoice Generation (18 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | GET | `/api/customers` | List customers | `invoicing-routes.ts` |
| 2 | POST | `/api/customers` | Create customer | `invoicing-routes.ts` |
| 3 | GET | `/api/customers/:id` | Get customer detail | `invoicing-routes.ts` |
| 4 | PATCH | `/api/customers/:id` | Update customer | `invoicing-routes.ts` |
| 5 | DELETE | `/api/customers/:id` | Archive customer | `invoicing-routes.ts` |
| 6 | GET | `/api/customers/:id/contacts` | List contacts | `invoicing-routes.ts` |
| 7 | POST | `/api/customers/:id/contacts` | Add contact | `invoicing-routes.ts` |
| 8 | GET | `/api/invoices` | List invoices | `invoicing-routes.ts` |
| 9 | POST | `/api/invoices` | Create invoice | `invoicing-routes.ts` |
| 10 | GET | `/api/invoices/:id` | Get invoice detail | `invoicing-routes.ts` |
| 11 | PATCH | `/api/invoices/:id` | Update draft invoice | `invoicing-routes.ts` |
| 12 | POST | `/api/invoices/:id/send` | Send invoice (email) | `invoicing-routes.ts` |
| 13 | POST | `/api/invoices/:id/void` | Void invoice | `invoicing-routes.ts` |
| 14 | GET | `/api/invoices/:id/pdf` | Download invoice PDF | `invoicing-routes.ts` |
| 15 | POST | `/api/invoices/:id/payment` | Record payment | `invoicing-routes.ts` |
| 16 | POST | `/api/invoices/credit-note` | Create credit note | `invoicing-routes.ts` |
| 17 | GET | `/api/invoices/next-number` | Get next invoice number | `invoicing-routes.ts` |
| 18 | POST | `/api/invoices/:id/void` | Void invoice | `invoicing-routes.ts` |

**Note**: Endpoint #13 and #18 are identical — dedup to **17 net new**.

### Wave 8: Recurring Invoices & Payment Processing (13 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | GET | `/api/invoices/recurring` | List recurring invoices | `invoicing-routes.ts` |
| 2 | POST | `/api/invoices/recurring` | Create recurring schedule | `invoicing-routes.ts` |
| 3 | PATCH | `/api/invoices/recurring/:id` | Update schedule | `invoicing-routes.ts` |
| 4 | DELETE | `/api/invoices/recurring/:id` | Cancel schedule | `invoicing-routes.ts` |
| 5 | POST | `/api/invoices/recurring/:id/generate` | Manually generate next | `invoicing-routes.ts` |
| 6 | GET | `/api/payments/gateways` | List payment gateways | `payments-routes.ts` |
| 7 | POST | `/api/payments/gateways` | Configure gateway | `payments-routes.ts` |
| 8 | POST | `/api/payments/process/:invoiceId` | Process payment via gateway | `payments-routes.ts` |
| 9 | GET | `/api/dunning/sequences` | List dunning sequences | `payments-routes.ts` |
| 10 | POST | `/api/dunning/sequences` | Create dunning sequence | `payments-routes.ts` |
| 11 | POST | `/api/dunning/send-reminders` | Trigger reminder batch | `payments-routes.ts` |
| 12 | GET | `/api/customers/:id/subscriptions` | List subscriptions | `invoicing-routes.ts` |
| 13 | POST | `/api/customers/:id/subscriptions` | Create subscription | `invoicing-routes.ts` |

**Net new: 13**

### Wave 9: AR Aging & Multi-Currency (12 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | GET | `/api/ar/aging` | AR aging report | `ar-routes.ts` |
| 2 | GET | `/api/ar/aging/:customerId` | Customer-specific aging | `ar-routes.ts` |
| 3 | GET | `/api/ar/summary` | AR summary (total outstanding) | `ar-routes.ts` |
| 4 | GET | `/api/currencies` | List supported currencies | `ar-routes.ts` |
| 5 | GET | `/api/exchange-rates/:from/:to` | Get exchange rate | `ar-routes.ts` |
| 6 | POST | `/api/exchange-rates/refresh` | Refresh rates from API | `ar-routes.ts` |
| 7 | GET | `/api/invoice-templates` | List templates | `ar-routes.ts` |
| 8 | POST | `/api/invoice-templates` | Create template | `ar-routes.ts` |
| 9 | PATCH | `/api/invoice-templates/:id` | Update template | `ar-routes.ts` |
| 10 | POST | `/api/invoice-templates/:id/logo` | Upload logo | `ar-routes.ts` |
| 11 | GET | `/api/customers/:id/statement` | Generate statement of account | `ar-routes.ts` |
| 12 | GET | `/api/gst/sales-summary` | GST on sales report | `ar-routes.ts` |

**Net new: 12**

### Wave 10: Accounts Payable & Purchase Orders (22 endpoints)

| # | Method | Path | Description | Handler |
|---|--------|------|-------------|---------|
| 1 | GET | `/api/suppliers` | List suppliers | `ap-routes.ts` |
| 2 | POST | `/api/suppliers` | Create supplier | `ap-routes.ts` |
| 3 | GET | `/api/suppliers/:id` | Get supplier detail | `ap-routes.ts` |
| 4 | PATCH | `/api/suppliers/:id` | Update supplier | `ap-routes.ts` |
| 5 | DELETE | `/api/suppliers/:id` | Archive supplier | `ap-routes.ts` |
| 6 | GET | `/api/bills` | List bills | `ap-routes.ts` |
| 7 | POST | `/api/bills` | Create bill | `ap-routes.ts` |
| 8 | GET | `/api/bills/:id` | Get bill detail | `ap-routes.ts` |
| 9 | PATCH | `/api/bills/:id` | Update bill | `ap-routes.ts` |
| 10 | POST | `/api/bills/:id/approve` | Approve bill | `ap-routes.ts` |
| 11 | POST | `/api/bills/:id/pay` | Record bill payment | `ap-routes.ts` |
| 12 | POST | `/api/bills/:id/void` | Void bill | `ap-routes.ts` |
| 13 | GET | `/api/purchase-orders` | List purchase orders | `ap-routes.ts` |
| 14 | POST | `/api/purchase-orders` | Create PO | `ap-routes.ts` |
| 15 | GET | `/api/purchase-orders/:id` | Get PO detail | `ap-routes.ts` |
| 16 | PATCH | `/api/purchase-orders/:id` | Update PO | `ap-routes.ts` |
| 17 | POST | `/api/purchase-orders/:id/send` | Send PO to supplier | `ap-routes.ts` |
| 18 | POST | `/api/purchase-orders/:id/receive` | Record PO receipt | `ap-routes.ts` |
| 19 | POST | `/api/purchase-orders/:id/cancel` | Cancel PO | `ap-routes.ts` |
| 20 | POST | `/api/supplier-payments` | Create supplier payment run | `ap-routes.ts` |
| 21 | GET | `/api/supplier-payments/:id` | Get payment run detail | `ap-routes.ts` |
| 22 | GET | `/api/ap/aging` | AP aging report | `ap-routes.ts` |

**Net new: 22**

---

## 3. Collision Report

### 3.1 Direct Path Collisions (Wave 1-10 vs Existing)

| Wave | New Endpoint | Existing Endpoint | Collision Type | Resolution |
|------|-------------|-------------------|----------------|------------|
| **W1** | POST `/api/chat` | POST `/api/chat` (line 950) | **REWRITE** — intentional | Rewrite existing handler; not a collision |
| **W1** | GET `/api/agents/status` | GET `/api/agents` (line 1890) | **NEAR-MISS** — different paths | OK — `/status` is a sub-path |
| **W1** | POST `/api/agents/parse` | POST `/api/agents/:type/run` (line 1913) | **PATTERN OVERLAP** | New specific routes must be registered BEFORE the `:type` wildcard |
| **W1** | POST `/api/agents/categorize` | POST `/api/agents/:type/run` (line 1913) | **PATTERN OVERLAP** | Same — register before wildcard |
| **W9** | GET `/api/gst/sales-summary` | GET `/api/gst/summary` (line 2359) | **NEAR-MISS** — different paths | OK — `/sales-summary` vs `/summary` |

### 3.2 Critical Route Registration Order Issues

The existing `POST /api/agents/:type/run` at line 1913 is a wildcard route. Wave 1 adds specific agent routes like `POST /api/agents/parse`, `POST /api/agents/categorize`, etc. These **must be registered before** the `:type/run` wildcard to avoid being caught by it.

**Recommendation**: Move Wave 1 agent routes into a separate route file (`agent-routes-extended.ts`) and mount it via `app.route()` BEFORE the generic agent routes, OR restructure so Wave 1 routes use a distinct path prefix like `/api/agents/invoke/:type`.

### 3.3 Namespace Conflicts with Future Waves (11-24)

| Wave 1-10 Path | Future Wave Path | Risk |
|----------------|-----------------|------|
| `/api/payroll/*` (W4-6) | — | No conflict — payroll namespace is new |
| `/api/customers/*` (W7-8) | — | No conflict — customers namespace is new |
| `/api/invoices/*` (W7-8) | — | No conflict — invoices namespace is new |
| `/api/suppliers/*` (W10) | — | No conflict — suppliers namespace is new |
| `/api/bills/*` (W10) | `/api/analytics/bills` (existing) | **NEAR-MISS** — different prefix |
| `/api/purchase-orders/*` (W10) | — | No conflict |
| `/api/payments/*` (W8) | — | No conflict — separate from `/api/matches/*` |
| `/api/dunning/*` (W8) | — | No conflict — new namespace |
| `/api/ar/*` (W9) | — | No conflict — new namespace |
| `/api/currencies/*` (W9) | — | No conflict — new namespace |
| `/api/exchange-rates/*` (W9) | — | No conflict — new namespace |
| `/api/invoice-templates/*` (W9) | — | No conflict — new namespace |
| `/api/ap/*` (W10) | — | No conflict — new namespace |
| `/api/supplier-payments/*` (W10) | — | No conflict — new namespace |
| `/api/cognee/*` (W3) | `/api/knowledge/*` (existing W16) | **INTENTIONAL SEPARATION** — Cognee session mgmt vs knowledge graph |
| `/api/chat/*` (W2) | `/api/chat` (existing) | **REWRITE + EXTENSION** — extends existing chat |

### 3.4 Wave 14 (OCR) vs Wave 7 (Invoicing) Overlap Check

Wave 14 created `/api/documents/*` for OCR processing. Wave 7 creates `/api/invoices/*` for invoice management. These are **separate namespaces** — no collision. However, the `invoice_payments` table from Wave 7 references `transactionId`, and Wave 14's `payment_matches` table also links documents to transactions. The **services** must be aware of each other but the **routes** are clean.

---

## 4. Pattern Guide — Standardized Conventions

### 4.1 Route Pattern Conventions

| Convention | Example | Notes |
|-----------|---------|-------|
| **Prefix** | `/api/` | ALL routes under `/api/` prefix |
| **Nouns in plural** | `/api/customers`, `/api/invoices` | Resources are plural |
| **Kebab-case** | `/api/pay-runs`, `/api/pay-categories` | Multi-word paths use hyphens |
| **Nested resources** | `/api/customers/:id/contacts` | Sub-resources under parent |
| **Actions as verbs** | `/api/invoices/:id/send`, `/api/invoices/:id/void` | Non-CRUD actions as POST with verb |
| **Parameter IDs** | `:id`, `:customerId`, `:year` | Descriptive param names |

### 4.2 HTTP Method Conventions

| Operation | Method | Pattern |
|-----------|--------|---------|
| List | GET | `/api/{resource}` |
| Get by ID | GET | `/api/{resource}/:id` |
| Create | POST | `/api/{resource}` |
| Update | PATCH | `/api/{resource}/:id` |
| Full Replace | PUT | `/api/{resource}/:id` |
| Delete/Archive | DELETE | `/api/{resource}/:id` |
| Action | POST | `/api/{resource}/:id/{action}` |

### 4.3 Pagination Pattern

Existing pattern uses query params:
```
GET /api/transactions?offset=0&limit=50&accountId=1&category=income
```
Returns: `{ transactions: [...], total: number }`

**Recommendation for new endpoints**: Use same offset/limit pattern with `total` in response.

### 4.4 Error Response Format

```json
{
  "error": "Human-readable error message"
}
```
**Exception**: `/api/chat` must return `{ answer: string }` for client compatibility.

### 4.5 Middleware Stack

All `/api/*` routes pass through:
1. `securityHeaders()` — OWASP headers
2. `auditMiddleware()` — audit logging
3. CORS middleware
4. JWT validation (`c.get('jwtPayload')`)
5. Rate limiter on `/api/chat`

### 4.6 Route File Organization (Recommended for W1+)

Current state: Most routes are inline in `index.ts` (6400+ lines). Recommended pattern:

```
server/src/routes/
  agents.ts           — existing (4 routes)
  pipeline.ts         — existing (7 routes)
  agent-routes.ts     — Wave 1: Extended agent routes
  chat-routes.ts      — Wave 2: Chat streaming/mutations
  cognee-routes.ts    — Wave 3: Cognee session management
  payroll-routes.ts   — Waves 4-6: Full payroll system
  invoicing-routes.ts — Waves 7-8: Customers & invoices
  ar-routes.ts        — Wave 9: AR aging & currencies
  ap-routes.ts        — Wave 10: Suppliers, bills, POs
```

Mount pattern:
```typescript
app.route('/api', payrollRoutes);
app.route('/api', invoicingRoutes);
app.route('/api', arRoutes);
app.route('/api', apRoutes);
```

---

## 5. Total New Endpoints Summary

| Wave | Description | New Endpoints |
|------|-------------|:-------------:|
| Wave 1 | Chat→Agent Bridge & Intent Routing | 8 (+1 rewrite) |
| Wave 2 | Transaction Mutation & Streaming | 6 |
| Wave 3 | Multi-User Cognee & Custom DataPoints | 4 |
| Wave 4 | Employee Management & Pay Structures | 15 |
| Wave 5 | Pay Run Processing & Leave Management | 15 |
| Wave 6 | STP Compliance & Payroll Reporting | 18 |
| Wave 7 | Customer Management & Invoice Generation | 17 |
| Wave 8 | Recurring Invoices & Payment Processing | 13 |
| Wave 9 | AR Aging & Multi-Currency | 12 |
| Wave 10 | Accounts Payable & Purchase Orders | 22 |
| **TOTAL** | | **130** (+1 rewrite) |

### After Waves 1-10 Complete

| Metric | Count |
|--------|:-----:|
| Existing endpoints (pre-Wave 1) | 254 |
| New endpoints (Waves 1-10) | 130 |
| **Total API surface** | **384** |

### Endpoint Distribution by HTTP Method

| Method | Existing | New (W1-10) | Total |
|--------|:--------:|:-----------:|:-----:|
| GET | 123 | 47 | 170 |
| POST | 103 | 67 | 170 |
| PATCH | 17 | 7 | 24 |
| PUT | 3 | 0 | 3 |
| DELETE | 8 | 5 | 13 |
| **Total** | **254** | **130** | **384** |

### Endpoint Distribution by Domain

| Domain | Existing | New (W1-10) | Total |
|--------|:--------:|:-----------:|:-----:|
| Core (auth, health, SSE) | 6 | 0 | 6 |
| Transactions | 6 | 0 | 6 |
| Statements | 9 | 0 | 9 |
| Agents | 12 | 8 | 20 |
| Chat | 1 | 6 | 7 |
| Cognee | 0 | 4 | 4 |
| BAS/GST | 14 | 1 | 15 |
| Tax | 25 | 0 | 25 |
| Payroll | 3 | 48 | 51 |
| Customers/Invoicing | 0 | 30 | 30 |
| Payments/Dunning | 0 | 6 | 6 |
| AR/Currencies | 0 | 12 | 12 |
| Suppliers/Bills/POs | 0 | 22 | 22 |
| Analytics | 15 | 0 | 15 |
| Accounts | 5 | 0 | 5 |
| Reports | 8 | 0 | 8 |
| Budgets/Forecasts | 13 | 0 | 13 |
| Documents/OCR | 8 | 0 | 8 |
| Matches | 10 | 0 | 10 |
| Knowledge | 16 | 0 | 16 |
| Intelligence | 14 | 0 | 14 |
| Inventory/Recon | 22 | 0 | 22 |
| Assets/Entities | 18 | 0 | 18 |
| Consolidation | 6 | 0 | 6 |
| Other (loans, economic, etc.) | 43 | 0 | 43 |

---

## 6. Critical Implementation Notes

### 6.1 index.ts Size Warning

`server/src/index.ts` is already ~6400+ lines with 197 inline route handlers. Adding 130 more endpoints inline would be untenable. **Waves 1-10 MUST use separate route files** mounted via `app.route()`.

### 6.2 Wave 1 Agent Route Registration Order

The existing generic agent routes (`/api/agents/:type/run`) MUST be registered AFTER specific Wave 1 routes (`/api/agents/parse`, `/api/agents/categorize`, etc.) to avoid the wildcard `:type` consuming specific paths.

### 6.3 Payroll Namespace (Waves 4-6)

Waves 4-6 add 48 endpoints under `/api/payroll/*`. This is the largest new namespace. Recommend a dedicated route file with sub-grouping:
- `/api/payroll/employees/*` (11 routes)
- `/api/payroll/pay-categories/*` (2 routes)
- `/api/payroll/pay-structures/*` (2 routes)
- `/api/payroll/pay-runs/*` (8 routes)
- `/api/payroll/leave/*` (7 routes)
- `/api/payroll/stp/*` (5 routes)
- `/api/payroll/payslips/*` (3 routes)
- `/api/payroll/awards/*` (3 routes)
- `/api/payroll/timesheets/*` (3 routes)
- `/api/payroll/reports/*` (4 routes)

### 6.4 Existing Payroll Routes Conflict

Existing endpoints at `/api/payroll/wages` (GET), `/api/payroll/upload-ledger` (POST), and `/api/payroll/wages/:id` (PATCH) are legacy payroll routes from the original system. Waves 4-6 must either:
- **Deprecate** these 3 routes and redirect to new payroll system
- **Keep** them for backward compatibility alongside new routes

**Recommendation**: Keep existing 3 routes but mark them as `@deprecated` in comments. New payroll system operates alongside.

### 6.5 GST Sales Summary (Wave 9) vs Existing GST

Wave 9 adds `GET /api/gst/sales-summary` alongside existing `GET /api/gst/summary`. These serve different purposes:
- `/api/gst/summary` — GST on purchases (input tax credits)
- `/api/gst/sales-summary` — GST on sales (output tax)

Both are needed. No collision.
