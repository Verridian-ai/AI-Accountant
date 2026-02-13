# Agent 8: UI Inventory Builder

## Role
Build 7 React components for the inventory management feature and wire them into the existing app shell with API integration.

## Priority: WAVE 11 (After Agent 7)

## Files to CREATE

### 1. `client/src/features/inventory/components/InventoryDashboard.tsx`
**Purpose**: Main inventory page with tab navigation between sub-views
**Pattern**: Follow `client/src/features/tax/components/TaxDashboard.tsx` — neumorphic dark theme, gold accents

- [ ] Create main container with tabs: "Items", "Stock Levels", "Movements", "Warehouses", "Valuation", "COGS"
- [ ] Import and render the 6 sub-components based on active tab
- [ ] Use `neu-raised` / `neu-inset` classes for neumorphic card styling
- [ ] Gold (#FFCC00) accent for active tab indicator and key metrics
- [ ] Header with title "Inventory Management" and summary stats (total items, total value, low stock alerts)

### 2. `client/src/features/inventory/components/InventoryItemList.tsx`
**Purpose**: CRUD table for inventory items with search and filtering
**Pattern**: Follow `client/src/features/transactions/components/LedgerPage.tsx` for table patterns

- [ ] Fetch items via `api.inventory.listItems()`
- [ ] Columns: SKU, Name, Category, Unit, Cost, Sale Price, Stock Qty, Reorder Point, Status, Actions
- [ ] Search bar filtering by name/SKU
- [ ] Category filter dropdown
- [ ] "Add Item" button opening a modal/form
- [ ] Edit/Deactivate actions per row
- [ ] Format amounts as AUD (divide cents by 100)
- [ ] Highlight items with stock below reorder point in amber/warning color

### 3. `client/src/features/inventory/components/StockLevelPanel.tsx`
**Purpose**: Visual overview of stock levels across all warehouses
**Pattern**: Card-based layout with progress bars

- [ ] Fetch stock levels via `api.inventory.getStockLevels()`
- [ ] Group by warehouse
- [ ] For each item: show name, SKU, quantity on hand, quantity available, reorder point
- [ ] Progress bar showing current stock relative to reorder point (green above, amber near, red below)
- [ ] "Low Stock Alerts" section at top showing items below reorder point
- [ ] Warehouse filter dropdown
- [ ] Quick action buttons: "Adjust Stock", "Transfer"

### 4. `client/src/features/inventory/components/MovementHistory.tsx`
**Purpose**: Paginated table of stock movements with filtering
**Pattern**: Follow existing paginated table patterns

- [ ] Fetch movements via `api.inventory.getMovements()`
- [ ] Columns: Date, Item (SKU + Name), Type (purchase/sale/adjustment/transfer), Qty, Unit Cost, Total, Warehouse, Notes
- [ ] Color-code movement types (green=purchase, red=sale, blue=transfer, amber=adjustment)
- [ ] Date range filter
- [ ] Item filter
- [ ] Movement type filter
- [ ] Pagination controls (limit/offset)

### 5. `client/src/features/inventory/components/WarehouseManager.tsx`
**Purpose**: Manage warehouses (create, list, set default)
**Pattern**: Simple card-based list

- [ ] Fetch warehouses via `api.inventory.listWarehouses()`
- [ ] Card for each warehouse showing: name, location, isDefault badge, item count
- [ ] "Add Warehouse" form (name, location, isDefault toggle)
- [ ] "Set as Default" action button
- [ ] Show total stock value per warehouse

### 6. `client/src/features/inventory/components/ValuationReport.tsx`
**Purpose**: Inventory valuation report with category breakdown
**Pattern**: Dashboard-style with charts

- [ ] Fetch valuation via `api.inventory.getValuation()`
- [ ] Top banner: "Total Inventory Value: $X,XXX.XX"
- [ ] Category breakdown table: Category, Item Count, Total Value, % of Total
- [ ] Optional: horizontal bar chart for category distribution (use existing chart patterns)
- [ ] "As of Date" selector for point-in-time valuation
- [ ] Export button (future — can be placeholder)

### 7. `client/src/features/inventory/components/COGSCalculator.tsx`
**Purpose**: Interactive COGS calculation tool
**Pattern**: Form-based calculator

- [ ] Item selector dropdown (fetch items list)
- [ ] Quantity sold input
- [ ] "Calculate COGS" button
- [ ] Results display: Unit Cost, Total COGS, Margin % (if sale price available)
- [ ] History of recent COGS calculations (client-side state)
- [ ] Explanation text about weighted average method

## Files to MODIFY

### 8. `client/src/api.ts`
**Purpose**: Add inventory API methods

**ADD** after existing API methods (find the `export const api = {` object or equivalent pattern and add an `inventory` namespace):

```typescript
// Inventory API
export const inventoryApi = {
  listItems: async (filters?: { category?: string; isActive?: boolean; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.isActive !== undefined) params.set('isActive', String(filters.isActive));
    if (filters?.search) params.set('search', filters.search);
    const res = await fetch(`${API_URL}/inventory/items?${params}`, { headers: getAuthHeaders() });
    return res.json();
  },
  createItem: async (data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/inventory/items`, {
      method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  getItem: async (id: string) => {
    const res = await fetch(`${API_URL}/inventory/items/${id}`, { headers: getAuthHeaders() });
    return res.json();
  },
  updateItem: async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`${API_URL}/inventory/items/${id}`, {
      method: 'PUT', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  deactivateItem: async (id: string) => {
    const res = await fetch(`${API_URL}/inventory/items/${id}`, {
      method: 'DELETE', headers: getAuthHeaders(),
    });
    return res.json();
  },
  adjustStock: async (itemId: string, data: { warehouseId: string; quantity: number; unitCostCents: number; movementType: string; notes?: string }) => {
    const res = await fetch(`${API_URL}/inventory/items/${itemId}/adjust`, {
      method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  transferStock: async (itemId: string, data: { fromWarehouseId: string; toWarehouseId: string; quantity: number; notes?: string }) => {
    const res = await fetch(`${API_URL}/inventory/items/${itemId}/transfer`, {
      method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  getStockLevels: async (filters?: { warehouseId?: string; itemId?: string; belowReorder?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.warehouseId) params.set('warehouseId', filters.warehouseId);
    if (filters?.itemId) params.set('itemId', filters.itemId);
    if (filters?.belowReorder) params.set('belowReorder', 'true');
    const res = await fetch(`${API_URL}/inventory/stock?${params}`, { headers: getAuthHeaders() });
    return res.json();
  },
  getMovements: async (filters?: { itemId?: string; warehouseId?: string; movementType?: string; startDate?: string; endDate?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (filters?.itemId) params.set('itemId', filters.itemId);
    if (filters?.warehouseId) params.set('warehouseId', filters.warehouseId);
    if (filters?.movementType) params.set('movementType', filters.movementType);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const res = await fetch(`${API_URL}/inventory/movements?${params}`, { headers: getAuthHeaders() });
    return res.json();
  },
  listWarehouses: async () => {
    const res = await fetch(`${API_URL}/inventory/warehouses`, { headers: getAuthHeaders() });
    return res.json();
  },
  createWarehouse: async (data: { name: string; location?: string; isDefault?: boolean }) => {
    const res = await fetch(`${API_URL}/inventory/warehouses`, {
      method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  getValuation: async (asOfDate?: string) => {
    const params = asOfDate ? `?asOfDate=${asOfDate}` : '';
    const res = await fetch(`${API_URL}/inventory/valuation${params}`, { headers: getAuthHeaders() });
    return res.json();
  },
};
```

### 9. `client/src/App.tsx`
**Purpose**: Add "inventory" tab and render InventoryDashboard

**BEFORE** (line 59):
```typescript
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'accounts' | 'analytics' | 'bas' | 'tax' | 'gst' | 'transfers' | 'loans'>('dashboard');
```
**AFTER**:
```typescript
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'accounts' | 'analytics' | 'bas' | 'tax' | 'gst' | 'transfers' | 'loans' | 'inventory' | 'recon'>('dashboard');
```

- [ ] Add import: `import { InventoryDashboard } from './features/inventory/components/InventoryDashboard';`
- [ ] Add tab rendering: `{activeTab === 'inventory' && <InventoryDashboard />}`
- [ ] Add "Inventory" button to the desktop sidebar/nav (find the nav items array and add `{ id: 'inventory', label: 'Inventory', icon: Package }`)
- [ ] Import `Package` from lucide-react

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 7 component files exist and export default or named components
- [ ] `inventoryApi` object in api.ts has all 12 methods
- [ ] App.tsx includes 'inventory' in the TabId union
- [ ] InventoryDashboard renders without errors when the inventory tab is active
- [ ] Create marker file: `.agent-done-W11-08`

## Dependencies
- **Agent 7** (API endpoints must exist for client calls)
- **Reuses**: api.ts (BASE_URL, getAuthHeaders), App.tsx (tab system), BottomNavigation.tsx (TabId), Tailwind/neumorphic classes, lucide-react icons
