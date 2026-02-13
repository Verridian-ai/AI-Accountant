/**
 * GoldLedger Service Worker
 *
 * Caching strategies (Workbox-style, vanilla Cache API):
 * - Cache-first: static assets (JS, CSS, fonts, images) — 30 day max age
 * - Network-first: API data (/api/transactions, /api/accounts, etc.) — 3s timeout, 1hr cache
 * - Stale-while-revalidate: semi-static data (/api/economic, /api/subscriptions/plans) — 24hr max
 * - Network-only: auth, streaming, chat, all POST/PUT/DELETE
 * - Offline fallback: /offline.html for uncached navigation requests
 */

const CACHE_VERSION = 'v2.0.0';
const CACHE_NAMES = {
  static: `static-assets-${CACHE_VERSION}`,
  api: `api-cache-${CACHE_VERSION}`,
  semiStatic: `semi-static-${CACHE_VERSION}`,
  appShell: `app-shell-${CACHE_VERSION}`,
};

// Pre-cache for app shell
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
];

// Limits
const STATIC_MAX_ENTRIES = 200;
const API_MAX_ENTRIES = 100;
const API_NETWORK_TIMEOUT_MS = 3000;
const STATIC_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const API_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const SEMI_STATIC_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// ROUTE CLASSIFICATION
// ============================================================================

/** Network-only routes — never cache */
function isNetworkOnly(request, url) {
  if (request.method !== 'GET') return true;
  const noCachePaths = ['/api/auth', '/api/stream', '/api/chat', '/api/admin/auth'];
  return noCachePaths.some((p) => url.pathname.startsWith(p));
}

/** Network-first API routes */
function isNetworkFirstApi(url) {
  const apiPaths = [
    '/api/transactions',
    '/api/accounts',
    '/api/bas',
    '/api/tax',
    '/api/budgets',
    '/api/reports',
    '/api/forecasts',
    '/api/anomalies',
    '/api/compliance',
    '/api/matches',
    '/api/documents',
  ];
  return apiPaths.some((p) => url.pathname.startsWith(p));
}

/** Stale-while-revalidate semi-static routes */
function isSemiStatic(url) {
  const semiStaticPaths = [
    '/api/economic',
    '/api/subscriptions/plans',
    '/api/cdr/data-holders',
    '/api/cdr/products',
    '/api/settings',
    '/api/banks',
  ];
  return semiStaticPaths.some((p) => url.pathname.startsWith(p));
}

/** Cache-first static assets */
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.woff', '.woff2', '.ttf', '.eot', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'];
  return staticExtensions.some((ext) => url.pathname.endsWith(ext));
}

/** Navigation request check */
function isNavigationRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// ============================================================================
// INSTALL
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker', CACHE_VERSION);
  event.waitUntil(
    caches
      .open(CACHE_NAMES.appShell)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => console.log('[SW] Precache complete'))
      .catch((err) => console.warn('[SW] Precache partial failure:', err))
  );
});

// ============================================================================
// ACTIVATE — clean old caches
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker', CACHE_VERSION);
  const validCaches = new Set(Object.values(CACHE_NAMES));
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !validCaches.has(k))
            .map((k) => {
              console.log('[SW] Deleting old cache:', k);
              return caches.delete(k);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ============================================================================
// FETCH — route to correct strategy
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http(s)
  if (!url.protocol.startsWith('http')) return;

  // Network-only: auth, streaming, chat, mutations
  if (isNetworkOnly(request, url)) return;

  // Semi-static API data (stale-while-revalidate)
  if (url.pathname.startsWith('/api/') && isSemiStatic(url)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.semiStatic, SEMI_STATIC_MAX_AGE_MS));
    return;
  }

  // Network-first for API data
  if (url.pathname.startsWith('/api/') && isNetworkFirstApi(url)) {
    event.respondWith(networkFirst(request, CACHE_NAMES.api, API_NETWORK_TIMEOUT_MS, API_MAX_AGE_MS));
    return;
  }

  // Any other /api/ request — let it pass through (network only)
  if (url.pathname.startsWith('/api/')) return;

  // Cache-first for static assets
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStatic(request, CACHE_NAMES.static, STATIC_MAX_AGE_MS));
    return;
  }

  // Navigation requests — try network, fall back to cache, then offline.html
  if (isNavigationRequest(request)) {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Everything else — network with cache fallback
  event.respondWith(cacheFirstStatic(request, CACHE_NAMES.appShell, STATIC_MAX_AGE_MS));
});

// ============================================================================
// CACHING STRATEGIES
// ============================================================================

/**
 * Cache-first for static assets.
 * Returns cached response if fresh enough, otherwise fetches from network.
 * Enforces max-age and max-entries limits.
 */
async function cacheFirstStatic(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const cachedTime = cached.headers.get('sw-cache-time');
    if (cachedTime && Date.now() - Number(cachedTime) < maxAgeMs) {
      return cached;
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-cache-time', String(Date.now()));
      const toCache = new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, toCache);
      trimCache(cacheName, STATIC_MAX_ENTRIES);
    }
    return response;
  } catch {
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network-first with timeout.
 * Tries network with a race timeout; falls back to cache.
 */
async function networkFirst(request, cacheName, timeoutMs, maxAgeMs) {
  const cache = await caches.open(cacheName);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);

    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-cache-time', String(Date.now()));
      const toCache = new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, toCache);
      trimCache(cacheName, API_MAX_ENTRIES);
    }

    return response;
  } catch {
    // Network failed or timed out — try cache
    const cached = await cache.match(request);
    if (cached) {
      const cachedTime = cached.headers.get('sw-cache-time');
      if (!cachedTime || Date.now() - Number(cachedTime) < maxAgeMs) {
        return cached;
      }
    }

    return new Response(
      JSON.stringify({ error: 'Network unavailable', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Stale-while-revalidate.
 * Returns cached immediately while fetching fresh copy in background.
 */
async function staleWhileRevalidate(request, cacheName, maxAgeMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchAndUpdate = fetch(request)
    .then((response) => {
      if (response.ok) {
        const headers = new Headers(response.headers);
        headers.set('sw-cache-time', String(Date.now()));
        const toCache = new Response(response.clone().body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
        cache.put(request, toCache);
      }
      return response;
    })
    .catch(() => cached || new Response('Offline', { status: 503 }));

  if (cached) {
    const cachedTime = cached.headers.get('sw-cache-time');
    if (cachedTime && Date.now() - Number(cachedTime) < maxAgeMs) {
      return cached;
    }
  }

  return cached || fetchAndUpdate;
}

/**
 * Navigation handler — try network, cache fallback, then offline.html.
 */
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
  }
}

// ============================================================================
// CACHE MAINTENANCE
// ============================================================================

/** Trim a cache to maxEntries (FIFO) */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    const excess = keys.length - maxEntries;
    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i]);
    }
  }
}

// ============================================================================
// BACKGROUND SYNC
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPending('pendingSync'));
  } else if (event.tag === 'sync-categorizations') {
    event.waitUntil(syncPending('pendingCategorizations'));
  }
});

async function syncPending(storeName) {
  try {
    const db = await openDatabase();
    const items = await idbGetAll(db, storeName);

    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: JSON.stringify(item.body),
        });
        if (response.ok) {
          await idbDelete(db, storeName, item.id);
        }
      } catch (err) {
        console.warn('[SW] Sync item failed:', err);
      }
    }
  } catch (err) {
    console.error('[SW] Background sync failed:', err);
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('goldledger-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pendingSync')) {
        db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pendingCategorizations')) {
        db.createObjectStore('pendingCategorizations', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: data.actions || [],
      tag: data.tag || 'default',
      renotify: data.renotify || false,
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'GoldLedger', options)
    );
  } catch (err) {
    console.error('[SW] Push notification error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  } else if (type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(CACHE_NAMES.static).then((cache) => cache.addAll(event.data.urls))
    );
  }
});

console.log('[SW] Service worker loaded', CACHE_VERSION);
