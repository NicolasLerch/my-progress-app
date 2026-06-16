self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("my-muscle-app-shell-v2").then((cache) =>
      cache.addAll(["/", "/manifest.json", "/gym-near-svgrepo-com.svg", "/apple-icon.png"]),
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
