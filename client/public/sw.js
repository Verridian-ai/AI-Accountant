/**
 * Service Worker for CBA AI Statement Parser PWA
 *
 * Implements caching strategies:
 * - App Shell: Cache First
 * - API: Network First with timeout fallback
 * - Static Assets: Stale While Revalidate
 * - Images: Cache First with 30-day expiry
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAMES = {
  appShell: `app-shell-${CACHE_VERSION}`,
  api: `api-${CACHE_VERSION}`,
  static: `static-${CACHE_VERSION}`,
  images: `images-${CACHE_VERSION}`,
};

// Files to cache for app shell
const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
];

// API timeout before falling back to cache (ms)
const API_TIMEOUT = 10000;

// Image cache expiry (30 days in seconds)
const IMAGE_CACHE_MAX_AGE = 30 * 24 * 60 * 60;

// ============================================================================
// INSTALL EVENT
// ============================================================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAMES.appShell)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL_FILES);
      })
      .then(() => {
        console.log('[SW] App shell cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to cache app shell:', error);
      })
  );
});

// ============================================================================
// ACTIVATE EVENT
// ============================================================================

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old version caches
              return !Object.values(CACHE_NAMES).includes(cacheName);
            })
            .map((cacheName) => {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// ============================================================================
// FETCH EVENT
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine caching strategy based on request type
  if (isApiRequest(url)) {
    event.respondWith(networkFirstWithTimeout(request, CACHE_NAMES.api, API_TIMEOUT));
  } else if (isImageRequest(request)) {
    event.respondWith(cacheFirstWithExpiry(request, CACHE_NAMES.images, IMAGE_CACHE_MAX_AGE));
  } else if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.static));
  } else {
    // App shell - cache first
    event.respondWith(cacheFirst(request, CACHE_NAMES.appShell));
  }
});

// ============================================================================
// CACHING STRATEGIES
// ============================================================================

/**
 * Cache First Strategy
 * Best for: App shell, offline-first assets
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network request failed, returning offline page');
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Network First with Timeout Strategy
 * Best for: API requests
 */
async function networkFirstWithTimeout(request, cacheName, timeout) {
  const cache = await caches.open(cacheName);

  // Create an AbortController for proper timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (networkResponse.ok) {
      // Only cache successful GET requests for safe endpoints
      if (isCacheableApiResponse(request.url)) {
        cache.put(request, networkResponse.clone());
      }
    }

    return networkResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    console.log('[SW] Network request failed/timed out, trying cache');
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return error response
    return new Response(JSON.stringify({
      error: 'Network unavailable',
      offline: true,
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Stale While Revalidate Strategy
 * Best for: Static assets that update occasionally
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      // Return cached response if available, otherwise rethrow
      if (cachedResponse) {
        return cachedResponse;
      }
      console.log('[SW] Stale-while-revalidate failed:', error);
      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    });

  // Return cached response immediately if available, otherwise wait for fetch
  return cachedResponse || fetchPromise;
}

/**
 * Cache First with Expiry Strategy
 * Best for: Images and other media
 */
async function cacheFirstWithExpiry(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const cachedDateHeader = cachedResponse.headers.get('sw-cached-date');
    if (cachedDateHeader) {
      const cachedDate = new Date(cachedDateHeader);
      const now = new Date();
      const ageSeconds = (now - cachedDate) / 1000;

      if (ageSeconds < maxAgeSeconds) {
        return cachedResponse;
      }
    }
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      // Clone response and add cache date header
      // Headers must be set during Response construction, not after
      const originalHeaders = new Headers(networkResponse.headers);
      originalHeaders.set('sw-cached-date', new Date().toISOString());

      const responseToCache = new Response(await networkResponse.clone().blob(), {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: originalHeaders,
      });

      cache.put(request, responseToCache);
    }

    return networkResponse;
  } catch (error) {
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isApiRequest(url) {
  return url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/');
}

function isImageRequest(request) {
  const acceptHeader = request.headers.get('Accept') || '';
  return acceptHeader.includes('image/');
}

function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.woff', '.woff2', '.ttf', '.eot'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

function isCacheableApiResponse(url) {
  // Only cache certain API endpoints
  const cacheableEndpoints = [
    '/api/accounts',
    '/api/bas/tax-codes',
    '/api/banks',
    '/api/settings',
  ];
  return cacheableEndpoints.some(endpoint => url.includes(endpoint));
}

// ============================================================================
// BACKGROUND SYNC
// ============================================================================

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-transactions') {
    event.waitUntil(syncPendingTransactions());
  } else if (event.tag === 'sync-categorizations') {
    event.waitUntil(syncPendingCategorizations());
  }
});

async function syncPendingTransactions() {
  try {
    // Get pending transactions from IndexedDB
    const db = await openDatabase();

    // Wrap getAll in a promise since IDBRequest is not a Promise
    const pendingItems = await new Promise((resolve, reject) => {
      const tx = db.transaction('pendingSync', 'readonly');
      const store = tx.objectStore('pendingSync');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const item of pendingItems) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: JSON.stringify(item.body),
        });

        if (response.ok) {
          // Remove from pending queue - wrap in promise
          await new Promise((resolve, reject) => {
            const deleteTx = db.transaction('pendingSync', 'readwrite');
            const deleteStore = deleteTx.objectStore('pendingSync');
            const deleteRequest = deleteStore.delete(item.id);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
          });
        }
      } catch (error) {
        console.error('[SW] Failed to sync item:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

async function syncPendingCategorizations() {
  // Similar to syncPendingTransactions but for categorization updates
  console.log('[SW] Syncing pending categorizations...');
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cba-parser-offline', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('pendingSync')) {
        db.createObjectStore('pendingSync', { keyPath: 'id', autoIncrement: true });
      }

      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
        txStore.createIndex('date', 'date');
        txStore.createIndex('category', 'category');
      }

      if (!db.objectStoreNames.contains('accounts')) {
        db.createObjectStore('accounts', { keyPath: 'id' });
      }
    };
  });
}

// ============================================================================
// PUSH NOTIFICATIONS
// ============================================================================

self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();

    const options = {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: data.actions || [],
      tag: data.tag || 'default',
      renotify: data.renotify || false,
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'CBA Parser', options)
    );
  } catch (error) {
    console.error('[SW] Failed to show notification:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if app not open
        return clients.openWindow(urlToOpen);
      })
  );
});

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  } else if (event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAMES.static).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

console.log('[SW] Service worker loaded');
