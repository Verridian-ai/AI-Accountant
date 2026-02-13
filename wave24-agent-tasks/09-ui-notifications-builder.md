# Agent 9: UI Notifications Builder

## Role
Build 6 React components: NotificationCenter (bell icon), NotificationPreferences, PushPermissionPrompt for push notifications, and OfflineIndicator, SyncStatus, ConflictResolver for offline support.

## Priority: WAVE 24 (After Agents 6, 7)

## Wait Condition
Check for `.agent-done-W24-06` and `.agent-done-W24-07` marker files before starting.

## Files to CREATE

### Push Notification Components (3):

### 1. `client/src/features/notifications/components/NotificationCenter.tsx`
**Purpose**: Bell icon in header with notification dropdown panel
**Pattern**: Neumorphic dark theme, gold accents

- [ ] Bell icon in HeaderBar: gold badge with unread count
- [ ] Click opens dropdown panel (slide-down on mobile, dropdown on desktop)
- [ ] Notification list: grouped by date (Today, Yesterday, Earlier)
- [ ] Each notification: icon (by category), title, body, timestamp, read/unread indicator
- [ ] Click notification: navigate to relevant page (e.g., transaction detail, BAS page)
- [ ] Mark all as read button (gold text)
- [ ] Clear all button (with confirmation)
- [ ] Empty state: "No notifications yet" with bell icon
- [ ] Real-time: listen for push events and add to list immediately
- [ ] Unread count stored in localStorage for persistence

### 2. `client/src/features/notifications/components/NotificationPreferences.tsx`
**Purpose**: Settings page for configuring notification categories and thresholds

- [ ] Fetch from `GET /api/notifications/preferences`
- [ ] Save to `PUT /api/notifications/preferences`
- [ ] Toggle switches for each category:
  - Transaction Alerts (large/unusual transactions)
  - BAS Reminders (approaching due dates)
  - Budget Alerts (over-budget categories)
  - Tax Reminders (deadlines, lodgement)
  - Bill Reminders (recurring bill due dates)
  - Sync Notifications (offline sync completed)
  - Team Notifications (member changes)
  - System Notifications (maintenance, updates)
- [ ] Threshold inputs:
  - Large transaction threshold: dollar amount input with slider ($100 - $10,000)
  - Budget alert threshold: percentage slider (50% - 100%)
- [ ] Quiet hours: time pickers for start and end (default 10pm - 7am)
- [ ] Delivery method: Push toggle, Email toggle
- [ ] "Test Notification" button: sends test push to verify setup
- [ ] Save button: `PUT /api/notifications/preferences`

### 3. `client/src/features/notifications/components/PushPermissionPrompt.tsx`
**Purpose**: User-friendly prompt for requesting push notification permission

- [ ] Triggered when: user first visits notifications page, or on first login
- [ ] Only shown if `Notification.permission === 'default'` (not yet asked)
- [ ] UI: neu-raised card with:
  - Bell icon
  - "Enable Push Notifications"
  - Description: "Get alerts for large transactions, BAS deadlines, and budget warnings"
  - "Enable" button (gold) -- calls `Notification.requestPermission()` then `pushManager.subscribe()`
  - "Not now" link (gray) -- dismisses for 30 days (localStorage)
- [ ] On permission granted: subscribe to push via `POST /api/push/subscribe`
- [ ] On permission denied: show "Notifications blocked" with instructions to enable in browser settings
- [ ] Pass VAPID public key from `GET /api/push/vapid-key` to subscription

### Offline Components (3):

### 4. `client/src/features/offline/components/OfflineIndicator.tsx`
**Purpose**: Global indicator showing online/offline status

- [ ] Uses `useOffline()` hook from Agent 6
- [ ] Online: hidden (no indicator shown)
- [ ] Offline: gold banner at top of app: "You're offline. Changes will sync when connected."
- [ ] Reconnecting: pulsing gold banner: "Reconnecting..."
- [ ] Syncing: gold progress bar: "Syncing X changes..."
- [ ] Position: below header bar, full-width
- [ ] Dismissible but returns if still offline
- [ ] Animate in/out with slide-down/up

### 5. `client/src/features/offline/components/SyncStatus.tsx`
**Purpose**: Detailed sync status panel in settings area

- [ ] Props: none (uses hooks internally)
- [ ] Shows:
  - Connectivity status: Online/Offline with colored dot
  - Pending changes count with breakdown by type (create/update/delete)
  - Last successful sync timestamp
  - Sync queue list: each pending operation with resource type, timestamp, status badge
  - Sync errors: list of failed operations with error messages and retry button
- [ ] "Sync Now" button: triggers manual sync
- [ ] "Clear Queue" button: discards all pending changes (with confirmation warning)
- [ ] Auto-refresh every 5 seconds while visible

### 6. `client/src/features/offline/components/ConflictResolver.tsx`
**Purpose**: UI for resolving sync conflicts between offline and server changes

- [ ] Shows when conflicts exist (badge on Sync Status)
- [ ] For each conflict:
  - Resource type and ID
  - Side-by-side diff: "Your change" (left, gold border) vs "Server version" (right, blue border)
  - Highlight differences in field values
  - Timestamps: when each version was created
  - Resolution buttons:
    - "Keep Mine" (gold button) -- client_wins
    - "Use Server" (gray button) -- server_wins
    - "Merge" (if applicable) -- opens merge editor
  - [ ] Calls `POST /api/sync/resolve/:conflictId` with resolution strategy
- [ ] Batch resolution: "Keep All Mine" / "Use All Server" for multiple conflicts
- [ ] Progress: X of Y conflicts resolved

### Barrel Exports:

### 7. `client/src/features/notifications/index.ts`
- [ ] Export all 3 notification components

### 8. `client/src/features/offline/index.ts`
- [ ] Export all 3 offline components

## Files to MODIFY

### 9. `client/src/components/layout/HeaderBar.tsx`
- [ ] Add NotificationCenter bell icon to header (right side, before user avatar)
- [ ] Add OfflineIndicator below header bar

### 10. `client/src/App.tsx`
- [ ] Add OfflineIndicator at app level (always visible when offline)
- [ ] Add PushPermissionPrompt (shown once on first visit)
- [ ] Add routes for NotificationPreferences and SyncStatus under settings

### 11. `client/src/api.ts`
- [ ] Add API functions:
  - `fetchNotificationPreferences()`
  - `updateNotificationPreferences(prefs)`
  - `subscribePush(subscription, deviceName)`
  - `unsubscribePush(endpoint)`
  - `getVapidKey()`
  - `syncOfflineChanges(operations)`
  - `getSyncConflicts()`
  - `resolveSyncConflict(conflictId, resolution)`
  - `getSyncLog(limit, offset)`

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] NotificationCenter shows bell with unread count in header
- [ ] NotificationPreferences saves and loads all toggles and thresholds
- [ ] PushPermissionPrompt requests permission and subscribes on approval
- [ ] OfflineIndicator appears when browser goes offline, disappears when online
- [ ] SyncStatus shows correct pending count and sync history
- [ ] ConflictResolver shows side-by-side diff and resolves conflicts
- [ ] All components use neumorphic dark theme with gold accents
- [ ] Touch targets >= 44px on all interactive elements
- [ ] Create marker file: `.agent-done-W24-09`

## Dependencies
- **Requires**: Agent 6 (`.agent-done-W24-06`) for offline hooks and sync manager, Agent 7 (`.agent-done-W24-07`) for API endpoints
- **Reuses**: api.ts patterns, useOffline hook, HeaderBar, Tailwind neumorphic classes
