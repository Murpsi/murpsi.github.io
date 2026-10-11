// Prüft die Zähllogik der Auswertung: Monat, Art, Gewässer, Tageszeit, Luftdrucktrend und Mondphase.
import { test } from "node:test";
import assert from "node:assert/strict";
import { auswertung, sonnenAbschnitt, WENIGE, BALKEN } from "../js/auswertung.js";

const stuttgart = { lat: 48.78, lon: 9.18, genauigkeit: 10 };
let nr = 0;
const fang = (mehr = {}) => ({ id: "f" + nr++, art: "hecht", artName: "Hecht", laenge: 62.5, zeit: "2026-06-21T13:25", gewaesser: "Kinzig",
  position: stuttgart, foto: null, vorschau: null, verbleib: "entnommen", notiz: "", wetter: null, ...mehr });
const wetter = (mehr = {}) => ({ zeit: "2026-06-21T13:00", lat: 48.78, lon: 9.18, temperatur: 24.5, luftdruck: 1016.4, drucktrend: -1.6,
  wind: 12, windrichtung: 230, boeen: 28, bewoelkung: 40, niederschlag: 0, abgerufen: "2026-06-21T12:00:00.000Z", ...mehr });
const zahlen = gruppen => gruppen.map(g => g.anzahl);
const summe = gruppen => zahlen(gruppen).reduce((a, b) => a + b, 0);
const von = (gruppen, name) => gruppen.find(g => g.name === name).anzahl;

test("Leeres Fangbuch: alle Gruppen stehen da und sind null", () => {
  const a = auswertung([]);
  assert.equal(a.anzahl, 0);
  assert.equal(a.wenige, false);
  assert.deepEqual(zahlen(a.monat), Array(12).fill(0));
  assert.deepEqual(zahlen(a.uhrzeit), Array(12).fill(0));
  assert.deepEqual(zahlen(a.sonne), Array(5).fill(0));
  assert.deepEqual(zahlen(a.mond), Array(8).fill(0));
  assert.deepEqual(a.art, []);
  assert.deepEqual(a.gewaesser, []);
  assert.deepEqual(a.koeder, []);
  assert.deepEqual(a.drucktrend, { gruppen: [{ name: "steigend", lang: "steigend", anzahl: 0 },
    { name: "gleichbleibend", lang: "gleichbleibend", anzahl: 0 }, { name: "fallend", lang: "fallend", anzahl: 0 }], ohne: 0 });
});

test("Jede Auswertung zählt jeden Fang genau einmal", () => {
  const faenge = [fang(), fang({ zeit: "2025-12-20T17:40", art: "quappe", artName: "Quappe", gewaesser: "" }),
    fang({ wetter: wetter() }), fang({ zeit: "2026-03-28T00:00", position: null }), fang({ zeit: "2026-10-03T23:59", gewaesser: "Rhein" })];
  const a = auswertung(faenge);
  assert.equal(a.anzahl, 5);
  for (const name of ["monat", "art", "gewaesser", "uhrzeit", "sonne", "mond"]) assert.equal(summe(a[name]), 5, name);
  assert.equal(summe(a.drucktrend.gruppen) + a.drucktrend.ohne, 5);
});

test("Monat: aus dem Text der Ortszeit, Jahre zusammen, Grenze um Mitternacht", () => {
  const a = auswertung([fang({ zeit: "2026-01-31T23:59" }), fang({ zeit: "2026-02-01T00:00" }), fang({ zeit: "2025-02-28T12:00" }), fang({ zeit: "2026-12-31T23:59" })]);
  assert.deepEqual(zahlen(a.monat), [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(a.monat[2], { name: "Mär", lang: "März", anzahl: 0 });
});

test("Uhrzeit: zwölf Blöcke von zwei Stunden, die untere Grenze gehört dazu", () => {
  const a = auswertung(["00:00", "01:59", "02:00", "13:25", "21:59", "22:00", "23:59"].map(u => fang({ zeit: "2026-06-21T" + u })));
  assert.deepEqual(zahlen(a.uhrzeit), [2, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 2]);
  assert.deepEqual(a.uhrzeit[11], { name: "22", lang: "22 bis 24 Uhr", anzahl: 2 });
});

test("Sonnenstand: Dämmerung morgens und abends, Vormittag, Nachmittag, Nacht", () => {
  // 21. Juni in Stuttgart: Aufgang gegen 5:21 Uhr, höchster Stand gegen 13:25 Uhr, Untergang gegen 21:30 Uhr.
  const am = zeit => sonnenAbschnitt(fang({ zeit }));
  assert.equal(am("2026-06-21T05:21"), "Morgendämmerung");
  assert.equal(am("2026-06-21T10:00"), "Vormittag");
  assert.equal(am("2026-06-21T12:30"), "Vormittag", "vor dem höchsten Stand, obwohl nach 12 Uhr");
  assert.equal(am("2026-06-21T16:00"), "Nachmittag");
  assert.equal(am("2026-06-21T21:30"), "Abenddämmerung");
  assert.equal(am("2026-06-21T01:00"), "Nacht");
  // Im Winter ist dieselbe Uhrzeit ein anderer Abschnitt.
  assert.equal(am("2026-12-20T17:40"), "Nacht");
  assert.equal(am("2026-06-20T17:40"), "Nachmittag");
  assert.equal(sonnenAbschnitt(fang({ zeit: "gestern" })), null);
});

test("Sonnenstand: ohne Position gilt die Mitte des Landes, die Reihenfolge folgt dem Tag", () => {
  const a = auswertung([fang({ zeit: "2026-06-21T10:00", position: null }), fang({ zeit: "2026-06-21T01:00", position: null })]);
  assert.deepEqual(a.sonne.map(g => g.name), ["Morgendämmerung", "Vormittag", "Nachmittag", "Abenddämmerung", "Nacht"]);
  assert.deepEqual(zahlen(a.sonne), [0, 1, 0, 0, 1]);
});

test("Luftdrucktrend: nur Wetter, das zum Fang passt, Grenze bei 1 hPa in 6 Stunden", () => {
  const mit = trend => fang({ wetter: wetter({ drucktrend: trend }) });
  const a = auswertung([mit(1), mit(3.2), mit(0.9), mit(-0.9), mit(0), mit(-1), mit(null), fang(),
    // Uhrzeit nach dem Abruf geändert: Das Wetter gehört nicht mehr zum Fang.
    fang({ zeit: "2026-06-21T15:25", wetter: wetter({ drucktrend: 4 }) }),
    // Ohne Position gibt es kein passendes Wetter.
    fang({ position: null, wetter: wetter({ drucktrend: 4 }) })]);
  assert.deepEqual(a.drucktrend.gruppen.map(g => [g.name, g.anzahl]), [["steigend", 2], ["gleichbleibend", 3], ["fallend", 1]]);
  assert.equal(a.drucktrend.ohne, 4);
});

test("Mondphase: acht Phasen in ihrer Reihenfolge", () => {
  // Neumond am 15. Juni 2026, Vollmond am 29. Juni 2026.
  const a = auswertung([fang({ zeit: "2026-06-15T02:10" }), fang({ zeit: "2026-06-29T23:40" }), fang({ zeit: "2026-06-30T01:00" })]);
  assert.equal(a.mond.length, 8);
  assert.equal(a.mond[0].name, "Neumond");
  assert.equal(von(a.mond, "Neumond"), 1);
  assert.equal(von(a.mond, "Vollmond"), 2);
});

test("Art: häufigste zuerst, bei Gleichstand nach Name, gezählt nach der Art und nicht nach dem Namen", () => {
  const a = auswertung([fang({ art: "zander", artName: "Zander" }), fang({ art: "aal", artName: "Aal" }), fang(), fang(),
    fang({ art: "aesche", artName: "Äsche" }), fang({ art: "aal", artName: "Europäischer Aal" })]);
  assert.deepEqual(a.art, [{ name: "Europäischer Aal", anzahl: 2 }, { name: "Hecht", anzahl: 2 }, { name: "Äsche", anzahl: 1 }, { name: "Zander", anzahl: 1 }]);
});

test("Gewässer: leerer Name ist „ohne Angabe“, die Schreibweise zählt wie im Filter", () => {
  const a = auswertung([fang(), fang({ gewaesser: "" }), fang({ gewaesser: "" }), fang({ gewaesser: "kinzig" })]);
  assert.deepEqual(a.gewaesser, [{ name: "ohne Angabe", anzahl: 2 }, { name: "kinzig", anzahl: 1 }, { name: "Kinzig", anzahl: 1 }]);
});

test("Viele Arten: neun passen noch, ab zehn fasst der letzte Balken den Rest zusammen", () => {
  const arten = n => Array.from({ length: n }, (_, i) => fang({ art: "art" + i, artName: "Art " + String(i).padStart(2, "0") }));
  assert.equal(auswertung(arten(BALKEN + 1)).art.length, BALKEN + 1);
  const a = auswertung([...arten(BALKEN + 4), fang({ art: "art11", artName: "Art 11" })]);
  assert.equal(a.art.length, BALKEN + 1);
  assert.deepEqual(a.art[0], { name: "Art 11", anzahl: 2 });
  assert.deepEqual(a.art[BALKEN], { name: "4 weitere Arten", anzahl: 4, rest: true });
  assert.equal(summe(a.art), BALKEN + 5);
});

test("Köder: ohne Rücksicht auf Groß- und Kleinschreibung, leer ist „ohne Angabe“, ohne jeden Köder keine Auswertung", () => {
  assert.deepEqual(auswertung([fang(), fang({ koeder: "" })]).koeder, []);
  // Einträge von vor dem Feld haben es gar nicht.
  const a = auswertung([fang({ koeder: "Tauwurm" }), fang({ koeder: "tauwurm" }), fang({ koeder: "Wobbler" }), fang(), fang({ koeder: "" }), fang({ koeder: "" })]);
  assert.deepEqual(a.koeder, [{ name: "tauwurm", anzahl: 2 }, { name: "Wobbler", anzahl: 1 }, { name: "ohne Angabe", anzahl: 3, rest: true }]);
  assert.equal(summe(a.koeder), 6);
});

test("Größte Fänge: der längste jeder Art, längste Art zuerst, Fänge ohne Länge zählen nicht", () => {
  const a = auswertung([fang({ id: "h1", laenge: 62.5, zeit: "2026-05-01T08:00" }), fang({ id: "h2", laenge: 78, zeit: "2026-06-21T13:20", gewaesser: "Baggersee" }),
    fang({ id: "h3", laenge: 78, zeit: "2026-08-01T09:00" }), fang({ id: "w", art: "wels", artName: "Wels", laenge: 124 }),
    fang({ id: "k", art: "edelkrebs_m", artName: "Edelkrebs", laenge: null })]);
  assert.deepEqual(a.groesste, [{ id: "w", name: "Wels", laenge: 124, zeit: "2026-06-21T13:25", gewaesser: "Kinzig" },
    { id: "h2", name: "Hecht", laenge: 78, zeit: "2026-06-21T13:20", gewaesser: "Baggersee" }]);
  assert.deepEqual(auswertung([]).groesste, []);
});

test("Wenige Fänge: Hinweis unter der Grenze, nicht beim leeren Fangbuch", () => {
  const n = anzahl => auswertung(Array.from({ length: anzahl }, () => fang())).wenige;
  assert.equal(n(1), true);
  assert.equal(n(WENIGE - 1), true);
  assert.equal(n(WENIGE), false);
});
