self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("my-progress-shell-v1").then((cache) =>
      cache.addAll(["/", "/manifest.json", "/icon-light-32x32.png", "/apple-icon.png"]),
    ),
  )
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
  )
})
