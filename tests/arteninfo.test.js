// Prüft die Bestimmungshilfe: benannte Merkmale mit Position im Bild und weitere Eigenschaften der Art.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bereinigeInfo, markierungen } from "../js/arteninfo.js";
import { bereinigeFotos } from "../js/fotos.js";

const lies = pfad => JSON.parse(readFileSync(new URL("../" + pfad, import.meta.url)));
const daten = lies("data/arten-info.json"), arten = lies("data/regeln-bw.json").arten, fotos = bereinigeFotos(lies("data/fotos.json"));

const beispiel = { wissenschaftlich: "Esox lucius", groesse: "Bis 100 cm.", merkmale: [
  { name: "Maul", text: "Lang und flach.", foto: [7, 50], zeichnung: [8, 50] },
  { name: "Flecken", text: "Hell.", zeichnung: [45, 48] }] };

test("Info: Merkmale behalten ihre Reihenfolge, Eigenschaften bekommen ihre Namen", () => {
  const i = bereinigeInfo({ arten: { hecht: beispiel } }).hecht;
  assert.deepEqual(i.merkmale.map(m => m.name), ["Maul", "Flecken"]);
  assert.deepEqual(i.eigenschaften, [{ name: "Wissenschaftlicher Name", text: "Esox lucius" }, { name: "Größe", text: "Bis 100 cm." }]);
});

test("Info: Markierung nur, wo es für die Bildart eine Position gibt", () => {
  const i = bereinigeInfo({ arten: { hecht: beispiel } }).hecht;
  assert.deepEqual(markierungen(i, "foto").map(m => [m.nr, m.ort]), [[1, [7, 50]], [2, null]]);
  assert.deepEqual(markierungen(i, "zeichnung").map(m => [m.nr, m.ort]), [[1, [8, 50]], [2, [45, 48]]]);
  assert.deepEqual(markierungen(undefined, "foto"), []);
});

test("Info: unlesbare Angaben fallen weg, nichts stürzt ab", () => {
  const i = bereinigeInfo({ arten: { hecht: { groesse: 12, merkmale: [null, "x", { name: "Ohne Text" }, { name: "Maul", text: "Lang.", foto: [120, 50], zeichnung: ["8", 50] },
    { name: "Flosse", text: "Hinten.", foto: [50], zeichnung: [0, 100] }] } } }).hecht;
  assert.deepEqual(i.eigenschaften, []);
  assert.deepEqual(i.merkmale, [{ name: "Maul", text: "Lang.", foto: null, zeichnung: null }, { name: "Flosse", text: "Hinten.", foto: null, zeichnung: [0, 100] }]);
  for (const kaputt of [null, undefined, "text", {}, { arten: null }, { arten: [] }, { arten: { hecht: null } }, { arten: { hecht: { merkmale: "x" } } }, { arten: { "../x": beispiel } }])
    assert.deepEqual(bereinigeInfo(kaputt), {});
});

test("Daten: jede Angabe gehört zu einer Art und ist vollständig lesbar", () => {
  const info = bereinigeInfo(daten);
  assert.deepEqual(Object.keys(info).sort(), Object.keys(daten.arten).sort());
  for (const [id, roh] of Object.entries(daten.arten)) {
    assert.ok(arten.some(a => a.id === id), id + " ist keine Art aus regeln-bw.json");
    assert.equal(info[id].merkmale.length, roh.merkmale.length, id + ": ein Merkmal ist unlesbar");
    assert.ok(info[id].merkmale.length >= 2, id + ": zu wenige Merkmale");
    assert.equal(info[id].eigenschaften.length, 5, id + ": eine Eigenschaft fehlt");
    assert.equal(new Set(info[id].merkmale.map(m => m.name)).size, info[id].merkmale.length, id + ": Merkmal doppelt");
    for (const [m, r] of info[id].merkmale.map((m, i) => [m, roh.merkmale[i]])) {
      assert.equal(!!m.foto, "foto" in r, id + " / " + m.name + ": Position im Foto unlesbar");
      assert.equal(!!m.zeichnung, "zeichnung" in r, id + " / " + m.name + ": Position in der Zeichnung unlesbar");
      assert.ok(m.foto || m.zeichnung, id + " / " + m.name + ": in keinem Bild markiert");
      if (m.foto) assert.ok(fotos[id], id + " / " + m.name + ": Position im Foto, aber kein Foto");
    }
  }
});

test("Daten: jede Art mit Foto hat markierte Merkmale", () => {
  const info = bereinigeInfo(daten);
  for (const id of Object.keys(fotos)) assert.ok(info[id] && info[id].merkmale.some(m => m.foto), id + ": Foto ohne markierte Merkmale");
});
