# Agent W15-05: Compliance Monitoring Agent Builder

## Role
Build the compliance monitoring Claude agent with tools for obligation checking, anomaly detection, compliance reporting, and risk assessment.

## Priority: WAVE 15 (After W15-01 and W15-03 complete)

## Wait Condition
Check for `.agent-done-W15-01` and `.agent-done-W15-03` marker files before starting.

## Context
- Agent base class: `server/src/services/claude/agents/` -- follow `gst-calculator.ts` pattern
- Compliance tables: `complianceChecks`, `complianceSchedules` (from W15-01 schema)
- Anomaly service: `server/src/services/anomaly-detection.ts` (from W15-03)
- BAS service: `server/src/services/bas.ts` -- existing BAS calculation logic
- Tax service: `server/src/services/tax.ts` -- existing tax calculation logic

## Files to CREATE

### 1. `server/src/services/compliance-monitor.ts`
**Purpose**: Compliance obligation tracking and schedule management
**Pattern**: Follow `server/src/services/bas.ts`

- [ ] Create `ComplianceMonitorService` class with:

  - `checkObligations(userId: string, asOfDate?: string): Promise<ComplianceStatus[]>` -- Scans all active compliance schedules, checks due dates against current date. Returns list of obligations with status (upcoming, due_soon, overdue, compliant). Due soon = within reminder_days_before.

  - `generateSchedule(userId: string, financialYear: string, entityType: string): Promise<ComplianceSchedule[]>` -- Creates full year of compliance checks based on entity type. Sole trader: quarterly BAS (28th of month after quarter), annual tax return (31 Oct or tax agent deadline). Company: monthly PAYG, quarterly BAS, annual return. Includes STP finalisation, super guarantee (28 days after quarter).

  - `getUpcomingDeadlines(userId: string, days: number): Promise<ComplianceCheck[]>` -- Returns obligations due within N days, sorted by due date.

  - `markLodged(checkId: string, referenceNumber: string, lodgedDate?: string): Promise<void>` -- Updates compliance check to 'lodged' with reference.

  - `assessOverallRisk(userId: string): Promise<RiskAssessment>` -- Calculates risk score (0-100) based on: overdue count (weight 0.4), late lodgement history (0.2), anomaly alert count (0.2), outstanding amounts (0.2). Returns score, level ('low' | 'medium' | 'high'), and contributing factors.

### 2. `server/src/services/claude/agents/compliance-monitoring-agent.ts`
**Pattern**: Follow `server/src/services/claude/agents/gst-calculator.ts`

- [ ] Create `ComplianceMonitoringAgent extends ClaudeAgent<ComplianceAgentInput, ComplianceAgentOutput>` with:

  - **System prompt**: "You are an Australian compliance monitoring specialist. You track ATO lodgement deadlines, BAS obligations, PAYG instalments, superannuation guarantee, and STP requirements. You understand the Australian tax calendar and can assess compliance risk. You provide clear, actionable advice on meeting obligations and avoiding penalties."

  - **4 tools**:

    1. `check_obligations` -- Parameters: `{ userId: string, asOfDate?: string }`. Handler: calls `ComplianceMonitorService.checkObligations()`. Returns status of all active obligations with urgency indicators.

    2. `detect_anomalies` -- Parameters: `{ userId: string, detectors: string[], severityThreshold?: string }`. Handler: calls `AnomalyDetectionService.scanTransactions()`. Returns anomaly alerts that may indicate compliance issues (e.g., unusual payments suggesting unreported income).

    3. `generate_compliance_report` -- Parameters: `{ userId: string, period: string, includeRecommendations: boolean }`. Handler: aggregates obligation status, anomaly alerts, lodgement history. Generates formatted compliance report with RAG status per obligation, risk assessment, and recommended actions.

    4. `assess_risk` -- Parameters: `{ userId: string }`. Handler: calls `ComplianceMonitorService.assessOverallRisk()` + `AnomalyDetectionService.getAlertStats()`. Combines risk scores into holistic compliance health assessment with specific improvement suggestions.

  - **Tool handlers**: Wire to `ComplianceMonitorService`, `AnomalyDetectionService`, `cogneeTools.search()` for ATO ruling context

## Files to MODIFY

### 3. `server/src/services/claude/types.ts`
- [ ] Add `compliance_monitoring_agent` to `AgentType` union type
- [ ] Add interfaces:
  ```typescript
  interface ComplianceAgentInput {
    userId: string;
    period?: string;
    action: 'check' | 'report' | 'assess_risk';
  }
  interface ComplianceAgentOutput {
    obligations: ComplianceStatus[];
    riskLevel: 'low' | 'medium' | 'high';
    riskScore: number;
    recommendations: string[];
    report?: string;
  }
  ```

### 4. `server/src/services/claude/config.ts`
- [ ] Add to `AGENT_TOKEN_BUDGETS`:
  ```typescript
  compliance_monitoring_agent: { maxInputTokens: 60000, maxOutputTokens: 8192 },
  ```
- [ ] Add to `AGENT_MODELS`:
  ```typescript
  compliance_monitoring_agent: 'claude-sonnet-4-20250514',
  ```

### 5. `server/src/services/claude/orchestrator.ts`
- [ ] Import `ComplianceMonitoringAgent` from `./agents/compliance-monitoring-agent.js`
- [ ] Register in agent map: `compliance_monitoring_agent: ComplianceMonitoringAgent`

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `ComplianceMonitorService` can be instantiated
- [ ] `ComplianceMonitoringAgent` can be instantiated via orchestrator
- [ ] `generateSchedule()` produces correct ATO dates for quarterly BAS
- [ ] `assessOverallRisk()` returns valid risk score 0-100
- [ ] All 4 agent tools are registered and callable
- [ ] Create marker file: `.agent-done-W15-05`

## Dependencies
- **Requires**: W15-01 (`.agent-done-W15-01`) -- compliance tables, W15-03 (`.agent-done-W15-03`) -- anomaly service
- **Reuses**: bas.ts, tax.ts, anomaly-detection.ts, cognee-tools.ts, base-agent.ts
