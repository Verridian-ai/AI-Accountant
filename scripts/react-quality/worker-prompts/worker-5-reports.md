# Worker 5 — Reports + Tax + GST + BAS + Compliance + Payroll

You are worker-5-reports on the react-quality agent team.

## YOUR FILE OWNERSHIP (never touch files outside these paths)
```
client/src/features/reports/
client/src/features/tax/
client/src/features/gst/
client/src/features/bas/
client/src/features/compliance/
client/src/features/payroll/
```

## STEP 1 — Read your instructions
Read these files before touching any code:
- `scripts/react-quality/rules-reference.md` — all fix patterns with code examples
- `scripts/react-quality/react-doctor-full-report.txt` — grep for your file paths to find exact line numbers

## STEP 2 — Run react-doctor on your directories
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx -y react-doctor@latest src/features/reports/ src/features/tax/ src/features/gst/ src/features/bas/ src/features/compliance/ src/features/payroll/ --verbose 2>&1
```

## STEP 3 — Fix each file, applying ALL applicable rules

Work file-by-file. After every 5 files: `npx tsc --noEmit` → must be 0 errors.

### High-priority files in your domain:
**reports/**
- `TrialBalance.tsx` — array key, multiple setState in useEffect, excessive useState
- `BalanceSheet.tsx` — multiple setState in useEffect
- `ProfitAndLoss.tsx` — multiple setState in useEffect
- `CashFlow.tsx` — multiple setState in useEffect
- `KPIDashboard.tsx` — multiple setState in useEffect
- `ReportsDashboard.tsx` — form labels (4×), excessive useState
- `PeriodComparison.tsx` — form labels (3×), excessive useState

**tax/**
- `OwnerEquityPanel.tsx` — excessive useState, multiple setState in useEffect
- `CompanyReturn.tsx` — array key, multiple setState in useEffect
- `TrustReturn.tsx` — array key
- `SoleTraderReturn.tsx` — array key
- `PersonalReturn.tsx` — array key, multiple setState in useEffect
- `TaxDashboard/tabs/TaxCalculatorTab.tsx` — array key

**gst/**
- `GSTPage.tsx` — array key, excessive useState
- `InputTaxCredits.tsx` — array key

**bas/**
- `BASPreFillReport.tsx` — nested component (LabelRow — ERROR, hoist it!), array key, non-lazy useState (2×), excessive useState
- `BASDashboard/tabs/CalculateTab.tsx` — large component (check for issues)

**compliance/**
- `ComplianceReport.tsx` — form label, array key (2×)
- `RiskAssessmentPanel.tsx` — array key

**payroll/**
- `EmployeeOnboarding/EmployeeOnboarding.tsx` — form labels (5×), inline render function, array key, stale closure (2×), non-lazy useState, excessive useState, large component
- `PayCategoryManager/PayCategoryManager.tsx` — form labels (5×), excessive useState
- `PayStructureEditor/PayStructureEditor.tsx` — form labels (4×), large component
- `PayrollDashboard.tsx` — excessive useState
- `EmployeeDetail/tabs/PayTab.tsx` — array key
- `EmployeeDetail/tabs/BankTab.tsx` — array key
- `EmployeeDetail/tabs/TaxTab.tsx` — form label
- `EmployeeDetail/tabs/SuperTab.tsx` — form label
- `EmployeeDetail/tabs/PersonalTab.tsx` — form label

### Critical: BASPreFillReport.tsx
This file has a NESTED COMPONENT (LabelRow defined inside BASPreFillReport) — this is an ERROR, not just a warning. Hoist `LabelRow` to module scope immediately:

```tsx
// Before (inside BASPreFillReport)
function BASPreFillReport() {
  const LabelRow = ({ label, value }) => <div>...</div>;
  ...
}

// After (module scope, above BASPreFillReport)
function LabelRow({ label, value }: { label: string; value: string }) {
  return <div>...</div>;
}

function BASPreFillReport() { ... }
```

## STEP 4 — Final check
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx tsc --noEmit
npx -y react-doctor@latest src/features/reports/ src/features/tax/ src/features/gst/ src/features/bas/ src/features/compliance/ src/features/payroll/ --verbose 2>&1 | tail -20
```

## STEP 5 — Commit
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse"
git add client/src/features/reports/ client/src/features/tax/ client/src/features/gst/ client/src/features/bas/ client/src/features/compliance/ client/src/features/payroll/
git commit -m "fix(react-quality): worker-5 reports/tax/bas/payroll — all warnings resolved"
```

## STEP 6 — Report done
Send message to lead: `DONE: worker-5-reports — [N] files fixed, TSC clean`
Then mark your task as completed using TaskUpdate.
