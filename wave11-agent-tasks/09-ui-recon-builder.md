# Agent 9: UI Reconciliation Builder

## Role
Build 5 React components for the bank reconciliation feature and wire them into the existing app shell with API integration and bottom navigation tabs.

## Priority: WAVE 11 (After Agent 7)

## Files to CREATE

### 1. `client/src/features/reconciliation/components/ReconDashboard.tsx`
**Purpose**: Main reconciliation page with session management and sub-view navigation
**Pattern**: Follow `client/src/features/tax/components/TaxDashboard.tsx` — neumorphic dark theme, gold accents

- [ ] Create main container with two sections: "Active Sessions" and "Completed Sessions"
- [ ] "New Reconciliation" button that opens session creation form
- [ ] Session creation form: account selector, date range (period start/end), optional statement balance
- [ ] Session list cards showing: account name, period, status badge (open/in_progress/completed), matched/unmatched counts, difference amount
- [ ] Click on session card to navigate to the matching workspace (ReconMatchingWorkspace)
- [ ] Summary stats at top: total sessions, active sessions, total matched transactions, average match rate

### 2. `client/src/features/reconciliation/components/ReconMatchingWorkspace.tsx`
**Purpose**: The main reconciliation workspace — side-by-side bank vs. ledger matching interface
**Pattern**: Split-pane layout with drag-and-drop or click-to-match

- [ ] Two-column layout:
  - **Left column**: "Bank Transactions" — unmatched bank transactions for the session period
  - **Right column**: "Ledger Entries" — unmatched journal entry lines
- [ ] Each item shows: date, description/reference, amount (formatted AUD), match status badge
- [ ] "Auto-Match" button at top — calls `api.recon.autoMatch(sessionId)`, shows results
- [ ] Progress bar showing: X of Y matched (percentage)
- [ ] Difference banner: "Statement Balance: $X | Ledger Balance: $Y | Difference: $Z"
- [ ] Click bank transaction to see suggested matches (ReconMatchSuggestions panel)
- [ ] "Complete Session" button when all items are reviewed
- [ ] Color coding: green=confirmed, amber=suggested, red=rejected, grey=unmatched

### 3. `client/src/features/reconciliation/components/ReconMatchSuggestions.tsx`
**Purpose**: Panel showing match suggestions for a selected bank transaction
**Pattern**: Slide-out panel or modal

- [ ] Shows the selected bank transaction at top (date, description, amount)
- [ ] List of suggested ledger matches ranked by confidence score
- [ ] Each suggestion shows: ledger reference, date, amount, confidence % (progress bar), match reasons (pills/badges)
- [ ] "Confirm Match" button per suggestion — calls `api.recon.confirmMatch(matchId)`
- [ ] "Reject" button — calls `api.recon.rejectMatch(matchId)`
- [ ] "Manual Match" option — select any ledger entry to create manual match
- [ ] "Mark as No Match" option for truly unreconciled items

### 4. `client/src/features/reconciliation/components/ReconRulesManager.tsx`
**Purpose**: CRUD interface for bank reconciliation matching rules
**Pattern**: Settings-style list with edit forms

- [ ] Fetch rules via `api.recon.getRules()`
- [ ] List of rules showing: name, match type badge, priority, auto-confirm toggle, status (active/inactive)
- [ ] "Add Rule" button opening creation form:
  - Name (text input)
  - Match Type (dropdown: amount_exact, amount_date, reference_number, description_pattern, combined)
  - Match Config (JSON editor or structured fields based on match type):
    - amount_exact: tolerance_cents
    - amount_date: tolerance_cents, date_window_days
    - reference_number: reference field name
    - description_pattern: regex pattern
    - combined: field_weights object
  - Auto Confirm toggle
  - Priority (number input)
- [ ] Edit/delete actions per rule
- [ ] Rules ordered by priority (drag to reorder, or number input)

### 5. `client/src/features/reconciliation/components/ReconSummaryCard.tsx`
**Purpose**: Compact summary card showing reconciliation status for the dashboard
**Pattern**: Follow `client/src/features/analytics/components/StatCard.tsx`

- [ ] Shows: last recon date, matched %, open sessions count, total discrepancy amount
- [ ] Mini progress bar for match percentage
- [ ] "View Reconciliation" link/button to navigate to recon tab
- [ ] Warning indicator if there are unresolved sessions older than 7 days
- [ ] Neumorphic card styling with gold accent for key numbers

## Files to MODIFY

### 6. `client/src/api.ts`
**Purpose**: Add reconciliation API methods

**ADD** a `reconApi` namespace alongside the inventoryApi:

```typescript
// Reconciliation API
export const reconApi = {
  listSessions: async (filters?: { accountId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.accountId) params.set('accountId', filters.accountId);
    if (filters?.status) params.set('status', filters.status);
    const res = await fetch(`${API_URL}/recon/sessions?${params}`, { headers: getAuthHeaders() });
    return res.json();
  },
  createSession: async (data: { accountId: string; periodStart: string; periodEnd: string; statementBalanceCents?: number }) => {
    const res = await fetch(`${API_URL}/recon/sessions`, {
      method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  getSession: async (id: string) => {
    const res = await fetch(`${API_URL}/recon/sessions/${id}`, { headers: getAuthHeaders() });
    return res.json();
  },
  autoMatch: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/recon/sessions/${sessionId}/auto-match`, {
      method: 'POST', headers: getAuthHeaders(),
    });
    return res.json();
  },
  completeSession: async (sessionId: string) => {
    const res = await fetch(`${API_URL}/recon/sessions/${sessionId}/complete`, {
      method: 'POST', headers: getAuthHeaders(),
    });
    return res.json();
  },
  confirmMatch: async (matchId: string) => {
    const res = await fetch(`${API_URL}/recon/matches/${matchId}/confirm`, {
      method: 'POST', headers: getAuthHeaders(),
    });
    return res.json();
  },
  undoMatch: async (matchId: string) => {
    const res = await fetch(`${API_URL}/recon/matches/${matchId}/undo`, {
      method: 'POST', headers: getAuthHeaders(),
    });
    return res.json();
  },
  createManualMatch: async (data: { sessionId: string; bankTransactionId: string; ledgerEntryId: string }) => {
    const res = await fetch(`${API_URL}/recon/matches/manual`, {
      method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  getRules: async () => {
    const res = await fetch(`${API_URL}/recon/rules`, { headers: getAuthHeaders() });
    return res.json();
  },
  createRule: async (data: { name: string; matchType: string; matchConfig: Record<string, unknown>; autoConfirm?: boolean; priority?: number }) => {
    const res = await fetch(`${API_URL}/recon/rules`, {
      method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
};
```

### 7. `client/src/App.tsx`
**Purpose**: Add "recon" tab and render ReconDashboard

- [ ] Verify 'recon' is already in the TabId union (Agent 8 should have added it):
```typescript
const [activeTab, setActiveTab] = useState<'...' | 'inventory' | 'recon'>('dashboard');
```
- [ ] Add import: `import { ReconDashboard } from './features/reconciliation/components/ReconDashboard';`
- [ ] Add tab rendering: `{activeTab === 'recon' && <ReconDashboard />}`
- [ ] Add "Reconciliation" button to the desktop sidebar/nav: `{ id: 'recon', label: 'Reconcile', icon: GitCompareArrows }`
- [ ] `GitCompareArrows` is already imported from lucide-react (line 41)

### 8. `client/src/components/layout/BottomNavigation.tsx` (line 4)
**Purpose**: Add inventory and reconciliation to the mobile bottom nav TabId type

**BEFORE**:
```typescript
export type TabId = 'dashboard' | 'transactions' | 'accounts' | 'analytics' | 'bas' | 'tax' | 'gst' | 'transfers' | 'loans';
```
**AFTER**:
```typescript
export type TabId = 'dashboard' | 'transactions' | 'accounts' | 'analytics' | 'bas' | 'tax' | 'gst' | 'transfers' | 'loans' | 'inventory' | 'recon';
```

- [ ] Add `'inventory' | 'recon'` to the TabId type union
- [ ] Note: The actual mobile nav items array only shows 4 items + center button, so the new tabs are accessible via the center menu button ("Menu"), not directly on the bottom bar. No changes needed to the navItems array itself unless you want to restructure. The TabId type just needs to support the new values.

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 5 component files exist and export correctly
- [ ] `reconApi` object in api.ts has all 10 methods
- [ ] App.tsx includes 'recon' in the activeTab union
- [ ] BottomNavigation.tsx TabId includes 'inventory' and 'recon'
- [ ] ReconDashboard renders without errors when the recon tab is active
- [ ] ReconMatchingWorkspace shows two-column layout
- [ ] Create marker file: `.agent-done-W11-09`

## Dependencies
- **Agent 7** (API endpoints must exist for client calls)
- **Agent 8** (App.tsx TabId should already include 'inventory' | 'recon' — coordinate with Agent 8)
- **Reuses**: api.ts (BASE_URL, getAuthHeaders), App.tsx (tab system), BottomNavigation.tsx (TabId), Tailwind/neumorphic classes, lucide-react icons
