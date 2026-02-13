# Agent 9: UI Matching Builder

## Role
Build 5 React components for the payment matching feature: dashboard, match review panel, rule manager, auto-match view, and match statistics.

## Priority: WAVE 14 (After Agent 7 completes API routes)

## Wait Condition
Check for `.agent-done-W14-07` marker file before starting.

## Context
- UI library: shadcn/ui at `client/src/components/ui/` (Card, Tabs, Button, Input, Select, Badge, Table, Progress)
- Icons: lucide-react (Link2, Unlink, CheckCircle2, XCircle, ArrowRightLeft, Zap, Settings, BarChart3, ShieldCheck)
- Existing pattern: `client/src/features/transactions/` (table-heavy views with filters)
- API layer: `client/src/api.ts` -- add new `matchesApi` object
- No `matching/` feature folder exists yet -- must create it

## Files to MODIFY

### 1. `client/src/api.ts`
- [ ] Add TypeScript interfaces:
```typescript
export interface MatchCandidate {
  transactionId: string; transactionDate: string; transactionDescription: string;
  transactionAmount: number;
  score: { overallScore: number; factors: { amount: number; date: number; vendor: number; rule: number }; amountDifference: number; dateDifference: number };
  ruleId?: string;
}
export interface PaymentMatch {
  id: string; documentId: string; transactionId: string; ruleId?: string;
  matchScore: number; matchMethod: string;
  amountDifference: number; dateDifference: number;
  status: 'suggested' | 'confirmed' | 'rejected';
  confirmedBy?: string; confirmedAt?: string; notes?: string; createdAt: string;
}
export interface PaymentMatchRule {
  id: string; userId: string; name: string;
  ruleType: 'exact_amount' | 'amount_range' | 'vendor_match' | 'recurring' | 'composite';
  vendorPattern?: string; amountExact?: number; amountMin?: number; amountMax?: number;
  amountTolerance: number; dateToleranceDays: number; categoryFilter?: string;
  priority: number; isActive: boolean; matchCount: number; lastMatchedAt?: string;
}
export interface MatchStats {
  totalDocuments: number; matched: number; pending: number; failed: number;
  matchRate: number; averageConfidence: number;
  topVendors: Array<{ name: string; count: number }>;
  ruleEffectiveness: Array<{ ruleId: string; name: string; matchCount: number; lastMatched?: string }>;
}
export interface AutoMatchResult {
  matched: number; suggested: number; unmatched: number;
  details: Array<{ documentId: string; status: string; matchId?: string; topScore?: number }>;
}
```

- [ ] Add `matchesApi` object:
```typescript
export const matchesApi = {
  findCandidates: (documentId: string, options?: { amountTolerance?: number; dateTolerance?: number; limit?: number }) =>
    fetch(`${API_URL}/matches/candidates/${documentId}?${new URLSearchParams(Object.entries(options ?? {}).map(([k, v]) => [k, String(v)])).toString()}`, { headers: getAuthHeaders() }).then(r => r.json()) as Promise<MatchCandidate[]>,

  scoreMatch: (documentId: string, transactionId: string) =>
    fetch(`${API_URL}/matches/score`, { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId, transactionId }) }).then(r => r.json()),

  autoMatch: (options?: { autoMatchThreshold?: number; suggestThreshold?: number }) =>
    fetch(`${API_URL}/matches/auto`, { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'default', ...options }) }).then(r => r.json()) as Promise<AutoMatchResult>,

  confirm: (matchId: string) =>
    fetch(`${API_URL}/matches/${matchId}/confirm`, { method: 'PATCH', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmedBy: 'user' }) }).then(r => r.json()),

  reject: (matchId: string, reason?: string) =>
    fetch(`${API_URL}/matches/${matchId}/reject`, { method: 'PATCH', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }).then(r => r.json()),

  getStats: () =>
    fetch(`${API_URL}/matches/stats?userId=default`, { headers: getAuthHeaders() }).then(r => r.json()) as Promise<MatchStats>,

  learn: (matchId: string) =>
    fetch(`${API_URL}/matches/${matchId}/learn`, { method: 'POST', headers: getAuthHeaders() }).then(r => r.json()),

  createRule: (params: any) =>
    fetch(`${API_URL}/match-rules`, { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'default', ...params }) }).then(r => r.json()),

  listRules: (isActive?: boolean) =>
    fetch(`${API_URL}/match-rules?userId=default${isActive !== undefined ? `&isActive=${isActive}` : ''}`, { headers: getAuthHeaders() }).then(r => r.json()) as Promise<PaymentMatchRule[]>,

  deleteRule: (ruleId: string) =>
    fetch(`${API_URL}/match-rules/${ruleId}`, { method: 'DELETE', headers: getAuthHeaders() }).then(r => r.json()),
};
```

### 2. `client/src/App.tsx`
- [ ] Add import: `import { MatchingDashboard } from './features/matching/components/MatchingDashboard';`
- [ ] Add "Matching" tab to navigation (use Link2 icon from lucide-react)
- [ ] Add route rendering `<MatchingDashboard />` when Matching tab is active

## Files to CREATE

### 3. `client/src/features/matching/components/MatchingDashboard.tsx`
**Purpose**: Main dashboard for payment matching with tabs
- [ ] Tabs: Match Review | Auto-Match | Rules | Statistics
- [ ] Top bar: unmatched document count badge, "Run Auto-Match" button
- [ ] Quick stats row: Total Docs | Match Rate | Avg Confidence | Pending Review
- [ ] Active tab renders corresponding component below

### 4. `client/src/features/matching/components/MatchReviewPanel.tsx`
**Purpose**: Review and confirm/reject suggested matches
- [ ] Two-panel layout:
  - Left panel: list of unmatched/suggested documents
    - Card per document: vendor name, amount, date, status badge, confidence
    - Click to select and show candidates in right panel
  - Right panel: match candidates for selected document
    - Candidate cards sorted by score
    - Each card shows: transaction date, description, amount, match score (progress bar)
    - Score factor breakdown: Amount (40%), Date (25%), Vendor (20%), Rule (15%)
    - Highlight best match with gold border
    - "Confirm" button (green) and "Reject" button (red) per candidate

- [ ] Score visualization:
  - Overall score as colored progress bar: <60% red, 60-85% amber, >85% green
  - Factor bars: individual thin progress bars for each scoring factor
  - Amount difference shown as "+/- $X.XX"
  - Date difference shown as "X days"

- [ ] Batch actions:
  - "Confirm All High-Confidence" button (>85% score)
  - "Reject All Low-Confidence" button (<40% score)

### 5. `client/src/features/matching/components/RuleManager.tsx`
**Purpose**: Create, view, and manage payment matching rules
- [ ] List of existing rules as expandable cards:
  - Rule name, type badge, priority, active/inactive toggle
  - Expand: vendor pattern, amount criteria, date tolerance, match count
  - Delete button with confirmation dialog

- [ ] "Create Rule" form (collapsible):
  - Rule name input
  - Rule type dropdown: Exact Amount | Amount Range | Vendor Match | Recurring | Composite
  - Conditional fields based on type:
    - Exact Amount: amount input + tolerance
    - Amount Range: min + max inputs
    - Vendor Match: vendor pattern input (supports wildcards)
    - Recurring: no extra fields (auto-detected)
    - Composite: all fields shown
  - Date tolerance (days) slider
  - Category filter dropdown
  - Priority input (number, lower = higher priority)
  - "Create Rule" button

- [ ] Rule effectiveness metrics per rule:
  - Match count badge
  - Last matched date
  - Success indicator: green if matched recently, gray if stale

### 6. `client/src/features/matching/components/AutoMatchView.tsx`
**Purpose**: Run and review auto-matching results
- [ ] "Run Auto-Match" primary action button
- [ ] Threshold controls:
  - Auto-confirm threshold slider (default 0.85, range 0.50-1.00)
  - Suggest threshold slider (default 0.60, range 0.30-0.95)
  - Apply rules toggle (default on)
- [ ] Results display (after running):
  - Summary cards: X Matched | Y Suggested | Z Unmatched
  - Results table: Document | Vendor | Amount | Status | Score | Action
  - Status badges: "Matched" (green), "Suggested" (amber), "Unmatched" (gray)
  - Quick confirm/reject buttons in Action column for suggested matches
- [ ] Processing indicator: spinner + "Matching X of Y documents..." during execution
- [ ] History: last auto-match run timestamp and results

### 7. `client/src/features/matching/components/MatchStatistics.tsx`
**Purpose**: Visualize matching performance and trends
- [ ] Fetch via `matchesApi.getStats()`
- [ ] Summary cards (2x2 grid):
  - Total Documents (FileText icon)
  - Match Rate as percentage (Target icon, green if >80%, red if <50%)
  - Average Confidence (ShieldCheck icon)
  - Pending Review count (Clock icon)

- [ ] Top Vendors section:
  - Horizontal bar chart (CSS-based): vendor name | bar proportional to count | count number
  - Top 10 most frequently matched vendors

- [ ] Rule Effectiveness section:
  - Table: Rule Name | Type | Match Count | Last Matched | Status
  - Sort by match count DESC
  - Inactive rules grayed out

- [ ] Match Method Distribution:
  - Donut chart or stacked bar (CSS-based): auto_rule vs auto_ai vs manual vs suggested
  - Percentage labels

## Component Pattern:
```tsx
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Link2, CheckCircle2, XCircle, ArrowRightLeft } from 'lucide-react';
import { matchesApi } from '@/api';
import type { MatchCandidate, MatchStats } from '@/api';

export function MatchReviewPanel() {
    const [documents, setDocuments] = useState<OCRDocument[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [candidates, setCandidates] = useState<MatchCandidate[]>([]);

    useEffect(() => {
        if (!selectedDocId) return;
        matchesApi.findCandidates(selectedDocId).then(setCandidates);
    }, [selectedDocId]);
    // ... render two-panel layout
}
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 5 components render without errors
- [ ] Navigation to Matching tab works
- [ ] Match review panel shows candidates with score visualization
- [ ] Confirm/reject actions update match status
- [ ] Rule manager CRUD works: create -> list -> delete
- [ ] Auto-match runs and shows results
- [ ] Statistics display accurate counts
- [ ] Neumorphic styling matches existing components (dark theme, gold #FFCC00 accents, neu-raised/neu-inset classes)
- [ ] Create marker file: `.agent-done-W14-09`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-W14-07`) -- API routes must exist
- **IMPORTANT**: Only this agent creates files in `client/src/features/matching/`
- **Coordinate with**: Agent 8 on client/src/App.tsx and client/src/api.ts modifications
