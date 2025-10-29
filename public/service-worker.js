const CACHE_NAME = 'neurolearn-cache-v2'
const STATIC_CACHE = 'neurolearn-static-v2'
const DYNAMIC_CACHE = 'neurolearn-dynamic-v2'

// Core assets to cache immediately
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
]

// Static assets that change less frequently
const STATIC_ASSETS = [
  '/src/main.jsx',
  '/src/App.jsx',
  '/src/main.css',
]

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker')
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      }),
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching core assets')
        return cache.addAll(CORE_ASSETS)
      }),
    ]).then(() => {
      return self.skipWaiting()
    }),
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker')
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', key)
              return caches.delete(key)
            }
            return undefined
          }),
        ),
      ),
      self.clients.claim(),
    ]),
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Handle Firebase requests with network-first strategy
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebaseio.com') ||
      url.hostname.includes('firebasestorage.googleapis.com')) {
    event.respondWith(networkFirstStrategy(request))
    return
  }

  // Handle static assets with cache-first strategy
  if (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'image' ||
      request.destination === 'font') {
    event.respondWith(cacheFirstStrategy(request))
    return
  }

  // Handle navigation requests with network-first strategy
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstStrategy(request))
    return
  }

  // Default: stale-while-revalidate for other requests
  event.respondWith(staleWhileRevalidateStrategy(request))
})

// Cache-first strategy for static assets
function cacheFirstStrategy(request) {
  return caches.match(request).then((cachedResponse) => {
    if (cachedResponse) {
      return cachedResponse
    }

    return fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        const clonedResponse = networkResponse.clone()
        caches.open(STATIC_CACHE).then((cache) => {
          cache.put(request, clonedResponse)
        })
      }
      return networkResponse
    })
  })
}

// Network-first strategy for dynamic content
function networkFirstStrategy(request) {
  return fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const clonedResponse = networkResponse.clone()
      caches.open(DYNAMIC_CACHE).then((cache) => {
        cache.put(request, clonedResponse)
      })
    }
    return networkResponse
  }).catch(() => {
    // Fallback to cache if network fails
    return caches.match(request)
  })
}

// Stale-while-revalidate strategy
function staleWhileRevalidateStrategy(request) {
  return caches.match(request).then((cachedResponse) => {
    const fetchPromise = fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        const clonedResponse = networkResponse.clone()
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, clonedResponse)
        })
      }
      return networkResponse
    })

    return cachedResponse || fetchPromise
  })
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)

  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync())
  }
})

async function doBackgroundSync() {
  // Implement background sync logic here
  // For example, retry failed Firebase requests
  console.log('[SW] Performing background sync')
}

// Handle push notifications (if implemented later)
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')

  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
    }

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked')

  event.notification.close()

  event.waitUntil(
    clients.openWindow('/')
  )
})
