// sw.js — Pazque Service Worker
// PWA: caches app shell for fast loading + handles push notifications

const CACHE_NAME = 'aryes-' + '20260409';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/pazque-logo.png',
];

// Install — cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first, fall back to cache (SPA friendly)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET, API calls, and Supabase requests
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.includes('supabase')) return;
  if (url.hostname.includes('posthog')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for static assets
        if (response.ok && SHELL_ASSETS.includes(url.pathname)) {
          // Only cache shell assets — /assets/*.js already have content hashes in filenames
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/')))
  );
});

// Push notification
self.addEventListener('push', event => {
  let data = { title: 'Pazque', body: 'Hay una actualización', icon: '/pazque-logo.png' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/pazque-logo.png',
      badge: '/pazque-logo.png',
      tag: data.tag || 'pazque-notif',
      data: data.url ? { url: data.url } : {},
      requireInteraction: data.urgent || false,
    })
  );
});

// Notification click
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(c => c.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});
