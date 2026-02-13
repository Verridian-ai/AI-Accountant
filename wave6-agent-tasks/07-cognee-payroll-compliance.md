# Agent 7: Cognee Payroll Compliance Indexer

## Role
Configure 3 new Cognee datasets for STP compliance, award rates, and timesheet patterns. Add indexing and search methods to CogneeTools. Update module-to-dataset mapping.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Purpose**: Add 3 new Cognee datasets and 6 new methods

**Location**: Find the `COGNEE_DATASETS` constant object

**Add to `COGNEE_DATASETS`**:
```typescript
// Wave 6: STP & Payroll Compliance
stpCompliance: 'stp_compliance',
awardRates: 'award_rates',
timesheetPatterns: 'timesheet_patterns',
```

**Add to `_moduleToDataset()` method** — find the switch/map and add:
```typescript
case 'stp': return COGNEE_DATASETS.stpCompliance;
case 'timesheets': return COGNEE_DATASETS.timesheetPatterns;
case 'awards': return COGNEE_DATASETS.awardRates;
```

**New methods to add** (after existing payroll indexing methods):

- [ ] **`indexSTPEvent(event: { eventId: string; eventType: string; payDate: string; employeeCount: number; grossPayments: number; taxWithheld: number; superGuarantee: number; status: string }): Promise<void>`**
  - Formats event data as structured text for Cognee indexing
  - Content format:
    ```
    STP Event: {eventType} on {payDate}
    Status: {status}
    Employees: {employeeCount}
    Gross: ${grossPayments/100}, Tax: ${taxWithheld/100}, Super: ${superGuarantee/100}
    Event ID: {eventId}
    ```
  - Uses `this.client.add(content, COGNEE_DATASETS.stpCompliance)`
  - Search type: RAG_COMPLETION (for compliance reasoning queries)

- [ ] **`searchSTPCompliance(query: string, topK: number = 5): Promise<string[]>`**
  - Searches `stp_compliance` dataset with RAG_COMPLETION search type
  - Use cases: "What are our STP obligations for Q2?", "Show STP events this FY"
  - Returns search results from `this.client.search(query, COGNEE_DATASETS.stpCompliance, topK, 'RAG_COMPLETION')`

- [ ] **`indexAwardRate(rate: { awardName: string; awardCode: string; classification: string; level: string; hourlyRateCents: number; casualLoadingPercent: number; effectiveDate: string }): Promise<void>`**
  - Formats rate data for Cognee indexing
  - Content format:
    ```
    Award: {awardName} ({awardCode})
    Classification: {classification}, Level: {level}
    Base Rate: ${hourlyRateCents/100}/hr
    Casual Rate: ${hourlyRateCents * (1 + casualLoadingPercent) / 100}/hr
    Effective: {effectiveDate}
    ```
  - Uses `this.client.add(content, COGNEE_DATASETS.awardRates)`
  - Search type: CHUNKS_LEXICAL (keyword-based rate lookups)

- [ ] **`searchAwardRates(query: string, topK: number = 5): Promise<string[]>`**
  - Searches `award_rates` dataset with CHUNKS_LEXICAL search type
  - Use cases: "What's the Level 3 clerk hourly rate?", "Find retail award casual rate"
  - Returns search results

- [ ] **`indexTimesheetPattern(pattern: { employeeId: string; employeeName: string; weekOf: string; totalHours: number; projectBreakdown: string; status: string }): Promise<void>`**
  - Formats timesheet pattern data for Cognee indexing
  - Content format:
    ```
    Timesheet: {employeeName} week of {weekOf}
    Total Hours: {totalHours}
    Projects: {projectBreakdown}
    Status: {status}
    ```
  - Uses `this.client.add(content, COGNEE_DATASETS.timesheetPatterns)`
  - Search type: GRAPH_COMPLETION (for pattern analysis)

- [ ] **`searchTimesheetPatterns(query: string, topK: number = 5): Promise<string[]>`**
  - Searches `timesheet_patterns` dataset with GRAPH_COMPLETION search type
  - Use cases: "Show timesheet trends for John", "Average weekly hours last quarter"
  - Returns search results

## Verification
- [ ] `COGNEE_DATASETS` has 3 new entries: stpCompliance, awardRates, timesheetPatterns
- [ ] `_moduleToDataset()` maps 'stp', 'timesheets', 'awards' correctly
- [ ] 6 new methods: indexSTPEvent, searchSTPCompliance, indexAwardRate, searchAwardRates, indexTimesheetPattern, searchTimesheetPatterns
- [ ] Search types match domain: RAG_COMPLETION for STP compliance, CHUNKS_LEXICAL for award rates, GRAPH_COMPLETION for timesheet patterns
- [ ] All content formatting correctly converts cents to dollars for display
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W06-07`

## Dependencies
- **Agent 1**: Schema must exist (for type references)
- **Coordination rule**: Only Agent 7 modifies `cognee-tools.ts` in Wave 6
