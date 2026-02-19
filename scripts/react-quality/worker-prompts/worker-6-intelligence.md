# Worker 6 — Intelligence + Entities + Knowledge + Docs + Invoicing + Inventory + Dashboards + Streaming + Assets + Onboarding + Chat + Statements + Components + App.tsx

You are worker-6-intelligence on the react-quality agent team.

## YOUR FILE OWNERSHIP (never touch files outside these paths)
```
client/src/features/intelligence/
client/src/features/entities/
client/src/features/knowledge/
client/src/features/documents/
client/src/features/invoicing/
client/src/features/inventory/
client/src/features/dashboards/
client/src/features/streaming/
client/src/features/assets/
client/src/features/onboarding/
client/src/features/chat/
client/src/features/statements/
client/src/features/notifications/
client/src/components/
client/src/App.tsx
```

## STEP 1 — Read your instructions
Read these files before touching any code:
- `scripts/react-quality/rules-reference.md` — all fix patterns with code examples
- `scripts/react-quality/react-doctor-full-report.txt` — grep for your file paths to find exact line numbers

## STEP 2 — Run react-doctor on your domains
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx -y react-doctor@latest \
  src/features/intelligence/ src/features/entities/ src/features/knowledge/ \
  src/features/documents/ src/features/invoicing/ src/features/inventory/ \
  src/features/dashboards/ src/features/streaming/ src/features/assets/ \
  src/features/onboarding/ src/features/chat/ src/features/statements/ \
  src/components/ src/App.tsx --verbose 2>&1
```

## STEP 3 — Fix each file, applying ALL applicable rules

Work file-by-file. After every 5 files: `npx tsc --noEmit` → must be 0 errors.

### Critical files (ERROR-level, fix first):
- `features/transactions/TransactionTable/TransactionTable.tsx` — nested component (NOT your domain — skip)
- `features/assets/AssetRegisterTable.tsx` — nested component (hoist it!), keyboard handler, role, array key, excessive useState
- `features/dashboards/components/CustomDashboard/CustomDashboard.tsx` — (fetch-in-useEffect fixed) inline render function: renderWidget()

### High-priority files:
**intelligence/**
- `InsightFeed.tsx` — keyboard handler, role, excessive useState, large component
- `CorrelationExplorer.tsx` — form labels (2×), excessive useState, recharts lazy-load
- `SubscriptionManager.tsx` — form labels (6×), excessive useState
- `ModuleConnectionMap.tsx` — excessive useState
- `IntelligenceTimeline.tsx` — form labels (2×), excessive useState
- `IntelligenceDashboard.tsx` — form labels (2×), excessive useState
- `TemporalQueryBuilder.tsx` — form labels (8×), array key, excessive useState, recharts lazy-load, inline render (2×)

**entities/**
- `EntityHierarchyView.tsx` — keyboard handler, role, array key
- `InterEntityTransactionsView.tsx` — keyboard handler, role, array key, excessive useState (2×), non-lazy useState
- `EntitiesDashboard.tsx` — array key, excessive useState
- `ConsolidationView.tsx` — array key, excessive useState, large component (326 lines — split it)
- `CreateEntityForm.tsx` — excessive useState
- `EntitySettingsPanel.tsx` — excessive useState

**knowledge/**
- `KnowledgeDashboard.tsx` — (fetch fixed) form label at line 103, fix it
- `KnowledgeGraphExplorer.tsx` — excessive useState
- `DataPointManager.tsx` — form labels (6×), excessive useState
- `OntologyManager.tsx` — form labels (5×), excessive useState
- `FeedbackPanel.tsx` — excessive useState
- `GraphStatsPanel.tsx` — multiple setState in useEffect

**documents/**
- `DocumentUpload.tsx` — keyboard handler, role
- `DocumentsDashboard.tsx` — keyboard handler, role
- `LineItemEditor.tsx` — autoFocus (4×), multiple setState in useEffect

**invoicing/**
- `InvoiceList.tsx` — useEffect→event handler (state reset), excessive useState
- `CustomerList.tsx` — useEffect→event handler (state reset), excessive useState
- `InvoicingDashboard.tsx` — excessive useState
- `InvoiceEditor.tsx` — form labels (4×), multiple setState in useEffect, excessive useState
- `CustomerDetail.tsx` — excessive useState, multiple setState
- `CustomerForm.tsx` — form labels (12×), large component
- `InvoicePreview.tsx` — array key

**inventory/**
- `COGSCalculator.tsx` — form labels (2×), array key, excessive useState
- `InventoryDashboard.tsx` — multiple setState in useEffect
- `InventoryItemList.tsx` — form labels (7×), excessive useState
- `MovementHistory.tsx` — stale closure setState, excessive useState
- `WarehouseManager.tsx` — form labels (2×)
- `ValuationReport.tsx` — form label

**dashboards/**
- `DashboardGrid.tsx` — form labels (2×), keyboard handler (2×), role (2×), autoFocus, excessive useState
- `WidgetPicker.tsx` — keyboard handler, role
- `WidgetConfigPanel.tsx` — form label (check), useEffect→event handler, multiple setState, excessive useState, inline render function
- `CustomDashboard/CustomDashboard.tsx` — inline render function (renderWidget), fix by extracting WidgetRenderer component

**streaming/**
- `StreamingIndicator.tsx` — (fetch fixed) check for other issues
- `SchemaExplorer.tsx` — array key, excessive useState
- `MigrationDashboard.tsx` — excessive useState

**assets/**
- `AssetRegisterTable.tsx` — nested component (HOIST), keyboard handler, role, array key, excessive useState
- `AssetsDashboard.tsx` — excessive useState
- `RegisterAssetForm.tsx` — excessive useState
- `DepreciationScheduleView.tsx` — array key
- `AssetDisposalForm.tsx` — excessive useState

**onboarding/**
- `StatementUploadStep.tsx` — keyboard handler, role, large component
- `CompletionStep.tsx` — array key (2×)
- `TaxSetupStep.tsx` — form labels (3×)
- `BusinessProfileStep.tsx` — form labels (3×)
- `CategorySetupStep.tsx` — autoFocus

**chat/**
- `ChatInterface.tsx` — array key
- `FloatingChat.tsx` — array key, excessive useState, keyboard handler

**statements/**
- `StatementList/StatementList.tsx:3` — BARREL IMPORT (fix: import directly from source)
- `StatementList/components/StatementCard.tsx` — keyboard handler, role
- `StatementList/components/LoadingSkeleton.tsx` — array key
- `StatementList/components/GapAnalysisPanel.tsx` — array key (3×)
- `FileUpload.tsx` — keyboard handler, role

**components/**
- `ui/SwipeableCard/SwipeableCard.tsx` — role, permanent will-change → conditional
- `ui/PullToRefresh/PullToRefresh.tsx` — role, permanent will-change → conditional
- `ui/BottomSheet.tsx` — role, useEffect→event handler, touchend without passive
- `common/ErrorRecovery.tsx` — array key
- `layout/NavigationDrawer.tsx` — keyboard handler, role
- `charts/BarChart.tsx` — recharts lazy-load
- `charts/LineChart.tsx` — recharts lazy-load
- `charts/PieChart.tsx` — recharts lazy-load
- `charts/ComposedChart.tsx` — recharts lazy-load, default prop [] (3×)
- `charts/Sankey.tsx` — recharts lazy-load
- `charts/ScatterPlot.tsx` — recharts lazy-load
- `charts/Sparkline.tsx` — recharts lazy-load
- `charts/TreeMap.tsx` — recharts lazy-load
- `charts/ChartContainer.tsx` — recharts lazy-load

**App.tsx**
- multiple setState in useEffect, excessive useState (73 lines — check if useReducer makes sense)

### recharts lazy-load for src/components/charts/
These are thin chart wrappers. Create a `src/components/charts/impl/` directory:
1. For each chart (e.g. `BarChart.tsx`), move the recharts code into `impl/BarChartImpl.tsx`
2. In the original file, replace with lazy wrapper:
```tsx
import { lazy, Suspense } from 'react';
const BarChartImpl = lazy(() => import('./impl/BarChartImpl'));
export function BarChartComponent(props: BarChartProps) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500 text-xs">Loading…</div>}>
      <BarChartImpl {...props} />
    </Suspense>
  );
}
```
Do this for ALL 9 chart wrappers in one commit.

## STEP 4 — Final check
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx tsc --noEmit
npx -y react-doctor@latest src/features/intelligence/ src/features/entities/ src/features/knowledge/ src/features/documents/ src/features/invoicing/ src/features/inventory/ src/features/dashboards/ src/features/streaming/ src/features/assets/ src/features/onboarding/ src/features/chat/ src/features/statements/ src/components/ src/App.tsx --verbose 2>&1 | tail -20
```

## STEP 5 — Commit
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse"
git add client/src/features/intelligence/ client/src/features/entities/ client/src/features/knowledge/ client/src/features/documents/ client/src/features/invoicing/ client/src/features/inventory/ client/src/features/dashboards/ client/src/features/streaming/ client/src/features/assets/ client/src/features/onboarding/ client/src/features/chat/ client/src/features/statements/ client/src/components/ client/src/App.tsx
git commit -m "fix(react-quality): worker-6 intelligence/knowledge/components — all warnings resolved"
```

## STEP 6 — Report done
Send message to lead: `DONE: worker-6-intelligence — [N] files fixed, TSC clean`
Then mark your task as completed using TaskUpdate.
