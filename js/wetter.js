// Wetter und Mond zu einem Fang. Kein DOM-Zugriff, damit die Logik in Node testbar bleibt.

// ---------- Mondphase ----------
// Wird aus Datum und Uhrzeit berechnet und nicht gespeichert. So gibt es sie ohne Netz, ohne Position und für alte Fänge.
// Gerechnet wird mit der mittleren Dauer von Neumond zu Neumond ab einem bekannten Neumond. Der wahre Mond weicht davon
// um bis zu etwa 14 Stunden ab. Für acht Phasen von je gut dreieinhalb Tagen reicht das.
const MONDMONAT = 29.530588853;
const NEUMOND = Date.UTC(2000, 0, 6, 18, 14);
export const MONDPHASEN = ["Neumond", "Zunehmende Sichel", "Erstes Viertel", "Zunehmender Mond",
  "Vollmond", "Abnehmender Mond", "Letztes Viertel", "Abnehmende Sichel"];

// zeit: Ortszeit als Text ("2026-10-11T14:30"). Ergebnis: { index (0 bis 7), name, alter (Tage seit Neumond),
// beleuchtet (Anteil der sichtbaren Scheibe, 0 bis 1) } oder null, wenn die Zeit nicht lesbar ist.
export function mondphase(zeit) {
  const m = typeof zeit === "string" && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(zeit);
  if (!m) return null;
  const [j, mo, t, h, mi] = m.slice(1).map(Number);
  // Die Ortszeit wird wie Weltzeit gelesen. Das verschiebt um höchstens zwei Stunden, hängt dafür nicht von der
  // Zeitzone des Geräts ab.
  const tage = (Date.UTC(j, mo - 1, t, h, mi) - NEUMOND) / 86400000;
  const anteil = ((tage / MONDMONAT) % 1 + 1) % 1;
  const index = Math.floor(anteil * 8 + 0.5) % 8;
  return { index, name: MONDPHASEN[index], alter: anteil * MONDMONAT, beleuchtet: (1 - Math.cos(2 * Math.PI * anteil)) / 2 };
}

// ---------- Wetter von Open-Meteo ----------
// Ein Wetter am Fang:
// { zeit (volle Stunde in Ortszeit, für die es gilt, "2026-10-10T14:00"), lat, lon (gerundete Position der Anfrage),
//   temperatur (°C), luftdruck (hPa auf Meereshöhe), drucktrend (Änderung in den 6 Stunden davor in hPa, oder null),
//   wind (km/h), windrichtung (Grad, woher er kommt), boeen (km/h oder null), bewoelkung (%), abgerufen }
//
// Nur diese eine Adresse verlässt das Gerät, und nur mit Zustimmung. tests/sw.test.js lässt keine andere zu.
const ADRESSE = "https://api.open-meteo.com/v1/forecast";
const WERTE = ["temperature_2m", "pressure_msl", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "cloud_cover"];
// Die Adresse liefert rund 93 Tage zurück. Ältere Fänge bleiben ohne Wetter.
export const TAGE_ZURUECK = 90;
const WARTEZEIT = 10000;

const zz = n => String(n).padStart(2, "0");
const istZahl = (z, min, max) => typeof z === "number" && Number.isFinite(z) && z >= min && z <= max;
const istStunde = z => typeof z === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(z);
const zehntel = z => Math.round(z * 10) / 10;
// Gerechnet wird mit der Ortszeit als Text. Sie wird dafür wie Weltzeit gelesen, es geht nur um Abstände in Tagen.
const alsZahl = zeit => Date.UTC(+zeit.slice(0, 4), zeit.slice(5, 7) - 1, +zeit.slice(8, 10), +zeit.slice(11, 13), +zeit.slice(14, 16));
const ortszeit = d => d.getFullYear() + "-" + zz(d.getMonth() + 1) + "-" + zz(d.getDate()) + "T" + zz(d.getHours()) + ":" + zz(d.getMinutes());

// Die volle Stunde, in der der Fang liegt. Für sie wird das Wetter geholt.
export const stunde = zeit => zeit.slice(0, 13) + ":00";

// Zwei Nachkommastellen sind ein Raster von rund einem Kilometer: Das Gewässer ist erkennbar, die Stelle nicht.
// Genauer bringt nichts, das Wettermodell rechnet selbst nur in Kästchen von rund zwei Kilometern.
export function gerundet(position) {
  return { lat: Math.round(position.lat * 100) / 100, lon: Math.round(position.lon * 100) / 100 };
}

// Gibt ein Wetter nur mit den bekannten Feldern zurück. Unlesbares Wetter ergibt null und wird später neu geholt,
// der Fang selbst bleibt gültig.
export function bereinigeWetter(roh) {
  if (!roh || typeof roh !== "object") return null;
  const boeen = roh.boeen ?? null, drucktrend = roh.drucktrend ?? null;
  const ok = istStunde(roh.zeit) && istZahl(roh.lat, -90, 90) && istZahl(roh.lon, -180, 180)
    && istZahl(roh.temperatur, -60, 60) && istZahl(roh.luftdruck, 850, 1100) && istZahl(roh.wind, 0, 400)
    && istZahl(roh.windrichtung, 0, 360) && istZahl(roh.bewoelkung, 0, 100)
    && (boeen === null || istZahl(boeen, 0, 400)) && (drucktrend === null || istZahl(drucktrend, -100, 100))
    && typeof roh.abgerufen === "string" && roh.abgerufen.length <= 40;
  if (!ok) return null;
  return { zeit: roh.zeit, lat: roh.lat, lon: roh.lon, temperatur: roh.temperatur, luftdruck: roh.luftdruck, drucktrend,
    wind: roh.wind, windrichtung: roh.windrichtung, boeen, bewoelkung: roh.bewoelkung, abgerufen: roh.abgerufen };
}

// Gehört das gespeicherte Wetter noch zu Uhrzeit und Position des Fangs? Nach einer Änderung nicht mehr.
export function wetterPasst(eintrag) {
  const w = eintrag.wetter;
  if (!w || !eintrag.position) return false;
  const p = gerundet(eintrag.position);
  return w.zeit === stunde(eintrag.zeit) && w.lat === p.lat && w.lon === p.lon;
}

// Fehlt das Wetter und lässt es sich holen? Nur mit Position, nicht für die Zukunft (eine Vorhersage ist keine
// Messung) und nicht für Fänge, die älter sind, als die Adresse zurückreicht.
export function wetterOffen(eintrag, jetzt = new Date()) {
  if (!eintrag.position || wetterPasst(eintrag)) return false;
  const tage = (alsZahl(ortszeit(jetzt)) - alsZahl(stunde(eintrag.zeit))) / 86400000;
  return tage >= 0 && tage <= TAGE_ZURUECK;
}

// Die Anfrage für einen Fang: der Tag des Fangs und der Tag davor, damit die 6 Stunden für den Drucktrend dabei sind.
// Die Zeitzone ist fest, weil die Uhrzeit des Fangs Ortszeit in Baden-Württemberg ist.
export function wetterAdresse(eintrag) {
  const p = gerundet(eintrag.position), tag = eintrag.zeit.slice(0, 10);
  const davor = new Date(alsZahl(eintrag.zeit) - 86400000).toISOString().slice(0, 10);
  return ADRESSE + "?latitude=" + p.lat + "&longitude=" + p.lon + "&hourly=" + WERTE.join(",")
    + "&timezone=Europe%2FBerlin&start_date=" + davor + "&end_date=" + tag;
}

// Liest die Antwort von Open-Meteo. Ergebnis ist das Wetter zur Stunde des Fangs oder null, wenn sie fehlt.
export function liesWetter(antwort, eintrag, jetzt = new Date()) {
  const h = antwort && antwort.hourly, zeit = stunde(eintrag.zeit);
  const i = h && Array.isArray(h.time) ? h.time.indexOf(zeit) : -1;
  if (i < 0) return null;
  const wert = (name, k = i) => Array.isArray(h[name]) && typeof h[name][k] === "number" ? h[name][k] : null;
  const druck = wert("pressure_msl"), vorher = i >= 6 ? wert("pressure_msl", i - 6) : null;
  return bereinigeWetter({ zeit, ...gerundet(eintrag.position), temperatur: wert("temperature_2m"), luftdruck: druck,
    drucktrend: druck === null || vorher === null ? null : zehntel(druck - vorher), wind: wert("wind_speed_10m"),
    windrichtung: wert("wind_direction_10m"), boeen: wert("wind_gusts_10m"), bewoelkung: wert("cloud_cover"),
    abgerufen: jetzt.toISOString() });
}

// Holt das Wetter zu einem Fang. Wirft, wenn das Netz fehlt oder der Server nicht antwortet (später noch einmal
// versuchen). Ergebnis null heißt: Antwort ist da, enthält aber kein Wetter für diese Stunde.
// hole ist nur für die Tests austauschbar.
export async function holeWetter(eintrag, hole = globalThis.fetch, jetzt = new Date()) {
  // Ohne Wartezeit hinge der Abruf bei schwachem Netz am Wasser minutenlang.
  const res = await hole(wetterAdresse(eintrag), { signal: AbortSignal.timeout(WARTEZEIT) });
  if (!res.ok) throw new Error("Wetterdienst antwortet nicht (" + res.status + ").");
  return liesWetter(await res.json(), eintrag, jetzt);
}

// ---------- Anzeige ----------
const komma = z => String(z).replace(".", ",").replace("-", "−");
const RICHTUNG = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
export const windrichtung = grad => RICHTUNG[Math.round(grad / 45) % 8];

// Gespeichert ist die Zahl. Die Grenze von 1 hPa in 6 Stunden ist eine Wahl für die Anzeige und kein Messwert.
export function drucktrendName(aenderung) {
  if (aenderung === null) return "";
  return aenderung >= 1 ? "steigend" : aenderung <= -1 ? "fallend" : "gleichbleibend";
}

export function bewoelkungName(prozent) {
  return prozent < 13 ? "klar" : prozent < 38 ? "heiter" : prozent < 63 ? "wolkig" : prozent < 88 ? "stark bewölkt" : "bedeckt";
}

// Eine Zeile für die Fangkarte.
export function wetterText(w) {
  const trend = w.drucktrend === null ? "" : " " + drucktrendName(w.drucktrend) + " (" + (w.drucktrend > 0 ? "+" : "") + komma(w.drucktrend) + " in 6 h)";
  return [komma(w.temperatur) + " °C", Math.round(w.luftdruck) + " hPa" + trend,
    "Wind " + Math.round(w.wind) + " km/h aus " + windrichtung(w.windrichtung), bewoelkungName(w.bewoelkung)].join(" · ");
}
