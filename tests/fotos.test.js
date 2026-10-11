// Prüft die Fotonachweise: Ohne Urheber, freie Lizenz und Quelle darf kein Foto in der App landen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { lizenzErlaubt, bereinigeFotos, nachweis, quellenMd } from "../js/fotos.js";
import { webpGroesse } from "../tools/webp.mjs";

const wurzel = new URL("../", import.meta.url);
const lies = pfad => readFileSync(new URL(pfad, wurzel));
const daten = JSON.parse(lies("data/fotos.json"));
const arten = JSON.parse(lies("data/regeln-bw.json")).arten;
const ordner = new URL("assets/fotos/", wurzel);
const dateien = existsSync(ordner) ? readdirSync(ordner).filter(d => d.endsWith(".webp")) : [];

// Beispiel für die Tests, kein echtes Foto.
const beispiel = (mehr = {}) => ({ datei: "hecht.webp", urheber: "Erika Muster", lizenz: "CC BY-SA 4.0",
  lizenzUrl: "https://creativecommons.org/licenses/by-sa/4.0", quelle: "https://commons.wikimedia.org/wiki/File:Beispiel.jpg",
  bearbeitung: "verkleinert", breite: 800, hoehe: 400, ...mehr });
const eins = f => bereinigeFotos({ fotos: { hecht: f } }).hecht;

test("Lizenzen: nur frei mit Bearbeitung, kein NC, kein ND, keine GFDL", () => {
  for (const l of ["CC0", "CC0 1.0", "Public domain", "CC BY 2.0", "CC BY 4.0", "CC BY-SA 2.5", "CC BY-SA 3.0", "CC BY-SA 3.0 de", "CC BY-SA 4.0"])
    assert.ok(lizenzErlaubt(l), l);
  for (const l of ["CC BY-NC 4.0", "CC BY-NC-SA 3.0", "CC BY-ND 4.0", "GFDL", "Copyrighted free use", "FAL", "", null, undefined, "CC BY-SA"])
    assert.ok(!lizenzErlaubt(l), String(l));
});

test("Nachweis: vollständiger Eintrag wird übernommen", () => {
  const f = eins(beispiel());
  assert.equal(f.src, "assets/fotos/hecht.webp");
  assert.equal(nachweis(f), "Foto: Erika Muster, CC BY-SA 4.0, Wikimedia Commons, verkleinert");
});

test("Nachweis: gemeinfrei braucht keinen Lizenztext, Sammelart nennt das Beispiel", () => {
  const f = eins(beispiel({ lizenz: "Public domain", lizenzUrl: undefined, zeigt: "Bachneunauge" }));
  assert.equal(nachweis(f), "Beispiel: Bachneunauge. Foto: Erika Muster, gemeinfrei, Wikimedia Commons, verkleinert");
});

test("Nachweis: unvollständige oder unfreie Einträge ergeben kein Foto", () => {
  const schlecht = [{ urheber: "" }, { urheber: undefined }, { lizenz: "CC BY-NC 4.0" }, { lizenz: undefined }, { lizenzUrl: undefined },
    { lizenzUrl: "https://example.org/lizenz" }, { quelle: undefined }, { quelle: "https://example.org/bild.jpg" },
    { quelle: "http://commons.wikimedia.org/wiki/File:Beispiel.jpg" }, { quelle: "javascript:alert(1)" }, { datei: "zander.webp" }, { datei: "../hecht.webp" }];
  for (const s of schlecht) assert.equal(eins(beispiel(s)), undefined, JSON.stringify(s));
  for (const kaputt of [null, undefined, {}, { fotos: null }, { fotos: [] }, { fotos: { hecht: null } }, "text"])
    assert.deepEqual(bereinigeFotos(kaputt), {});
});

test("Daten: jedes Foto hat einen gültigen Nachweis und jeder Nachweis ein Foto", () => {
  const fotos = bereinigeFotos(daten);
  assert.deepEqual(Object.keys(fotos).sort(), Object.keys(daten.fotos).sort(), "Ein Eintrag in data/fotos.json ist unvollständig");
  assert.deepEqual(dateien.map(d => d.replace(".webp", "")).sort(), Object.keys(fotos).sort(), "assets/fotos/ und data/fotos.json passen nicht zusammen");
  for (const id of Object.keys(fotos)) assert.ok(arten.some(a => a.id === id), id + " ist keine Art aus regeln-bw.json");
});

test("Daten: Fotos sind WebP, höchstens 800 px breit und 150 KB groß", () => {
  for (const d of dateien) {
    const inhalt = lies("assets/fotos/" + d), g = webpGroesse(inhalt), f = daten.fotos[d.replace(".webp", "")];
    assert.ok(g, d + " ist keine WebP-Datei");
    assert.ok(g.breite <= 800, d + " ist breiter als 800 px");
    assert.ok(inhalt.length <= 150 * 1024, d + " ist größer als 150 KB");
    assert.deepEqual([f.breite, f.hoehe], [g.breite, g.hoehe], d + ": Größe in fotos.json stimmt nicht");
  }
});

test("Daten: QUELLEN.md passt zu fotos.json", () => {
  if (!dateien.length) return;
  const namen = Object.fromEntries(arten.map(a => [a.id, a.name]));
  assert.equal(lies("assets/fotos/QUELLEN.md").toString("utf8").replaceAll("\r\n", "\n"), quellenMd(bereinigeFotos(daten), namen),
    "QUELLEN.md ist veraltet: node tools/foto.mjs --quellen");
});
