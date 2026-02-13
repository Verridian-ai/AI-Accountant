# Agent 9: UI Entities Builder

## Role
Build all React frontend components for the Multi-Entity and Consolidation features, including entity management, hierarchy visualization, inter-entity transaction tracking, and consolidated reporting.

## Priority: WAVE 4 (After Agent 7 and Agent 8 complete)

## Wait Condition
Check for `.agent-done-W12-07` and `.agent-done-W12-08` marker files before starting.

## Context
- UI library: shadcn/ui at `client/src/components/ui/` (Card, Tabs, Button, Input, Select, Badge, Switch, Progress, Dialog, Table)
- Icons: lucide-react (Building2, GitBranch, ArrowLeftRight, Layers, Users, Settings, etc.)
- API layer: `client/src/api.ts` — Agent 8 will have already added `assetApi` and updated `TabId`
- BottomNavigation: Agent 8 already added `'assets' | 'entities'` to TabId union
- App.tsx: Agent 8 already added assets tab rendering

## Files to MODIFY

### 1. `client/src/api.ts` (after assetApi added by Agent 8)

- [ ] Add new TypeScript interfaces:
```typescript
// Multi-Entity types
export interface EntityData {
  id: string;
  name: string;
  entityType: 'sole_trader' | 'company' | 'trust' | 'partnership' | 'smsf' | 'individual';
  abn?: string;
  acn?: string;
  parentEntityId?: string;
  isConsolidatedParent: boolean;
  status: 'active' | 'inactive' | 'dormant';
  financialYearEnd: string;
  address?: string;
  contactEmail?: string;
  createdAt: string;
}

export interface EntityWithDetails extends EntityData {
  accounts: EntityAccountData[];
  settings: EntitySettingData | null;
  children: EntityData[];
  parentName?: string;
}

export interface EntityAccountData {
  id: string;
  entityId: string;
  accountId: string;
  role: string;
  ownershipPercentage: number;
  linkedAt: string;
}

export interface EntitySettingData {
  basReportingFrequency: string;
  gstRegistered: boolean;
  gstMethod: string;
  taxRate: number;
  defaultDepreciationMethod: string;
  instantWriteOffThreshold: number;
}

export interface EntityHierarchyResponse {
  entities: EntityWithDetails[];
  rootEntities: EntityData[];
  totalEntities: number;
}

export interface InterEntityTransactionData {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  amount: number;
  description: string;
  transactionDate: string;
  transactionType: string;
  status: 'pending' | 'confirmed' | 'eliminated' | 'disputed';
  confirmedByFrom: boolean;
  confirmedByTo: boolean;
}

export interface ConsolidationSnapshotData {
  id: string;
  parentEntityId: string;
  financialYear: string;
  snapshotDate: string;
  status: 'draft' | 'reviewed' | 'finalized';
  totalRevenue: number;
  totalExpenses: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  eliminationsApplied: number;
}

export interface ConsolidationDetailResponse {
  snapshot: ConsolidationSnapshotData;
  byEntity: Record<string, {
    entityName: string;
    revenue: number;
    expenses: number;
    assets: number;
    liabilities: number;
    equity: number;
  }>;
  eliminations: Array<{ description: string; amount: number }>;
  consolidatedTotals: {
    revenue: number;
    expenses: number;
    netProfit: number;
    assets: number;
    liabilities: number;
    equity: number;
  };
}
```

- [ ] Add `entityApi` object:
```typescript
export const entityApi = {
  getHierarchy: async (userId?: string): Promise<EntityHierarchyResponse> => {
    const res = await fetch(`${API_URL}/entities?userId=${userId || 'default'}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch entities');
    return res.json();
  },
  getEntity: async (id: string): Promise<EntityWithDetails> => {
    const res = await fetch(`${API_URL}/entities/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch entity');
    return res.json();
  },
  createEntity: async (data: Partial<EntityData>): Promise<EntityData> => {
    const res = await fetch(`${API_URL}/entities`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create entity');
    return res.json();
  },
  updateEntity: async (id: string, updates: Partial<EntityData>): Promise<EntityData> => {
    const res = await fetch(`${API_URL}/entities/${id}`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update entity');
    return res.json();
  },
  updateSettings: async (id: string, settings: Partial<EntitySettingData>): Promise<EntitySettingData> => {
    const res = await fetch(`${API_URL}/entities/${id}/settings`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },
  linkAccount: async (entityId: string, accountId: string, role: string): Promise<EntityAccountData> => {
    const res = await fetch(`${API_URL}/entities/${entityId}/accounts`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, role }),
    });
    if (!res.ok) throw new Error('Failed to link account');
    return res.json();
  },
  unlinkAccount: async (entityId: string, accountId: string): Promise<void> => {
    const res = await fetch(`${API_URL}/entities/${entityId}/accounts/${accountId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to unlink account');
  },
  getInterEntityTransactions: async (filters?: Record<string, string>): Promise<InterEntityTransactionData[]> => {
    const params = new URLSearchParams({ userId: 'default', ...filters });
    const res = await fetch(`${API_URL}/entities/inter-entity-transactions?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch inter-entity transactions');
    return res.json();
  },
  recordInterEntityTransaction: async (data: Partial<InterEntityTransactionData>): Promise<InterEntityTransactionData> => {
    const res = await fetch(`${API_URL}/entities/inter-entity-transactions`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record transaction');
    return res.json();
  },
  confirmInterEntityTransaction: async (id: string, entityId: string, confirmed: boolean): Promise<InterEntityTransactionData> => {
    const res = await fetch(`${API_URL}/entities/inter-entity-transactions/${id}/confirm`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId, confirmed }),
    });
    if (!res.ok) throw new Error('Failed to confirm transaction');
    return res.json();
  },
};

export const consolidationApi = {
  generate: async (parentEntityId: string, financialYear: string): Promise<ConsolidationDetailResponse> => {
    const res = await fetch(`${API_URL}/consolidation/generate`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'default', parentEntityId, financialYear }),
    });
    if (!res.ok) throw new Error('Failed to generate consolidation');
    return res.json();
  },
  getSnapshots: async (parentEntityId: string, financialYear?: string): Promise<ConsolidationSnapshotData[]> => {
    const params = new URLSearchParams({ parentEntityId });
    if (financialYear) params.set('financialYear', financialYear);
    const res = await fetch(`${API_URL}/consolidation/snapshots?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch snapshots');
    return res.json();
  },
  getSnapshotDetail: async (id: string): Promise<ConsolidationDetailResponse> => {
    const res = await fetch(`${API_URL}/consolidation/snapshots/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch snapshot detail');
    return res.json();
  },
  finalizeSnapshot: async (id: string): Promise<ConsolidationSnapshotData> => {
    const res = await fetch(`${API_URL}/consolidation/snapshots/${id}/finalize`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to finalize snapshot');
    return res.json();
  },
};
```

### 2. `client/src/App.tsx`
- [ ] Add imports for new entity components:
```typescript
import { EntitiesDashboard } from './features/entities/components/EntitiesDashboard';
```
- [ ] Add `Building2` and `GitBranch` to lucide-react imports
- [ ] Add rendering logic for `activeTab === 'entities'` in the tab content section

## Files to CREATE

### 3. `client/src/features/entities/components/EntitiesDashboard.tsx`
**Purpose**: Main dashboard for multi-entity management with tab navigation
- [ ] Tabbed layout: Entity Hierarchy | Inter-Entity Transactions | Consolidation | Settings
- [ ] Entity selector at top (for filtering by specific entity)
- [ ] Financial year selector
- [ ] Summary cards: Total Entities, Linked Accounts, Pending Inter-Entity Txns, Last Consolidation
- [ ] Import and render child components based on active tab
- [ ] Style: Neumorphic `neu-raised` cards, gold (#FFCC00) accents

### 4. `client/src/features/entities/components/EntityHierarchyView.tsx`
**Purpose**: Visual hierarchy of entities with parent-child relationships
- [ ] Tree view: Root entities at top, children indented below with connecting lines
- [ ] Each entity card shows: Name, Type (badge), ABN, linked account count, status
- [ ] Entity type badges: company=blue, trust=purple, sole_trader=green, partnership=orange, smsf=amber, individual=gray
- [ ] Click entity → expand to show linked accounts with roles
- [ ] "Add Entity" button → opens CreateEntityForm
- [ ] "Link Account" button on each entity → opens account selector dialog
- [ ] Edit button → opens entity edit form
- [ ] Drag-and-drop to reparent entities (optional stretch goal)

### 5. `client/src/features/entities/components/CreateEntityForm.tsx`
**Purpose**: Form to create a new entity
- [ ] Fields: Name, Entity Type (dropdown), ABN (with format validation XX XXX XXX XXX), ACN (company only), Parent Entity (dropdown of existing entities), Financial Year End, Address, Contact Email
- [ ] ABN validation: 11 digits, show formatted with spaces
- [ ] Conditional fields: ACN only shown when entityType=company, parent only shown if entities exist
- [ ] Entity type description helper text (e.g., "Company — 25% tax rate, separate legal entity")
- [ ] Submit → calls `entityApi.createEntity()`
- [ ] Dialog/modal overlay with form

### 6. `client/src/features/entities/components/InterEntityTransactionsView.tsx`
**Purpose**: Track and manage inter-entity transactions
- [ ] Table: Date, From Entity, To Entity, Type, Amount, Status, Actions
- [ ] Status badges: pending=amber, confirmed=green, eliminated=blue, disputed=red
- [ ] Type badges: loan, management_fee, dividend, distribution, rent, service_fee, asset_transfer, capital_contribution
- [ ] Confirm/Dispute buttons for pending transactions
- [ ] "Record Transaction" button → opens form dialog with: From Entity, To Entity, Type, Amount, Date, Description
- [ ] Filter by: entity, status, type, date range
- [ ] Division 7A warning badge on loan-type transactions that may be non-compliant

### 7. `client/src/features/entities/components/ConsolidationView.tsx`
**Purpose**: Generate and view consolidated financial reports
- [ ] Parent entity selector (only entities with isConsolidatedParent=true)
- [ ] "Generate Consolidation" button → calls `consolidationApi.generate()`
- [ ] Results display:
  - Per-entity P&L breakdown table (Entity | Revenue | Expenses | Net)
  - Elimination entries list (Description | Amount)
  - Consolidated totals card: Total Revenue, Total Expenses, Net Profit, Total Eliminations
  - Balance sheet summary: Assets, Liabilities, Equity
- [ ] Snapshot history: list of previous consolidation snapshots with date and status
- [ ] "Finalize" button on draft snapshots
- [ ] Stacked bar chart showing entity contributions to consolidated revenue (optional)

### 8. `client/src/features/entities/components/EntitySettingsPanel.tsx`
**Purpose**: Configure entity-specific settings
- [ ] Entity selector dropdown
- [ ] Settings form:
  - BAS Reporting Frequency (monthly / quarterly / annually)
  - GST Registered toggle (switch)
  - GST Method (cash / accrual) — only shown if GST registered
  - Tax Rate (numeric input, shown as percentage)
  - Default Depreciation Method (straight_line / diminishing_value)
  - Instant Write-Off Threshold ($) — default $20,000
- [ ] Auto-save on change (debounced PATCH to API)
- [ ] Success/error toast notifications
- [ ] Help text for each setting explaining implications

## Component Pattern (follow existing features):
```tsx
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { entityApi, consolidationApi } from '@/api';
import type { EntityHierarchyResponse } from '@/api';

export function EntitiesDashboard() {
    const [loading, setLoading] = useState(false);
    const [hierarchy, setHierarchy] = useState<EntityHierarchyResponse | null>(null);
    // ... fetch on mount, render tabs
}
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 6 components render without errors
- [ ] Navigation to entities tab works from App.tsx
- [ ] Entity hierarchy displays correctly with parent-child nesting
- [ ] Create entity form submits successfully
- [ ] Inter-entity transaction table loads and filters work
- [ ] Consolidation generation produces visible results
- [ ] Entity settings save via API
- [ ] Styling matches existing neumorphic dark theme with gold accents
- [ ] Create marker file: `.agent-done-W12-09`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-W12-07`) — API routes must exist
- **Requires**: Agent 8 (`.agent-done-W12-08`) — TabId already updated, api.ts already has asset types
- **IMPORTANT**: Only this agent modifies api.ts (entity section) and App.tsx (entity tab) after Agent 8
- **Coordinate**: Agent 8 adds TabId values `assets` and `entities` to BottomNavigation — do NOT duplicate
