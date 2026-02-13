# Agent 7: Cognee Payroll Indexer

## Role
Configure Cognee datasets for pay run history and leave patterns. Add indexing and search methods to `cognee-tools.ts`.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Purpose**: Add 2 new datasets and 4 new methods for pay run and leave Cognee integration

- [ ] **Add to `COGNEE_DATASETS` constant**:
```typescript
// Payroll domain (Wave 5)
payRunHistory: 'pay_run_history',
leavePatterns: 'leave_patterns',
```

- [ ] **Add `indexPayRun()` method**:
```typescript
async indexPayRun(payRun: {
  id: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  payDate: string;
  frequency: string;
  totalGrossCents: number;
  totalTaxCents: number;
  totalSuperCents: number;
  totalNetCents: number;
  employeeCount: number;
  status: string;
}): Promise<void> {
  const text = `Pay run ${payRun.id} for period ${payRun.payPeriodStart} to ${payRun.payPeriodEnd}. ` +
    `Frequency: ${payRun.frequency}. Pay date: ${payRun.payDate}. ` +
    `Total gross: $${(payRun.totalGrossCents / 100).toFixed(2)}, ` +
    `Tax withheld: $${(payRun.totalTaxCents / 100).toFixed(2)}, ` +
    `Super: $${(payRun.totalSuperCents / 100).toFixed(2)}, ` +
    `Net pay: $${(payRun.totalNetCents / 100).toFixed(2)}. ` +
    `${payRun.employeeCount} employees. Status: ${payRun.status}.`;
  await this.index([text], COGNEE_DATASETS.payRunHistory);
}
```

- [ ] **Add `searchPayRunHistory()` method**:
```typescript
async searchPayRunHistory(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.payRunHistory, 5, 'CHUNKS');
}
```

- [ ] **Add `indexLeavePattern()` method**:
```typescript
async indexLeavePattern(pattern: {
  employeeId: string;
  employeeName: string;
  leaveType: string;
  balanceHours: number;
  accruedHours: number;
  takenHours: number;
  periodStart: string;
  periodEnd: string;
}): Promise<void> {
  const text = `Leave pattern for ${pattern.employeeName}: ` +
    `${pattern.leaveType} balance is ${pattern.balanceHours.toFixed(1)} hours ` +
    `(accrued: ${pattern.accruedHours.toFixed(1)}, taken: ${pattern.takenHours.toFixed(1)}). ` +
    `Period: ${pattern.periodStart} to ${pattern.periodEnd}.`;
  await this.index([text], COGNEE_DATASETS.leavePatterns);
}
```

- [ ] **Add `searchLeavePatterns()` method**:
```typescript
async searchLeavePatterns(query: string): Promise<string[]> {
  return this.search(query, COGNEE_DATASETS.leavePatterns, 5, 'GRAPH_COMPLETION');
}
```

- [ ] **Update `_moduleToDataset()` mapping** — add entries:
```typescript
'payruns': COGNEE_DATASETS.payRunHistory,
'leave': COGNEE_DATASETS.leavePatterns,
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `COGNEE_DATASETS` now includes `payRunHistory` and `leavePatterns`
- [ ] `indexPayRun()` converts pay run data to descriptive text and indexes to `pay_run_history`
- [ ] `searchPayRunHistory()` uses CHUNKS search type (fast vector similarity for time-series data)
- [ ] `indexLeavePattern()` indexes leave balance snapshots to `leave_patterns`
- [ ] `searchLeavePatterns()` uses GRAPH_COMPLETION search type (relationship-aware reasoning)
- [ ] `_moduleToDataset()` mapping updated with `payruns` and `leave` keys
- [ ] No existing methods modified — only additions
- [ ] Create marker file: `.agent-done-W05-07`

## Dependencies
- **Agent 1**: Schema must exist (for type references)
- **No blocking dependency on other agents** — Cognee methods are standalone
