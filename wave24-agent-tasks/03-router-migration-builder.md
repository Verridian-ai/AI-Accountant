# Agent 3: Router Migration Builder

## Role
Install react-router-dom and replace the current tab-based navigation with URL routes. Map all 15+ feature pages to URL paths. Support deep linking and browser history navigation.

## Priority: WAVE 24 (After Agent 2)

## Wait Condition
Check for `.agent-done-W24-02` marker file before starting.

## Files to MODIFY

### 1. `client/package.json`
- [ ] Add dependency: `react-router-dom@^7.0`

### 2. `client/src/App.tsx`
**Current state**: Tab-based navigation with state-driven page switching (e.g., `activeTab === 'transactions'`)

- [ ] Wrap app in `<BrowserRouter>` (or `<HashRouter>` if server doesn't support fallback)
- [ ] Replace tab-based conditional rendering with `<Routes>` and `<Route>` components
- [ ] Route mapping:

  ```typescript
  // Dashboard
  <Route path="/" element={<AnalyticsDashboard />} />
  <Route path="/dashboards" element={<DashboardGrid />} />
  <Route path="/dashboards/:id" element={<CustomDashboard />} />

  // Transactions
  <Route path="/transactions" element={<TransactionLedger />} />
  <Route path="/transactions/import" element={<StatementImport />} />
  <Route path="/transactions/categories" element={<CategoryManager />} />

  // Accounts
  <Route path="/accounts" element={<AccountManager />} />
  <Route path="/accounts/transfers" element={<TransferView />} />

  // Tax & BAS
  <Route path="/tax" element={<TaxDashboard />} />
  <Route path="/tax/returns/:entityType" element={<TaxReturnDetail />} />
  <Route path="/bas" element={<BASDashboard />} />
  <Route path="/bas/comparison" element={<BASComparison />} />
  <Route path="/gst" element={<GSTPage />} />

  // Analytics
  <Route path="/analytics" element={<AnalyticsDashboard />} />
  <Route path="/analytics/budget" element={<BudgetVsActual />} />
  <Route path="/analytics/forecast" element={<ForecastDashboard />} />
  <Route path="/analytics/flow" element={<MoneyFlowSankey />} />
  <Route path="/analytics/market" element={<MarketDashboard />} />

  // AI
  <Route path="/chat" element={<ChatPage />} />
  <Route path="/streaming" element={<StreamingChat />} />
  <Route path="/migration" element={<MigrationDashboard />} />

  // Loans
  <Route path="/loans" element={<LoanCalculator />} />

  // Settings
  <Route path="/settings" element={<TenantSettings />} />
  <Route path="/settings/members" element={<MemberManager />} />
  <Route path="/settings/permissions" element={<PermissionMatrix />} />
  <Route path="/settings/subscription" element={<SubscriptionPage />} />
  <Route path="/settings/notifications" element={<NotificationPreferences />} />

  // Auth
  <Route path="/login" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/invite/:token" element={<InvitationAccept />} />

  // Catch-all
  <Route path="*" element={<Navigate to="/" replace />} />
  ```

- [ ] Remove all `useState` for `activeTab` and tab switching logic
- [ ] Remove old tab-rendering conditional blocks

### 3. `client/src/components/layout/SidebarNavigation.tsx`
- [ ] Replace `onClick` handlers that set `activeTab` state with `<NavLink>` components from react-router-dom
- [ ] Use `NavLink`'s `className` callback for active styling:
  ```typescript
  <NavLink
    to="/transactions"
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${
        isActive ? 'text-gold border-l-4 border-gold neu-raised' : 'text-gray-400 hover:text-white'
      }`
    }
  >
  ```

### 4. `client/src/components/layout/MobileNavigation.tsx`
- [ ] Replace tab switching with `<NavLink>` components
- [ ] Active state detection via react-router

### 5. `client/src/components/layout/NavigationDrawer.tsx`
- [ ] Replace all navigation items with `<NavLink>` components
- [ ] Close drawer on navigation (use `useNavigate` or `NavLink` onClick)

### 6. `client/src/components/layout/HeaderBar.tsx`
- [ ] Use `useLocation()` to determine current page title for mobile header
- [ ] Map pathname to human-readable title: `/transactions` -> "Transactions", `/tax` -> "Tax Dashboard"

## Files to CREATE

### 7. `client/src/routes.tsx`
**Purpose**: Centralized route configuration

```typescript
export interface RouteConfig {
  path: string;
  label: string;
  icon: string;
  component: React.LazyComponentType;
  section: 'dashboard' | 'transactions' | 'accounts' | 'tax' | 'analytics' | 'ai' | 'settings';
  requiresAuth?: boolean;
  requiredPermission?: string;
}

export const routes: RouteConfig[] = [
  { path: '/', label: 'Dashboard', icon: 'home', component: lazy(() => import('./features/analytics/components/AnalyticsDashboard')), section: 'dashboard' },
  // ... all routes
];
```

- [ ] Export route configuration array used by both sidebar and mobile navigation
- [ ] Lazy loading: use `React.lazy()` for all page components to reduce initial bundle
- [ ] Include metadata: path, label, icon, section, auth requirement, permission

### 8. `client/src/hooks/usePageTitle.ts`
**Purpose**: Hook to set document title based on current route

- [ ] Uses `useLocation()` to detect route changes
- [ ] Sets `document.title` to "GoldLedger - [Page Name]"
- [ ] Returns current page title for use in header

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] All 15+ routes resolve to correct page components
- [ ] Browser back/forward buttons navigate between pages
- [ ] Deep linking works: navigating directly to `/tax/returns/sole-trader` loads correct page
- [ ] Active state in sidebar matches current URL path
- [ ] Active state in mobile bottom nav matches current URL path
- [ ] `<Navigate to="/" />` redirects unknown paths to dashboard
- [ ] Lazy loading: pages load on-demand (verify with network tab)
- [ ] No remaining `activeTab` state or tab-switching logic
- [ ] Document title updates on navigation
- [ ] Create marker file: `.agent-done-W24-03`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W24-02`) for AppShell, SidebarNavigation, MobileNavigation
- **IMPORTANT**: This agent has exclusive rights to modify App.tsx routing logic in Wave 24
