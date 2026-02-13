# Agent 8: UI AR Aging Builder

## Role
Build the AR aging report, GST sales report, and customer statement UI components.

## Priority: WAVE 9 (After Agent 7)

## Files to CREATE

### 1. `client/src/features/invoicing/components/ARAgingReport.tsx`
**Purpose**: AR aging buckets visualization with customer drill-down
**Pattern**: Follow `client/src/features/reports/components/ProfitAndLoss.tsx` for report layout

**Features**:
- [ ] Summary cards: Total Outstanding, Total Overdue, DSO, Customer Count
- [ ] Aging bucket breakdown as horizontal stacked bar chart or table:
  - Current (green), 1-30 (yellow), 31-60 (orange), 61-90 (red), 90+ (dark red)
- [ ] Bucket percentage pie/donut visualization
- [ ] Top debtors list with amounts
- [ ] Click on customer name to drill down to CustomerAgingDetail
- [ ] As-of-date picker (defaults to today)
- [ ] Export data as CSV

**API calls**:
```typescript
// In client/src/api.ts
export const fetchARAgingReport = async (asOfDate?: string) => {
  const params = asOfDate ? `?asOfDate=${asOfDate}` : '';
  const res = await fetch(`${BASE_URL}/api/ar/aging${params}`);
  return res.json();
};

export const fetchARSummary = async () => {
  const res = await fetch(`${BASE_URL}/api/ar/summary`);
  return res.json();
};

export const fetchCustomerAging = async (customerId: string, asOfDate?: string) => {
  const params = asOfDate ? `?asOfDate=${asOfDate}` : '';
  const res = await fetch(`${BASE_URL}/api/ar/aging/${customerId}${params}`);
  return res.json();
};
```

**Styling**: Use neumorphic theme (`neu-raised`, `neu-inset` classes), gold (#FFCC00) accents, dark background

### 2. `client/src/features/invoicing/components/GSTSalesReport.tsx`
**Purpose**: GST collected on sales summary for BAS preparation
**Pattern**: Follow `client/src/features/bas/components/BASDashboard.tsx` for GST report layout

**Features**:
- [ ] Period selector (date range picker)
- [ ] Summary: Total Sales (ex-GST), Total GST Collected, Total Sales (inc-GST)
- [ ] Monthly breakdown table
- [ ] Breakdown by GST rate table
- [ ] BAS label mapping display (G1, 1A fields)

**API calls**:
```typescript
export const fetchGSTSalesReport = async (periodStart: string, periodEnd: string) => {
  const res = await fetch(`${BASE_URL}/api/gst/sales-summary?periodStart=${periodStart}&periodEnd=${periodEnd}`);
  return res.json();
};
```

### 3. `client/src/features/invoicing/components/CustomerStatement.tsx`
**Purpose**: Customer statement of account viewer with PDF generation
**Pattern**: Follow `client/src/features/reports/components/CashFlow.tsx` for statement layout

**Features**:
- [ ] Customer selector dropdown
- [ ] Period start/end date pickers
- [ ] Generate button
- [ ] Statement display: opening balance, transaction table (date, type, ref, debit, credit, running balance), closing balance
- [ ] Print / Download PDF button
- [ ] Statement history list (previously generated statements)

**API calls**:
```typescript
export const fetchCustomerStatement = async (customerId: string, periodStart: string, periodEnd: string) => {
  const res = await fetch(`${BASE_URL}/api/customers/${customerId}/statement?periodStart=${periodStart}&periodEnd=${periodEnd}`);
  return res.json();
};
```

## Files to MODIFY

### 4. `client/src/api.ts`
**Purpose**: Add API functions for AR aging, GST sales, and customer statements
- [ ] Add `fetchARAgingReport()`, `fetchARSummary()`, `fetchCustomerAging()`
- [ ] Add `fetchGSTSalesReport()`
- [ ] Add `fetchCustomerStatement()`

### 5. `client/src/App.tsx`
**Purpose**: Wire AR aging components into the invoicing tab as sub-views
- [ ] Import ARAgingReport, GSTSalesReport, CustomerStatement
- [ ] Add them as sub-tab options within the invoicing section
- [ ] Add routing logic for invoicing sub-tabs (if not already tabbed)

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] ARAgingReport renders aging buckets with correct color coding
- [ ] Customer drill-down shows detailed aging for selected customer
- [ ] GSTSalesReport shows monthly breakdown and by-rate breakdown
- [ ] CustomerStatement shows chronological transaction list with running balance
- [ ] All components use neumorphic dark theme styling
- [ ] Create marker file: `.agent-done-W09-08`

## Dependencies
- **Agent 7** must complete API endpoints
- **Existing**: `client/src/api.ts` base URL pattern, `client/src/App.tsx` tab routing
