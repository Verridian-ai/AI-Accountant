# Agent 2: Responsive Layout Builder

## Role
Build the responsive application shell with AppShell.tsx (responsive wrapper), SidebarNavigation.tsx (desktop), and MobileNavigation.tsx (bottom tabs). These replace/augment the existing BottomNavigation.tsx.

## Priority: WAVE 24 (Start Immediately)

## Files to CREATE

### 1. `client/src/components/layout/AppShell.tsx`
**Purpose**: Responsive application wrapper that switches between desktop sidebar and mobile bottom nav
**Pattern**: Neumorphic dark theme, gold accents

- [ ] Detects viewport size using Tailwind breakpoints and `window.matchMedia`:
  - Mobile: < 768px (md breakpoint) -- bottom navigation, no sidebar
  - Tablet: 768px - 1023px -- collapsible sidebar (icons only), no bottom nav
  - Desktop: >= 1024px (lg breakpoint) -- full sidebar with labels, no bottom nav
- [ ] Layout structure:
  ```tsx
  <div className="flex h-screen bg-gray-900">
    {/* Desktop/Tablet: Sidebar */}
    {!isMobile && <SidebarNavigation collapsed={isTablet} />}

    {/* Main Content */}
    <main className="flex-1 overflow-auto">
      {/* Header bar: tenant switcher, search, notifications */}
      <header className="sticky top-0 z-10 neu-raised">...</header>

      {/* Page content with padding */}
      <div className="p-4 md:p-6 lg:p-8">
        {children}
      </div>
    </main>

    {/* Mobile: Bottom navigation */}
    {isMobile && <MobileNavigation />}
  </div>
  ```
- [ ] Smooth transition between layouts (no flash)
- [ ] Persist sidebar collapsed state in localStorage

### 2. `client/src/components/layout/SidebarNavigation.tsx`
**Purpose**: Desktop/tablet sidebar navigation with collapsible sections

- [ ] Props: `collapsed?: boolean` (icons only when true)
- [ ] Logo area at top: GoldLedger logo + name (hidden when collapsed)
- [ ] Navigation sections (collapsible groups):
  - **Dashboard**: Home, Custom Dashboards
  - **Transactions**: Ledger, Import Statements, Categories
  - **Accounts**: Account Manager, Transfers
  - **Tax & BAS**: Tax Dashboard, BAS Dashboard, GST, Tax Returns
  - **Analytics**: Overview, Budget vs Actual, Forecasts, Money Flow, Market
  - **AI**: Chat, Streaming, Migration Dashboard
  - **Settings**: Tenant Settings, Members, Permissions, Subscription, Notifications
- [ ] Each item: icon (24px), label (hidden when collapsed), active indicator (gold left border)
- [ ] Section headers: uppercase, gray-500, 12px font
- [ ] Hover: neu-raised effect on item
- [ ] Active: gold text + gold left border (4px)
- [ ] Collapse toggle button at bottom: chevron icon
- [ ] Width: 256px expanded, 64px collapsed
- [ ] Transition: 200ms ease for width change

### 3. `client/src/components/layout/MobileNavigation.tsx`
**Purpose**: Bottom tab bar for mobile devices (replaces/extends existing BottomNavigation.tsx)
**Reference**: Existing `client/src/components/layout/BottomNavigation.tsx`

- [ ] Fixed at bottom: 64px height, safe-area-inset-bottom padding for iOS
- [ ] 5 primary tabs (most important features for mobile):
  - Dashboard (home icon)
  - Transactions (list icon)
  - Scan (camera icon, prominent gold circle) -- quick statement upload
  - Analytics (chart icon)
  - More (menu icon) -- opens full navigation drawer
- [ ] Active tab: gold icon + gold label, inactive: gray-400
- [ ] "More" opens a slide-up drawer with all remaining navigation items
- [ ] Touch targets: minimum 44px x 44px per Apple HIG
- [ ] Haptic feedback on tab switch (if supported)
- [ ] Safe area padding: `pb-safe` for notched devices

### 4. `client/src/components/layout/NavigationDrawer.tsx`
**Purpose**: Full navigation drawer opened from "More" tab on mobile

- [ ] Slide-up from bottom (80% height)
- [ ] All navigation items grouped by section (same as sidebar)
- [ ] Handle bar at top for drag-to-dismiss
- [ ] Backdrop overlay (semi-transparent)
- [ ] Close on: backdrop tap, swipe down, item selection
- [ ] Smooth spring animation (200ms)

### 5. `client/src/components/layout/HeaderBar.tsx`
**Purpose**: Top header bar with common actions

- [ ] Desktop: TenantSwitcher (left), Search (center), NotificationBell + UserAvatar (right)
- [ ] Mobile: Hamburger/logo (left), Page title (center), NotificationBell (right)
- [ ] Sticky positioning: stays at top during scroll
- [ ] Neu-raised background with gold bottom border (1px)

## Files to MODIFY

### 6. `client/src/components/layout/BottomNavigation.tsx`
- [ ] Mark as deprecated with comment pointing to `MobileNavigation.tsx`
- [ ] Keep for backward compatibility during migration

### 7. `client/src/App.tsx`
- [ ] Wrap entire app in `<AppShell>` component
- [ ] Remove direct usage of BottomNavigation (AppShell handles it)

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] At 375px: MobileNavigation shows bottom tabs, no sidebar visible
- [ ] At 768px: SidebarNavigation shows collapsed (icons only), no bottom tabs
- [ ] At 1024px: SidebarNavigation shows expanded with labels
- [ ] Sidebar collapse/expand animates smoothly
- [ ] "More" drawer slides up and shows all navigation items
- [ ] Touch targets >= 44px on all mobile interactive elements
- [ ] Safe area padding works on notched device viewports
- [ ] Create marker file: `.agent-done-W24-02`

## Dependencies
- **None** -- can start immediately
- **Reuses**: Existing BottomNavigation patterns, Tailwind config, neumorphic classes
