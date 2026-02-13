# Agent 8: UI Tenant & Subscription Builder

## Role
Build 5 React components for tenant management and 5 for subscription management. These form the organization settings and billing areas of the application.

## Priority: WAVE 23 (After Agent 7)

## Wait Condition
Check for `.agent-done-W23-07` marker file before starting.

## Files to CREATE

### Tenant Components (5):

### 1. `client/src/features/tenant/components/TenantSwitcher.tsx`
**Purpose**: Dropdown in header for switching between tenants
**Pattern**: Neumorphic dark theme, gold accents

- [ ] Positioned in top navigation bar
- [ ] Shows current tenant name + logo (or initial avatar)
- [ ] Dropdown: list of all user's tenants with role badge
- [ ] Click to switch: calls `POST /api/tenants/:id/switch`, updates JWT in local storage
- [ ] "Create New Workspace" option at bottom with plus icon
- [ ] Gold highlight on current tenant

### 2. `client/src/features/tenant/components/TenantSettings.tsx`
**Purpose**: Tenant configuration page (owner/admin only)

- [ ] Form fields: Name, slug (readonly after creation), ABN, entity type (dropdown), industry, financial year end, timezone
- [ ] Logo upload area (drag-drop or click)
- [ ] Save button: `PUT /api/tenants/:id`
- [ ] Danger zone: Deactivate tenant (red bordered section, confirmation dialog)
- [ ] Show if user lacks `settings.manage` permission: "You don't have permission to edit settings"

### 3. `client/src/features/tenant/components/MemberManager.tsx`
**Purpose**: Team member management page

- [ ] Member list table: name, email, role badge (colored), joined date, last active
- [ ] Role column: dropdown to change role (requires `members.manage`)
- [ ] Remove button (X) per member with confirmation dialog
- [ ] "Invite Member" button: opens invite modal
- [ ] Invite modal: email input, role dropdown, send button
- [ ] Pending invitations section: list with status, revoke button
- [ ] Role colors: owner=gold, admin=blue, accountant=green, bookkeeper=purple, viewer=gray

### 4. `client/src/features/tenant/components/PermissionMatrix.tsx`
**Purpose**: Visual permission matrix editor (owner only)

- [ ] Grid: rows = permissions (16), columns = roles (5)
- [ ] Each cell: checkbox (checked = granted)
- [ ] System permissions: locked checkbox (cannot be modified, grayed out)
- [ ] Custom permissions: editable checkboxes
- [ ] Save button: `PUT /api/tenants/:tenantId/permissions/:role` for each modified role
- [ ] Reset to defaults button with confirmation
- [ ] Color coding: green=granted, gray=denied, gold=system (immutable)

### 5. `client/src/features/tenant/components/TenantCreate.tsx`
**Purpose**: New tenant creation wizard

- [ ] Step 1: Business details (name, slug auto-generated from name, ABN optional)
- [ ] Step 2: Entity type selection (sole trader, company, trust, partnership, SMSF) with icon cards
- [ ] Step 3: Plan selection (embed PlanComparison component)
- [ ] Step 4: Confirmation and creation
- [ ] Progress indicator: 4 dots with gold active state
- [ ] `POST /api/tenants` on final step

### Subscription Components (5):

### 6. `client/src/features/subscription/components/PlanComparison.tsx`
**Purpose**: Side-by-side plan comparison card grid

- [ ] 4 plan cards in a row (responsive: 2x2 on tablet, 1 column on mobile)
- [ ] Each card: plan name, price (monthly/annual toggle), feature checklist, limits
- [ ] Current plan: gold border with "Current Plan" badge
- [ ] CTA button: "Upgrade" (for lower plans), "Downgrade" (for higher plans), "Current" (disabled)
- [ ] Annual billing shows discount: "Save 17%" badge
- [ ] Feature list with checkmarks (green) and X (gray) for each plan

### 7. `client/src/features/subscription/components/UsageDashboard.tsx`
**Purpose**: Current usage metrics with visual progress bars

- [ ] 5 usage meters (neu-inset cards):
  - Members: X of Y (progress bar)
  - Accounts: X of Y (progress bar)
  - Transactions this month: X of Y (progress bar)
  - AI Queries this month: X of Y (progress bar)
  - Storage: X MB of Y MB (progress bar)
- [ ] Progress bar color: green (<60%), gold (60-80%), red (>80%)
- [ ] Warning banner when any metric >90%: "You're approaching your [metric] limit. Upgrade for more."
- [ ] Fetch from `GET /api/tenants/:tenantId/subscription`

### 8. `client/src/features/subscription/components/BillingHistory.tsx`
**Purpose**: Subscription history and billing records

- [ ] Table: plan name, status badge, billing cycle, period start/end, amount
- [ ] Status colors: active=green, cancelled=red, trialing=gold, expired=gray
- [ ] Fetch from `GET /api/tenants/:tenantId/subscription` history

### 9. `client/src/features/subscription/components/UpgradePrompt.tsx`
**Purpose**: Contextual upgrade prompt shown when limits are hit

- [ ] Props: `metric: UsageMetric`, `current: number`, `limit: number`, `currentPlan: string`
- [ ] Shows: "You've reached your [metric] limit on the [plan] plan"
- [ ] CTA: "Upgrade to [next plan] for [new limit]"
- [ ] Dismissible but persists in session if not upgraded

### 10. `client/src/features/subscription/components/CancelConfirmation.tsx`
**Purpose**: Subscription cancellation flow

- [ ] Warning about what will happen at period end
- [ ] List of features that will be lost
- [ ] Retention offer: "Stay on [plan] and get 20% off next month"
- [ ] Confirm cancel button (red, requires typing "CANCEL" to confirm)
- [ ] Calls `DELETE /api/tenants/:tenantId/subscription`

### Barrel Exports:

### 11. `client/src/features/tenant/index.ts`
- [ ] Export all 5 tenant components

### 12. `client/src/features/subscription/index.ts`
- [ ] Export all 5 subscription components

## Files to MODIFY

### 13. `client/src/App.tsx`
- [ ] Add TenantSwitcher to header/navigation
- [ ] Add routes for: TenantSettings, MemberManager, PermissionMatrix, PlanComparison, UsageDashboard, BillingHistory

### 14. `client/src/api.ts`
- [ ] Add API functions for all tenant, member, permission, subscription, and auth endpoints (26 functions matching the 26 API routes from Agent 7)

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] TenantSwitcher renders in header with tenant list
- [ ] TenantSettings form saves changes
- [ ] MemberManager lists members with role management
- [ ] PermissionMatrix renders 16x5 grid correctly
- [ ] PlanComparison shows 4 plans with correct features
- [ ] UsageDashboard shows progress bars with correct percentages
- [ ] UpgradePrompt appears when limits are approaching
- [ ] All components use neumorphic dark theme with gold accents
- [ ] Create marker file: `.agent-done-W23-08`

## Dependencies
- **Requires**: Agent 7 (`.agent-done-W23-07`) for API endpoints
- **Reuses**: api.ts patterns, Tailwind neumorphic classes
