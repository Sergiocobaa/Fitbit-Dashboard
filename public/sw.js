// Service Worker — Fitbit Dashboard PWA
// Handles push notification clicks and basic PWA caching

const CACHE_NAME = 'fitbit-dash-v1'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim())
})

// Al hacer click en una notificación, abre el dashboard en la pestaña de sueño
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.action === 'sleep' ? '/sleep' : '/dashboard'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

// Fetch pass-through (no cache agresiva, la app es dinámica)
self.addEventListener('fetch', () => {})
