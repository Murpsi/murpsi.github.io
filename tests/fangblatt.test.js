// Prüft die Logik des Fangblatts: Sonnenstand, Tageszeit, Himmel, Mond und die Angaben in den Kacheln.
import { test } from "node:test";
import assert from "node:assert/strict";
import { weltzeit, sonnenstand, tageszeit, himmel, himmelSvg, mondSvg, fakten, nachbarn } from "../js/fangblatt.js";

const stuttgart = { lat: 48.78, lon: 9.18, genauigkeit: 10 };
const fang = (mehr = {}) => ({ id: "a", art: "hecht", artName: "Hecht", laenge: 62.5, zeit: "2026-06-21T13:25", gewaesser: "Kinzig",
  position: stuttgart, foto: null, vorschau: null, verbleib: "entnommen", notiz: "", wetter: null, ...mehr });
const wetter = (mehr = {}) => ({ zeit: "2026-06-21T13:00", lat: 48.78, lon: 9.18, temperatur: 24.5, luftdruck: 1016.4, drucktrend: -1.6,
  wind: 12, windrichtung: 230, boeen: 28, bewoelkung: 40, niederschlag: 0, abgerufen: "2026-06-21T12:00:00.000Z", ...mehr });
const nahe = (ist, soll, toleranz, text) => assert.ok(Math.abs(ist - soll) <= toleranz, `${text}: ${ist} statt ${soll} ± ${toleranz}`);

test("Weltzeit: Sommerzeit zwei Stunden, Winterzeit eine Stunde, Umstellung am letzten Sonntag", () => {
  assert.equal(weltzeit("2026-06-21T13:25"), Date.UTC(2026, 5, 21, 11, 25));
  assert.equal(weltzeit("2026-12-21T12:00"), Date.UTC(2026, 11, 21, 11, 0));
  // 2026 beginnt die Sommerzeit am 29. März und endet am 25. Oktober.
  assert.equal(weltzeit("2026-03-28T12:00"), Date.UTC(2026, 2, 28, 11, 0));
  assert.equal(weltzeit("2026-03-29T12:00"), Date.UTC(2026, 2, 29, 10, 0));
  assert.equal(weltzeit("2026-10-24T12:00"), Date.UTC(2026, 9, 24, 10, 0));
  assert.equal(weltzeit("2026-10-25T12:00"), Date.UTC(2026, 9, 25, 11, 0));
  assert.equal(weltzeit("gestern"), null);
});

test("Sonnenstand: Mittagshöhe an den Sonnenwenden, Aufgang und Untergang in Stuttgart", () => {
  // Mittagshöhe = 90° − Breite ± 23,44° Schiefe der Erdachse.
  nahe(sonnenstand("2026-06-21T13:25", stuttgart).hoehe, 90 - 48.78 + 23.44, 0.5, "Sommersonnenwende mittags");
  nahe(sonnenstand("2026-12-21T12:21", stuttgart).hoehe, 90 - 48.78 - 23.44, 0.5, "Wintersonnenwende mittags");
  // Sonnenaufgang am 21. Juni in Stuttgart gegen 5:21 Uhr, Untergang gegen 21:30 Uhr (Sommerzeit).
  nahe(sonnenstand("2026-06-21T05:21", stuttgart).hoehe, -0.8, 1, "Aufgang");
  nahe(sonnenstand("2026-06-21T21:30", stuttgart).hoehe, -0.8, 1, "Untergang");
  assert.equal(sonnenstand("2026-06-21T09:00", stuttgart).steigend, true);
  assert.equal(sonnenstand("2026-06-21T17:00", stuttgart).steigend, false);
  assert.ok(sonnenstand("2026-06-21T01:30", stuttgart).hoehe < -15);
  // Ohne Position rechnet die App mit der Mitte des Landes.
  nahe(sonnenstand("2026-06-21T13:25", null).hoehe, 64.8, 1, "ohne Position");
  assert.equal(sonnenstand("unsinn", stuttgart), null);
});

test("Tageszeit: Nacht unter −6°, Tag über +6°, dazwischen Dämmerung", () => {
  assert.deepEqual([-30, -6.1, -6, 0, 5.9, 6, 60].map(tageszeit), ["nacht", "nacht", "daemmerung", "daemmerung", "daemmerung", "tag", "tag"]);
  assert.equal(himmel(fang({ zeit: "2026-06-21T13:25" })).tageszeit, "tag");
  assert.equal(himmel(fang({ zeit: "2026-06-21T05:20" })).tageszeit, "daemmerung");
  assert.equal(himmel(fang({ zeit: "2026-06-21T01:00" })).tageszeit, "nacht");
  assert.equal(himmel(fang({ zeit: "2026-12-21T17:30" })).tageszeit, "nacht", "im Winter ist es um halb sechs dunkel");
});

test("Himmel: Wetter nur, wenn es zum Fang passt, Mond immer", () => {
  const ohne = himmel(fang());
  assert.deepEqual([ohne.bewoelkung, ohne.regen, ohne.wind], [null, null, null]);
  const mit = himmel(fang({ wetter: wetter({ bewoelkung: 80, niederschlag: 2.5 }) }));
  assert.deepEqual([mit.bewoelkung, mit.regen, mit.wind], [80, 2.5, 12]);
  // Uhrzeit geändert: das alte Wetter gilt nicht mehr.
  assert.equal(himmel(fang({ zeit: "2026-06-21T18:00", wetter: wetter() })).bewoelkung, null);
  // Vollmond am 29. Juni 2026, Neumond am 15. Juni 2026.
  assert.ok(himmel(fang({ zeit: "2026-06-29T23:00" })).mond.beleuchtet > 0.97);
  assert.ok(himmel(fang({ zeit: "2026-06-15T04:00" })).mond.beleuchtet < 0.03);
  assert.equal(himmel(fang({ zeit: "2026-06-22T23:00" })).mond.zunehmend, true);
  assert.equal(himmel(fang({ zeit: "2026-07-06T23:00" })).mond.zunehmend, false);
  assert.equal(himmel(fang({ zeit: "kaputt" })), null);
});

test("Mond als Zeichnung: Halbmond hat eine gerade Grenze, abnehmender Mond ist gespiegelt", () => {
  assert.match(mondSvg({ beleuchtet: 0.5, zunehmend: true }, 10, 20, 24), /A0\.00,24 /);
  assert.match(mondSvg({ beleuchtet: 1, zunehmend: true }, 10, 20, 24), /A24\.00,24 0 0 1 /);
  assert.match(mondSvg({ beleuchtet: 0.1, zunehmend: true }, 10, 20, 24), /A19\.20,24 0 0 0 /);
  assert.equal(mondSvg({ beleuchtet: 0.3, zunehmend: true }, 10, 20, 24).includes("scale(-1,1)"), false);
  assert.equal(mondSvg({ beleuchtet: 0.3, zunehmend: false }, 10, 20, 24).includes("scale(-1,1)"), true);
});

test("Himmel als Zeichnung: Sterne nur nachts, Wolken nach Bewölkung, Regen nur bei Niederschlag", () => {
  const zaehle = (svg, klasse) => svg.split('class="' + klasse + '"').length - 1;
  const tag = himmelSvg(himmel(fang({ wetter: wetter({ bewoelkung: 40 }) })), "a");
  assert.ok(tag.startsWith("<svg") && tag.endsWith("</svg>"));
  assert.deepEqual([zaehle(tag, "stern"), zaehle(tag, "wolke"), zaehle(tag, "regen")], [0, 2, 0]);
  assert.equal(tag.includes("#2a3352"), false, "tagsüber steht die Sonne am Himmel, nicht der Mond");

  const nacht = himmelSvg(himmel(fang({ zeit: "2026-06-21T01:00" })), "a");
  assert.equal(zaehle(nacht, "stern"), 40);
  assert.equal(zaehle(nacht, "wolke"), 0);
  assert.ok(nacht.includes("#2a3352"), "nachts ist der Mond zu sehen");

  const regen = himmelSvg(himmel(fang({ zeit: "2026-06-21T01:00", wetter: wetter({ zeit: "2026-06-21T01:00", bewoelkung: 100, niederschlag: 5 }) })), "a");
  assert.deepEqual([zaehle(regen, "stern"), zaehle(regen, "wolke"), zaehle(regen, "regen")], [0, 5, 1]);
  assert.equal(regen.split("<line ").length - 1, 40);
  assert.equal(regen.includes("#2a3352"), false, "unter geschlossener Wolkendecke ist der Mond nicht zu sehen");
  // Derselbe Fang ergibt immer dieselbe Zeichnung, ein anderer eine andere.
  assert.equal(himmelSvg(himmel(fang({ zeit: "2026-06-21T01:00" })), "a"), nacht);
  assert.notEqual(himmelSvg(himmel(fang({ zeit: "2026-06-21T01:00" })), "b"), nacht);
  assert.equal(/NaN|undefined|null/.test(tag + nacht + regen), false);
});

test("Kacheln: Angaben des Fangs, Wetter nur wenn vorhanden", () => {
  const VERBLEIB = { entnommen: "entnommen", zurueckgesetzt: "zurückgesetzt" };
  assert.deepEqual(fakten(fang(), VERBLEIB), [{ name: "Länge", wert: "62,5 cm" }, { name: "Datum", wert: "21.6.2026" }, { name: "Uhrzeit", wert: "13:25 Uhr" },
    { name: "Gewässer", wert: "Kinzig" }, { name: "Verbleib", wert: "entnommen" }, { name: "Mond", wert: "Erstes Viertel · 39 %" }]);
  assert.deepEqual(fakten(fang({ laenge: null, gewaesser: "" }), VERBLEIB).map(f => f.name), ["Datum", "Uhrzeit", "Verbleib", "Mond"]);
  const mit = Object.fromEntries(fakten(fang({ wetter: wetter({ niederschlag: 1.2 }) }), VERBLEIB).map(f => [f.name, f.wert]));
  assert.equal(mit.Luft, "24,5 °C");
  assert.equal(mit.Luftdruck, "1016 hPa · fallend");
  assert.equal(mit.Wind, "12 km/h aus SW · Böen 28");
  assert.equal(mit.Himmel, "wolkig");
  assert.equal(mit.Niederschlag, "Regen · 1,2 mm");
  assert.equal(Object.fromEntries(fakten(fang({ wetter: wetter() })).map(f => [f.name, f.wert])).Niederschlag, "trocken");
  // Wetter aus der Zeit vor dem Niederschlag: die Kachel fehlt, statt "trocken" zu behaupten.
  assert.equal(fakten(fang({ wetter: wetter({ niederschlag: null }) })).some(f => f.name === "Niederschlag"), false);
});

test("Blättern: voriger und nächster Fang in der Reihenfolge der Liste", () => {
  const liste = [{ id: "c" }, { id: "b" }, { id: "a" }];
  assert.deepEqual(nachbarn(liste, "b"), { stelle: 2, anzahl: 3, vor: { id: "c" }, nach: { id: "a" } });
  assert.deepEqual(nachbarn(liste, "c"), { stelle: 1, anzahl: 3, vor: null, nach: { id: "b" } });
  assert.equal(nachbarn(liste, "x"), null);
});
