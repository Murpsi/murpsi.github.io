// Fangbuch: Speicherlogik. Kein DOM-Zugriff, damit sie in Node testbar bleibt.
// Gespeichert wird in IndexedDB, der Datenbank des Browsers. Sie liegt nur auf dem Gerät, läuft ohne Netz
// und kann anders als localStorage auch Fotos (Blobs) aufnehmen.
//
// Ein Eintrag:
// { id, art, artName, laenge (cm oder null), zeit ("2026-10-11T14:30", Ortszeit), gewaesser,
//   position ({ lat, lon, genauigkeit } oder null), foto, vorschau (Blob oder null),
//   verbleib ("entnommen" | "zurueckgesetzt"), notiz, erstellt, geaendert }
//
// In derselben Datenbank liegen seit Version 2 die Gewässer mit ihren Vereinsregeln (siehe gewaesser.js).

import { bereinigeGewaesser, liesGewaesserListe } from "./gewaesser.js";

export const DB_NAME = "fang-check";
export const STORE = "faenge";
export const STORE_GEWAESSER = "gewaesser";
export const VERBLEIB = { entnommen: "entnommen", zurueckgesetzt: "zurückgesetzt" };
const BACKUP_FORMAT = "fang-check-backup";

const istText = (t, max) => typeof t === "string" && t.length <= max;
const istZahl = (z, min, max) => typeof z === "number" && Number.isFinite(z) && z >= min && z <= max;
const istBild = b => b === null || (b instanceof Blob && /^image\/(jpeg|png|webp)$/.test(b.type));

function istZeit(z) {
  const m = typeof z === "string" && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(z);
  if (!m) return false;
  const [j, mo, t, h, mi] = m.slice(1).map(Number), d = new Date(j, mo - 1, t);
  // new Date(2026, 1, 31) rollt still in den März, deshalb zurückvergleichen.
  return d.getMonth() === mo - 1 && d.getDate() === t && h < 24 && mi < 60;
}

// Prüft einen Eintrag und gibt ihn nur mit den bekannten Feldern zurück. Wirft bei Fehlern mit deutscher Meldung.
export function bereinige(roh) {
  const fehler = text => { throw new Error(text); };
  if (!roh || typeof roh !== "object") fehler("Eintrag fehlt.");
  for (const feld of ["id", "art", "artName", "erstellt", "geaendert"])
    if (!istText(roh[feld], 100) || !roh[feld]) fehler("Feld " + feld + " fehlt.");
  if (!istZeit(roh.zeit)) fehler("Datum oder Uhrzeit fehlt oder ist ungültig.");
  if (!Object.hasOwn(VERBLEIB, roh.verbleib)) fehler("Bitte wählen: entnommen oder zurückgesetzt.");
  const laenge = roh.laenge ?? null;
  if (laenge !== null && !(istZahl(laenge, 0, 300) && laenge > 0)) fehler("Länge muss zwischen 0 und 300 cm liegen.");
  const gewaesser = roh.gewaesser ?? "", notiz = roh.notiz ?? "";
  if (!istText(gewaesser, 80)) fehler("Gewässer ist zu lang (höchstens 80 Zeichen).");
  if (!istText(notiz, 1000)) fehler("Notiz ist zu lang (höchstens 1000 Zeichen).");
  let position = roh.position ?? null;
  if (position !== null) {
    const g = position.genauigkeit ?? null;
    if (!istZahl(position.lat, -90, 90) || !istZahl(position.lon, -180, 180) || (g !== null && !istZahl(g, 0, 1e7))) fehler("Position ist ungültig.");
    position = { lat: position.lat, lon: position.lon, genauigkeit: g };
  }
  const foto = roh.foto ?? null, vorschau = roh.vorschau ?? null;
  if (!istBild(foto) || !istBild(vorschau)) fehler("Foto ist kein Bild.");
  return { id: roh.id, art: roh.art, artName: roh.artName, laenge, zeit: roh.zeit, gewaesser: gewaesser.trim(), position,
    foto, vorschau, verbleib: roh.verbleib, notiz: notiz.trim(), erstellt: roh.erstellt, geaendert: roh.geaendert };
}

// Neueste zuerst.
export function sortiere(faenge) {
  return [...faenge].sort((a, b) => b.zeit.localeCompare(a.zeit) || b.erstellt.localeCompare(a.erstellt));
}

// filter: { jahr, art, gewaesser }, leer heißt "alle".
export function filtere(faenge, { jahr = "", art = "", gewaesser = "" } = {}) {
  return faenge.filter(e => (!jahr || e.zeit.startsWith(jahr + "-")) && (!art || e.art === art) && (!gewaesser || e.gewaesser === gewaesser));
}

// Was in den Filtern zur Auswahl steht: nur Werte, die im Fangbuch vorkommen.
export function filterWerte(faenge) {
  const arten = new Map();
  faenge.forEach(e => arten.set(e.art, e.artName));
  return {
    jahre: [...new Set(faenge.map(e => e.zeit.slice(0, 4)))].sort().reverse(),
    arten: [...arten].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "de")),
    gewaesser: [...new Set(faenge.map(e => e.gewaesser).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"))
  };
}

// Zuletzt genutzte Gewässer als Vorschlag, das jüngste zuerst.
export function letzteGewaesser(faenge, max = 8) {
  const nachEingabe = [...faenge].sort((a, b) => b.geaendert.localeCompare(a.geaendert));
  return [...new Set(nachEingabe.map(e => e.gewaesser).filter(Boolean))].slice(0, max);
}

// Fangliste für den Verein. Semikolon und Dezimalkomma, damit ein deutsches Excel sie direkt öffnet.
// Die Position bleibt bewusst draußen: Angelstellen sind privat.
export function alsCsv(faenge) {
  const zelle = (wert, freitext) => {
    let s = wert == null ? "" : String(wert);
    // Excel würde Text mit = + - @ am Anfang als Formel ausführen.
    if (freitext && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[";\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
  };
  const zeilen = [["Datum", "Uhrzeit", "Art", "Länge (cm)", "Gewässer", "Verbleib", "Notiz"].join(";")];
  for (const e of sortiere(faenge).reverse()) {
    const [j, m, t] = e.zeit.slice(0, 10).split("-");
    zeilen.push([zelle(t + "." + m + "." + j), zelle(e.zeit.slice(11)), zelle(e.artName, true),
      zelle(e.laenge === null ? "" : String(e.laenge).replace(".", ",")), zelle(e.gewaesser, true),
      zelle(VERBLEIB[e.verbleib]), zelle(e.notiz, true)].join(";"));
  }
  // Das BOM am Anfang sagt Excel, dass die Datei UTF-8 ist, sonst werden Umlaute zu Zeichensalat.
  return "﻿" + zeilen.join("\r\n") + "\r\n";
}

// Fotos stehen im Backup als Data-URL (Base64-Text), weil JSON keine Binärdaten kennt.
async function alsDataUrl(blob) {
  if (!blob) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return "data:" + blob.type + ";base64," + btoa(s);
}
function ausDataUrl(url) {
  if (url == null) return null;
  const m = typeof url === "string" && /^data:([^;,]*);base64,([A-Za-z0-9+/=]*)$/.exec(url);
  if (!m) throw new Error("Foto im Backup ist nicht lesbar.");
  const s = atob(m[2]), bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

// Backup aller Fänge samt Fotos und aller Gewässer als JSON-Datei. Stückweise gebaut, damit nie alles als ein Text im Speicher liegt.
export async function alsBackup(faenge, jetzt = new Date(), gewaesser = []) {
  const teile = ['{"format":"' + BACKUP_FORMAT + '","version":2,"erstellt":"' + jetzt.toISOString() + '","faenge":['];
  for (const [i, e] of faenge.entries())
    teile.push((i ? "," : "") + JSON.stringify({ ...e, foto: await alsDataUrl(e.foto), vorschau: await alsDataUrl(e.vorschau) }));
  teile.push('],"gewaesser":' + JSON.stringify(gewaesser) + "}");
  return new Blob(teile, { type: "application/json" });
}

// Liest den Text einer Backup-Datei. Einträge, die die Prüfung nicht bestehen, werden gezählt statt übernommen.
// Backups der Version 1 haben keine Gewässer.
export function liesBackup(text) {
  let daten;
  try { daten = JSON.parse(text); } catch (e) { throw new Error("Die Datei ist kein lesbares JSON."); }
  if (!daten || daten.format !== BACKUP_FORMAT || !Array.isArray(daten.faenge)) throw new Error("Die Datei ist kein Fang-Check-Backup.");
  const faenge = [];
  let fehlerhaft = 0;
  for (const roh of daten.faenge) {
    try { faenge.push(bereinige({ ...roh, foto: ausDataUrl(roh.foto), vorschau: ausDataUrl(roh.vorschau) })); }
    catch (e) { fehlerhaft++; }
  }
  const g = liesGewaesserListe(Array.isArray(daten.gewaesser) ? daten.gewaesser : []);
  return { faenge, fehlerhaft, gewaesser: g.gewaesser, gewaesserFehlerhaft: g.fehlerhaft };
}

// Größe nach dem Verkleinern: längste Seite höchstens max, Seitenverhältnis bleibt, nie vergrößern.
export function zielGroesse(breite, hoehe, max = 1600) {
  const f = Math.min(1, max / Math.max(breite, hoehe));
  return { breite: Math.max(1, Math.round(breite * f)), hoehe: Math.max(1, Math.round(hoehe * f)) };
}

const anfrage = req => new Promise((ok, fehler) => { req.onsuccess = () => ok(req.result); req.onerror = () => fehler(req.error); });

// Öffnet das Fangbuch. idb ist nur für die Tests austauschbar.
export function oeffne(idb = globalThis.indexedDB) {
  return new Promise((ok, fehler) => {
    if (!idb) return fehler(new Error("Dieser Browser kann kein Fangbuch speichern."));
    const req = idb.open(DB_NAME, 2);
    // Läuft beim allerersten Öffnen und wenn die Versionsnummer oben gestiegen ist. oldVersion sagt, was schon da ist:
    // 0 = noch keine Datenbank, 1 = Fangbuch ohne Gewässer. Vorhandene Tabellen und ihre Einträge bleiben unberührt.
    req.onupgradeneeded = ev => {
      if (ev.oldVersion < 1) req.result.createObjectStore(STORE, { keyPath: "id" });
      if (ev.oldVersion < 2) req.result.createObjectStore(STORE_GEWAESSER, { keyPath: "id" });
    };
    // Der Umbau wartet, solange die App in einem zweiten Fenster noch mit der alten Version offen ist.
    req.onblocked = () => fehler(new Error("Die App ist noch in einem anderen Fenster offen. Dort schließen und hier neu laden."));
    req.onsuccess = () => {
      // Umgekehrt: Will ein anderes Fenster später umbauen, gibt dieses die Datenbank frei.
      req.result.onversionchange = () => req.result.close();
      ok({ ...tabelle(req.result, STORE, bereinige, sortiere), gewaesser: tabelle(req.result, STORE_GEWAESSER, bereinigeGewaesser, nachName) });
    };
    req.onerror = () => fehler(req.error);
  });
}

const nachName = liste => [...liste].sort((a, b) => a.name.localeCompare(b.name, "de"));

// Lesen und Schreiben einer Tabelle. Das Fangbuch und die Gewässer arbeiten gleich, nur Prüfung und Reihenfolge unterscheiden sich.
function tabelle(db, store, pruefe, ordne) {
  const alle = async () => ordne(await anfrage(db.transaction(store).objectStore(store).getAll()));
  // Erst wenn die Transaktion abgeschlossen ist, liegen die Daten sicher auf dem Gerät.
  const schreiben = fn => new Promise((ok, fehler) => {
    const tx = db.transaction(store, "readwrite");
    tx.oncomplete = () => ok();
    tx.onerror = tx.onabort = () => fehler(tx.error || new Error("Speichern fehlgeschlagen."));
    fn(tx.objectStore(store));
  });
  return {
    alle,
    // Ohne id entsteht ein neuer Eintrag, mit id wird der vorhandene ersetzt.
    async speichere(roh, jetzt = new Date()) {
      const zeit = jetzt.toISOString();
      const e = pruefe({ ...roh, id: roh.id || crypto.randomUUID(), erstellt: roh.erstellt || zeit, geaendert: zeit });
      await schreiben(s => s.put(e));
      return e;
    },
    loesche: id => schreiben(s => s.delete(id)),
    // Spielt ein Backup oder eine geteilte Datei ein, ohne etwas zu löschen. Bei gleicher id gewinnt der zuletzt geänderte Eintrag.
    async uebernimm(liste) {
      const vorhanden = new Map((await alle()).map(e => [e.id, e]));
      const ergebnis = { neu: 0, aktualisiert: 0, unveraendert: 0 }, neue = [];
      for (const e of liste) {
        const alt = vorhanden.get(e.id);
        if (!alt) ergebnis.neu++;
        else if (e.geaendert > alt.geaendert) ergebnis.aktualisiert++;
        else { ergebnis.unveraendert++; continue; }
        neue.push(e);
      }
      if (neue.length) await schreiben(s => neue.forEach(e => s.put(e)));
      return ergebnis;
    }
  };
}
