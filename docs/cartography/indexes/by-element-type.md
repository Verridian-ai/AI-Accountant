# Index: By Element Type

## UI Components (34 total)

### Feature Components (19)
| ID | Name | Feature |
|----|------|---------|
| ui-cmp-auth | Auth | auth |
| ui-cmp-accounts-overview | AccountsOverview | accounts |
| ui-cmp-debt-reduction-planner | DebtReductionPlanner | accounts |
| ui-cmp-account-setup-wizard | AccountSetupWizard | accounts |
| ui-cmp-monthly-trend-chart | MonthlyTrendChart | analytics |
| ui-cmp-category-chart | CategoryChart | analytics |
| ui-cmp-bas-dashboard | BASDashboard | bas |
| ui-cmp-floating-chat | FloatingChat | chat |
| ui-cmp-settings-modal | SettingsModal | settings |
| ui-cmp-merchant-memory-manager | MerchantMemoryManager | settings |
| ui-cmp-file-upload | FileUpload | statements |
| ui-cmp-statement-list | StatementList | statements |
| ui-cmp-tax-dashboard | TaxDashboard | tax |
| ui-cmp-tax-calculator | TaxCalculator | tax |
| ui-cmp-deduction-manager | DeductionManager | tax |
| ui-cmp-cgt-asset-register | CGTAssetRegister | tax |
| ui-cmp-depreciation-schedule | DepreciationSchedule | tax |
| ui-cmp-transaction-table | TransactionTable | transactions |
| ui-cmp-pending-categorization-review | PendingCategorizationReview | transactions |

### Common Components (15)
Button, Card, Dialog, DropdownMenu, Input, Label, Popover, Progress, ScrollArea, Select, Switch, Tabs, Tooltip, HoverCard, StatCard

---

## Hooks (3)
| ID | Name | Purpose |
|----|------|---------|
| hook-use-undo-redo | useUndoRedo | Undo/redo for edits |
| hook-use-event-source | useEventSource | SSE connection |
| hook-use-polling | usePolling | Polling fallback |

---

## Contexts (1)
| ID | Name | Purpose |
|----|------|---------|
| ctx-sse | SSEContext | Real-time events |

---

## Backend Services (8)
| ID | Name | Functions |
|----|------|-----------|
| svc-pipeline | Pipeline Service | 5 |
| svc-ai | AI Service | 8 |
| svc-accounts | Accounts Service | 6 |
| svc-rag | RAG Service | 3 |
| svc-bas | BAS Service | 4 |
| svc-tax | Tax Service | 6 |
| svc-transfers | Transfer Service | 4 |
| svc-agents | Agent Service | 3 |

---

## API Objects (4)
| Object | Methods | Purpose |
|--------|---------|---------|
| api | 34 | Core CRUD operations |
| basApi | 8 | BAS calculations |
| taxApi | 10 | Tax calculations |
| multiBankApi | 3 | Multi-account views |

---

## User Actions (35)
- Authentication: 3 (login, register, logout)
- Statements: 2 (upload, reprocess)
- Transactions: 7 (edit, split, delete, filter, sort, export, undo)
- Categorization: 3 (review, approve, modify)
- Accounts: 4 (create, edit, link transfer, auto-detect)
- Chat: 2 (send, toggle)
- Settings: 2 (open, change model)
- BAS: 2 (calculate, save)
- Tax: 4 (calculate, add deduction, add CGT, record disposal)
- Analytics: 1 (view debt plan)
- Navigation: 2 (switch tab, refresh)
