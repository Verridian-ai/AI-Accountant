# Agent 8: Responsive Pages Builder

## Role
Update ALL existing page components for responsive breakpoints. Ensure touch targets >= 44px on mobile. Test and verify at 375px (iPhone SE), 768px (iPad), and 1024px (desktop).

## Priority: WAVE 24 (After Agents 2, 3)

## Wait Condition
Check for `.agent-done-W24-02` and `.agent-done-W24-03` marker files before starting.

## Files to MODIFY

### General Responsive Patterns to Apply:

```
- Grid layouts: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
- Padding: p-3 sm:p-4 lg:p-6
- Font sizes: text-sm sm:text-base for body, text-lg sm:text-xl for headings
- Tables: overflow-x-auto with min-w for scrollable tables on mobile
- Modals: full-screen on mobile (w-full h-full sm:w-auto sm:h-auto sm:max-w-lg)
- Touch targets: min-h-[44px] min-w-[44px] on all interactive elements
- Button spacing: gap-2 sm:gap-3 with adequate padding
```

### 1. `client/src/features/transactions/` (all transaction components)
- [ ] Transaction ledger table: horizontal scroll on mobile, sticky first column (description)
- [ ] Column visibility: hide less important columns (balance, GST) on mobile, show on desktop
- [ ] Row actions: swipe actions on mobile (edit, delete) instead of hover buttons
- [ ] Filter bar: collapsible on mobile, expanded on desktop
- [ ] Pagination: simplified (prev/next only) on mobile, full on desktop
- [ ] Touch: row tap opens detail, long-press for actions

### 2. `client/src/features/accounts/components/AccountManager.tsx`
- [ ] Account cards: 1 column on mobile, 2 on tablet, 3 on desktop
- [ ] Balance text: `text-lg sm:text-2xl`
- [ ] Action buttons: icon-only on mobile, icon+text on desktop
- [ ] Account switcher: full-width dropdown on mobile, inline tabs on desktop

### 3. `client/src/features/analytics/components/AnalyticsDashboard.tsx`
- [ ] KPI cards: 2 per row on mobile, 4 per row on desktop
- [ ] Charts: full-width on mobile with reduced height (200px), normal on desktop (300px)
- [ ] Period selector: dropdown on mobile, button group on desktop
- [ ] Chart container titles: `text-sm sm:text-base`

### 4. `client/src/features/bas/components/BASDashboard.tsx`
- [ ] BAS form fields: single column on mobile, 2-column on tablet, 3-column on desktop
- [ ] BAS line items table: horizontal scroll with sticky first column
- [ ] Summary cards: stacked on mobile, side-by-side on desktop

### 5. `client/src/features/bas/components/BASComparison.tsx`
- [ ] Comparison view: stacked vertically on mobile, side-by-side on desktop
- [ ] Period selector: dropdown on mobile, button group on desktop

### 6. `client/src/features/gst/components/GSTPage.tsx`
- [ ] GST category cards: 2 per row on mobile, 4 on desktop
- [ ] GST table: horizontal scroll on mobile
- [ ] Filter controls: collapsible accordion on mobile

### 7. `client/src/features/tax/components/TaxDashboard.tsx`
- [ ] Entity tabs: scrollable horizontal tabs on mobile, full tab bar on desktop
- [ ] Tax summary cards: stacked on mobile, grid on desktop
- [ ] Deduction table: horizontal scroll on mobile

### 8. `client/src/features/chat/` (chat components)
- [ ] Chat interface: full-screen on mobile
- [ ] Message input: sticky at bottom with safe-area padding
- [ ] Message bubbles: max-width 90% on mobile, 70% on desktop

### 9. `client/src/features/loans/` (loan components)
- [ ] Calculator inputs: single column on mobile, 2-column on desktop
- [ ] Results: stacked cards on mobile, side-by-side comparison on desktop
- [ ] Sliders: full-width with touch-friendly thumb (44px)

### 10. `client/src/features/settings/` (settings components, if exists)
- [ ] Settings page: single-column form on mobile
- [ ] Toggle switches: right-aligned, 44px touch target

### 11. `client/src/features/statements/` (statement import)
- [ ] Upload area: larger touch target on mobile (full-width, 120px height)
- [ ] File list: simplified on mobile (name + status only)
- [ ] Progress bars: full-width on mobile

### 12. All modal/dialog components across features
- [ ] Mobile: full-screen modals (`fixed inset-0` instead of centered)
- [ ] Desktop: centered with max-width
- [ ] Close button: top-right, 44px touch target
- [ ] Form buttons: full-width on mobile, auto-width on desktop

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] **375px (iPhone SE)**: All pages render without horizontal overflow
- [ ] **375px**: All touch targets >= 44px x 44px
- [ ] **375px**: Tables scroll horizontally with sticky first column
- [ ] **375px**: Modals are full-screen
- [ ] **375px**: No text truncation that loses meaning
- [ ] **768px (iPad)**: Sidebar collapsed, 2-column grids
- [ ] **768px**: Charts at medium size, tables show more columns
- [ ] **1024px (Desktop)**: Full sidebar, 3-4 column grids, all features visible
- [ ] No layout shifts during viewport resize
- [ ] Font sizes appropriate at each breakpoint (readable on mobile, not oversized on desktop)
- [ ] Create marker file: `.agent-done-W24-08`

## Dependencies
- **Requires**: Agent 2 (`.agent-done-W24-02`) for AppShell layout, Agent 3 (`.agent-done-W24-03`) for router
- **Reuses**: Existing Tailwind responsive utilities (sm:, md:, lg:, xl:)
- **IMPORTANT**: This agent modifies many files -- coordinate to avoid conflicts with other agents
