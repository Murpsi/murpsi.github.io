// Tests der Gewässerregeln: Kombination aus Landesrecht und Vereinsregel. Start: node --test
// Die Zahlen sind Beispiele für die Tests und keine Regeln eines echten Vereins.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pruefe } from "../js/regeln.js";
import { pruefeGewaesser, bereinigeGewaesser, gleichesGewaesser, woche, zaehle, vereinGeschont, alsGewaesserDatei, liesGewaesserDatei } from "../js/gewaesser.js";

const ARTEN = JSON.parse(readFileSync(new URL("../data/regeln-bw.json", import.meta.url), "utf8")).arten;
const art = id => ARTEN.find(a => a.id === id);
const tag = (t, m, jahr = 2027) => new Date(jahr, m - 1, t, 12);
const zeitraum = (t1, m1, t2, m2) => ({ von: { tag: t1, monat: m1 }, bis: { tag: t2, monat: m2 } });
const see = (mehr = {}) => ({ id: "g1", name: "Vereinssee Haslach", system: "rhein", lage: "uebrig", sperrzeit: null, regeln: {}, limits: [],
  weitereRegeln: "", erstellt: "2026-10-11T08:00:00.000Z", geaendert: "2026-10-11T08:00:00.000Z", ...mehr });
const regel = (mehr = {}) => ({ gesperrt: false, mindestmass: null, hoechstmass: null, schonzeit: null, entnahmepflicht: false, ...mehr });
const fang = (artId, zeit, mehr = {}) => ({ art: artId, zeit, gewaesser: "Vereinssee Haslach", verbleib: "entnommen", ...mehr });
const text = res => res.gruende.map(g => g.text).join(" ");
const vereinsText = res => res.gruende.filter(g => g.ebene === "verein").map(g => g.text).join(" ");

/* ---------- Pflichtfall aus ROADMAP.md ---------- */

test("Hecht 55 cm am Vereinsgewässer mit 60-cm-Regel: Zurücksetzen (Vereinsregel)", () => {
  const g = see({ regeln: { hecht: regel({ mindestmass: 60 }) } });
  const res = pruefeGewaesser(art("hecht"), g, tag(1, 7), 55, []);
  assert.equal(res.status, "stop");
  assert.equal(res.titel, "Zurücksetzen (Vereinsregel)");
  assert.match(vereinsText(res), /Untermaßig: 55 cm, es fehlen 5 cm bis 60 cm/);
  assert.equal(res.wirksam.mindestmass, 60);
  assert.equal(res.wirksam.mindestmassEbene, "verein");
  assert.equal(pruefe(art("hecht"), "rhein", "uebrig", tag(1, 7), 55).status, "ok", "nach Landesrecht allein wäre er erlaubt");

  const gross = pruefeGewaesser(art("hecht"), g, tag(1, 7), 62, []);
  assert.equal(gross.status, "ok");
  assert.equal(gross.titel, "Entnahme erlaubt");
});

/* ---------- Strengste Regel gewinnt ---------- */

test("Ohne Vereinsregel für die Art gilt das Landesrecht unverändert", () => {
  const g = see({ regeln: { zander: regel({ mindestmass: 60 }) } });
  for (const [t, m, laenge] of [[1, 7, 55], [1, 7, 45], [1, 3, 80], [1, 7, null]]) {
    const land = pruefe(art("hecht"), "rhein", "uebrig", tag(t, m), laenge), res = pruefeGewaesser(art("hecht"), g, tag(t, m), laenge, []);
    assert.equal(res.status, land.status);
    assert.equal(res.titel, land.titel);
    assert.deepEqual(res.gruende, land.gruende.map(x => ({ text: x, ebene: "land" })));
  }
});

test("Niedrigeres Vereinsmaß bleibt wirkungslos, das Landesmaß gilt weiter", () => {
  const g = see({ regeln: { hecht: regel({ mindestmass: 40 }) } });
  const res = pruefeGewaesser(art("hecht"), g, tag(1, 7), 45, []);
  assert.equal(res.status, "stop");
  assert.equal(res.titel, "Zurücksetzen");
  assert.equal(res.wirksam.mindestmass, 50);
  assert.equal(res.wirksam.mindestmassEbene, "land");
  assert.equal(vereinsText(res), "");
});

test("Stoppen Land und Verein, heißt es nur Zurücksetzen und beide Gründe stehen da", () => {
  const g = see({ regeln: { hecht: regel({ mindestmass: 60 }) } });
  const res = pruefeGewaesser(art("hecht"), g, tag(1, 3), 55, []);
  assert.equal(res.titel, "Zurücksetzen");
  assert.match(text(res), /Schonzeit bis 15\. Mai/);
  assert.match(vereinsText(res), /Untermaßig/);
});

test("Ganzjährig geschonte Art bleibt gesperrt, egal was der Verein einträgt", () => {
  const g = see({ regeln: { lachs: regel({ entnahmepflicht: true, mindestmass: 10 }) } });
  const res = pruefeGewaesser(art("lachs"), g, tag(1, 7), 80, []);
  assert.equal(res.status, "stop");
  assert.equal(res.titel, "Ganzjährig geschont");
  assert.equal(vereinsText(res), "");
});

test("Das Gewässer bringt System und Lage mit", () => {
  const main = see({ system: "main" });
  assert.equal(pruefeGewaesser(art("hecht"), main, tag(10, 5), 60, []).status, "ok", "Hecht im Main am 10.5. erlaubt");
  assert.equal(pruefeGewaesser(art("hecht"), see(), tag(10, 5), 60, []).status, "stop", "im Rhein-System geschont");
  assert.equal(pruefeGewaesser(art("bachforelle"), see({ lage: "hochrhein" }), tag(1, 6), 30, []).status, "stop", "Hochrhein 35 cm");
  assert.equal(pruefeGewaesser(art("bachforelle"), see(), tag(1, 6), 30, []).status, "ok");
});

/* ---------- Einzelne Regelarten ---------- */

test("Entnahmefenster: über dem Höchstmaß zurücksetzen, ohne Länge nie erlaubt", () => {
  const g = see({ regeln: { hecht: regel({ mindestmass: 60, hoechstmass: 80 }) } });
  assert.equal(pruefeGewaesser(art("hecht"), g, tag(1, 7), 70, []).status, "ok");
  assert.equal(pruefeGewaesser(art("hecht"), g, tag(1, 7), 80, []).status, "ok", "Höchstmaß selbst zählt noch");
  const gross = pruefeGewaesser(art("hecht"), g, tag(1, 7), 85, []);
  assert.equal(gross.titel, "Zurücksetzen (Vereinsregel)");
  assert.match(vereinsText(gross), /Über dem Höchstmaß: 85 cm, erlaubt bis 80 cm/);
  assert.equal(gross.wirksam.hoechstmass, 80);

  // Barsch hat kein Landesmaß. Mit Höchstmaß vom Verein darf die fehlende Länge trotzdem kein "erlaubt" ergeben.
  const barsch = see({ regeln: { barsch: regel({ hoechstmass: 35 }) } });
  assert.equal(pruefe(art("barsch"), "rhein", "uebrig", tag(1, 7), null).status, "ok");
  const ohne = pruefeGewaesser(art("barsch"), barsch, tag(1, 7), null, []);
  assert.equal(ohne.status, "warn");
  assert.equal(ohne.titel, "Länge fehlt");
});

test("Vereinsschonzeit gilt zusätzlich, auch über den Jahreswechsel, beide Grenztage zählen", () => {
  // Land: Bachforelle 1.10. bis 28.2. Der Verein verlängert bis 31.3.
  const g = see({ regeln: { bachforelle: regel({ schonzeit: zeitraum(1, 10, 31, 3) }) } });
  const maerz = pruefeGewaesser(art("bachforelle"), g, tag(15, 3), 30, []);
  assert.equal(maerz.titel, "Zurücksetzen (Vereinsregel)");
  assert.match(vereinsText(maerz), /Schonzeit bis 31\. Mär/);
  assert.equal(pruefeGewaesser(art("bachforelle"), g, tag(31, 3), 30, []).status, "stop");
  assert.equal(pruefeGewaesser(art("bachforelle"), g, tag(1, 4), 30, []).status, "ok");
  assert.equal(pruefeGewaesser(art("bachforelle"), g, tag(31, 12), 30, []).titel, "Zurücksetzen", "hier schont schon das Land");

  // Eine kürzere Vereinsschonzeit hebt die Landesschonzeit nicht auf.
  const kurz = see({ regeln: { hecht: regel({ schonzeit: zeitraum(1, 3, 31, 3) }) } });
  assert.equal(pruefeGewaesser(art("hecht"), kurz, tag(20, 4), 60, []).status, "stop");
});

test("Gesperrte Art und Sperrzeit des ganzen Gewässers", () => {
  const g = see({ sperrzeit: zeitraum(1, 1, 31, 3), regeln: { aesche: regel({ gesperrt: true }) } });
  const aesche = pruefeGewaesser(art("aesche"), g, tag(1, 7), 40, []);
  assert.equal(aesche.titel, "Zurücksetzen (Vereinsregel)");
  assert.match(vereinsText(aesche), /ganzjährig gesperrt/);
  assert.equal(aesche.wirksam.gesperrt, true);

  const barsch = pruefeGewaesser(art("barsch"), g, tag(31, 3), 25, []);
  assert.equal(barsch.titel, "Zurücksetzen (Vereinsregel)");
  assert.match(vereinsText(barsch), /Gewässer gesperrt bis 31\. Mär\. Wieder offen ab morgen\./);
  assert.equal(pruefeGewaesser(art("barsch"), g, tag(1, 4), 25, []).status, "ok");
});

test("Entnahmepflicht ist nur ein Hinweis und ändert den Status nicht", () => {
  const g = see({ regeln: { wels: regel({ entnahmepflicht: true }), hecht: regel({ entnahmepflicht: true }) } });
  const wels = pruefeGewaesser(art("wels"), g, tag(1, 7), 90, []);
  assert.equal(wels.status, "ok");
  assert.match(vereinsText(wels), /verlangt, Wels zu entnehmen/);
  const hecht = pruefeGewaesser(art("hecht"), g, tag(1, 3), 70, []);
  assert.equal(hecht.status, "stop", "Schonzeit des Landes geht vor");
});

/* ---------- Limits aus dem Fangbuch ---------- */

const edel = { name: "Edelfische", arten: ["hecht", "zander", "karpfen"], proTag: 2, proWoche: 3 };

test("Woche läuft von Montag bis Sonntag, auch über Monats- und Jahreswechsel", () => {
  assert.deepEqual(woche(tag(11, 10, 2026)), { von: "2026-10-05", bis: "2026-10-11" }, "Sonntag gehört zur laufenden Woche");
  assert.deepEqual(woche(tag(12, 10, 2026)), { von: "2026-10-12", bis: "2026-10-18" });
  assert.deepEqual(woche(tag(1, 10, 2026)), { von: "2026-09-28", bis: "2026-10-04" });
  assert.deepEqual(woche(tag(1, 1, 2027)), { von: "2026-12-28", bis: "2027-01-03" });
});

test("Tageslimit zählt entnommene Fänge der Gruppe am selben Tag und Gewässer", () => {
  const g = see({ limits: [{ ...edel, proWoche: null }] });
  const buch = [
    fang("hecht", "2027-06-16T07:00"),
    fang("zander", "2027-06-16T09:00", { gewaesser: "  vereinssee haslach " }),
    fang("karpfen", "2027-06-16T10:00", { verbleib: "zurueckgesetzt" }),
    fang("hecht", "2027-06-16T11:00", { gewaesser: "Kinzig" }),
    fang("barsch", "2027-06-16T12:00"),
    fang("hecht", "2027-06-15T07:00")
  ];
  assert.deepEqual(zaehle(edel, "Vereinssee Haslach", tag(16, 6), buch), { tag: 2, woche: 3 });
  const voll = pruefeGewaesser(art("karpfen"), g, tag(16, 6), 50, buch);
  assert.equal(voll.titel, "Zurücksetzen (Vereinsregel)");
  assert.match(vereinsText(voll), /Tageslimit Edelfische erreicht: 2 von 2 entnommen/);

  const einer = pruefeGewaesser(art("karpfen"), g, tag(16, 6), 50, buch.slice(1));
  assert.equal(einer.status, "ok");
  assert.match(vereinsText(einer), /Tageslimit Edelfische: 1 von 2 entnommen/);
  assert.equal(pruefeGewaesser(art("karpfen"), g, tag(17, 6), 50, buch).status, "ok", "am nächsten Tag wieder frei");
  assert.equal(pruefeGewaesser(art("barsch"), g, tag(16, 6), 25, buch).status, "ok", "Barsch gehört nicht zur Gruppe");
});

test("Wochenlimit zählt Montag bis Sonntag", () => {
  const g = see({ limits: [edel] });
  // Der 16.6.2027 ist ein Mittwoch, die Woche läuft vom 14. bis 20.6.
  const buch = [fang("hecht", "2027-06-14T07:00"), fang("zander", "2027-06-15T07:00"), fang("karpfen", "2027-06-20T07:00"), fang("hecht", "2027-06-13T07:00")];
  const voll = pruefeGewaesser(art("hecht"), g, tag(16, 6), 60, buch);
  assert.equal(voll.status, "stop");
  assert.match(vereinsText(voll), /Wochenlimit Edelfische erreicht: 3 von 3 entnommen/);
  assert.match(vereinsText(voll), /Tageslimit Edelfische: 0 von 2 entnommen/);
  assert.equal(pruefeGewaesser(art("hecht"), g, tag(21, 6), 60, buch).status, "ok", "neue Woche ab Montag");
  assert.equal(pruefeGewaesser(art("hecht"), g, tag(13, 6), 60, buch).status, "ok", "der Sonntag davor gehört zur Vorwoche");
});

test("Ohne lesbares Fangbuch ist ein Limit nicht prüfbar, also nie erlaubt", () => {
  const g = see({ limits: [edel] });
  const res = pruefeGewaesser(art("hecht"), g, tag(16, 6), 60, null);
  assert.equal(res.status, "stop");
  assert.match(vereinsText(res), /kann ohne Fangbuch nicht geprüft werden/);
  assert.equal(pruefeGewaesser(art("barsch"), g, tag(16, 6), 25, null).status, "ok", "Art ohne Limit braucht kein Fangbuch");
});

test("Gewässernamen: Groß- und Kleinschreibung und Leerzeichen am Rand egal, leer passt nie", () => {
  assert.equal(gleichesGewaesser("Vereinssee Haslach", " vereinssee haslach "), true);
  assert.equal(gleichesGewaesser("Vereinssee Haslach", "Vereinssee"), false);
  assert.equal(gleichesGewaesser("", ""), false);
  assert.equal(gleichesGewaesser(undefined, "Rench"), false);
});

/* ---------- Unlesbare Daten ---------- */

test("Unlesbare Gewässerregeln ergeben nie erlaubt", () => {
  for (const kaputt of [null, {}, see({ system: "elbe" }), see({ regeln: { hecht: regel({ mindestmass: "60" }) } }), see({ limits: [{ name: "x", arten: [], proTag: 1 }] })]) {
    const res = pruefeGewaesser(art("barsch"), kaputt, tag(1, 7), 25, []);
    assert.equal(res.status, "stop");
    assert.match(text(res), /nicht lesbar/);
  }
});

test("bereinigeGewaesser: gültiges Gewässer bleibt, leere Regeln und fremde Felder fallen weg", () => {
  const g = bereinigeGewaesser(see({ name: "  Rench ", fremd: 1, regeln: { hecht: regel({ mindestmass: 60, fremd: 1 }), zander: regel() },
    limits: [{ name: " Edelfische ", arten: ["hecht", "hecht", "zander"], proTag: 3 }] }));
  assert.equal(g.name, "Rench");
  assert.equal("fremd" in g, false);
  assert.deepEqual(g.regeln, { hecht: regel({ mindestmass: 60 }) });
  assert.deepEqual(g.limits, [{ name: "Edelfische", arten: ["hecht", "zander"], proTag: 3, proWoche: null }]);
});

test("bereinigeGewaesser: fehlerhafte Angaben werden abgelehnt", () => {
  const schlecht = [{ name: " " }, { name: "x".repeat(81) }, { system: "bodensee" }, { lage: "tal" }, { id: "" }, { geaendert: undefined },
    { sperrzeit: { von: { tag: 31, monat: 2 }, bis: { tag: 1, monat: 3 } } }, { sperrzeit: { von: { tag: 1, monat: 1 } } }, { sperrzeit: "Winter" },
    { regeln: [] }, { regeln: { hecht: null } }, { regeln: { hecht: regel({ mindestmass: 0 }) } }, { regeln: { hecht: regel({ mindestmass: 301 }) } },
    { regeln: { hecht: regel({ mindestmass: 80, hoechstmass: 60 }) } }, { regeln: { hecht: regel({ gesperrt: "ja" }) } },
    { regeln: { hecht: regel({ gesperrt: true, entnahmepflicht: true }) } }, { regeln: { hecht: regel({ schonzeit: { von: { tag: 1, monat: 13 }, bis: { tag: 1, monat: 3 } } }) } },
    { limits: "3" }, { limits: [{ name: "", arten: ["hecht"], proTag: 3 }] }, { limits: [{ name: "Edel", arten: ["hecht"] }] },
    { limits: [{ name: "Edel", arten: ["hecht"], proTag: 0 }] }, { limits: [{ name: "Edel", arten: ["hecht"], proWoche: 2.5 }] },
    { weitereRegeln: "x".repeat(2001) }];
  for (const s of schlecht) assert.throws(() => bereinigeGewaesser(see(s)), Error, JSON.stringify(s));
});

/* ---------- Liste "Geschont am" ---------- */

test("vereinGeschont: Schonzeit und Sperre des Vereins für die Übersicht", () => {
  const g = see({ regeln: { bachforelle: regel({ schonzeit: zeitraum(1, 10, 31, 3) }), aesche: regel({ gesperrt: true }), hecht: regel({ mindestmass: 60 }) } });
  assert.deepEqual(vereinGeschont(g, "bachforelle", tag(15, 3)), { bis: { tag: 31, monat: 3 } });
  assert.equal(vereinGeschont(g, "bachforelle", tag(15, 4)), null);
  assert.deepEqual(vereinGeschont(g, "aesche", tag(1, 7)), { gesperrt: true });
  assert.equal(vereinGeschont(g, "hecht", tag(1, 7)), null);
  assert.equal(vereinGeschont(g, "zander", tag(1, 7)), null);
  assert.equal(vereinGeschont(null, "hecht", tag(1, 7)), null);
});

/* ---------- Datei zum Teilen ---------- */

test("Export und Import: Regeln kommen unverändert an, die Datei enthält nur Regeln", () => {
  const g = see({ sperrzeit: zeitraum(1, 1, 31, 3), regeln: { hecht: regel({ mindestmass: 60, hoechstmass: 80 }) }, limits: [edel], weitereRegeln: "Zwei Ruten." });
  const datei = alsGewaesserDatei([{ ...g, position: { lat: 48.5, lon: 8.1 } }], new Date("2026-10-11T10:00:00Z"));
  assert.doesNotMatch(datei, /48[.,]5|position|faenge/, "Angelstellen und Fänge gehören nicht in die Datei");
  assert.deepEqual(liesGewaesserDatei(datei), { gewaesser: [g], fehlerhaft: 0 });
});

test("liesGewaesserDatei: fremde Dateien werden abgelehnt, kaputte Gewässer gezählt", () => {
  assert.throws(() => liesGewaesserDatei("kein json"), /kein lesbares JSON/);
  assert.throws(() => liesGewaesserDatei('{"format":"fang-check-backup","faenge":[]}'), /keine Fang-Check-Gewässerregeln/);
  assert.throws(() => liesGewaesserDatei("null"), /keine Fang-Check-Gewässerregeln/);
  const datei = JSON.stringify({ format: "fang-check-gewaesser", version: 1, gewaesser: [see(), see({ id: "g2", system: "?" }), null] });
  const { gewaesser, fehlerhaft } = liesGewaesserDatei(datei);
  assert.deepEqual(gewaesser.map(g => g.id), ["g1"]);
  assert.equal(fehlerhaft, 2);
});
