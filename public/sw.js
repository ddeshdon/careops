self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
// Minimal pass-through SW. Extend with a cache strategy for offline check-in later.
self.addEventListener("fetch", () => {});
