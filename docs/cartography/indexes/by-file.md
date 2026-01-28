# Index: By File

## Client Source Files

### Entry Points
- `client/src/main.tsx` - React entry point
- `client/src/App.tsx` - Main application shell
- `client/src/api.ts` - API client (55 methods)
- `client/src/index.css` - Global styles

### Contexts
- `client/src/context/SSEContext.tsx` - Real-time events

### Hooks
- `client/src/hooks/useUndoRedo.ts` - Undo/redo
- `client/src/hooks/useEventSource.ts` - SSE connection
- `client/src/hooks/usePolling.ts` - Polling fallback

### Feature Components
- `features/auth/components/Auth.tsx`
- `features/accounts/components/AccountsOverview.tsx`
- `features/accounts/components/DebtReductionPlanner.tsx`
- `features/accounts/components/AccountSetupWizard.tsx`
- `features/analytics/components/MonthlyTrendChart.tsx`
- `features/analytics/components/CategoryChart.tsx`
- `features/bas/components/BASDashboard.tsx`
- `features/chat/components/FloatingChat.tsx`
- `features/settings/components/SettingsModal.tsx`
- `features/settings/components/MerchantMemoryManager.tsx`
- `features/statements/components/FileUpload.tsx`
- `features/statements/components/StatementList.tsx`
- `features/tax/components/TaxDashboard.tsx`
- `features/tax/components/TaxCalculator.tsx`
- `features/tax/components/DeductionManager.tsx`
- `features/tax/components/CGTAssetRegister.tsx`
- `features/tax/components/DepreciationSchedule.tsx`
- `features/transactions/components/TransactionTable.tsx`
- `features/transactions/components/PendingCategorizationReview.tsx`

### UI Components
- `components/ui/button.tsx`
- `components/ui/card.tsx`
- `components/ui/dialog.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/input.tsx`
- `components/ui/select.tsx`
- `components/ui/tabs.tsx`
- (+ 7 more)

---

## Server Source Files

### Entry Points
- `server/src/index.ts` - Hono server (65+ routes)
- `server/src/schema.ts` - Database schema (17 tables)
- `server/src/auth.ts` - Auth utilities

### Services
- `server/src/services/pipeline.ts` - Statement processing
- `server/src/services/ai.ts` - AI integration
- `server/src/services/accounts.ts` - Account operations
- `server/src/services/rag.ts` - RAG integration
- `server/src/services/bas.ts` - BAS calculations
- `server/src/services/tax.ts` - Tax calculations
- `server/src/services/agents.ts` - Python agents

### Bank Parsers
- `server/src/services/parsers/cba.ts`
- `server/src/services/parsers/anz.ts`
- `server/src/services/parsers/westpac.ts`
- `server/src/services/parsers/nab.ts`
- `server/src/services/parsers/stgeorge.ts`
- `server/src/services/parsers/bendigo.ts`
- `server/src/services/parsers/ing.ts`
- `server/src/services/parsers/macquarie.ts`

---

## Configuration Files
- `client/package.json`
- `client/vite.config.ts`
- `client/tsconfig.json`
- `client/tailwind.config.js`
- `server/package.json`
- `server/tsconfig.json`
- `server/drizzle.config.ts`
- `env.local`
- `docker-compose.yml`

**Total: ~80 source files**
