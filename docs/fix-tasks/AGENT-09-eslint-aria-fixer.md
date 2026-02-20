# Agent-09: ESLint Errors & Accessibility Fixer

**Your role**: Fix all 46 ESLint errors in client/src/ and add ARIA attributes to modals, buttons, and tables.
**Working directory**: `/mnt/c/Users/Danie/Desktop/CBA Statements Parse`
**After every change**: Run `cd client && npx tsc --noEmit` — must stay at 0 errors.
**Check ESLint progress**: Run `cd client && npx eslint src/ --ext .ts,.tsx 2>&1 | grep "error " | wc -l`

---

## PART 1: Fix 46 ESLint Errors

Run this first to see the current errors:
```bash
cd client && npx eslint src/ --ext .ts,.tsx 2>&1 | grep " error "
```

### Category 1: Unused imports (most common error)

For each file, READ it first, then remove only the unused imports. Do NOT remove imports that are used.

**Pattern**: Find `import { X, Y } from '...'` where `X` is flagged as unused. Remove only `X` from the import list. If the entire import only had `X`, remove the whole import line.

**Files likely to fix** (based on audit — verify with actual ESLint output):

- `client/src/features/ai-agents/components/AgentConfigManager.tsx` — unused `Badge`, `Calculator`
- `client/src/features/reports/` — unused `ArrowUpDown`, `Save`
- `client/src/features/bas/` — unused `BarChart3`
- `client/src/features/transactions/` — unused `CATEGORY_NAMES`, `cn`
- `client/src/features/dashboard/` — unused `Download`, `CheckCircle`, `Clock`, `AlertTriangle`, `XCircle`, `Skeleton`
- Multiple files with `EntityData`, `CardHeader`, `CardTitle`, `FileText`, `Search`, `Eye`, `TrendingDown`, `Check`

**For each file**:
1. Run `cd client && npx eslint src/path/to/File.tsx 2>&1` to see exactly which imports are flagged
2. READ the file
3. Remove only the flagged unused imports
4. Verify with tsc

### Category 2: Unused variables

**Pattern**: Variables declared but never used. Remove them.

**Files with unused vars** (verify with ESLint):
- Some component files have `currentIndex`, `loading`, `setLoading`, `setCustomerFilter`, `confidenceBarColor`, `statusColors`, `onRefresh`, `isOnboarding`

For unused state variables like `const [loading, setLoading] = useState(false)` where `loading` is used but `setLoading` is not (or vice versa), you can prefix with `_` to indicate intentionally unused:
```typescript
const [_loading, setLoading] = useState(false);  // prefixed with _ = intentionally unused
```

Or remove the variable entirely if it's truly not needed.

### Category 3: React Hook violations

**Pattern**: `setState()` called synchronously inside `useEffect` without a condition — this triggers re-renders.

**Example of broken code**:
```typescript
useEffect(() => {
  setSomeState(value);  // ← synchronous setState inside useEffect = ESLint warning
}, []);
```

**Fix**: This is usually OK if it's called once on mount. The ESLint rule may be `react-hooks/exhaustive-deps` — check if deps array is complete:
```typescript
useEffect(() => {
  setSomeState(computedValue);
}, [computedValue]);  // ← add the dependency
```

### Category 4: Impure function calls during render

**Pattern**: `Math.random()` or similar called during component render — violates React's purity rules.

If found in a chart component (PieChart), move the random call into a `useRef` or `useMemo`:
```typescript
// BEFORE:
const color = `hsl(${Math.random() * 360}, 70%, 50%)`;  // called every render

// AFTER:
const color = useMemo(() => `hsl(${Math.random() * 360}, 70%, 50%)`, []);
```

---

## PART 2: Add ARIA Attributes to Modals

**Problem**: 9+ modals/overlays lack `role="dialog"` and `aria-labelledby`.

For each modal component, READ the file, find the top-level div of the modal, and add:
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title-id"
>
  <h2 id="modal-title-id">Modal Title</h2>
  {/* ... */}
</div>
```

**Files to fix** (verify each one by reading):

1. `client/src/features/ai-agents/components/AgentConfigManager.tsx` — edit modal div ~line 159
2. `client/src/features/admin/components/FeatureFlagManager.tsx` — flag edit modal
3. `client/src/features/admin/components/UserManager.tsx` — user edit modal
4. `client/src/features/invoicing/components/InvoiceEditor.tsx` — invoice modal
5. `client/src/features/payables/components/BillEntry.tsx` — bill entry modal
6. `client/src/features/payables/components/PurchaseOrderEditor.tsx` — PO editor modal
7. `client/src/features/dashboards/components/WidgetConfigPanel.tsx` — config panel
8. `client/src/components/CategorySelect.tsx` — dropdown overlay
9. `client/src/features/accounts/components/AccountSetupWizard.tsx` — wizard overlay

---

## PART 3: Add aria-label to Icon-Only Buttons

**Problem**: Icon-only buttons (no text) need `aria-label` for screen readers.

**Files to fix**:

1. `client/src/features/ai-agents/components/AgentConfigManager.tsx` — lines ~127-136, 140-146, 171-176

Find buttons like:
```tsx
<button onClick={handleToggle}>
  <ToggleIcon />  {/* ← no text, no aria-label */}
</button>
```

Fix:
```tsx
<button onClick={handleToggle} aria-label={isEnabled ? 'Disable agent' : 'Enable agent'}>
  <ToggleIcon aria-hidden="true" />
</button>
```

**General pattern for all icon-only buttons**:
- Add `aria-label="descriptive action name"` to the `<button>` element
- Add `aria-hidden="true"` to the icon inside

---

## PART 4: Add aria-label to Data Tables

**Problem**: Data tables lack accessible labels.

**Files to fix** (the most important ones):

1. `client/src/features/ai-agents/components/AgentConfigManager.tsx` — table at ~line 99
2. `client/src/features/reports/components/TrialBalance.tsx`
3. `client/src/features/reports/components/ProfitAndLoss.tsx`

**Fix pattern**:
```tsx
// BEFORE:
<table>

// AFTER — Option 1 (aria-label):
<table aria-label="Agent Configuration">

// AFTER — Option 2 (caption):
<table>
  <caption>Agent Configuration</caption>
```

---

## EXECUTION ORDER

1. Fix ESLint errors first (they block commits)
2. Run `cd client && npx eslint src/ --ext .ts,.tsx 2>&1 | grep " error " | wc -l` — should go to 0
3. Then add ARIA attributes
4. Run `cd client && npx tsc --noEmit` — must stay at 0

## COMMIT

```bash
git add client/src/
git commit -m "fix(client): resolve 46 ESLint errors, add ARIA attributes to modals/buttons/tables"
```
