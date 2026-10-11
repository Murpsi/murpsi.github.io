// Prüft die Logik der Karte: welche Fänge erscheinen, welcher Ausschnitt, Text der Blasen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mitPosition, rahmen, auswahlSchluessel, blase, punktName, hinweis, zeichnungAlsBild, KACHELN } from "../js/karte.js";
import { bildFuer } from "../js/fischbilder.js";

const fang = (id, lat, lon, mehr = {}) => ({ id, art: "hecht", artName: "Hecht", laenge: 62.5, zeit: "2026-10-11T14:30",
  position: lat === null ? null : { lat, lon, genauigkeit: 8 }, ...mehr });
const kinzig = fang("a", 48.3301, 8.0102), rench = fang("b", 48.5312, 7.9405), ohne = fang("c", null);

test("Nur Fänge mit Position kommen auf die Karte", () => {
  assert.deepEqual(mitPosition([kinzig, ohne, rench]).map(e => e.id), ["a", "b"]);
});

test("Rahmen: kleinstes Rechteck um alle Positionen, ohne Position null", () => {
  assert.deepEqual(rahmen([kinzig, ohne, rench]), [[48.3301, 7.9405], [48.5312, 8.0102]]);
  assert.deepEqual(rahmen([kinzig]), [[48.3301, 8.0102], [48.3301, 8.0102]]);
  assert.equal(rahmen([ohne]), null);
  assert.equal(rahmen([]), null);
});

test("Schlüssel der Auswahl: ändert sich mit Fängen und Orten, nicht mit Reihenfolge oder Wetter", () => {
  const s = auswahlSchluessel([kinzig, rench, ohne]);
  assert.equal(auswahlSchluessel([rench, { ...kinzig, wetter: { temperatur: 12 } }]), s);
  assert.notEqual(auswahlSchluessel([kinzig]), s);
  assert.notEqual(auswahlSchluessel([fang("a", 48.4, 8.0102), rench]), s);
  assert.equal(auswahlSchluessel([ohne]), "");
});

test("Blase: Anzahl als Text, Größe in drei Stufen", () => {
  assert.deepEqual([2, 9, 10, 99, 100].map(n => blase(n).groesse), [40, 40, 48, 48, 56]);
  assert.equal(blase(12).text, "12");
  assert.equal(blase(1200).text, "999+");
  assert.match(blase(12).name, /^12 Fänge/);
});

test("Name eines Punkts: Art, Länge mit Komma, Datum", () => {
  assert.equal(punktName(kinzig), "Hecht, 62,5 cm, 11.10.2026");
  assert.equal(punktName(fang("d", 48, 8, { laenge: null, zeit: "2026-03-01T06:05" })), "Hecht, 1.3.2026");
});

test("Hinweis unter der Karte nennt, wie viele Fänge fehlen", () => {
  assert.equal(hinweis([kinzig, rench]), "");
  assert.match(hinweis([kinzig, ohne, ohne]), /^1 von 3 Fängen/);
  assert.match(hinweis([ohne]), /hat eine Position/);
  assert.match(hinweis([]), /Kein Fang/);
});

test("Zeichnung als Bild: Data-URL ohne CSS-Variablen, unbekannte Art ergibt nichts", () => {
  const bild = zeichnungAlsBild(bildFuer("hecht"));
  assert.ok(bild.startsWith("data:image/svg+xml,"));
  const svg = decodeURIComponent(bild.slice("data:image/svg+xml,".length));
  assert.ok(svg.startsWith("<svg") && !svg.includes("var(--"));
  assert.equal(zeichnungAlsBild(bildFuer("gibt-es-nicht")), "");
});

test("Kacheln: genau die erlaubte Adresse von OpenStreetMap, Nennung mit Link", () => {
  assert.equal(KACHELN.adresse, "https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  assert.match(KACHELN.nachweis, /^© <a href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>OpenStreetMap<\/a>-Mitwirkende$/);
});
