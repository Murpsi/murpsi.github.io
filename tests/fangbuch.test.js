// Tests der Speicherlogik des Fangbuchs. Node hat kein IndexedDB, deshalb unten ein kleiner Ersatz im Speicher.
import { test } from "node:test";
import assert from "node:assert/strict";
import { oeffne, bereinige, filtere, filterWerte, letzteGewaesser, alsCsv, alsBackup, liesBackup, zielGroesse, STORE, STORE_GEWAESSER, DB_NAME } from "../js/fangbuch.js";

// Kann nur, was fangbuch.js benutzt: open mit Versionsnummer, createObjectStore, transaction, put, delete, getAll.
function ersatzIdb() {
  const dbs = new Map();
  const req = wert => { const r = {}; queueMicrotask(() => { r.result = wert; r.onsuccess?.(); }); return r; };
  return {
    open(name, version) {
      const r = {};
      queueMicrotask(() => {
        if (!dbs.has(name)) dbs.set(name, { version: 0, tabellen: new Map() });
        const db = dbs.get(name), tabellen = db.tabellen, oldVersion = db.version;
        r.result = {
          // Wie im Browser: eine Tabelle doppelt anzulegen ist ein Fehler.
          createObjectStore(n, { keyPath }) {
            if (tabellen.has(n)) throw new Error("Tabelle " + n + " gibt es schon");
            tabellen.set(n, { keyPath, zeilen: new Map() });
          },
          transaction(n) {
            const t = tabellen.get(n), tx = {};
            setTimeout(() => tx.oncomplete?.(), 0);
            tx.objectStore = () => ({
              put: wert => req(t.zeilen.set(wert[t.keyPath], { ...wert })),
              delete: id => req(t.zeilen.delete(id)),
              getAll: () => req([...t.zeilen.values()].map(z => ({ ...z })))
            });
            return tx;
          }
        };
        if (version > oldVersion) { db.version = version; r.onupgradeneeded?.({ oldVersion }); }
        r.onsuccess?.();
      });
      return r;
    }
  };
}

const fang = (mehr = {}) => ({ art: "hecht", artName: "Hecht", laenge: 62.5, zeit: "2026-06-01T07:15", gewaesser: "Kinzig",
  position: null, foto: null, vorschau: null, verbleib: "entnommen", notiz: "", ...mehr });
const fertig = (mehr = {}) => fang({ id: "a", erstellt: "2026-06-01T05:15:00.000Z", geaendert: "2026-06-01T05:15:00.000Z", ...mehr });

test("bereinige: gültiger Eintrag bleibt, Text wird gekürzt um Leerzeichen, fremde Felder fallen weg", () => {
  const e = bereinige(fertig({ gewaesser: "  Kinzig ", notiz: " Wobbler ", fremd: 1 }));
  assert.equal(e.gewaesser, "Kinzig");
  assert.equal(e.notiz, "Wobbler");
  assert.equal("fremd" in e, false);
  assert.equal(bereinige(fertig({ laenge: null })).laenge, null);
});

test("bereinige: fehlerhafte Angaben werden abgelehnt", () => {
  const schlecht = [{ art: "" }, { artName: undefined }, { zeit: "2026-02-31T10:00" }, { zeit: "2026-06-01" }, { zeit: "2026-06-01T24:00" },
    { verbleib: "gegessen" }, { verbleib: undefined }, { laenge: 0 }, { laenge: -5 }, { laenge: "60" }, { laenge: 301 },
    { position: { lat: 91, lon: 8 } }, { position: { lat: 48, lon: "8" } }, { foto: "bild" },
    { foto: new Blob(["<svg/>"], { type: "image/svg+xml" }) }, { gewaesser: "x".repeat(81) }, { id: "" }];
  for (const s of schlecht) assert.throws(() => bereinige(fertig(s)), Error, JSON.stringify(s));
  assert.throws(() => bereinige(null));
});

test("speichern, lesen, bearbeiten, löschen", async () => {
  const buch = await oeffne(ersatzIdb());
  const a = await buch.speichere(fang(), new Date("2026-06-01T08:00:00Z"));
  const b = await buch.speichere(fang({ art: "zander", artName: "Zander", zeit: "2026-07-10T21:30" }), new Date("2026-07-10T22:00:00Z"));
  assert.notEqual(a.id, b.id);
  assert.equal(a.erstellt, "2026-06-01T08:00:00.000Z");
  assert.deepEqual((await buch.alle()).map(e => e.artName), ["Zander", "Hecht"], "neueste zuerst");

  const geaendert = await buch.speichere({ ...a, laenge: 64 }, new Date("2026-06-02T08:00:00Z"));
  assert.equal(geaendert.id, a.id);
  assert.equal(geaendert.erstellt, a.erstellt);
  assert.equal(geaendert.geaendert, "2026-06-02T08:00:00.000Z");
  const alle = await buch.alle();
  assert.equal(alle.length, 2);
  assert.equal(alle.find(e => e.id === a.id).laenge, 64);

  await buch.loesche(a.id);
  assert.deepEqual((await buch.alle()).map(e => e.id), [b.id]);
});

test("speichere lehnt ungültige Einträge ab und schreibt dann nichts", async () => {
  const buch = await oeffne(ersatzIdb());
  await assert.rejects(buch.speichere(fang({ verbleib: "" })), /entnommen oder zurückgesetzt/);
  assert.equal((await buch.alle()).length, 0);
});

test("Einträge überleben das Schließen und erneute Öffnen", async () => {
  const idb = ersatzIdb();
  await (await oeffne(idb)).speichere(fang());
  assert.equal((await (await oeffne(idb)).alle()).length, 1);
});

test("Umbau auf Version 2: ein vorhandenes Fangbuch bleibt vollständig, die Gewässer kommen dazu", async () => {
  // Stand vor Phase 4 nachbauen: Version 1 mit nur der Tabelle der Fänge.
  const idb = ersatzIdb();
  await new Promise(ok => {
    const r = idb.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => { const tx = r.result.transaction(STORE, "readwrite"); tx.oncomplete = ok; tx.objectStore(STORE).put(fertig({ notiz: "von früher" })); };
  });
  const buch = await oeffne(idb);
  assert.deepEqual(await buch.alle(), [bereinige(fertig({ notiz: "von früher" }))]);
  assert.deepEqual(await buch.gewaesser.alle(), []);
  await buch.gewaesser.speichere(see());
  await buch.speichere(fang({ zeit: "2026-07-01T10:00" }));

  const wieder = await oeffne(idb);
  assert.equal((await wieder.alle()).length, 2);
  assert.equal((await wieder.gewaesser.alle()).length, 1);
});

const see = (mehr = {}) => ({ name: "Vereinssee Haslach", system: "rhein", lage: "uebrig", sperrzeit: null,
  regeln: { hecht: { gesperrt: false, mindestmass: 60, hoechstmass: null, schonzeit: null, entnahmepflicht: false } },
  limits: [{ name: "Edelfische", arten: ["hecht", "zander"], proTag: 3, proWoche: 6 }], weitereRegeln: "Zwei Ruten.", ...mehr });

test("Gewässer speichern, lesen nach Namen sortiert, bearbeiten, löschen", async () => {
  const buch = await oeffne(ersatzIdb());
  const a = await buch.gewaesser.speichere(see(), new Date("2026-10-11T08:00:00Z"));
  const b = await buch.gewaesser.speichere(see({ name: "Rench" }), new Date("2026-10-11T09:00:00Z"));
  assert.deepEqual((await buch.gewaesser.alle()).map(g => g.name), ["Rench", "Vereinssee Haslach"]);
  assert.equal(a.regeln.hecht.mindestmass, 60);

  const neu = await buch.gewaesser.speichere({ ...a, lage: "800" }, new Date("2026-10-12T08:00:00Z"));
  assert.equal(neu.id, a.id);
  assert.equal(neu.erstellt, "2026-10-11T08:00:00.000Z");
  assert.equal(neu.geaendert, "2026-10-12T08:00:00.000Z");

  await assert.rejects(buch.gewaesser.speichere(see({ system: "elbe" })), /Gewässersystem fehlt/);
  await buch.gewaesser.loesche(a.id);
  assert.deepEqual((await buch.gewaesser.alle()).map(g => g.id), [b.id]);
  assert.equal((await buch.alle()).length, 0, "Fänge und Gewässer liegen getrennt");
});

test("Backup enthält die Gewässer, alte Backups ohne Gewässer bleiben lesbar", async () => {
  const quelle = await oeffne(ersatzIdb());
  await quelle.speichere(fang());
  const g = await quelle.gewaesser.speichere(see(), new Date("2026-10-11T08:00:00Z"));
  const datei = await (await alsBackup(await quelle.alle(), new Date(), await quelle.gewaesser.alle())).text();
  const backup = liesBackup(datei);
  assert.equal(backup.faenge.length, 1);
  assert.deepEqual(backup.gewaesser, [g]);
  assert.equal(backup.gewaesserFehlerhaft, 0);

  const ziel = await oeffne(ersatzIdb());
  assert.deepEqual(await ziel.gewaesser.uebernimm(backup.gewaesser), { neu: 1, aktualisiert: 0, unveraendert: 0 });
  await ziel.gewaesser.speichere({ ...g, weitereRegeln: "neuer als das Backup" }, new Date("2026-10-20T08:00:00Z"));
  assert.deepEqual(await ziel.gewaesser.uebernimm(backup.gewaesser), { neu: 0, aktualisiert: 0, unveraendert: 1 });
  assert.equal((await ziel.gewaesser.alle())[0].weitereRegeln, "neuer als das Backup");

  const alt = liesBackup(JSON.stringify({ format: "fang-check-backup", version: 1, faenge: [fertig()] }));
  assert.equal(alt.faenge.length, 1);
  assert.deepEqual(alt.gewaesser, []);
  const kaputt = liesBackup(JSON.stringify({ format: "fang-check-backup", version: 2, faenge: [], gewaesser: [{ ...g, system: "?" }, g] }));
  assert.deepEqual(kaputt.gewaesser, [g]);
  assert.equal(kaputt.gewaesserFehlerhaft, 1);
});

test("ohne IndexedDB gibt es eine verständliche Meldung", async () => {
  await assert.rejects(oeffne(null), /kein Fangbuch/);
});

const liste = [
  fertig({ id: "1", zeit: "2025-05-20T06:00", gewaesser: "Kinzig", geaendert: "2025-05-20T06:10:00.000Z" }),
  fertig({ id: "2", zeit: "2026-03-02T18:00", art: "aal", artName: "Aal", gewaesser: "Rench", geaendert: "2026-03-02T18:10:00.000Z" }),
  fertig({ id: "3", zeit: "2026-06-01T07:15", gewaesser: "Kinzig", verbleib: "zurueckgesetzt", geaendert: "2026-06-01T07:20:00.000Z" }),
  fertig({ id: "4", zeit: "2026-08-01T07:15", art: "aesche", artName: "Äsche", gewaesser: "", geaendert: "2026-08-01T07:20:00.000Z" })
];

test("Filter nach Jahr, Art und Gewässer", () => {
  assert.deepEqual(filtere(liste, {}).length, 4);
  assert.deepEqual(filtere(liste, { jahr: "2026" }).map(e => e.id), ["2", "3", "4"]);
  assert.deepEqual(filtere(liste, { art: "hecht" }).map(e => e.id), ["1", "3"]);
  assert.deepEqual(filtere(liste, { gewaesser: "Kinzig", jahr: "2026" }).map(e => e.id), ["3"]);
  assert.deepEqual(filtere(liste, { jahr: "2024" }), []);
});

test("Filterwerte und Gewässervorschläge kommen aus den Einträgen", () => {
  const w = filterWerte(liste);
  assert.deepEqual(w.jahre, ["2026", "2025"]);
  assert.deepEqual(w.arten.map(a => a.name), ["Aal", "Äsche", "Hecht"]);
  assert.deepEqual(w.gewaesser, ["Kinzig", "Rench"]);
  assert.deepEqual(letzteGewaesser(liste), ["Kinzig", "Rench"], "zuletzt genutztes zuerst, keine doppelten, kein leeres");
  assert.deepEqual(letzteGewaesser(liste, 1), ["Kinzig"]);
});

test("CSV: Kopfzeile, Dezimalkomma, Anführungszeichen, keine Formeln, keine Position", () => {
  const csv = alsCsv([
    fertig({ id: "1", zeit: "2026-06-01T07:15", notiz: 'Köder "Mepps"; Größe 3', position: { lat: 48.123456, lon: 8.123456, genauigkeit: 5 } }),
    fertig({ id: "2", zeit: "2026-03-02T18:00", laenge: null, gewaesser: "=SUMME(A1)", verbleib: "zurueckgesetzt", notiz: "zwei\nZeilen" })
  ]);
  assert.ok(csv.startsWith("﻿"), "BOM für Excel fehlt");
  const zeilen = csv.slice(1).split("\r\n");
  assert.equal(zeilen[0], "Datum;Uhrzeit;Art;Länge (cm);Gewässer;Verbleib;Notiz");
  assert.equal(zeilen[1], "02.03.2026;18:00;Hecht;;'=SUMME(A1);zurückgesetzt;\"zwei\nZeilen\"", "älteste zuerst");
  assert.equal(zeilen[2],'01.06.2026;07:15;Hecht;62,5;Kinzig;entnommen;"Köder ""Mepps""; Größe 3"');
  assert.doesNotMatch(csv, /48[.,]123/, "Angelstellen gehören nicht in die Fangliste");
});

test("Backup und Wiederherstellen samt Foto", async () => {
  const bytes = new Uint8Array(70000).map((_, i) => i % 251);
  const foto = new Blob([bytes], { type: "image/jpeg" });
  const quelle = await oeffne(ersatzIdb());
  const a = await quelle.speichere(fang({ foto, vorschau: new Blob([bytes.subarray(0, 10)], { type: "image/jpeg" }), position: { lat: 48.4, lon: 8.02, genauigkeit: 12 }, notiz: "Ä ö ü ß €" }));
  await quelle.speichere(fang({ zeit: "2026-07-01T10:00" }));

  const datei = await alsBackup(await quelle.alle());
  assert.equal(datei.type, "application/json");
  const { faenge, fehlerhaft } = liesBackup(await datei.text());
  assert.equal(fehlerhaft, 0);

  const ziel = await oeffne(ersatzIdb());
  assert.deepEqual(await ziel.uebernimm(faenge), { neu: 2, aktualisiert: 0, unveraendert: 0 });
  const zurueck = (await ziel.alle()).find(e => e.id === a.id);
  assert.equal(zurueck.foto.type, "image/jpeg");
  assert.deepEqual(new Uint8Array(await zurueck.foto.arrayBuffer()), bytes);
  assert.equal(zurueck.vorschau.size, 10);
  assert.deepEqual({ ...zurueck, foto: null, vorschau: null }, { ...a, foto: null, vorschau: null });
});

test("Wiederherstellen löscht nichts und überschreibt nur ältere Stände", async () => {
  const buch = await oeffne(ersatzIdb());
  const a = await buch.speichere(fang({ notiz: "alt" }), new Date("2026-06-01T08:00:00Z"));
  const b = await buch.speichere(fang({ zeit: "2026-06-05T08:00" }), new Date("2026-06-05T09:00:00Z"));
  const backup = liesBackup(await (await alsBackup(await buch.alle())).text()).faenge;

  await buch.speichere({ ...a, notiz: "neuer als das Backup" }, new Date("2026-06-10T08:00:00Z"));
  await buch.loesche(b.id);
  const c = await buch.speichere(fang({ zeit: "2026-06-11T08:00" }), new Date("2026-06-11T09:00:00Z"));

  assert.deepEqual(await buch.uebernimm(backup), { neu: 1, aktualisiert: 0, unveraendert: 1 });
  const alle = await buch.alle();
  assert.deepEqual(alle.map(e => e.id).sort(), [a.id, b.id, c.id].sort());
  assert.equal(alle.find(e => e.id === a.id).notiz, "neuer als das Backup");

  const neuer = backup.map(e => e.id === a.id ? { ...e, notiz: "aus neuerem Backup", geaendert: "2026-07-01T00:00:00.000Z" } : e);
  assert.deepEqual(await buch.uebernimm(neuer), { neu: 0, aktualisiert: 1, unveraendert: 1 });
  assert.equal((await buch.alle()).find(e => e.id === a.id).notiz, "aus neuerem Backup");
});

test("liesBackup: fremde Dateien werden abgelehnt, kaputte Einträge gezählt", () => {
  assert.throws(() => liesBackup("kein json"), /kein lesbares JSON/);
  assert.throws(() => liesBackup('{"faenge":[]}'), /kein Fang-Check-Backup/);
  assert.throws(() => liesBackup("null"), /kein Fang-Check-Backup/);
  const text = JSON.stringify({ format: "fang-check-backup", version: 1, faenge: [fertig(), fertig({ id: "b", verbleib: "?" }), fertig({ id: "c", foto: "data:text/html;base64,PGI+" }), fertig({ id: "d", foto: "kaputt" }), null] });
  const { faenge, fehlerhaft } = liesBackup(text);
  assert.deepEqual(faenge.map(e => e.id), ["a"]);
  assert.equal(fehlerhaft, 4);
});

test("Foto verkleinern: längste Seite höchstens 1600 px, nie vergrößern", () => {
  assert.deepEqual(zielGroesse(4000, 3000), { breite: 1600, hoehe: 1200 });
  assert.deepEqual(zielGroesse(3000, 4000), { breite: 1200, hoehe: 1600 });
  assert.deepEqual(zielGroesse(800, 600), { breite: 800, hoehe: 600 });
  assert.deepEqual(zielGroesse(1600, 1600), { breite: 1600, hoehe: 1600 });
  assert.deepEqual(zielGroesse(4000, 3000, 320), { breite: 320, hoehe: 240 });
  assert.deepEqual(zielGroesse(10000, 2), { breite: 1600, hoehe: 1 });
});

test("Namen von Datenbank und Tabellen bleiben stabil, sonst wären vorhandene Fangbücher leer", () => {
  assert.equal(DB_NAME, "fang-check");
  assert.equal(STORE, "faenge");
  assert.equal(STORE_GEWAESSER, "gewaesser");
});
