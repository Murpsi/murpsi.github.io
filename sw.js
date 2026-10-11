// Service Worker: legt beim Installieren alle Dateien der App in den Cache, damit sie ohne Netz läuft.
// Er läuft getrennt von der Seite im Hintergrund und beantwortet deren Anfragen aus dem Cache.

// VERSION ist ein Fingerabdruck aller Dateien in DATEIEN. tests/sw.test.js schlägt fehl, wenn er
// nicht mehr passt, und nennt den neuen Wert. Erst die neue VERSION löst auf den Handys das Update aus.
const VERSION = "b58c90c192";

const DATEIEN = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/arteninfo.js",
  "js/fangbuch.js",
  "js/fangbuch-ui.js",
  "js/gewaesser.js",
  "js/gewaesser-ui.js",
  "js/karte.js",
  "js/karte-ui.js",
  "js/regeln.js",
  "js/fischbilder.js",
  "js/fotos.js",
  "js/pwa.js",
  "js/wetter.js",
  "data/arten-info.json",
  "data/fotos.json",
  "data/regeln-bw.json",
  "assets/fonts/saira-condensed-700.woff2",
  "assets/fonts/saira-condensed-800.woff2",
  "assets/fonts/ibm-plex-sans-var.woff2",
  "assets/fonts/ibm-plex-mono-500.woff2",
  "assets/icons/icon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/vendor/leaflet/leaflet.js",
  "assets/vendor/leaflet/leaflet.css",
  "assets/vendor/leaflet/leaflet.markercluster.js",
  "assets/vendor/leaflet/MarkerCluster.css"
];

// Die Fotos liegen in einem eigenen Cache mit eigenem Fingerabdruck. So lädt ein Update der Regeln
// nur die kleinen Dateien neu und nicht jedes Mal alle Fotos.
const FOTO_VERSION = "9b3ccf488c";

const FOTOS = [
  "assets/fotos/aal.webp",
  "assets/fotos/aesche.webp",
  "assets/fotos/aland.webp",
  "assets/fotos/bachforelle.webp",
  "assets/fotos/bachsaibling.webp",
  "assets/fotos/barbe.webp",
  "assets/fotos/barsch.webp",
  "assets/fotos/bitterling.webp",
  "assets/fotos/brachse.webp",
  "assets/fotos/doebel.webp",
  "assets/fotos/dohlenkrebs.webp",
  "assets/fotos/edelkrebs_m.webp",
  "assets/fotos/felchen.webp",
  "assets/fotos/finte.webp",
  "assets/fotos/groppe.webp",
  "assets/fotos/grossmuscheln.webp",
  "assets/fotos/hecht.webp",
  "assets/fotos/huchen.webp",
  "assets/fotos/karausche.webp",
  "assets/fotos/karpfen.webp",
  "assets/fotos/lachs.webp",
  "assets/fotos/maifisch.webp",
  "assets/fotos/nase.webp",
  "assets/fotos/neunaugen.webp",
  "assets/fotos/quappe.webp",
  "assets/fotos/rapfen.webp",
  "assets/fotos/regenbogen.webp",
  "assets/fotos/rotauge.webp",
  "assets/fotos/rotfeder.webp",
  "assets/fotos/schlammpeitzger.webp",
  "assets/fotos/schleie.webp",
  "assets/fotos/schneider.webp",
  "assets/fotos/schraetzer.webp",
  "assets/fotos/seesaibling.webp",
  "assets/fotos/steinbeisser.webp",
  "assets/fotos/steinkrebs.webp",
  "assets/fotos/streber.webp",
  "assets/fotos/stroemer.webp",
  "assets/fotos/wandermaraene.webp",
  "assets/fotos/wels.webp",
  "assets/fotos/zaehrte.webp",
  "assets/fotos/zander.webp",
  "assets/fotos/zingel.webp"
];

const CACHE = "fang-check-" + VERSION;
const FOTO_CACHE = "fang-check-fotos-" + FOTO_VERSION;

// Kartenkacheln von OpenStreetMap, die auf der Karte der Fänge angesehen wurden. Eigener Cache ohne Fingerabdruck:
// er überlebt jedes Update der App und hat eine Obergrenze. Gespeichert wird nur, was die Karte beim Ansehen lädt,
// nie auf Vorrat. So verlangen es die Nutzungsregeln (https://operations.osmfoundation.org/policies/tiles/).
const KACHEL_CACHE = "fang-check-kacheln-1";
const KACHEL_HOST = "tile.openstreetmap.org";
const KACHEL_MAX = 1000;
const GEHOLT = "x-fang-check-geholt";
const TAG = 24 * 60 * 60 * 1000;
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
    Promise.all(namen.filter(n => n.startsWith("fang-check-") && n !== CACHE && n !== FOTO_CACHE && n !== KACHEL_CACHE).map(n => caches.delete(n)))));
});

// Die Seite schickt das nach dem Tippen auf "Jetzt aktualisieren".
self.addEventListener("message", e => { if (e.data === "aktualisieren") self.skipWaiting(); });

async function ausCache(request) {
  const cache = await caches.open(CACHE);
  if (request.mode === "navigate") return (await cache.match("index.html")) || fetch(request);
  return (await cache.match(request, { ignoreSearch: true })) || (await (await caches.open(FOTO_CACHE)).match(request)) || fetch(request);
}

// Wie lange eine Kachel gilt, bestimmt der Server von OpenStreetMap. frisch: bis dahin kommt sie ohne Nachfrage aus dem
// Cache (Angabe Expires, sonst max-age). notfall: bis dahin darf sie noch gezeigt werden, wenn der Server nicht erreichbar
// ist (stale-if-error), also ohne Netz. Fehlen die Angaben, gelten 7 Tage, das Mindestmaß der Nutzungsregeln.
function kachelFristen(antwort) {
  const geholt = Number(antwort.headers.get(GEHOLT)) || 0, angaben = antwort.headers.get("cache-control") || "";
  const sekunden = name => { const m = new RegExp("(?:^|[\\s,])" + name + "=(\\d+)").exec(angaben); return m ? Number(m[1]) * 1000 : null; };
  const ablauf = Date.parse(antwort.headers.get("expires") || ""), maxAge = sekunden("max-age");
  const frisch = Number.isFinite(ablauf) ? ablauf : geholt + (maxAge ?? 7 * TAG);
  return { frisch, notfall: frisch + (sekunden("stale-if-error") ?? 0) };
}

// Legt eine Kachel mit dem Zeitpunkt des Abrufs in den Cache. Die ältesten fallen heraus, sobald es zu viele sind.
let kachelnGemerkt = 0;
async function merkeKachel(cache, adresse, antwort, jetzt) {
  const kopf = new Headers(antwort.headers);
  kopf.set(GEHOLT, String(jetzt));
  await cache.put(adresse, new Response(await antwort.blob(), { status: 200, headers: kopf }));
  // Nicht bei jeder Kachel zählen: beim ersten Mal nach dem Start des Service Workers, danach bei jeder 25.
  if (kachelnGemerkt++ % 25) return;
  const alle = await cache.keys();
  await Promise.all(alle.slice(0, Math.max(0, alle.length - KACHEL_MAX)).map(k => cache.delete(k)));
}

async function kachel(request, jetzt = Date.now()) {
  const cache = await caches.open(KACHEL_CACHE), alt = await cache.match(request.url);
  const fristen = alt ? kachelFristen(alt) : null;
  if (alt && jetzt < fristen.frisch) return alt;
  const notfall = alt && jetzt < fristen.notfall ? alt : null;
  let neu;
  // Kein Netz: die alte Kachel, solange der Server das erlaubt. Sonst bleibt die Stelle auf der Karte grau.
  try { neu = await fetch(request); }
  catch (fehler) { if (notfall) return notfall; throw fehler; }
  if (neu.ok) await merkeKachel(cache, request.url, neu.clone(), jetzt).catch(() => {});
  return neu.status >= 500 && notfall ? notfall : neu;
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname === KACHEL_HOST) return e.respondWith(kachel(e.request));
  if (url.origin !== self.location.origin) return;
  e.respondWith(LOKAL ? fetch(e.request).catch(() => ausCache(e.request)) : ausCache(e.request));
});
