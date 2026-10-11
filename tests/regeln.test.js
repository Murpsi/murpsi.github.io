// Tests der Prüflogik. Start: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pruefe, regeln, inSchonzeit, tageBisEnde } from "../js/regeln.js";
import { bildFuer } from "../js/fischbilder.js";

const DATEN = JSON.parse(readFileSync(new URL("../data/regeln-bw.json", import.meta.url), "utf8"));
const ARTEN = DATEN.arten;
const art = id => ARTEN.find(a => a.id === id);
const tag = (t, m, jahr = 2027) => new Date(jahr, m - 1, t, 12);
// Kurzform: Urteil für Art, Tag, Monat, Länge; Rest mit Standardwerten
const urteil = (id, t, m, laenge, { system = "rhein", lage = "uebrig", jahr = 2027 } = {}) =>
  pruefe(art(id), system, lage, tag(t, m, jahr), laenge);

/* ---------- Pflichtfälle aus ROADMAP.md ---------- */

test("Bachforelle: 11.10. Schonzeit, 1.3. mit 24 cm untermaßig, 1.3. mit 26 cm erlaubt", () => {
  const schon = urteil("bachforelle", 11, 10, 30);
  assert.equal(schon.status, "stop");
  assert.match(schon.gruende.join(" "), /Schonzeit bis 28\. Feb/);

  const klein = urteil("bachforelle", 1, 3, 24);
  assert.equal(klein.status, "stop");
  assert.match(klein.gruende.join(" "), /Untermaßig: 24 cm, es fehlen 1 cm bis 25 cm/);

  const ok = urteil("bachforelle", 1, 3, 26);
  assert.equal(ok.status, "ok");
  assert.equal(ok.titel, "Entnahme erlaubt");
});

test("Grenztage Hecht: 15.2. und 15.5. geschont, 14.2. und 16.5. erlaubt", () => {
  assert.equal(urteil("hecht", 15, 2, 60).status, "stop");
  assert.equal(urteil("hecht", 15, 5, 60).status, "stop");
  assert.equal(urteil("hecht", 14, 2, 60).status, "ok");
  assert.equal(urteil("hecht", 16, 5, 60).status, "ok");
});

test("Jahreswechsel Aal: 31.12. und 1.3. geschont, 2.3. erlaubt", () => {
  assert.equal(urteil("aal", 31, 12, 60).status, "stop");
  assert.equal(urteil("aal", 1, 1, 60).status, "stop");
  assert.equal(urteil("aal", 1, 3, 60).status, "stop");
  assert.equal(urteil("aal", 2, 3, 60).status, "ok");
  assert.equal(urteil("aal", 14, 9, 60).status, "ok");
  assert.equal(urteil("aal", 15, 9, 60).status, "stop");
});

test("Schaltjahr: Forelle am 29.2.2028 erlaubt, am 28.2.2028 geschont", () => {
  assert.equal(urteil("bachforelle", 29, 2, 30, { jahr: 2028 }).status, "ok");
  assert.equal(urteil("bachforelle", 28, 2, 30, { jahr: 2028 }).status, "stop");
});

test("Hecht am 10.5.: im Main erlaubt, im Rhein-System geschont", () => {
  assert.equal(urteil("hecht", 10, 5, 60, { system: "main" }).status, "ok");
  assert.equal(urteil("hecht", 10, 5, 60, { system: "rhein" }).status, "stop");
});

test("Huchen im Rhein-System: keine Landesregel, Hinweis erscheint", () => {
  const res = urteil("huchen", 1, 3, 80);
  assert.equal(res.r.ausserhalb, true);
  assert.equal(res.r.schonzeit, null);
  assert.equal(res.r.mindestmass, null);
  assert.match(res.gruende.join(" "), /nur im Donau-System Schonzeit und Mindestmaß\. Vereinsregeln prüfen\./);
  // Im Donau-System gilt die Regel
  assert.equal(urteil("huchen", 1, 3, 80, { system: "donau" }).status, "stop");
});

test("Lachs: immer ganzjährig geschont", () => {
  for (const system of ["rhein", "main", "donau"])
    for (let m = 1; m <= 12; m++) {
      const res = urteil("lachs", 15, m, 90, { system });
      assert.equal(res.status, "stop");
      assert.equal(res.titel, "Ganzjährig geschont");
    }
});

test("Fehlende Länge bei Art mit Mindestmaß: nie erlaubt", () => {
  for (const a of ARTEN.filter(a => a.mindestmass !== null))
    for (const laenge of [null, undefined, NaN, "", "30"]) {
      const res = pruefe(a, a.nurSystem || "rhein", "uebrig", tag(1, 8), laenge);
      assert.notEqual(res.status, "ok", a.name + " mit Länge " + String(laenge));
    }
  assert.equal(urteil("karpfen", 1, 8, null).titel, "Länge fehlt");
});

/* ---------- Gewässerabhängige Regeln ---------- */

test("Bachforelle: Mindestmaß je nach Lage 25, 20 oder 35 cm", () => {
  assert.equal(regeln(art("bachforelle"), "rhein", "uebrig").mindestmass, 25);
  assert.equal(regeln(art("bachforelle"), "rhein", "800").mindestmass, 20);
  assert.equal(regeln(art("bachforelle"), "rhein", "hochrhein").mindestmass, 35);
  assert.equal(urteil("bachforelle", 1, 6, 30, { lage: "hochrhein" }).status, "stop");
  assert.equal(urteil("bachforelle", 1, 6, 22, { lage: "800" }).status, "ok");
});

test("Zander im Main: 1.2. bis 30.4. und 50 cm statt 45 cm", () => {
  assert.equal(urteil("zander", 10, 5, 60, { system: "main" }).status, "ok");
  assert.equal(urteil("zander", 10, 5, 60).status, "stop");
  assert.equal(urteil("zander", 1, 8, 47, { system: "main" }).status, "stop");
  assert.equal(urteil("zander", 1, 8, 47).status, "ok");
});

test("Aal gilt im Main wie im Rhein-System, in der Donau nicht", () => {
  assert.equal(urteil("aal", 1, 12, 60, { system: "main" }).status, "stop");
  assert.equal(urteil("aal", 1, 12, 60, { system: "donau" }).r.ausserhalb, true);
});

test("Länge genau am Mindestmaß ist maßig", () => {
  assert.equal(urteil("hecht", 1, 8, 50).status, "ok");
  assert.equal(urteil("hecht", 1, 8, 49.5).status, "stop");
});

/* ---------- Im Zweifel Zurücksetzen ---------- */

test("Fehlende oder ungültige Angaben ergeben immer Zurücksetzen", () => {
  const bf = art("bachforelle"), d = tag(1, 6);
  const faelle = {
    "Art fehlt": pruefe(undefined, "rhein", "uebrig", d, 30),
    "System unbekannt": pruefe(bf, "elbe", "uebrig", d, 30),
    "System fehlt": pruefe(bf, undefined, "uebrig", d, 30),
    "Lage unbekannt": pruefe(bf, "rhein", "bodensee", d, 30),
    "Datum fehlt": pruefe(bf, "rhein", "uebrig", null, 30),
    "Datum ungültig": pruefe(bf, "rhein", "uebrig", new Date("kein Datum"), 30),
    "Regel ohne Felder": pruefe({ name: "X" }, "rhein", "uebrig", d, 30),
    "Schonzeit kaputt": pruefe({ name: "X", schonzeit: { von: { tag: 1 } }, mindestmass: null }, "rhein", "uebrig", d, 30),
    "Mindestmaß kaputt": pruefe({ name: "X", schonzeit: null, mindestmass: "30" }, "rhein", "uebrig", d, 30),
  };
  for (const [name, res] of Object.entries(faelle)) {
    assert.equal(res.status, "stop", name);
    assert.equal(res.titel, "Zurücksetzen", name);
    assert.ok(res.r.unklar, name);
  }
});

/* ---------- Hilfsfunktionen ---------- */

test("inSchonzeit: ohne Schonzeit nie geschont, Grenztage zählen mit", () => {
  const s = { von: { tag: 1, monat: 10 }, bis: { tag: 28, monat: 2 } };
  assert.equal(inSchonzeit(null, 6, 1), false);
  assert.equal(inSchonzeit(s, 10, 1), true);
  assert.equal(inSchonzeit(s, 9, 30), false);
  assert.equal(inSchonzeit(s, 2, 28), true);
  assert.equal(inSchonzeit(s, 2, 29), false);
});

test("tageBisEnde: letzter Schontag ergibt 1, auch über den Jahreswechsel", () => {
  const hecht = art("hecht").schonzeit, aal = art("aal").schonzeit;
  assert.equal(tageBisEnde(hecht, tag(15, 5)), 1);
  assert.equal(tageBisEnde(hecht, tag(14, 5)), 2);
  assert.equal(tageBisEnde(hecht, new Date(2027, 4, 15, 23, 59)), 1);
  assert.equal(tageBisEnde(aal, tag(31, 12)), 62);   // 31.12.2027 bis 2.3.2028: 1 + 31 + 29 (Schaltjahr) + 1
  assert.match(urteil("hecht", 15, 5, 60).gruende[0], /Wieder erlaubt ab morgen\./);
  assert.match(urteil("hecht", 10, 5, 60).gruende[0], /Wieder erlaubt in 6 Tagen\./);
});

/* ---------- Daten ---------- */

test("Daten: jede Art hat Quelle, eindeutige ID, gültige Schonzeit und eine Zeichnung", () => {
  const TAGE = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const ids = new Set();
  for (const a of ARTEN) {
    assert.ok(a.id && !ids.has(a.id), "ID doppelt oder leer: " + a.id);
    ids.add(a.id);
    assert.ok(a.name && a.gruppe && a.merkmale, a.id + ": Name, Gruppe oder Merkmale fehlen");
    assert.match(a.quelle, /LFischVO/, a.id + ": Quelle fehlt");
    const zeiten = [a.schonzeit, a.abweichung?.main?.schonzeit].filter(Boolean);
    for (const s of zeiten) for (const g of [s.von, s.bis])
      assert.ok(g.monat >= 1 && g.monat <= 12 && g.tag >= 1 && g.tag <= TAGE[g.monat - 1], a.id + ": kein Kalendertag");
    if (a.ganzjaehrig) assert.ok(a.schonzeit === null && a.mindestmass === null, a.id + ": ganzjährig, aber mit Einzelregel");
    assert.ok(!regeln(a, "rhein", "uebrig").unklar, a.id + ": Regel unvollständig");
    assert.ok(bildFuer(a.id).startsWith("<svg"), a.id + ": Zeichnung fehlt");
  }
});
