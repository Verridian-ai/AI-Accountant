# React Quality Agent Team — Atomic Task List

## Baseline: 81/100 · ✗ 10 errors · ⚠ 712 warnings · 231/530 files
## Target:    95+/100 · ✗ 0 errors · ⚠ <50 warnings

Full issue list: `scripts/react-quality/react-doctor-full-report.txt`
Fix patterns:    `scripts/react-quality/rules-reference.md`

---

## Worker Domain Assignments (zero file overlap — no conflicts)

| Task | Worker | Directories |
|------|--------|-------------|
| T01  | worker-1-transactions | features/transactions/ + features/ap/ + features/matching/ |
| T02  | worker-2-admin        | features/admin/ + features/auth/ + features/settings/ + features/tenant/ + features/subscription/ + context/ |
| T03  | worker-3-analytics    | features/analytics/ + features/accounts/ + features/budgets/ + features/reconciliation/ |
| T04  | worker-4-loans        | features/loans/ + features/banking-products/ + features/transfers/ + features/market/ + features/forecasting/ |
| T05  | worker-5-reports      | features/reports/ + features/tax/ + features/gst/ + features/bas/ + features/compliance/ + features/payroll/ |
| T06  | worker-6-intelligence | features/intelligence/ + features/entities/ + features/knowledge/ + features/documents/ + features/invoicing/ + features/inventory/ + features/dashboards/ + features/streaming/ + features/assets/ + features/onboarding/ + features/chat/ + features/statements/ + features/notifications/ + components/ + App.tsx |
| T07  | LEAD (after T01–T06)  | TSC check + react-doctor verify + commit |

---

## Rules Checklist (apply ALL applicable rules to your directories)

### A · Accessibility
- [ ] **A1** Form labels: every `<label>` needs `htmlFor="id"`, every paired control needs matching `id`
- [ ] **A2** Clickable divs: add `role="button"` (or convert to `<button>`) + `onKeyDown` handler
- [ ] **A3** Remove `autoFocus` attribute from all elements
- [ ] **A4** Fix combobox missing `aria-controls`

### C · Correctness
- [ ] **C1** Array index keys: replace `key={idx}` / `key={i}` / `key={index}` with stable id
- [ ] **C2** Stale closure setState: `setState(val + 1)` → `setState(prev => prev + 1)`
- [ ] **C3** useState lazy initializer: `useState(fn())` → `useState(() => fn())`
- [ ] **C4** Default prop `[]`: extract to module-level `const EMPTY_X: T[] = []`

### P · Performance / Bundle
- [ ] **P1** recharts imports: wrap consumer components in `React.lazy()` + `<Suspense>` OR extract to separate lazy-loaded file
- [ ] **P2** Permanent `will-change`: only apply during active animation (via className toggle)
- [ ] **P3** `touchend` without `{ passive: true }`: add third arg `{ passive: true }`
- [ ] **P4** Barrel imports: `import { X } from '../components'` → `import { X } from '../components/X'`

### Ar · Architecture
- [ ] **Ar1** `useEffect` simulating event handler: move logic into `onClick`/`onChange`/`onSubmit`
- [ ] **Ar2** Multiple `setState` in single `useEffect`: combine into `useReducer`
- [ ] **Ar3** Excessive `useState` (≥6 related): group into `useReducer`
- [ ] **Ar4** Inline render functions `renderX()`: extract to named component above parent
- [ ] **Ar5** Component defined inside component: hoist to module scope

---

## T07 — Lead: Final Verification + Commit (depends on T01–T06)

1. `cd "C:/Users/Danie/Desktop/CBA Statements Parse/client" && npx tsc --noEmit` — must be **0 errors**
2. `npx -y react-doctor@latest . --verbose` — capture new score
3. Commit: `git add -A && git commit -m "fix(react-quality): resolve 700+ warnings, raise score 81→95+"`
4. Report final score to user
