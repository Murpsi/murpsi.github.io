// Vereins- und Gewässerregeln: zweite Ebene über dem Landesrecht. Kein DOM-Zugriff, damit sie in Node testbar bleibt.
// Grundsatz: Es gewinnt immer die strengere Regel. Eine Vereinsregel kann nur zusätzlich stoppen, nie etwas erlauben,
// was das Landesrecht verbietet. Fehlt etwas oder ist etwas unlesbar, nie "erlaubt".
//
// Ein Gewässer:
// { id, name, system ("rhein" | "main" | "donau"), lage ("uebrig" | "800" | "hochrhein"),
//   sperrzeit ({ von, bis } oder null, gilt für alle Arten),
//   regeln: { hecht: { gesperrt, mindestmass, hoechstmass, schonzeit, entnahmepflicht }, ... },
//   limits: [ { name, arten: ["hecht", ...], proTag, proWoche } ],
//   weitereRegeln (Freitext, wird nur angezeigt), erstellt, geaendert }

import { pruefe, inSchonzeit, tageBisEnde, fmt, SYSTEME } from "./regeln.js";

export const LAGEN = ["uebrig", "800", "hochrhein"];
const DATEI_FORMAT = "fang-check-gewaesser";
const TAGE_IM_MONAT = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const istText = (t, max) => typeof t === "string" && t.length <= max;
const istMass = m => typeof m === "number" && Number.isFinite(m) && m > 0 && m <= 300;
const istAnzahl = n => Number.isInteger(n) && n >= 1 && n <= 999;
const istTag = t => !!t && typeof t === "object" && Number.isInteger(t.monat) && t.monat >= 1 && t.monat <= 12
  && Number.isInteger(t.tag) && t.tag >= 1 && t.tag <= TAGE_IM_MONAT[t.monat - 1];

// Liefert { von, bis } nur mit den bekannten Feldern oder null. Wirft, wenn nur die Hälfte stimmt.
function zeitraum(z, was) {
  if (z == null) return null;
  if (typeof z !== "object" || !istTag(z.von) || !istTag(z.bis)) throw new Error(was + " ist unvollständig oder kein gültiges Datum.");
  return { von: { tag: z.von.tag, monat: z.von.monat }, bis: { tag: z.bis.tag, monat: z.bis.monat } };
}

// Prüft ein Gewässer und gibt es nur mit den bekannten Feldern zurück. Wirft bei Fehlern mit deutscher Meldung.
export function bereinigeGewaesser(roh) {
  const fehler = text => { throw new Error(text); };
  if (!roh || typeof roh !== "object") fehler("Gewässer fehlt.");
  for (const feld of ["id", "erstellt", "geaendert"])
    if (!istText(roh[feld], 100) || !roh[feld]) fehler("Feld " + feld + " fehlt.");
  if (!istText(roh.name, 80) || !roh.name.trim()) fehler("Name fehlt oder ist zu lang (höchstens 80 Zeichen).");
  if (!SYSTEME.includes(roh.system)) fehler("Gewässersystem fehlt.");
  if (!LAGEN.includes(roh.lage)) fehler("Lage des Gewässers fehlt.");
  const weitereRegeln = roh.weitereRegeln ?? "";
  if (!istText(weitereRegeln, 2000)) fehler("Weitere Regeln sind zu lang (höchstens 2000 Zeichen).");

  const rohRegeln = roh.regeln ?? {}, regeln = {};
  if (typeof rohRegeln !== "object" || Array.isArray(rohRegeln)) fehler("Regeln sind nicht lesbar.");
  for (const [art, r] of Object.entries(rohRegeln)) {
    if (!art || art.length > 100 || !r || typeof r !== "object") fehler("Regel für " + (art || "unbekannte Art") + " ist nicht lesbar.");
    const mindestmass = r.mindestmass ?? null, hoechstmass = r.hoechstmass ?? null;
    const gesperrt = r.gesperrt ?? false, entnahmepflicht = r.entnahmepflicht ?? false;
    if (typeof gesperrt !== "boolean" || typeof entnahmepflicht !== "boolean") fehler("Regel für " + art + " ist nicht lesbar.");
    if (mindestmass !== null && !istMass(mindestmass)) fehler("Mindestmaß für " + art + " muss zwischen 0 und 300 cm liegen.");
    if (hoechstmass !== null && !istMass(hoechstmass)) fehler("Höchstmaß für " + art + " muss zwischen 0 und 300 cm liegen.");
    if (mindestmass !== null && hoechstmass !== null && hoechstmass < mindestmass) fehler("Höchstmaß für " + art + " liegt unter dem Mindestmaß.");
    if (gesperrt && entnahmepflicht) fehler("Regel für " + art + ": gesperrt und Entnahmepflicht schließen sich aus.");
    const schonzeit = zeitraum(r.schonzeit, "Schonzeit für " + art);
    // Eine Regel ohne Inhalt wird nicht gespeichert.
    if (gesperrt || entnahmepflicht || mindestmass !== null || hoechstmass !== null || schonzeit)
      regeln[art] = { gesperrt, mindestmass, hoechstmass, schonzeit, entnahmepflicht };
  }

  const rohLimits = roh.limits ?? [];
  if (!Array.isArray(rohLimits) || rohLimits.length > 20) fehler("Limits sind nicht lesbar.");
  const limits = rohLimits.map(l => {
    if (!l || typeof l !== "object" || !istText(l.name, 40) || !l.name.trim()) fehler("Ein Limit hat keinen Namen (höchstens 40 Zeichen).");
    const name = l.name.trim(), proTag = l.proTag ?? null, proWoche = l.proWoche ?? null;
    if (!Array.isArray(l.arten) || !l.arten.length || l.arten.length > 100 || !l.arten.every(a => istText(a, 100) && a)) fehler("Limit " + name + ": mindestens eine Art wählen.");
    if (proTag === null && proWoche === null) fehler("Limit " + name + ": Anzahl pro Tag oder pro Woche fehlt.");
    if ((proTag !== null && !istAnzahl(proTag)) || (proWoche !== null && !istAnzahl(proWoche))) fehler("Limit " + name + ": Anzahl muss eine ganze Zahl von 1 bis 999 sein.");
    return { name, arten: [...new Set(l.arten)], proTag, proWoche };
  });

  return { id: roh.id, name: roh.name.trim(), system: roh.system, lage: roh.lage, sperrzeit: zeitraum(roh.sperrzeit, "Sperrzeit"),
    regeln, limits, weitereRegeln: weitereRegeln.trim(), erstellt: roh.erstellt, geaendert: roh.geaendert };
}

// Gewässer im Fangbuch sind Freitext. Verglichen wird der Name ohne Rücksicht auf Groß- und Kleinschreibung.
const norm = name => typeof name === "string" ? name.trim().toLocaleLowerCase("de") : "";
export const gleichesGewaesser = (a, b) => norm(a) !== "" && norm(a) === norm(b);

const zz = n => String(n).padStart(2, "0");
const tagText = d => d.getFullYear() + "-" + zz(d.getMonth() + 1) + "-" + zz(d.getDate());
// Erster und letzter Tag der Woche von Montag bis Sonntag, als Text wie im Fangbuch ("2026-10-11").
export function woche(date) {
  const j = date.getFullYear(), m = date.getMonth(), montag = date.getDate() - (date.getDay() + 6) % 7;
  return { von: tagText(new Date(j, m, montag)), bis: tagText(new Date(j, m, montag + 6)) };
}

// Zählt die entnommenen Fänge eines Limits am Gewässer: am Kalendertag und in der Woche des Datums.
export function zaehle(limit, gewaesserName, date, faenge) {
  const heute = tagText(date), w = woche(date);
  let tag = 0, wocheAnzahl = 0;
  for (const e of faenge) {
    if (!e || e.verbleib !== "entnommen" || !limit.arten.includes(e.art) || !gleichesGewaesser(e.gewaesser, gewaesserName)) continue;
    const t = String(e.zeit).slice(0, 10);
    if (t === heute) tag++;
    if (t >= w.von && t <= w.bis) wocheAnzahl++;
  }
  return { tag, woche: wocheAnzahl };
}

const wiederAb = (z, date) => { const tage = tageBisEnde(z, date); return tage === 1 ? "ab morgen." : "in " + tage + " Tagen."; };
const RANG = { ok: 0, warn: 1, stop: 2 };

// Prüft einen Fang gegen Landesrecht und Gewässerregeln.
// faenge: Einträge aus dem Fangbuch für die Limits. Ohne lesbares Fangbuch gilt ein Limit als nicht prüfbar.
// Ergebnis: { status, titel, gruende: [{ text, ebene: "land" | "verein" }], r, wirksam }
export function pruefeGewaesser(art, gewaesser, date, laenge, faenge) {
  let g;
  try { g = bereinigeGewaesser(gewaesser); }
  catch (e) {
    return { status: "stop", titel: "Zurücksetzen", r: { unklar: "Gewässerregeln unlesbar." }, wirksam: null,
      gruende: [{ text: "Die Regeln dieses Gewässers sind nicht lesbar (" + e.message + "). Ohne sichere Angaben keine Entnahme.", ebene: "verein" }] };
  }
  const land = pruefe(art, g.system, g.lage, date, laenge);
  const gruende = land.gruende.map(text => ({ text, ebene: "land" }));
  // Ohne klare Landesregel oder bei ganzjähriger Schonung ändert der Verein nichts mehr.
  if (land.r.unklar || land.r.ganzjaehrig) return { status: land.status, titel: land.titel, gruende, r: land.r, wirksam: null };

  const m = date.getMonth() + 1, d = date.getDate();
  const regel = Object.hasOwn(g.regeln, art.id) ? g.regeln[art.id] : null;
  const hatLaenge = typeof laenge === "number" && Number.isFinite(laenge);
  let verein = "ok";
  const hebe = s => { if (RANG[s] > RANG[verein]) verein = s; };
  const grund = text => gruende.push({ text, ebene: "verein" });

  if (inSchonzeit(g.sperrzeit, m, d)) { hebe("stop"); grund("Gewässer gesperrt bis " + fmt(g.sperrzeit.bis) + ". Wieder offen " + wiederAb(g.sperrzeit, date)); }

  // Ein niedrigeres Vereinsmaß als das Landesmaß bleibt wirkungslos.
  const vereinsMass = regel && regel.mindestmass !== null && regel.mindestmass > (land.r.mindestmass || 0) ? regel.mindestmass : null;
  if (regel) {
    if (regel.gesperrt) { hebe("stop"); grund(art.name + " ist an diesem Gewässer ganzjährig gesperrt."); }
    if (inSchonzeit(regel.schonzeit, m, d)) { hebe("stop"); grund("Schonzeit bis " + fmt(regel.schonzeit.bis) + ". Wieder erlaubt " + wiederAb(regel.schonzeit, date)); }
    if (vereinsMass !== null) {
      if (!hatLaenge) { hebe("warn"); grund("Länge eingeben, Mindestmaß ist " + vereinsMass + " cm."); }
      else if (laenge < vereinsMass) { hebe("stop"); grund("Untermaßig: " + laenge + " cm, es fehlen " + (Math.round((vereinsMass - laenge) * 10) / 10) + " cm bis " + vereinsMass + " cm."); }
      else grund("Maßig: " + laenge + " cm, Mindestmaß " + vereinsMass + " cm.");
    }
    if (regel.hoechstmass !== null) {
      if (!hatLaenge) { hebe("warn"); grund("Länge eingeben, Höchstmaß ist " + regel.hoechstmass + " cm."); }
      else if (laenge > regel.hoechstmass) { hebe("stop"); grund("Über dem Höchstmaß: " + laenge + " cm, erlaubt bis " + regel.hoechstmass + " cm."); }
      else grund("Unter dem Höchstmaß von " + regel.hoechstmass + " cm.");
    }
  }

  for (const limit of g.limits) {
    if (!limit.arten.includes(art.id)) continue;
    if (!Array.isArray(faenge)) { hebe("stop"); grund("Limit " + limit.name + " kann ohne Fangbuch nicht geprüft werden. Ohne sichere Angaben keine Entnahme."); continue; }
    const n = zaehle(limit, g.name, date, faenge);
    for (const [max, anzahl, wort] of [[limit.proTag, n.tag, "Tageslimit"], [limit.proWoche, n.woche, "Wochenlimit"]]) {
      if (max === null) continue;
      if (anzahl >= max) { hebe("stop"); grund(wort + " " + limit.name + " erreicht: " + anzahl + " von " + max + " entnommen."); }
      else grund(wort + " " + limit.name + ": " + anzahl + " von " + max + " entnommen.");
    }
  }

  if (regel && regel.entnahmepflicht) grund("Der Verein verlangt, " + art.name + " zu entnehmen. Schonzeit und Mindestmaß gehen vor.");

  const status = RANG[verein] > RANG[land.status] ? verein : land.status;
  const titel = status === "ok" ? "Entnahme erlaubt" : status === "warn" ? "Länge fehlt"
    : land.status === "stop" ? "Zurücksetzen" : "Zurücksetzen (Vereinsregel)";
  const wirksam = { mindestmass: vereinsMass ?? land.r.mindestmass, mindestmassEbene: vereinsMass !== null ? "verein" : "land",
    hoechstmass: regel ? regel.hoechstmass : null, schonzeit: regel ? regel.schonzeit : null, sperrzeit: g.sperrzeit,
    gesperrt: !!(regel && regel.gesperrt), weitereRegeln: g.weitereRegeln };
  return { status, titel, gruende, r: land.r, wirksam };
}

// Was der Verein an einem Tag für eine Art sperrt, für die Liste "Geschont am":
// null | { gesperrt: true } | { bis: { tag, monat } }
export function vereinGeschont(gewaesser, artId, date) {
  const regel = gewaesser && gewaesser.regeln && Object.hasOwn(gewaesser.regeln, artId) ? gewaesser.regeln[artId] : null;
  if (!regel) return null;
  if (regel.gesperrt) return { gesperrt: true };
  return inSchonzeit(regel.schonzeit, date.getMonth() + 1, date.getDate()) ? { bis: regel.schonzeit.bis } : null;
}

// Datei zum Teilen mit Vereinskollegen. Sie enthält nur Regeln, keine Fänge und keine Positionen.
export function alsGewaesserDatei(liste, jetzt = new Date()) {
  return JSON.stringify({ format: DATEI_FORMAT, version: 1, erstellt: jetzt.toISOString(), gewaesser: liste.map(bereinigeGewaesser) }, null, 1);
}

// Prüft eine Liste aus einer Datei. Gewässer, die die Prüfung nicht bestehen, werden gezählt statt übernommen.
export function liesGewaesserListe(liste) {
  const gewaesser = [];
  let fehlerhaft = 0;
  for (const roh of liste) {
    try { gewaesser.push(bereinigeGewaesser(roh)); } catch (e) { fehlerhaft++; }
  }
  return { gewaesser, fehlerhaft };
}

export function liesGewaesserDatei(text) {
  let daten;
  try { daten = JSON.parse(text); } catch (e) { throw new Error("Die Datei ist kein lesbares JSON."); }
  if (!daten || daten.format !== DATEI_FORMAT || !Array.isArray(daten.gewaesser)) throw new Error("Die Datei enthält keine Fang-Check-Gewässerregeln.");
  return liesGewaesserListe(daten.gewaesser);
}
