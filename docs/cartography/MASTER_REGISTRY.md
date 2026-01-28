# CBA Statements Parser - Master Registry

Single source of truth for all codebase elements.

## Quick Reference

- **API Routes**: 65 | **Database Tables**: 17 | **Components**: 34
- **API Methods**: 55 | **User Actions**: 35 | **Icons**: 43

---

## Database Tables

| ID | Table | Columns | Key References |
|----|-------|---------|----------------|
| `table-users` | users | 3 | Root table |
| `table-user-settings` | userSettings | 6 | → users |
| `table-statements` | statements | 17 | → users |
| `table-transactions` | transactions | 19 | → statements, users |
| `table-transaction-history` | transactionHistory | 6 | → transactions |
| `table-accounts` | accounts | 17 | → users |
| `table-statement-accounts` | statementAccounts | 2 | → statements, accounts |
| `table-merchant-memory` | merchantMemory | 10 | → users |
| `table-transfer-links` | transferLinks | 5 | → transactions |
| `table-pending-categorizations` | pendingCategorizations | 7 | → transactions |
| `table-bas-periods` | basPeriods | 8 | → users |
| `table-bas-calculations` | basCalculations | 14 | → basPeriods |
| `table-deductions` | deductions | 10 | → users |
| `table-cgt-assets` | cgtAssets | 13 | → users |
| `table-cgt-events` | cgtEvents | 9 | → cgtAssets |
| `table-depreciation-schedules` | depreciationSchedules | 11 | → users |

---

## API Routes by Category

### Authentication (2)
| ID | Method | Path |
|----|--------|------|
| `route-auth-register` | POST | /auth/register |
| `route-auth-login` | POST | /auth/login |

### Statements (5)
| ID | Method | Path |
|----|--------|------|
| `route-get-statements` | GET | /api/statements |
| `route-upload-statement` | POST | /api/statements/upload |
| `route-reprocess-statement` | POST | /api/statements/:id/reprocess |
| `route-delete-statement` | DELETE | /api/statements/:id |
| `route-statement-gaps` | GET | /api/statements/gaps |

### Transactions (7)
| ID | Method | Path |
|----|--------|------|
| `route-get-transactions` | GET | /api/transactions |
| `route-get-transaction` | GET | /api/transactions/:id |
| `route-update-transaction` | PATCH | /api/transactions/:id |
| `route-split-transaction` | POST | /api/transactions/:id/split |
| `route-delete-transaction` | DELETE | /api/transactions/:id |
| `route-export-csv` | GET | /api/transactions/export/csv |
| `route-export-xlsx` | GET | /api/transactions/export/xlsx |

### Accounts (5)
| ID | Method | Path |
|----|--------|------|
| `route-get-accounts` | GET | /api/accounts |
| `route-create-account` | POST | /api/accounts |
| `route-update-account` | PATCH | /api/accounts/:id |
| `route-delete-account` | DELETE | /api/accounts/:id |
| `route-get-balance-history` | GET | /api/accounts/:id/balance-history |

### Transfers (4)
| ID | Method | Path |
|----|--------|------|
| `route-get-transfers` | GET | /api/transfers |
| `route-create-transfer` | POST | /api/transfers |
| `route-delete-transfer` | DELETE | /api/transfers/:id |
| `route-auto-detect-transfers` | POST | /api/transfers/auto-detect |

### BAS (8)
| ID | Method | Path |
|----|--------|------|
| `route-get-bas-periods` | GET | /api/bas/periods |
| `route-create-bas-period` | POST | /api/bas/periods |
| `route-get-bas-period` | GET | /api/bas/periods/:id |
| `route-calculate-bas` | POST | /api/bas/calculate |
| `route-save-bas` | POST | /api/bas/periods/:id/save |
| `route-get-gst-summary` | GET | /api/bas/gst-summary |
| `route-get-bas-history` | GET | /api/bas/history |
| `route-export-bas-pdf` | POST | /api/bas/export-pdf |

### Tax (10)
| ID | Method | Path |
|----|--------|------|
| `route-calculate-tax` | POST | /api/tax/calculate |
| `route-get-deductions` | GET | /api/tax/deductions |
| `route-add-deduction` | POST | /api/tax/deductions |
| `route-update-deduction` | PATCH | /api/tax/deductions/:id |
| `route-delete-deduction` | DELETE | /api/tax/deductions/:id |
| `route-get-cgt-assets` | GET | /api/tax/cgt-assets |
| `route-add-cgt-asset` | POST | /api/tax/cgt-assets |
| `route-record-disposal` | POST | /api/tax/cgt-assets/:id/dispose |
| `route-get-depreciation` | GET | /api/tax/depreciation |
| `route-add-depreciation` | POST | /api/tax/depreciation |

---

## UI Components

### Feature Components
| ID | Name | Feature |
|----|------|---------|
| `ui-cmp-auth` | Auth | auth |
| `ui-cmp-accounts-overview` | AccountsOverview | accounts |
| `ui-cmp-debt-reduction-planner` | DebtReductionPlanner | accounts |
| `ui-cmp-account-setup-wizard` | AccountSetupWizard | accounts |
| `ui-cmp-monthly-trend-chart` | MonthlyTrendChart | analytics |
| `ui-cmp-category-chart` | CategoryChart | analytics |
| `ui-cmp-bas-dashboard` | BASDashboard | bas |
| `ui-cmp-floating-chat` | FloatingChat | chat |
| `ui-cmp-settings-modal` | SettingsModal | settings |
| `ui-cmp-merchant-memory-manager` | MerchantMemoryManager | settings |
| `ui-cmp-file-upload` | FileUpload | statements |
| `ui-cmp-statement-list` | StatementList | statements |
| `ui-cmp-tax-dashboard` | TaxDashboard | tax |
| `ui-cmp-tax-calculator` | TaxCalculator | tax |
| `ui-cmp-deduction-manager` | DeductionManager | tax |
| `ui-cmp-cgt-asset-register` | CGTAssetRegister | tax |
| `ui-cmp-depreciation-schedule` | DepreciationSchedule | tax |
| `ui-cmp-transaction-table` | TransactionTable | transactions |
| `ui-cmp-pending-categorization-review` | PendingCategorizationReview | transactions |

---

## Backend Services

| ID | Service | File | Functions |
|----|---------|------|-----------|
| `svc-pipeline` | Pipeline | services/pipeline.ts | 5 |
| `svc-ai` | AI | services/ai.ts | 8 |
| `svc-accounts` | Accounts | services/accounts.ts | 6 |
| `svc-rag` | RAG | services/rag.ts | 3 |
| `svc-bas` | BAS | services/bas.ts | 4 |
| `svc-tax` | Tax | services/tax.ts | 6 |
| `svc-transfers` | Transfers | services/transfers/ | 4 |
| `svc-agents` | Agents | services/agents.ts | 3 |

---

## Hooks & Contexts

| ID | Name | Purpose |
|----|------|---------|
| `ctx-sse` | SSEContext | Real-time event streaming |
| `hook-use-undo-redo` | useUndoRedo | Undo/redo for edits |
| `hook-use-event-source` | useEventSource | SSE connection |
| `hook-use-polling` | usePolling | Polling fallback |

---

## Cross-Reference: Feature → Elements

### Transactions Feature
- **Components**: `ui-cmp-transaction-table`, `ui-cmp-pending-categorization-review`
- **Routes**: `route-get-transactions`, `route-update-transaction`, `route-split-transaction`, `route-delete-transaction`
- **Tables**: `table-transactions`, `table-transaction-history`, `table-pending-categorizations`
- **Actions**: `action-edit-transaction`, `action-split-transaction`, `action-delete-transaction`

### BAS Feature
- **Components**: `ui-cmp-bas-dashboard`
- **Routes**: `route-calculate-bas`, `route-save-bas`, `route-get-gst-summary`
- **Tables**: `table-bas-periods`, `table-bas-calculations`
- **Service**: `svc-bas`

### Tax Feature
- **Components**: `ui-cmp-tax-dashboard`, `ui-cmp-tax-calculator`, `ui-cmp-deduction-manager`, `ui-cmp-cgt-asset-register`
- **Routes**: `route-calculate-tax`, `route-get-deductions`, `route-add-deduction`, `route-get-cgt-assets`
- **Tables**: `table-deductions`, `table-cgt-assets`, `table-cgt-events`, `table-depreciation-schedules`
- **Service**: `svc-tax`

---

## See Also

- [Raw Data Files](raw/) - Machine-readable JSON
- [Diagrams](diagrams/) - Architecture diagrams
- [Indexes](indexes/) - Searchable indexes
