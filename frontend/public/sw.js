const CACHE_NAME = "my-progress-static-v4"
const STATIC_ASSETS = ["/manifest.json", "/gym-near-svgrepo-com.svg", "/apple-icon.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return
  }

  const requestUrl = new URL(event.request.url)

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request))
    return
  }

  if (requestUrl.origin !== self.location.origin) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const sessionId = event.notification.data?.sessionId
  const targetUrl = new URL("/training/current", self.location.origin)

  if (event.action === "complete" && sessionId) {
    targetUrl.searchParams.set("completeSession", sessionId)
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const client = clients[0]
      if (client) {
        await client.navigate(targetUrl.href)
        return client.focus()
      }

      return self.clients.openWindow(targetUrl.href)
    }),
  )
})
