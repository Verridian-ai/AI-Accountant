# Agent 8: UI Assets Builder

## Role
Build all React frontend components for the Fixed Assets feature, including asset register, depreciation schedules, disposal tracking, and new asset registration.

## Priority: WAVE 4 (After Agent 7 completes API routes)

## Wait Condition
Check for `.agent-done-W12-07` marker file before starting.

## Context
- UI library: shadcn/ui at `client/src/components/ui/` (Card, Tabs, Button, Input, Select, Badge, Switch, Progress, Dialog, Table)
- Icons: lucide-react (Package, Calculator, TrendingDown, Building2, Trash2, Plus, FileText, etc.)
- Existing pattern: `client/src/features/tax/components/TaxDashboard.tsx` (line 1-12 for imports)
- API layer: `client/src/api.ts` — existing API methods at end of file (~line 1860)
- BottomNavigation tabs: `client/src/components/layout/BottomNavigation.tsx` — TabId type at line 4
- App.tsx: `client/src/App.tsx` — imports at lines 1-45, tab rendering logic
- No `assets/` feature folder exists yet — must create it

## Files to MODIFY

### 1. `client/src/api.ts` (after line 1860, end of file)

- [ ] Add new TypeScript interfaces:
```typescript
// Fixed Asset types
export interface FixedAssetData {
  id: string;
  assetName: string;
  assetNumber: string;
  category: string;
  purchaseDate: string;
  purchasePrice: number;
  residualValue: number;
  depreciationMethod: string;
  effectiveLifeYears: number;
  currentWrittenDownValue: number;
  status: 'active' | 'disposed' | 'fully_depreciated' | 'written_off';
  entityId?: string;
  location?: string;
  serialNumber?: string;
  supplier?: string;
}

export interface AssetRegisterResponse {
  assets: FixedAssetData[];
  summary: {
    totalAssets: number;
    totalCost: number;
    totalWDV: number;
    totalDepreciationToDate: number;
    byCategory: Array<{ category: string; count: number; cost: number; wdv: number }>;
  };
}

export interface DepreciationScheduleResponse {
  financialYear: string;
  assets: Array<{
    assetId: string;
    assetName: string;
    category: string;
    method: string;
    openingValue: number;
    depreciation: number;
    closingValue: number;
    additions: number;
    disposals: number;
  }>;
  totals: {
    openingValue: number;
    totalDepreciation: number;
    closingValue: number;
    totalAdditions: number;
    totalDisposals: number;
  };
}

export interface BatchDepreciationResult {
  assetsProcessed: number;
  totalDepreciation: number;
  results: Array<{
    assetId: string;
    assetName: string;
    depreciationAmount: number;
    closingValue: number;
  }>;
  errors: Array<{ assetId: string; error: string }>;
}
```

- [ ] Add `assetApi` object:
```typescript
export const assetApi = {
  getRegister: async (userId?: string, filters?: Record<string, string>): Promise<AssetRegisterResponse> => {
    const params = new URLSearchParams({ userId: userId || 'default', ...filters });
    const res = await fetch(`${API_URL}/assets?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch asset register');
    return res.json();
  },
  getAsset: async (id: string): Promise<FixedAssetData> => {
    const res = await fetch(`${API_URL}/assets/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch asset');
    return res.json();
  },
  registerAsset: async (data: Partial<FixedAssetData>): Promise<FixedAssetData> => {
    const res = await fetch(`${API_URL}/assets`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to register asset');
    return res.json();
  },
  updateAsset: async (id: string, updates: Partial<FixedAssetData>): Promise<FixedAssetData> => {
    const res = await fetch(`${API_URL}/assets/${id}`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update asset');
    return res.json();
  },
  calculateDepreciation: async (id: string, year: string): Promise<{ depreciationAmount: number; closingValue: number }> => {
    const res = await fetch(`${API_URL}/assets/${id}/depreciation/${year}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to calculate depreciation');
    return res.json();
  },
  runBatchDepreciation: async (year: string, entityId?: string): Promise<BatchDepreciationResult> => {
    const params = new URLSearchParams({ userId: 'default' });
    if (entityId) params.set('entityId', entityId);
    const res = await fetch(`${API_URL}/assets/depreciation/batch/${year}?${params}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to run batch depreciation');
    return res.json();
  },
  disposeAsset: async (id: string, data: Record<string, unknown>): Promise<unknown> => {
    const res = await fetch(`${API_URL}/assets/${id}/dispose`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to dispose asset');
    return res.json();
  },
  getDepreciationSchedule: async (year: string, entityId?: string): Promise<DepreciationScheduleResponse> => {
    const params = new URLSearchParams({ userId: 'default' });
    if (entityId) params.set('entityId', entityId);
    const res = await fetch(`${API_URL}/assets/schedule/${year}?${params}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch depreciation schedule');
    return res.json();
  },
};
```

### 2. `client/src/components/layout/BottomNavigation.tsx` (line 4)
**BEFORE**:
```typescript
export type TabId = 'dashboard' | 'transactions' | 'accounts' | 'analytics' | 'bas' | 'tax' | 'gst' | 'transfers' | 'loans';
```
**AFTER**:
```typescript
export type TabId = 'dashboard' | 'transactions' | 'accounts' | 'analytics' | 'bas' | 'tax' | 'gst' | 'transfers' | 'loans' | 'assets' | 'entities';
```

### 3. `client/src/App.tsx`
- [ ] Add imports for new components:
```typescript
import { AssetsDashboard } from './features/assets/components/AssetsDashboard';
```
- [ ] Add `Package` to lucide-react imports (for assets icon)
- [ ] Add rendering logic for `activeTab === 'assets'` in the tab content section (follow existing pattern for 'loans' or 'tax' tab)

## Files to CREATE

### 4. `client/src/features/assets/components/AssetsDashboard.tsx`
**Purpose**: Main dashboard for fixed assets with tab navigation
- [ ] Tabbed layout: Asset Register | Depreciation Schedule | Disposals | Add Asset
- [ ] Financial year selector dropdown (2023-24, 2024-25, 2025-26)
- [ ] Entity filter dropdown (if entities exist)
- [ ] Summary stat cards at top: Total Assets, Total Cost, Total WDV, Annual Depreciation
- [ ] Import and render child components based on active tab
- [ ] Style: Use neumorphic `neu-raised` cards, gold (#FFCC00) accents

### 5. `client/src/features/assets/components/AssetRegisterTable.tsx`
**Purpose**: Sortable, filterable table of all fixed assets
- [ ] Columns: Asset #, Name, Category, Purchase Date, Cost, WDV, Method, Status, Actions
- [ ] Category badge with color coding (match existing category color pattern)
- [ ] Status badge: active=green, disposed=red, fully_depreciated=amber, written_off=gray
- [ ] Filter by: category dropdown, status dropdown, search by name
- [ ] Sort by: any column header click
- [ ] Row click → expand to show full asset detail
- [ ] Action buttons: Edit, Depreciate, Dispose
- [ ] Use TanStack Table if already in project, otherwise simple HTML table with sort state
- [ ] Format amounts as AUD currency: `$XX,XXX.XX` (divide cents by 100)

### 6. `client/src/features/assets/components/DepreciationScheduleView.tsx`
**Purpose**: Display depreciation schedule for a financial year
- [ ] Table: Asset Name, Category, Method, Opening Value, Depreciation, Closing Value, Additions, Disposals
- [ ] Totals row at bottom with bold styling
- [ ] "Run Batch Depreciation" button (calls `assetApi.runBatchDepreciation`)
- [ ] Loading state with skeleton cards
- [ ] Results summary after batch run: X assets processed, $Y total depreciation
- [ ] Error display for any individual asset failures

### 7. `client/src/features/assets/components/AssetDisposalForm.tsx`
**Purpose**: Form to record asset disposal
- [ ] Fields: Disposal Date (date picker), Disposal Method (dropdown: sale, scrapped, trade_in, theft, insurance_claim), Proceeds ($), Buyer Details, Invoice Reference, Notes
- [ ] Auto-calculate: WDV at disposal date, Profit/Loss, CGT applicability
- [ ] Display calculated values in real-time as user fills form
- [ ] Confirm button with summary before submission
- [ ] Style: Dialog/modal overlay with neumorphic form fields

### 8. `client/src/features/assets/components/RegisterAssetForm.tsx`
**Purpose**: Form to register a new fixed asset
- [ ] Fields: Asset Name, Category (dropdown with all 10 categories), Purchase Date, Purchase Price ($), Residual Value ($), Depreciation Method (dropdown), Effective Life (years), Location, Serial Number, Supplier, Invoice Reference, GST Claimed ($)
- [ ] Entity selector (if entities exist)
- [ ] Smart defaults: Auto-fill effective life from ATO defaults when category selected
- [ ] Method recommendation: Show hint based on category and price (e.g., "Under $20,000 — eligible for instant write-off")
- [ ] Validation: Required fields marked, price must be positive, date cannot be in future
- [ ] Submit → calls `assetApi.registerAsset()`
- [ ] Success toast notification on completion

### 9. `client/src/features/assets/components/AssetSummaryCards.tsx`
**Purpose**: Summary stat cards for the assets dashboard header
- [ ] 4 cards in a grid: Total Assets (count), Total Cost (sum of purchase prices), Current WDV (sum of current WDV), Total Depreciation (cost - WDV)
- [ ] Optional 5th card: Assets by Category (mini bar chart or list)
- [ ] Each card: icon, label, value, trend indicator (vs prior year if available)
- [ ] Use existing `StatCard` component from `client/src/features/analytics/components/StatCard.tsx` as reference

## Component Pattern (follow TaxDashboard.tsx):
```tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { assetApi } from '@/api';
import type { AssetRegisterResponse } from '@/api';

export function AssetsDashboard() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<AssetRegisterResponse | null>(null);
    const [financialYear, setFinancialYear] = useState('2024-25');
    // ... fetch on mount, render tabs
}
```

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 6 components render without errors
- [ ] Navigation to assets tab works from App.tsx
- [ ] Asset register table displays mock/real data correctly
- [ ] Register asset form submits successfully
- [ ] Depreciation schedule loads for selected FY
- [ ] Amounts display correctly in AUD format (divided by 100)
- [ ] Create marker file: `.agent-done-W12-08`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-W12-07`) — API routes must exist
- **IMPORTANT**: Only this agent and Agent 9 may modify client/src/api.ts, App.tsx, and BottomNavigation.tsx in Wave 12
- **Note**: Agent 9 will add entity-related API methods and components — coordinate TabId change
