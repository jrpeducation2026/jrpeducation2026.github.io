// Minimal service worker so phones offer "Install app". Always uses the network, so updates show immediately.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => new Response(
    "<h2 style='font-family:sans-serif;padding:24px'>No internet connection. Please connect and try again.</h2>",
    { headers: { "Content-Type": "text/html" } })));
});
