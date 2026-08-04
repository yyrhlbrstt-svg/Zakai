/* Zakai PWA service worker — push + basic offline shell */

const OFFLINE_CACHE = "zakai-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // Best-effort: a failed precache (e.g. dev server hiccup) must not block
  // install, or push notifications — the more load-bearing half of this file
  // — would stop registering too.
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => null),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Navigation only, and only as a fallback: this is not a caching strategy for
// the app (a stale cached dashboard is worse than a network error), just the
// difference between the browser's own "no internet" interstitial and a page
// that still looks like Zakai when a phone loses signal mid-use.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () => caches.match(OFFLINE_URL).then((res) => res || Response.error()),
    ),
  );
});

self.addEventListener("push", (event) => {
  // Finish surface is Money OS — never fall back to portfolio /dashboard.
  let data = { title: "זכאי", body: "עדכון מהסוכן", url: "/he/money", tag: "zakai" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "zakai",
      data: { url: data.url || "/he/money" },
      dir: "rtl",
      lang: "he",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/he/money";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
