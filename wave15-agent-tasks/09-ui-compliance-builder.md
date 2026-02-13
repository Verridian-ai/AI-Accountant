# Agent W15-09: UI Compliance Builder

## Role
Build 6 React components for compliance monitoring and anomaly alerts in `client/src/features/compliance/`.

## Priority: WAVE 15 (After W15-07 completes API routes)

## Wait Condition
Check for `.agent-done-W15-07` marker file before starting.

## Context
- UI library: shadcn/ui at `client/src/components/ui/` (Card, Tabs, Button, Badge, Progress, Alert)
- Icons: lucide-react (Shield, ShieldAlert, ShieldCheck, Clock, AlertTriangle, CheckCircle, XCircle, Calendar, Bell, FileText)
- Design: Gold (#FFCC00) accent, neumorphic dark theme (`neu-raised`, `neu-inset` classes)
- Existing pattern: `client/src/features/bas/components/BASDashboard.tsx` for compliance-style layouts

## Files to CREATE

### 1. `client/src/features/compliance/components/ComplianceDashboard.tsx`
**Purpose**: Main compliance monitoring page with tabbed navigation

- [ ] Tabbed layout: "Obligations" | "Anomaly Alerts" | "Risk Assessment" | "Calendar" | "Reports"
- [ ] Top banner: overall compliance health score (0-100) with color-coded badge (green >80, yellow 50-80, red <50)
- [ ] Quick stats row: Overdue count (red), Due Soon count (yellow), Compliant count (green), Total Alerts (orange)
- [ ] Render sub-components in each tab
- [ ] Financial year selector and account filter

### 2. `client/src/features/compliance/components/ObligationTracker.tsx`
**Purpose**: Track and manage ATO compliance obligations

- [ ] Table/list view of all compliance checks:
  - Columns: Obligation Type, Period, Due Date, Status, Risk Level, Actions
  - Status badges: color-coded (red=overdue, yellow=pending, green=compliant, blue=lodged)
  - Risk level indicators (low/medium/high shield icons)
- [ ] "Generate Schedule" button for new financial year
- [ ] Inline actions per obligation: Mark Lodged (opens reference number input), Set In Progress
- [ ] Filters: status, obligation type, date range
- [ ] Sort by due date (default: soonest first)
- [ ] Overdue obligations highlighted with red left border and pulsing indicator
- [ ] Props: `{ userId: string; financialYear: string }`

### 3. `client/src/features/compliance/components/AnomalyAlertPanel.tsx`
**Purpose**: Display and manage anomaly detection alerts

- [ ] Alert cards in severity-ordered list:
  - Critical: red border, red badge, top of list
  - High: orange border, orange badge
  - Medium: yellow border, yellow badge
  - Low: gray border, gray badge
- [ ] Each alert card shows:
  - Alert type icon (duplicate=Copy, amount=DollarSign, velocity=Zap, drift=TrendingDown)
  - Title, description, transaction reference (clickable link to transaction)
  - Timestamp, severity badge, status badge
  - Action buttons: Acknowledge, Resolve, Dismiss (with reason dropdown)
- [ ] Stats bar at top: Open count, Acknowledged, Resolved this period, Dismissal rate
- [ ] "Run Scan" button to trigger new anomaly scan with detector selection checkboxes
- [ ] Filters: status, severity, alert type, date range
- [ ] Props: `{ userId: string }`

### 4. `client/src/features/compliance/components/RiskAssessmentPanel.tsx`
**Purpose**: Visual risk assessment dashboard

- [ ] Large circular risk score gauge (0-100):
  - Animated ring using SVG circle with `stroke-dashoffset`
  - Color: green (0-30), yellow (31-60), orange (61-80), red (81-100)
  - Center text: score number + risk level label
- [ ] Contributing factors breakdown:
  - 4 factor cards: Overdue Items (40%), Late History (20%), Active Anomalies (20%), Outstanding Amounts (20%)
  - Each card: factor name, weight, current impact, sub-score
- [ ] Risk trend chart (line chart showing risk score over past 12 months)
- [ ] Recommendations list: actionable suggestions to reduce risk (from agent)
- [ ] "Refresh Assessment" button
- [ ] Props: `{ userId: string }`

### 5. `client/src/features/compliance/components/ComplianceCalendar.tsx`
**Purpose**: Calendar view of all compliance deadlines

- [ ] Monthly calendar grid layout (follow standard calendar component pattern):
  - Days with obligations show colored dots (red=overdue, yellow=due, green=lodged)
  - Click day to see obligations due that date
  - Month navigation (prev/next arrows)
- [ ] Upcoming deadlines sidebar (next 30 days):
  - List of obligations sorted by date
  - Days remaining countdown badge
  - Quick actions (Mark Lodged, Set Reminder)
- [ ] BAS quarter highlights (Oct 28, Feb 28, Apr 28, Jul 28)
- [ ] Financial year boundaries marked
- [ ] Props: `{ userId: string; financialYear: string }`

### 6. `client/src/features/compliance/components/ComplianceReport.tsx`
**Purpose**: Generate and display formatted compliance reports

- [ ] Report generation form:
  - Period selector (quarter or financial year)
  - Include Recommendations toggle
  - "Generate Report" button (calls compliance report API)
- [ ] Report display:
  - Header: entity name, period, generated date
  - Summary section: overall status, risk level
  - Obligation table with RAG status per item
  - Anomaly summary section with counts by type
  - Recommendations section (if enabled)
  - Risk assessment summary
- [ ] Export actions: "Download PDF" (future), "Copy to Clipboard"
- [ ] Report history list showing past generated reports
- [ ] Props: `{ userId: string }`

## Files to MODIFY

### 7. `client/src/api.ts`
- [ ] Add `anomalyApi` object:
  ```typescript
  export const anomalyApi = {
    scan: (data: AnomalyScanRequest) => post('/api/anomalies/scan', data),
    list: (userId: string, filters?: AlertFilters) => get(`/api/anomalies/${userId}`, filters),
    stats: (userId: string) => get(`/api/anomalies/stats/${userId}`),
    acknowledge: (alertId: string) => patch(`/api/anomalies/${alertId}/acknowledge`),
    resolve: (alertId: string, resolvedBy: string) => patch(`/api/anomalies/${alertId}/resolve`, { resolvedBy }),
    dismiss: (alertId: string, reason: string) => patch(`/api/anomalies/${alertId}/dismiss`, { reason }),
  };
  ```

- [ ] Add `complianceApi` object:
  ```typescript
  export const complianceApi = {
    obligations: (userId: string, asOfDate?: string) => get(`/api/compliance/${userId}/obligations`, { asOfDate }),
    generateSchedule: (userId: string, data: ScheduleRequest) => post(`/api/compliance/${userId}/schedule`, data),
    upcoming: (userId: string, days?: number) => get(`/api/compliance/${userId}/upcoming`, { days }),
    lodge: (checkId: string, data: LodgeRequest) => patch(`/api/compliance/${checkId}/lodge`, data),
    risk: (userId: string) => get(`/api/compliance/${userId}/risk`),
    report: (userId: string, data: ReportRequest) => post(`/api/compliance/${userId}/report`, data),
    calendar: (userId: string) => get(`/api/compliance/${userId}/calendar`),
  };
  ```

- [ ] Add TypeScript interfaces for all request/response types

### 8. `client/src/App.tsx`
- [ ] Add "Compliance" navigation tab and route to ComplianceDashboard
- [ ] Import ComplianceDashboard from `./features/compliance/components/ComplianceDashboard`

## Component Pattern (follow BASDashboard.tsx):
```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { complianceApi } from '@/api';

export function ComplianceDashboard() {
    const [riskScore, setRiskScore] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    // ... fetch on mount, render tabs
}
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 6 components render without errors
- [ ] ComplianceDashboard loads with all 5 tabs
- [ ] ObligationTracker displays obligations with correct status colors
- [ ] AnomalyAlertPanel shows alerts in severity order
- [ ] RiskAssessmentPanel renders animated risk gauge
- [ ] ComplianceCalendar displays month grid with obligation dots
- [ ] ComplianceReport generates formatted report
- [ ] Navigation to /compliance works from main nav
- [ ] Create marker file: `.agent-done-W15-09`

## Dependencies
- **Requires**: W15-07 (`.agent-done-W15-07`) -- API routes must exist
- **IMPORTANT**: Coordinate with W15-08 on App.tsx modifications (add both routes together)
