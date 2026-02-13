# Agent 10: Testing & Validation Agent

## Role
Run the full verification plan for Wave 24 (Mobile Responsive & PWA). Validate responsive design at 375/768/1024px, PWA installability (Lighthouse), offline mode, and push notification delivery.

## Priority: WAVE 24 FINAL (After ALL Wave 24 agents complete)

## Wait Condition
Check for ALL marker files: `.agent-done-W24-01` through `.agent-done-W24-09` before starting.

## Verification Tasks

### 1. Compilation
- [ ] Run `cd server && npx tsc --noEmit` (zero errors)
- [ ] Run `cd client && npx tsc --noEmit` (zero errors)
- [ ] Run `docker compose config` (validates)

### 2. Schema & Migration
- [ ] Run migration 0036 against PostgreSQL:
  ```bash
  docker compose exec postgres psql -U app_user -d ai_accountant -f /docker-entrypoint-initdb.d/0036_pwa_support.sql
  ```
- [ ] Verify 3 new tables exist: `push_subscriptions`, `notification_preferences`, `offline_sync_log`
- [ ] Verify unique constraints and FK cascades

### 3. Responsive Design — 375px (iPhone SE)
- [ ] **Layout**: MobileNavigation visible at bottom, no sidebar
- [ ] **All pages**: No horizontal overflow, no content clipped
- [ ] **Touch targets**: ALL interactive elements >= 44px x 44px:
  - Buttons, links, checkboxes, radio buttons, toggles, dropdown triggers
  - Table row actions, navigation items, close buttons
- [ ] **Tables**: Horizontal scroll with sticky first column
- [ ] **Modals**: Full-screen on mobile
- [ ] **Charts**: Full-width, appropriate height (200-250px)
- [ ] **Text**: Readable without zooming (min 14px body text)
- [ ] **Forms**: Full-width inputs, appropriate spacing

### 4. Responsive Design — 768px (iPad)
- [ ] **Layout**: Collapsed sidebar (icons only), no bottom navigation
- [ ] **Grids**: 2-column layouts where appropriate
- [ ] **Tables**: More columns visible than mobile
- [ ] **Charts**: Medium size (250-300px height)
- [ ] **Modals**: Centered with max-width, not full-screen

### 5. Responsive Design — 1024px (Desktop)
- [ ] **Layout**: Expanded sidebar with labels, no bottom navigation
- [ ] **Grids**: 3-4 column layouts
- [ ] **Tables**: All columns visible
- [ ] **Charts**: Full size (300-400px height)
- [ ] **Modals**: Centered with appropriate max-width

### 6. URL Routing
- [ ] All 15+ routes resolve to correct page components:
  - `/` -> Dashboard
  - `/transactions` -> Transaction Ledger
  - `/accounts` -> Account Manager
  - `/tax` -> Tax Dashboard
  - `/bas` -> BAS Dashboard
  - `/gst` -> GST Page
  - `/analytics` -> Analytics Dashboard
  - `/analytics/flow` -> Money Flow Sankey
  - `/chat` -> Chat Page
  - `/loans` -> Loan Calculator
  - `/settings` -> Tenant Settings
  - and all others
- [ ] Browser back/forward navigation works
- [ ] Deep linking: direct URL access loads correct page
- [ ] Unknown routes redirect to `/`

### 7. PWA — Installability
- [ ] Manifest served correctly at `/manifest.json`
- [ ] Service worker registered and active
- [ ] Run Lighthouse PWA audit:
  ```bash
  npx lighthouse http://localhost:8080 --only-categories=pwa --output=json
  ```
- [ ] Lighthouse PWA score >= 90
- [ ] Install prompt appears on first visit (eligible browsers)
- [ ] App installs to home screen with correct name and icon

### 8. PWA — Offline Mode
- [ ] Disconnect network (DevTools > Network > Offline)
- [ ] Cached pages load from service worker cache
- [ ] Uncached pages show offline fallback page
- [ ] API GET requests serve cached data
- [ ] API POST requests queued in sync queue
- [ ] OfflineIndicator banner appears: "You're offline"
- [ ] Reconnect: sync queue processes, indicator disappears
- [ ] SyncStatus shows correct pending count during offline period

### 9. Push Notifications
- [ ] VAPID public key served from `GET /api/push/vapid-key`
- [ ] PushPermissionPrompt shows on first visit
- [ ] Granting permission creates subscription in database
- [ ] Test notification delivered to browser:
  ```bash
  curl -X POST http://localhost:3501/api/push/test \
    -H "Content-Type: application/json" \
    -H "X-Tenant-Id: [tenant]" \
    -d '{"title":"Test","body":"Push works!"}'
  ```
- [ ] Notification preferences: disabling category prevents delivery
- [ ] Quiet hours: notifications not delivered during configured quiet period

### 10. Offline Sync & Conflict Resolution
- [ ] Create transaction while offline
- [ ] Edit same transaction on server while still offline
- [ ] Reconnect: conflict detected
- [ ] ConflictResolver shows side-by-side diff
- [ ] "Keep Mine" resolves with client version
- [ ] "Use Server" resolves with server version
- [ ] Sync log records all operations

### 11. Notification Components
- [ ] NotificationCenter bell icon shows unread count
- [ ] NotificationPreferences saves all toggles
- [ ] PushPermissionPrompt handles grant and deny correctly
- [ ] All components match neumorphic dark theme

### 12. Generate Verification Report
```
GOLDLEDGER WAVE 24 VERIFICATION REPORT
=======================================
Date: [timestamp]
Schema:          [PASS/FAIL] - 3 tables, indexes, FK cascades
Responsive 375px:[PASS/FAIL] - Mobile layout, touch targets, no overflow
Responsive 768px:[PASS/FAIL] - Tablet layout, collapsed sidebar
Responsive 1024px:[PASS/FAIL] - Desktop layout, full sidebar
URL Routing:     [PASS/FAIL] - 15+ routes, deep linking, history
PWA Install:     [PASS/FAIL] - Manifest, SW, Lighthouse >= 90
PWA Offline:     [PASS/FAIL] - Cached pages, sync queue, fallback
Push Notifs:     [PASS/FAIL] - Subscribe, deliver, preferences
Offline Sync:    [PASS/FAIL] - Queue, sync, conflict resolution
Notifications UI:[PASS/FAIL] - Bell, preferences, permission prompt
Offline UI:      [PASS/FAIL] - Indicator, sync status, resolver
API Endpoints:   [PASS/FAIL] - 12 routes accessible
Build:           [PASS/FAIL] - Server + Client + Docker clean
```

- [ ] Create marker file: `.agent-done-W24-10`

## Dependencies
- **Requires**: ALL Wave 24 agents (`.agent-done-W24-01` through `.agent-done-W24-09`)
- **Docker must be running**: `docker compose up -d`
- **Browser required**: Chrome or Edge for PWA testing
