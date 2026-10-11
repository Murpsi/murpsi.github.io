// Service Worker: legt beim Installieren alle Dateien der App in den Cache, damit sie ohne Netz läuft.
// Er läuft getrennt von der Seite im Hintergrund und beantwortet deren Anfragen aus dem Cache.

// VERSION ist ein Fingerabdruck aller Dateien in DATEIEN. tests/sw.test.js schlägt fehl, wenn er
// nicht mehr passt, und nennt den neuen Wert. Erst die neue VERSION löst auf den Handys das Update aus.
const VERSION = "eb700b4893";

const DATEIEN = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/fangbuch.js",
  "js/fangbuch-ui.js",
  "js/regeln.js",
  "js/fischbilder.js",
  "js/pwa.js",
  "data/regeln-bw.json",
  "assets/fonts/saira-condensed-700.woff2",
  "assets/fonts/saira-condensed-800.woff2",
  "assets/fonts/ibm-plex-sans-var.woff2",
  "assets/fonts/ibm-plex-mono-500.woff2",
  "assets/icons/icon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png"
];

const CACHE = "fang-check-" + VERSION;
// Beim Entwickeln zuerst das Netz fragen, sonst zeigt der Browser nach jeder Änderung den alten Stand.
const LOKAL = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);

self.addEventListener("install", e => {
  // cache: "reload" umgeht den HTTP-Cache des Browsers, sonst könnte ein alter Stand im neuen Cache landen.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN.map(d => new Request(d, { cache: "reload" })))));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(namen =>
    Promise.all(namen.filter(n => n.startsWith("fang-check-") && n !== CACHE).map(n => caches.delete(n)))));
});

// Die Seite schickt das nach dem Tippen auf "Jetzt aktualisieren".
self.addEventListener("message", e => { if (e.data === "aktualisieren") self.skipWaiting(); });

async function ausCache(request) {
  const cache = await caches.open(CACHE);
  if (request.mode === "navigate") return (await cache.match("index.html")) || fetch(request);
  return (await cache.match(request, { ignoreSearch: true })) || fetch(request);
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(LOKAL ? fetch(e.request).catch(() => ausCache(e.request)) : ausCache(e.request));
});
