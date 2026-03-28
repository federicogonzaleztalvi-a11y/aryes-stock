// sw.js — Aryes Stock Service Worker
// Handles Web Push Notifications

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Push event — show notification
self.addEventListener('push', event => {
  let data = { title: 'Aryes Stock', body: 'Hay una actualizacion', icon: '/favicon.ico' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch { /* use defaults */ }

  const options = {
    body:    data.body,
    icon:    data.icon || '/favicon.ico',
    badge:   '/favicon.ico',
    tag:     data.tag || 'aryes-notif',
    data:    data.url ? { url: data.url } : {},
    actions: data.actions || [],
    requireInteraction: data.urgent || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click — open app or specific URL
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing window if open
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then(c => c.navigate(url));
      return self.clients.openWindow(url);
    })
  );
});
