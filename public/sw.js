const cacheName = 'zap2-shell-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => {
    return cache.add(new Request('/', { cache: 'reload' }))
  }))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.mode !== 'navigate') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || /^\/(?:api|socket\.io)(?:\/|$)/.test(url.pathname)) return

  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(cacheName)
    return (await cache.match('/')) ?? Response.error()
  }))
})

self.addEventListener('notificationclick', (event) => {
  const { notification } = event
  notification.close()

  const url = new URL('/conversations', self.location.origin)
  const conversationId = notification.data?.conversationId ?? notification.tag
  if (conversationId) url.searchParams.set('contact', conversationId)

  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const client = clients.find((client) => client.url === url.href)
    return client ? client.focus() : self.clients.openWindow(url.href)
  }))
})
