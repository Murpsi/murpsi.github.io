// Service Worker: legt beim Installieren alle Dateien der App in den Cache, damit sie ohne Netz läuft.
// Er läuft getrennt von der Seite im Hintergrund und beantwortet deren Anfragen aus dem Cache.

// VERSION ist ein Fingerabdruck aller Dateien in DATEIEN. tests/sw.test.js schlägt fehl, wenn er
// nicht mehr passt, und nennt den neuen Wert. Erst die neue VERSION löst auf den Handys das Update aus.
const VERSION = "118cb350e9";

const DATEIEN = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/fangbuch.js",
  "js/fangbuch-ui.js",
  "js/gewaesser.js",
  "js/gewaesser-ui.js",
  "js/regeln.js",
  "js/fischbilder.js",
  "js/fotos.js",
  "js/pwa.js",
  "data/fotos.json",
  "data/regeln-bw.json",
  "assets/fonts/saira-condensed-700.woff2",
  "assets/fonts/saira-condensed-800.woff2",
  "assets/fonts/ibm-plex-sans-var.woff2",
  "assets/fonts/ibm-plex-mono-500.woff2",
  "assets/icons/icon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png"
];

// Die Fotos liegen in einem eigenen Cache mit eigenem Fingerabdruck. So lädt ein Update der Regeln
// nur die kleinen Dateien neu und nicht jedes Mal alle Fotos.
const FOTO_VERSION = "e3b0c44298";

const FOTOS = [];

const CACHE = "fang-check-" + VERSION;
const FOTO_CACHE = "fang-check-fotos-" + FOTO_VERSION;
// Beim Entwickeln zuerst das Netz fragen, sonst zeigt der Browser nach jeder Änderung den alten Stand.
const LOKAL = ["localhost", "127.0.0.1", "[::1]"].includes(self.location.hostname);

self.addEventListener("install", e => {
  // cache: "reload" umgeht den HTTP-Cache des Browsers, sonst könnte ein alter Stand im neuen Cache landen.
  const fuelle = (name, dateien) => caches.open(name).then(c => c.addAll(dateien.map(d => new Request(d, { cache: "reload" }))));
  // Den Foto-Cache gibt es schon, wenn sich an den Fotos nichts geändert hat. Scheitert das Füllen, wird er
  // wieder gelöscht, damit der nächste Versuch keinen halben Cache für vollständig hält.
  const fotos = caches.has(FOTO_CACHE).then(da => da || fuelle(FOTO_CACHE, FOTOS).catch(err => caches.delete(FOTO_CACHE).then(() => { throw err; })));
  e.waitUntil(Promise.all([fuelle(CACHE, DATEIEN), fotos]));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(namen =>
    Promise.all(namen.filter(n => n.startsWith("fang-check-") && n !== CACHE && n !== FOTO_CACHE).map(n => caches.delete(n)))));
});

// Die Seite schickt das nach dem Tippen auf "Jetzt aktualisieren".
self.addEventListener("message", e => { if (e.data === "aktualisieren") self.skipWaiting(); });

async function ausCache(request) {
  const cache = await caches.open(CACHE);
  if (request.mode === "navigate") return (await cache.match("index.html")) || fetch(request);
  return (await cache.match(request, { ignoreSearch: true })) || (await (await caches.open(FOTO_CACHE)).match(request)) || fetch(request);
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(LOKAL ? fetch(e.request).catch(() => ausCache(e.request)) : ausCache(e.request));
});
