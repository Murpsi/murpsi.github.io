// Prüft, dass der Service Worker alle Dateien der App cached und dass VERSION zum Inhalt passt.
// Ohne neue VERSION bekämen installierte Apps geänderte Regeln nie zu sehen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wurzel = new URL("../", import.meta.url);
const lies = pfad => readFileSync(new URL(pfad, wurzel));
const sw = lies("sw.js").toString("utf8");

const VERSION = sw.match(/const VERSION = "([^"]*)";/)[1];
const DATEIEN = JSON.parse(sw.match(/const DATEIEN = (\[[^\]]*\]);/)[1]);

const FOTO_VERSION = sw.match(/const FOTO_VERSION = "([^"]*)";/)[1];
const FOTOS = JSON.parse(sw.match(/const FOTOS = (\[[^\]]*\]);/)[1]);
const BINAER = /\.(woff2|png|webp)$/;

function fingerabdruck(dateien) {
  const hash = createHash("sha256");
  for (const d of [...dateien].sort()) {
    let inhalt = lies(d);
    // Zeilenenden angleichen, damit Windows und Linux denselben Wert liefern.
    if (!BINAER.test(d)) inhalt = inhalt.toString("utf8").replaceAll("\r\n", "\n");
    hash.update(d).update(inhalt);
  }
  return hash.digest("hex").slice(0, 10);
}

function alleDateien(ordner) {
  return readdirSync(new URL(ordner + "/", wurzel), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? alleDateien(ordner + "/" + e.name) : [ordner + "/" + e.name]);
}

test("Service Worker cached genau die Dateien der App", () => {
  // Lizenztexte liegen im Repo, die App lädt sie aber nicht.
  const vorhanden = ["index.html", "manifest.webmanifest", ...["css", "js", "data", "assets"].flatMap(alleDateien)]
    .filter(d => !/\.(txt|md)$/.test(d));
  const istFoto = d => d.startsWith("assets/fotos/");
  assert.deepEqual(DATEIEN.filter(d => d !== "./").sort(), vorhanden.filter(d => !istFoto(d)).sort());
  assert.deepEqual([...FOTOS].sort(), vorhanden.filter(istFoto).sort(), "FOTOS in sw.js passt nicht zu assets/fotos/");
  assert.ok(DATEIEN.includes("./"), "Startadresse ./ fehlt");
});

test("Manifest: Name, Startadresse und Icons stimmen", () => {
  const m = JSON.parse(lies("manifest.webmanifest"));
  assert.equal(m.name, "Fang-Check");
  assert.equal(m.display, "standalone");
  // Relative Adressen, weil die App auf GitHub Pages in einem Unterordner liegt.
  assert.equal(m.start_url, "./");
  for (const groesse of ["192x192", "512x512"])
    assert.ok(m.icons.some(i => i.sizes === groesse && i.type === "image/png"), "Icon " + groesse + " fehlt");
  for (const i of m.icons) {
    assert.ok(DATEIEN.includes(i.src), i.src + " wird nicht gecached");
    if (i.type !== "image/png") continue;
    const [b, h] = i.sizes.split("x").map(Number), png = lies(i.src);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [b, h], i.src + " hat die falsche Größe");
  }
});

test("VERSION in sw.js passt zum Inhalt der Dateien", () => {
  const soll = fingerabdruck(DATEIEN.filter(d => d !== "./"));
  assert.equal(VERSION, soll, `Dateien geändert: in sw.js VERSION = "${soll}" eintragen`);
});

test("FOTO_VERSION in sw.js passt zu den Fotos", () => {
  const soll = fingerabdruck(FOTOS);
  assert.equal(FOTO_VERSION, soll, `Fotos geändert: in sw.js FOTO_VERSION = "${soll}" eintragen`);
});

test("Keine Datei lädt etwas von fremden Servern, außer dem Wetter von Open-Meteo und dem Kartenbild von OpenStreetMap", () => {
  // Die Ausnahmen, beide nur mit Zustimmung: js/wetter.js fragt das Wetter ab, index.html nennt die Quelle als Link (Pflicht der Lizenz).
  // js/karte.js nennt die Adresse der Kartenkacheln und den Link zur Nennung von OpenStreetMap (ebenfalls Pflicht).
  const ERLAUBT = { "js/wetter.js": ["https://api.open-meteo.com/v1/forecast"], "index.html": ["https://open-meteo.com/"],
    "js/karte.js": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png", "https://www.openstreetmap.org/copyright"] };
  const dateien = ["index.html", "css/app.css", ...alleDateien("js")];
  for (const d of dateien) {
    // Der Namensraum von SVG sieht aus wie eine Adresse, ist aber nur ein Name. Der Browser lädt dort nichts.
    const adressen = (lies(d).toString("utf8").match(/https?:\/\/[^\s"'`<>)]*/g) ?? []).filter(a => a !== "http://www.w3.org/2000/svg");
    assert.deepEqual([...new Set(adressen)], ERLAUBT[d] ?? [], d + " verweist ins Netz");
  }
});

// ---------- Kartenkacheln ----------
// sw.js läuft hier in einer eigenen Umgebung mit einem kleinen Ersatz für den Cache des Browsers und für das Netz.
import vm from "node:vm";

function starteSw({ hostname = "murpsi.github.io" } = {}) {
  const speicher = new Map(), ereignisse = {}, netz = { anfragen: [], antwort: null };
  const cache = name => {
    if (!speicher.has(name)) speicher.set(name, new Map());
    const m = speicher.get(name), adresse = k => typeof k === "string" ? k : k.url;
    return {
      match: async k => m.get(adresse(k))?.clone(),
      put: async (k, antwort) => { m.delete(adresse(k)); m.set(adresse(k), antwort); },
      keys: async () => [...m.keys()].map(url => ({ url })),
      delete: async k => m.delete(adresse(k))
    };
  };
  const umgebung = vm.createContext({
    self: { location: { hostname, origin: "https://" + hostname }, addEventListener: (name, fn) => { ereignisse[name] = fn; }, skipWaiting() {} },
    caches: { open: async name => cache(name), has: async name => speicher.has(name), keys: async () => [...speicher.keys()], delete: async name => speicher.delete(name) },
    fetch: async anfrage => { netz.anfragen.push(anfrage.url); if (!netz.antwort) throw new TypeError("kein Netz"); return netz.antwort(); },
    Response, Headers, Request, URL, Date, Promise, RegExp, Number, Math, String
  });
  vm.runInContext(sw, umgebung);
  return { umgebung, speicher, ereignisse, netz, cache };
}

const KACHEL = "https://tile.openstreetmap.org/12/2139/1420.png";
const START = Date.parse("2026-10-11T12:00:00Z"), STUNDE = 3600e3, TAGE = 24 * STUNDE;
// So antwortet der Server von OpenStreetMap: rund 6 Tage frisch, danach bei Fehlern noch 7 Tage nutzbar.
const antwortOsm = (inhalt = "bild", jetzt = START) => () => new Response(inhalt, { headers: {
  "content-type": "image/png", "cache-control": "max-age=525885, stale-while-revalidate=604800, stale-if-error=604800",
  expires: new Date(jetzt + 6 * TAGE).toUTCString() } });

test("Kachel: einmal angesehen kommt sie frisch aus dem Cache, ohne das Netz zu fragen", async () => {
  const s = starteSw();
  s.netz.antwort = antwortOsm();
  assert.equal(await (await s.umgebung.kachel({ url: KACHEL }, START)).text(), "bild");
  assert.equal(await (await s.umgebung.kachel({ url: KACHEL }, START + 5 * TAGE)).text(), "bild");
  assert.deepEqual(s.netz.anfragen, [KACHEL]);
});

test("Kachel: nach Ablauf wird neu geholt und der Cache erneuert", async () => {
  const s = starteSw();
  s.netz.antwort = antwortOsm("alt");
  await s.umgebung.kachel({ url: KACHEL }, START);
  s.netz.antwort = antwortOsm("neu", START + 7 * TAGE);
  assert.equal(await (await s.umgebung.kachel({ url: KACHEL }, START + 7 * TAGE)).text(), "neu");
  s.netz.antwort = null;
  assert.equal(await (await s.umgebung.kachel({ url: KACHEL }, START + 8 * TAGE)).text(), "neu");
});

test("Kachel ohne Netz: abgelaufen noch 7 Tage nutzbar (stale-if-error), danach nicht mehr", async () => {
  const s = starteSw();
  s.netz.antwort = antwortOsm();
  await s.umgebung.kachel({ url: KACHEL }, START);
  s.netz.antwort = null;
  assert.equal(await (await s.umgebung.kachel({ url: KACHEL }, START + 12 * TAGE)).text(), "bild");
  await assert.rejects(s.umgebung.kachel({ url: KACHEL }, START + 14 * TAGE));
  // Nie angesehen und kein Netz: keine Kachel, die Karte bleibt dort grau.
  await assert.rejects(s.umgebung.kachel({ url: "https://tile.openstreetmap.org/12/1/1.png" }, START));
});

test("Kachel: Serverfehler zeigt die alte Kachel, Fehler und unlesbare Antworten werden nicht gespeichert", async () => {
  const s = starteSw();
  s.netz.antwort = () => new Response("weg", { status: 404 });
  assert.equal((await s.umgebung.kachel({ url: KACHEL }, START)).status, 404);
  assert.equal(s.speicher.get("fang-check-kacheln-1").size, 0);
  s.netz.antwort = antwortOsm();
  await s.umgebung.kachel({ url: KACHEL }, START);
  s.netz.antwort = () => new Response("kaputt", { status: 503 });
  assert.equal(await (await s.umgebung.kachel({ url: KACHEL }, START + 8 * TAGE)).text(), "bild");
});

test("Kachel ohne Cache-Angaben gilt 7 Tage", async () => {
  const s = starteSw();
  s.netz.antwort = () => new Response("bild");
  await s.umgebung.kachel({ url: KACHEL }, START);
  s.netz.antwort = null;
  assert.equal(await (await s.umgebung.kachel({ url: KACHEL }, START + 7 * TAGE - STUNDE)).text(), "bild");
  await assert.rejects(s.umgebung.kachel({ url: KACHEL }, START + 7 * TAGE + STUNDE));
});

test("Kachel-Cache hat eine Obergrenze, die ältesten Kacheln fallen heraus", async () => {
  const s = starteSw(), c = s.cache("fang-check-kacheln-1");
  for (let i = 0; i < 1010; i++) await c.put("https://tile.openstreetmap.org/15/" + i + "/1.png", antwortOsm()());
  s.netz.antwort = antwortOsm();
  await s.umgebung.kachel({ url: KACHEL }, START);
  const adressen = [...s.speicher.get("fang-check-kacheln-1").keys()];
  assert.equal(adressen.length, 1000);
  assert.equal(adressen[0], "https://tile.openstreetmap.org/15/11/1.png");
  assert.equal(adressen.at(-1), KACHEL);
});

test("Update der App löscht alte App-Caches, aber nicht die Kacheln", async () => {
  const s = starteSw();
  for (const name of ["fang-check-alt", "fang-check-fotos-alt", "fang-check-kacheln-1", "fremd"]) s.cache(name);
  let fertig;
  s.ereignisse.activate({ waitUntil: p => { fertig = p; } });
  await fertig;
  assert.deepEqual([...s.speicher.keys()].sort(), ["fang-check-kacheln-1", "fremd"]);
});

test("Service Worker fasst nur die eigene App und die Kacheln von OpenStreetMap an", () => {
  const s = starteSw(), beantwortet = [];
  const frage = url => s.ereignisse.fetch({ request: { url, method: "GET", mode: "cors" }, respondWith: p => { beantwortet.push(url); Promise.resolve(p).catch(() => {}); } });
  for (const url of ["https://api.open-meteo.com/v1/forecast?latitude=48.33", "https://a.tile.openstreetmap.org/1/1/1.png", KACHEL, "https://murpsi.github.io/css/app.css"]) frage(url);
  assert.deepEqual(beantwortet, [KACHEL, "https://murpsi.github.io/css/app.css"]);
});
