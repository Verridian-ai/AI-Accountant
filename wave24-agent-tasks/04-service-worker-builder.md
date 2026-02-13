# Agent 4: Service Worker Builder

## Role
Build the Workbox-powered service worker, web app manifest, and install prompt for Progressive Web App (PWA) functionality. Implement cache strategies for static assets and API responses.

## Priority: WAVE 24 (Start Immediately)

## Files to CREATE

### 1. `client/public/manifest.json`
**Purpose**: Web App Manifest for PWA installation

```json
{
  "name": "GoldLedger - AI Accounting",
  "short_name": "GoldLedger",
  "description": "AI-powered Australian accounting and bookkeeping platform",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#111827",
  "theme_color": "#FFCC00",
  "categories": ["finance", "business", "productivity"],
  "icons": [
    { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "screenshots": [],
  "prefer_related_applications": false
}
```

- [ ] Create manifest with correct dark theme colors (bg=#111827, theme=#FFCC00)
- [ ] Include all required icon sizes

### 2. `client/public/sw.js` (or `client/src/sw.ts` for Workbox build)
**Purpose**: Service worker with Workbox caching strategies

- [ ] **Cache-first** for static assets (immutable after build):
  - `*.js`, `*.css`, `*.woff2`, `*.png`, `*.svg`
  - Cache name: `static-assets-v1`
  - Max entries: 200
  - Max age: 30 days

- [ ] **Network-first** for API responses (prefer fresh data):
  - `/api/transactions*`, `/api/accounts*`, `/api/bas*`, `/api/tax*`
  - Cache name: `api-cache-v1`
  - Network timeout: 3 seconds (fall back to cache)
  - Max entries: 100
  - Max age: 1 hour

- [ ] **Stale-while-revalidate** for semi-static data:
  - `/api/economic/*`, `/api/subscriptions/plans`
  - Cache name: `semi-static-v1`
  - Max age: 24 hours

- [ ] **Network-only** (never cache):
  - `/api/auth/*`, `/api/stream/*`, `/api/chat`
  - POST/PUT/DELETE requests

- [ ] **Offline fallback page**: `/offline.html` served when network unavailable and no cache hit
- [ ] **Background sync**: Queue failed POST/PUT/DELETE requests for retry when online
- [ ] **Cache cleanup**: on service worker activation, delete old cache versions

### 3. `client/public/offline.html`
**Purpose**: Offline fallback page shown when no cached version available

- [ ] Dark theme matching app (bg=#111827)
- [ ] GoldLedger logo
- [ ] Message: "You're offline. Some features are available from cache."
- [ ] List of cached pages (if any)
- [ ] "Try again" button that calls `location.reload()`
- [ ] Inline CSS (no external dependencies)

### 4. `client/src/components/pwa/InstallPrompt.tsx`
**Purpose**: PWA install prompt component

- [ ] Listens for `beforeinstallprompt` event
- [ ] Shows banner at top of screen: "Install GoldLedger for faster access" with Install button
- [ ] Dismissible (stores dismissal in localStorage, doesn't show again for 7 days)
- [ ] Only shows if not already installed (`window.matchMedia('(display-mode: standalone)')`)
- [ ] Gold install button, dark background banner
- [ ] Call `deferredPrompt.prompt()` on install click

### 5. `client/src/components/pwa/UpdatePrompt.tsx`
**Purpose**: Prompt when new service worker version available

- [ ] Listens for service worker `updatefound` and `controllerchange` events
- [ ] Shows banner: "A new version is available" with "Update Now" button
- [ ] "Update Now" calls `registration.waiting.postMessage({ type: 'SKIP_WAITING' })` then reloads
- [ ] Neu-raised banner with gold CTA button

### 6. `client/src/hooks/useServiceWorker.ts`
**Purpose**: React hook for service worker registration and lifecycle

- [ ] Register service worker on mount
- [ ] Track states: `installing`, `waiting`, `active`, `updateAvailable`
- [ ] Expose: `register()`, `unregister()`, `update()`, `isOnline: boolean`
- [ ] Listen for online/offline events
- [ ] Clean up on unmount

## Files to MODIFY

### 7. `client/index.html`
- [ ] Add manifest link: `<link rel="manifest" href="/manifest.json">`
- [ ] Add theme-color meta: `<meta name="theme-color" content="#FFCC00">`
- [ ] Add apple-touch-icon links for iOS
- [ ] Add apple-mobile-web-app meta tags

### 8. `client/vite.config.ts` (or equivalent build config)
- [ ] Configure Workbox plugin for Vite if using vite-plugin-pwa
- [ ] Or configure manual service worker build step
- [ ] Ensure service worker is copied to dist/ on build

### 9. `client/src/App.tsx`
- [ ] Add `<InstallPrompt />` and `<UpdatePrompt />` components
- [ ] Call `useServiceWorker()` hook at app level

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] `manifest.json` is served at `/manifest.json`
- [ ] Service worker registers successfully (check DevTools > Application > Service Workers)
- [ ] Static assets cached (check DevTools > Application > Cache Storage)
- [ ] API responses cached with network-first strategy
- [ ] Offline: app loads from cache, shows cached data
- [ ] Offline: offline.html shown for uncached pages
- [ ] Install prompt appears on eligible browsers
- [ ] Update prompt appears when new SW version detected
- [ ] Lighthouse PWA audit score >= 90
- [ ] Create marker file: `.agent-done-W24-04`

## Dependencies
- **None** -- can start immediately
- **Reuses**: Existing Vite build config
