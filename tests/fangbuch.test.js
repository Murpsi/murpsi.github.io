// Tests der Speicherlogik des Fangbuchs. Node hat kein IndexedDB, deshalb unten ein kleiner Ersatz im Speicher.
import { test } from "node:test";
import assert from "node:assert/strict";
import { oeffne, bereinige, filtere, filterWerte, letzteGewaesser, alsCsv, alsBackup, liesBackup, zielGroesse, korbText, korbTageNoch, STORE, STORE_GEWAESSER, STORE_PAPIERKORB, DB_NAME } from "../js/fangbuch.js";

// Kann nur, was fangbuch.js benutzt: open mit Versionsnummer, createObjectStore, transaction über eine oder mehrere Tabellen,
// put, delete, get, getAll.
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
          transaction(namen) {
            const tx = {}, erlaubt = [namen].flat();
            setTimeout(() => tx.oncomplete?.(), 0);
            tx.objectStore = n => {
              // Wie im Browser: nur Tabellen, die beim Öffnen der Transaktion genannt wurden.
              if (!erlaubt.includes(n) || !tabellen.has(n)) throw new Error("Tabelle " + n + " gehört nicht zur Transaktion");
              const t = tabellen.get(n);
              return {
              put: wert => req(t.zeilen.set(wert[t.keyPath], { ...wert })),
              delete: id => req(t.zeilen.delete(id)),
              get: id => req(t.zeilen.has(id) ? { ...t.zeilen.get(id) } : undefined),
              getAll: () => req([...t.zeilen.values()].map(z => ({ ...z })))
              };
            };
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

// ---------- Papierkorb ----------
const KORB_START = new Date("2026-10-01T08:00:00Z"), nachTagen = n => new Date(KORB_START.getTime() + n * 86400000);
const stelle = { lat: 48.3301, lon: 8.0102, genauigkeit: 8 }, korbFoto = () => new Blob(["foto"], { type: "image/jpeg" });

test("Papierkorb: ein gelöschter Fang kommt mit Position und Foto zurück", async () => {
  const buch = await oeffne(ersatzIdb());
  const a = await buch.speichere(fang({ position: stelle, foto: korbFoto(), vorschau: korbFoto(), notiz: "Wobbler" }), KORB_START);
  const imKorb = await buch.loesche(a.id, nachTagen(1));
  assert.equal((await buch.alle()).length, 0);
  const korb = await buch.papierkorb.alle();
  assert.deepEqual(korb.map(k => [k.id, k.art, k.grund, k.geloescht]), [[imKorb, "fang", "geloescht", nachTagen(1).toISOString()]]);

  const zurueck = await buch.papierkorb.stelleWiederHer(imKorb, nachTagen(2));
  assert.deepEqual(zurueck.position, stelle);
  assert.equal(await zurueck.foto.text(), "foto");
  assert.equal(zurueck.notiz, "Wobbler");
  assert.equal(zurueck.erstellt, a.erstellt);
  assert.equal(zurueck.geaendert, nachTagen(2).toISOString(), "gilt als eben geändert, damit ein altes Backup ihn nicht überschreibt");
  assert.deepEqual((await buch.alle()).map(e => e.id), [a.id]);
  assert.equal((await buch.papierkorb.alle()).length, 0);
  assert.equal(await buch.loesche("gibt-es-nicht"), null);
});

test("Papierkorb: entfernte Position und ersetztes Foto lassen sich zurückholen, und das Zurückholen auch", async () => {
  const buch = await oeffne(ersatzIdb());
  const a = await buch.speichere(fang({ position: stelle, foto: korbFoto() }), KORB_START);
  // Speichern ohne Änderung füllt den Papierkorb nicht.
  await buch.speichere({ ...a }, nachTagen(1));
  assert.equal((await buch.papierkorb.alle()).length, 0);

  await buch.speichere({ ...a, position: null, foto: new Blob(["anderes"], { type: "image/jpeg" }) }, nachTagen(2));
  const [davor] = await buch.papierkorb.alle();
  assert.equal(davor.grund, "geaendert");
  assert.deepEqual(davor.eintrag.position, stelle);

  await buch.papierkorb.stelleWiederHer(davor.id, nachTagen(3));
  const [jetzt] = await buch.alle();
  assert.deepEqual(jetzt.position, stelle);
  assert.equal(await jetzt.foto.text(), "foto");
  // Die Fassung ohne Position liegt jetzt dafür im Papierkorb.
  const korb = await buch.papierkorb.alle();
  assert.equal(korb.length, 1);
  assert.equal(korb[0].eintrag.position, null);
  assert.equal(await korb[0].eintrag.foto.text(), "anderes");
});

test("Papierkorb: Wetter nachtragen ist keine Änderung, ein Backup, das überschreibt, schon", async () => {
  const buch = await oeffne(ersatzIdb());
  const a = await buch.speichere(fang({ notiz: "hier" }), KORB_START);
  await buch.ergaenze(a.id, e => ({ ...e, notiz: "ergänzt" }));
  assert.equal((await buch.papierkorb.alle()).length, 0);
  await buch.uebernimm([bereinige({ ...a, notiz: "aus dem Backup", geaendert: nachTagen(5).toISOString() })], nachTagen(6));
  const korb = await buch.papierkorb.alle();
  assert.deepEqual(korb.map(k => [k.grund, k.eintrag.notiz]), [["geaendert", "ergänzt"]]);
});

test("Papierkorb: Gewässer mit Regeln kommt zurück, Fänge und Gewässer bleiben getrennt", async () => {
  const buch = await oeffne(ersatzIdb());
  const g = await buch.gewaesser.speichere(see(), KORB_START);
  const f = await buch.speichere(fang(), KORB_START);
  const korbG = await buch.gewaesser.loesche(g.id, nachTagen(1)), korbF = await buch.loesche(f.id, nachTagen(1));
  assert.deepEqual((await buch.papierkorb.alle()).map(k => k.art).sort(), ["fang", "gewaesser"]);
  await buch.papierkorb.stelleWiederHer(korbG, nachTagen(2));
  assert.equal((await buch.gewaesser.alle())[0].regeln.hecht.mindestmass, 60);
  assert.equal((await buch.alle()).length, 0);
  await buch.papierkorb.stelleWiederHer(korbF, nachTagen(2));
  assert.equal((await buch.alle()).length, 1);
  await assert.rejects(buch.papierkorb.stelleWiederHer(korbF, nachTagen(2)), /nicht mehr im Papierkorb/);
});

test("Papierkorb: nach 30 Tagen wird aufgeräumt, endgültig löschen und leeren gehen sofort", async () => {
  const buch = await oeffne(ersatzIdb());
  const ids = [];
  for (const n of [0, 10, 20]) ids.push(await buch.loesche((await buch.speichere(fang({ notiz: "Tag " + n }), KORB_START)).id, nachTagen(n)));
  await buch.papierkorb.raeumeAuf(nachTagen(29.9));
  assert.equal((await buch.papierkorb.alle()).length, 3);
  await buch.papierkorb.raeumeAuf(nachTagen(30));
  assert.deepEqual((await buch.papierkorb.alle()).map(k => k.eintrag.notiz), ["Tag 20", "Tag 10"], "neueste zuerst");
  await buch.papierkorb.loesche(ids[1]);
  assert.deepEqual((await buch.papierkorb.alle()).map(k => k.id), [ids[2]]);
  await buch.papierkorb.leere();
  assert.equal((await buch.papierkorb.alle()).length, 0);
  assert.equal((await buch.alle()).length, 0);
});

test("Papierkorb steht nicht im Backup", async () => {
  const buch = await oeffne(ersatzIdb());
  await buch.loesche((await buch.speichere(fang({ position: stelle }), KORB_START)).id, nachTagen(1));
  const text = await (await alsBackup(await buch.alle(), KORB_START, await buch.gewaesser.alle())).text();
  assert.equal(text.includes("48.3301"), false);
});

test("Papierkorb: Texte für die Anzeige und verbleibende Tage", () => {
  const k = { id: "k", art: "fang", grund: "geloescht", geloescht: "2026-10-01T10:00:00.000Z", eintrag: fertig({ position: stelle, foto: korbFoto() }) };
  const jetzt = new Date("2026-10-02T10:00:00Z");
  assert.equal(korbTageNoch(k, jetzt), 29);
  assert.equal(korbTageNoch(k, new Date("2026-10-30T11:00:00Z")), 1);
  assert.equal(korbTageNoch(k, new Date("2026-12-01T10:00:00Z")), 0);
  const t = korbText(k, jetzt);
  assert.equal(t.titel, "Hecht · 62,5 cm");
  assert.equal(t.zeilen[0], "Fang vom 1.6.2026, Kinzig, mit Position, mit Foto");
  assert.match(t.zeilen[1], /^Gelöscht am 1\.10\.2026, bleibt noch 29 Tage$/);
  const g = korbText({ ...k, art: "gewaesser", grund: "geaendert", eintrag: { name: "Vereinssee Haslach" } }, new Date("2026-10-30T11:00:00Z"));
  assert.equal(g.titel, "Vereinssee Haslach");
  assert.match(g.zeilen[1], /^Fassung vor der Änderung vom 1\.10\.2026, bleibt noch einen Tag$/);
});

test("Umbau auf Version 3: Fänge und Gewässer bleiben, der Papierkorb kommt dazu", async () => {
  // Stand vor dem Papierkorb nachbauen: Version 2 mit Fängen und Gewässern.
  const idb = ersatzIdb();
  await new Promise(ok => {
    const r = idb.open(DB_NAME, 2);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: "id" }); r.result.createObjectStore(STORE_GEWAESSER, { keyPath: "id" }); };
    r.onsuccess = () => { const tx = r.result.transaction(STORE, "readwrite"); tx.oncomplete = ok; tx.objectStore(STORE).put(fertig({ notiz: "von früher" })); };
  });
  const buch = await oeffne(idb);
  assert.deepEqual((await buch.alle()).map(e => e.notiz), ["von früher"]);
  assert.deepEqual(await buch.papierkorb.alle(), []);
  await buch.loesche("a");
  assert.equal((await (await oeffne(idb)).papierkorb.alle()).length, 1);
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
  // Einträge von früher haben noch kein Feld "wetter". bereinige ergänzt es beim nächsten Speichern.
  assert.deepEqual((await buch.alle()).map(bereinige), [bereinige(fertig({ notiz: "von früher" }))]);
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

const ort = { lat: 48.4012, lon: 8.0234, genauigkeit: 5 };
const wetter = (mehr = {}) => ({ zeit: "2026-06-01T07:00", lat: 48.4, lon: 8.02, temperatur: 14.2, luftdruck: 1012.3, drucktrend: -1.8,
  wind: 9.4, windrichtung: 230, boeen: 21, bewoelkung: 75, niederschlag: 0.4, abgerufen: "2026-06-01T05:20:00.000Z", ...mehr });

test("Wetter am Fang: bleibt nur, solange Stunde und Ort passen, unlesbares Wetter macht den Fang nicht ungültig", () => {
  assert.equal(bereinige(fertig()).wetter, null, "Einträge von früher haben kein Wetter");
  assert.deepEqual(bereinige(fertig({ position: ort, wetter: wetter() })).wetter, wetter());
  assert.equal(bereinige(fertig({ position: ort, wetter: wetter(), zeit: "2026-06-01T08:15" })).wetter, null, "andere Stunde");
  assert.equal(bereinige(fertig({ position: { ...ort, lat: 48.5 }, wetter: wetter() })).wetter, null, "anderer Ort");
  assert.equal(bereinige(fertig({ position: null, wetter: wetter() })).wetter, null, "ohne Position kein Wetter");
  assert.equal(bereinige(fertig({ position: ort, wetter: wetter({ luftdruck: "hoch" }) })).wetter, null);
  assert.equal(bereinige(fertig({ position: ort, wetter: "sonnig" })).artName, "Hecht");
});

test("ergaenze: Wetter nachtragen lässt geaendert stehen und überschreibt keine Bearbeitung", async () => {
  const buch = await oeffne(ersatzIdb());
  const a = await buch.speichere(fang({ position: ort }), new Date("2026-06-01T08:00:00Z"));
  const b = await buch.speichere(fang({ zeit: "2026-06-02T07:15", gewaesser: "Rench" }), new Date("2026-06-02T08:00:00Z"));

  const neu = await buch.ergaenze(a.id, e => ({ ...e, wetter: wetter() }));
  assert.deepEqual(neu.wetter, wetter());
  assert.equal(neu.geaendert, a.geaendert);
  const alle = await buch.alle();
  assert.deepEqual(alle.find(e => e.id === a.id), neu);
  assert.deepEqual(letzteGewaesser(alle), ["Rench", "Kinzig"], "Nachladen sortiert die Vorschläge nicht um");

  // Inzwischen wurde die Uhrzeit geändert: Das alte Wetter passt nicht mehr und wird nicht eingetragen.
  await buch.speichere({ ...neu, zeit: "2026-06-01T11:15", notiz: "korrigiert" }, new Date("2026-06-03T08:00:00Z"));
  const spaet = await buch.ergaenze(a.id, e => ({ ...e, wetter: wetter() }));
  assert.equal(spaet.wetter, null);
  assert.equal(spaet.notiz, "korrigiert");

  assert.equal(await buch.ergaenze(a.id, () => null), null, "null heißt: nichts tun");
  assert.equal(await buch.ergaenze("gibt-es-nicht", e => e), null);
  assert.equal(await buch.ergaenze(b.id, e => ({ ...e, verbleib: "?" })), null, "ungültiger Stand wird nicht geschrieben");
  assert.equal((await buch.alle()).find(e => e.id === b.id).verbleib, "entnommen");
});

test("Backup enthält das Wetter, die CSV nicht", async () => {
  const buch = await oeffne(ersatzIdb());
  const a = await buch.speichere(fang({ position: ort, wetter: wetter() }));
  const { faenge } = liesBackup(await (await alsBackup(await buch.alle())).text());
  assert.deepEqual(faenge[0].wetter, wetter());
  assert.doesNotMatch(alsCsv([a]), /1012|hPa|14[.,]2/);
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
  assert.equal(STORE_PAPIERKORB, "papierkorb");
});
