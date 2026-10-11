/* SakhiAI service worker — OFFLINE-FIRST app shell.
 *
 * What this makes possible offline
 *  - The whole app (HTML, JS, CSS, fonts, icons, translations, the local
 *    knowledge base, the Rule/Intent engines — all bundled) loads with no network.
 *  - Navigation requests: network-first with a short timeout, falling back to the
 *    cached app shell, then /offline.html (emergency numbers).
 *  - Static same-origin assets: cache-first (they are content-hashed), refreshed in
 *    the background.
 *
 * What it deliberately NEVER does
 *  - Cache or intercept /api/* or any cross-origin request (Google Maps embeds,
 *    OpenStreetMap geocoding, the backend on another origin, Gemini). Live SOS,
 *    sync, maps and AI must always hit the real network; offline they fail and the
 *    UI says so — they are not faked from a cache.
 *
 * Install: downloads /precache-manifest.json (emitted at build time) and caches
 * every listed file so even the first offline launch works.
 */
const VERSION = "sakhiai-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const FALLBACK_URLS = ["/", "/offline.html", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
const NAV_TIMEOUT_MS = 4000;

async function precache() {
  const cache = await caches.open(SHELL_CACHE);
  let urls = FALLBACK_URLS;
  try {
    const res = await fetch("/precache-manifest.json", { cache: "no-store" });
    if (res.ok) {
      const manifest = await res.json();
      if (Array.isArray(manifest.urls) && manifest.urls.length) urls = manifest.urls;
    }
  } catch { /* dev server or offline during install: fall back to the minimal shell */ }

  // Cache each file individually so one failure cannot abort the whole install.
  await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(url, { cache: "reload" });
      if (res.ok) await cache.put(url, res);
    } catch { /* ignore */ }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;       // maps, geocoding, API on another origin
  if (url.pathname.startsWith("/api/")) return;          // same-origin API proxy: never cached
  if (url.pathname === "/sw.js" || url.pathname === "/precache-manifest.json") return;

  if (request.mode === "navigate") {
    event.respondWith(
      withTimeout(fetch(request), NAV_TIMEOUT_MS)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put("/", copy)); }
          return res;
        })
        .catch(async () => (await caches.match("/")) || (await caches.match("/offline.html")) || Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(ASSET_CACHE).then((c) => c.put(request, copy)); } return res; })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (event) => {
  let data;
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "SakhiAI alert", body: event.data?.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "SakhiAI alert", {
      body: data.body || "Open SakhiAI for details.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "sakhiai-alert",
      requireInteraction: Boolean(data.urgent),
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) if ("focus" in client && client.url === target) return client.focus();
      return self.clients.openWindow(target);
    })
  );
});
