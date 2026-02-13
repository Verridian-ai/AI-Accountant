# Wave 24 — Mobile Responsive & PWA — Orchestration Prompt

You are the **Team Lead** for Wave 24: Mobile Responsive & PWA. You coordinate 10 specialized agents to make GoldLedger fully responsive on mobile/tablet devices and enable Progressive Web App features (offline support, push notifications, app-like install).

## Architecture References
- **Master plan**: `docs/wave0-master-plan.md`
- **Frontend research**: `wave0-research/R07-frontend-architecture.md`
- **Docker research**: `wave0-research/R09-docker-infrastructure.md`

## Current State (After Wave 23)
- 26 Claude agents
- Multi-tenant RBAC operational
- Recharts visualization library integrated
- Custom dashboards with drag-and-drop
- Tab-based navigation (15+ tabs via BottomNavigation)
- NO responsive design (desktop-only layout)
- NO PWA capabilities
- NO offline support
- 25 migrations (0009–0035) applied

## Dependencies
- **Requires**: Wave 22 (responsive charts), Wave 23 (tenant-aware auth for PWA)
- **Estimated Complexity**: MEDIUM-HIGH

## PWA Technical Stack
- **Service Worker**: Workbox (Google's PWA library, production-ready)
- **Manifest**: `manifest.json` for install prompt
- **Cache Strategy**: Cache-first for static assets, network-first for API
- **Push Notifications**: Web Push API + VAPID keys
- **Offline Storage**: IndexedDB via idb library for transaction cache

### Dependencies to Install
```json
{
  "workbox-webpack-plugin": "^7.0.0",
  "workbox-window": "^7.0.0",
  "idb": "^8.0.0",
  "web-push": "^3.6.0"
}
```

## Database Schema Changes

### New Tables (3 tables)
| Table | Columns |
|-------|---------|
| `push_subscriptions` | id, userId, tenantId, endpoint, p256dh, auth, userAgent, createdAt, lastUsed |
| `notification_preferences` | id, userId, notificationType (bill_due/pay_run/anomaly/compliance/rate_alert/insight), channel (push/email/in_app), isEnabled |
| `offline_sync_log` | id, userId, deviceId, action, entityType, entityId, payload (JSON), syncStatus (pending/synced/conflict), createdAt, syncedAt |

**Migration**: `docker/migrations/0036_mobile_pwa.sql`

## API Endpoints (12 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/push/subscribe | Register push subscription |
| DELETE | /api/push/subscribe | Unsubscribe from push |
| GET | /api/push/preferences | Get notification preferences |
| PATCH | /api/push/preferences | Update preferences |
| POST | /api/push/test | Send test notification |
| GET | /api/sync/pending | Get pending offline changes |
| POST | /api/sync/upload | Upload offline changes |
| POST | /api/sync/resolve | Resolve sync conflicts |
| GET | /api/sync/status | Sync status for device |
| GET | /api/manifest.json | Dynamic PWA manifest |
| GET | /api/offline/essential-data | Minimal data for offline mode |
| GET | /api/health/ping | Lightweight health check for service worker |

## UI Components

### Responsive Layout Overhaul
- **Navigation**: Replace BottomNavigation tabs with:
  - Desktop: Sidebar navigation (collapsible)
  - Tablet: Condensed sidebar with icons
  - Mobile: Bottom tab bar (top 5) + hamburger menu for rest
- **Install** react-router-dom for URL-based routing (replaces tab state)
- **Grid system**: Use Tailwind responsive breakpoints (sm/md/lg/xl)

### `client/src/components/layout/` — Updated
- AppShell.tsx — Responsive shell: sidebar (desktop) / bottom nav (mobile)
- SidebarNavigation.tsx — Desktop sidebar with collapsible groups
- MobileNavigation.tsx — Bottom tab bar with hamburger overflow
- ResponsiveContainer.tsx — Width-aware wrapper component
- InstallPrompt.tsx — PWA install banner

### `client/src/features/notifications/` — New feature folder
- NotificationCenter.tsx — In-app notification panel (bell icon)
- NotificationPreferences.tsx — Configure notification channels
- PushPermissionPrompt.tsx — Request push notification permission

### `client/src/features/offline/` — New feature folder
- OfflineIndicator.tsx — Banner showing offline status
- SyncStatus.tsx — Sync status with pending change count
- ConflictResolver.tsx — UI for resolving sync conflicts
- OfflineDataViewer.tsx — Browse cached data while offline

### PWA Files
- public/manifest.json — PWA manifest with GoldLedger branding
- public/service-worker.ts — Workbox service worker
- src/service-worker-registration.ts — Service worker registration

**Navigation**: Major restructure — tabs → sidebar + router

## New Claude Agents (0)
No new agents — this wave is purely frontend/infrastructure.

## Cognee Integration
- No new datasets
- Offline mode: Cache last search results in IndexedDB for offline chat

## Testing Criteria
- [ ] Desktop: Sidebar navigation at 1024px+
- [ ] Tablet: Condensed sidebar at 768–1023px
- [ ] Mobile: Bottom tab bar at <768px
- [ ] All pages render correctly at 375px width (iPhone SE)
- [ ] Touch targets ≥44px on mobile
- [ ] PWA installable (passes Lighthouse PWA audit)
- [ ] Service worker caches static assets
- [ ] Offline mode shows cached transactions
- [ ] Push notification delivered within 5 seconds
- [ ] Offline changes sync correctly when back online
- [ ] Sync conflict resolution UI works
- [ ] URL routing works for all pages (deep linking)
- [ ] React Router history navigation (back/forward) works
- [ ] `cd client && npx tsc --noEmit` passes clean

## Team Structure — 10 Agents

### Agent 1: pwa-schema-builder [PRIORITY: WAVE 1]
**Task file**: `wave24-agent-tasks/01-pwa-schema-builder.md`

### Agent 2: responsive-layout-builder [PRIORITY: WAVE 1]
**Task file**: `wave24-agent-tasks/02-responsive-layout-builder.md`
**Creates**: AppShell, SidebarNavigation, MobileNavigation

### Agent 3: router-migration-builder [PRIORITY: WAVE 1]
**Task file**: `wave24-agent-tasks/03-router-migration-builder.md`
**Role**: Replace tab-based nav with react-router-dom

### Agent 4: service-worker-builder [DEPENDS ON: Agent 1]
**Task file**: `wave24-agent-tasks/04-service-worker-builder.md`
**Creates**: Service worker + manifest + registration

### Agent 5: push-notification-builder [DEPENDS ON: Agent 1]
**Task file**: `wave24-agent-tasks/05-push-notification-builder.md`
**Creates**: server/src/services/push-notifications.ts

### Agent 6: offline-sync-builder [DEPENDS ON: Agents 4, 5]
**Task file**: `wave24-agent-tasks/06-offline-sync-builder.md`
**Creates**: server/src/services/offline-sync.ts, client offline features

### Agent 7: api-endpoints-builder [DEPENDS ON: Agents 5, 6]
**Task file**: `wave24-agent-tasks/07-api-endpoints-builder.md`

### Agent 8: responsive-pages-builder [DEPENDS ON: Agents 2, 3]
**Task file**: `wave24-agent-tasks/08-responsive-pages-builder.md`
**Role**: Update ALL existing pages for responsive breakpoints

### Agent 9: ui-notifications-builder [DEPENDS ON: Agent 7]
**Task file**: `wave24-agent-tasks/09-ui-notifications-builder.md`

### Agent 10: testing-validation-agent [DEPENDS ON: All]
**Task file**: `wave24-agent-tasks/10-testing-validation-agent.md`

## Execution Priority Order

```
Sub-wave 1 (Parallel): Agent 1 + Agent 2 + Agent 3
Sub-wave 2 (After 1):  Agent 4 + Agent 5
Sub-wave 3 (After 2):  Agent 6 + Agent 8
Sub-wave 4 (After 3):  Agent 7
Sub-wave 5 (After 4):  Agent 9
Sub-wave 6 (After 5):  Agent 10
```

## START THE TEAM NOW

Spawn all 10 teammates. Read each agent's task file from `wave24-agent-tasks/`.
