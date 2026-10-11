// Tests für Wetter und Mond.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mondphase, MONDPHASEN, wetterAdresse, gerundet, liesWetter, bereinigeWetter, wetterPasst, wetterOffen, holeWetter, TAGE_ZURUECK,
  drucktrendName, windrichtung, bewoelkungName, wetterText } from "../js/wetter.js";

// Finsternisse sind sichere Vergleichswerte: Eine Sonnenfinsternis gibt es nur bei Neumond, eine Mondfinsternis nur bei Vollmond.
test("Mondphase: Sonnenfinsternisse liegen im Neumond, Mondfinsternisse im Vollmond", () => {
  for (const zeit of ["1999-08-11T12:30", "2024-04-08T20:00", "2026-08-12T19:30"])
    assert.equal(mondphase(zeit).name, "Neumond", zeit);
  for (const zeit of ["2022-11-08T12:00", "2025-03-14T08:00", "2025-09-07T20:00"])
    assert.equal(mondphase(zeit).name, "Vollmond", zeit);
});

test("Mondphase: Reihenfolge von Neumond zu Neumond", () => {
  // Ab der Sonnenfinsternis am 8.4.2024 alle 3,7 Tage eine Phase weiter.
  const namen = ["2024-04-08T20:00", "2024-04-12T12:00", "2024-04-16T06:00", "2024-04-19T23:00", "2024-04-23T16:00",
    "2024-04-27T10:00", "2024-05-01T04:00", "2024-05-04T21:00", "2024-05-08T12:00"].map(z => mondphase(z).name);
  assert.deepEqual(namen, [...MONDPHASEN, "Neumond"]);
});

test("Mondphase: beleuchteter Anteil und Alter", () => {
  assert.ok(mondphase("2024-04-08T20:00").beleuchtet < 0.02);
  assert.ok(mondphase("2025-03-14T08:00").beleuchtet > 0.98);
  const viertel = mondphase("2025-03-22T12:00");
  assert.equal(viertel.name, "Letztes Viertel");
  assert.ok(viertel.beleuchtet > 0.3 && viertel.beleuchtet < 0.7);
  const alter = mondphase("2025-03-14T08:00").alter;
  assert.ok(alter > 13.5 && alter < 16, "Vollmond liegt rund 14,8 Tage nach Neumond, war " + alter);
});

test("Mondphase: unlesbare Zeit ergibt null", () => {
  for (const z of [null, undefined, "", "2026-10-11", "gestern", 5]) assert.equal(mondphase(z), null);
});

// ---------- Wetter ----------
// Eine echte Antwort von Open-Meteo für 48.40 / 8.02 am 9. und 10.10.2026, unverändert gespeichert.
const antwort = JSON.parse(readFileSync(new URL("open-meteo-antwort.json", import.meta.url), "utf8"));
const fang = (mehr = {}) => ({ zeit: "2026-10-10T14:30", position: { lat: 48.4012, lon: 8.0234, genauigkeit: 5 }, wetter: null, ...mehr });
const jetzt = new Date(2026, 9, 11, 20, 0);

test("Anfrage: nur gerundete Position und zwei Tage, nichts sonst", () => {
  const adresse = new URL(wetterAdresse(fang()));
  assert.equal(adresse.origin + adresse.pathname, "https://api.open-meteo.com/v1/forecast");
  assert.deepEqual(Object.fromEntries(adresse.searchParams), {
    latitude: "48.4", longitude: "8.02", timezone: "Europe/Berlin", start_date: "2026-10-09", end_date: "2026-10-10",
    hourly: "temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover" });
  assert.doesNotMatch(adresse.href, /4012|0234/, "die genaue Stelle bleibt auf dem Gerät");
  // Über den Monats- und Jahreswechsel.
  assert.match(wetterAdresse(fang({ zeit: "2026-03-01T05:00" })), /start_date=2026-02-28&end_date=2026-03-01/);
  assert.match(wetterAdresse(fang({ zeit: "2027-01-01T00:10" })), /start_date=2026-12-31&end_date=2027-01-01/);
  assert.deepEqual(gerundet({ lat: 48.405, lon: 8.0151 }), { lat: 48.41, lon: 8.02 });
});

test("Antwort lesen: Werte der vollen Stunde, Drucktrend über 6 Stunden", () => {
  const w = liesWetter(antwort, fang(), jetzt);
  const i = antwort.hourly.time.indexOf("2026-10-10T14:00");
  assert.equal(w.zeit, "2026-10-10T14:00");
  assert.deepEqual([w.lat, w.lon], [48.4, 8.02]);
  assert.equal(w.temperatur, antwort.hourly.temperature_2m[i]);
  assert.equal(w.luftdruck, antwort.hourly.pressure_msl[i]);
  assert.equal(w.drucktrend, Math.round((antwort.hourly.pressure_msl[i] - antwort.hourly.pressure_msl[i - 6]) * 10) / 10);
  assert.equal(w.wind, antwort.hourly.wind_speed_10m[i]);
  assert.equal(w.windrichtung, antwort.hourly.wind_direction_10m[i]);
  assert.equal(w.boeen, antwort.hourly.wind_gusts_10m[i]);
  assert.equal(w.bewoelkung, antwort.hourly.cloud_cover[i]);
  assert.equal(w.abgerufen, jetzt.toISOString());
  assert.deepEqual(bereinigeWetter(w), w);
});

test("Antwort lesen: fehlende Stunde oder fehlende Werte ergeben kein Wetter", () => {
  assert.equal(liesWetter(antwort, fang({ zeit: "2026-10-11T14:30" }), jetzt), null, "Stunde nicht in der Antwort");
  assert.equal(liesWetter({ error: true, reason: "out of allowed range" }, fang(), jetzt), null);
  assert.equal(liesWetter(null, fang(), jetzt), null);
  const luecke = structuredClone(antwort), i = luecke.hourly.time.indexOf("2026-10-10T14:00");
  luecke.hourly.temperature_2m[i] = null;
  assert.equal(liesWetter(luecke, fang(), jetzt), null, "ohne Temperatur kein Wetter");
  // Fehlen nur die 6 Stunden davor, gibt es Wetter ohne Trend.
  const ohneTrend = structuredClone(antwort);
  ohneTrend.hourly.pressure_msl[i - 6] = null;
  assert.equal(liesWetter(ohneTrend, fang(), jetzt).drucktrend, null);
  assert.equal(liesWetter(antwort, fang({ zeit: "2026-10-09T03:10" }), jetzt).drucktrend, null, "erste Stunden der Antwort");
});

test("bereinigeWetter: unlesbares Wetter wird zu null, fremde Felder fallen weg", () => {
  const w = liesWetter(antwort, fang(), jetzt);
  assert.equal("fremd" in bereinigeWetter({ ...w, fremd: 1 }), false);
  for (const s of [{ temperatur: "15" }, { luftdruck: 100 }, { zeit: "2026-10-10T14:30" }, { bewoelkung: 120 }, { lat: 91 },
    { windrichtung: -1 }, { abgerufen: 5 }, { drucktrend: "fallend" }])
    assert.equal(bereinigeWetter({ ...w, ...s }), null, JSON.stringify(s));
  for (const s of [null, undefined, "sonnig", 5]) assert.equal(bereinigeWetter(s), null);
});

test("wetterPasst und wetterOffen: nach Änderung von Uhrzeit oder Ort ist das Wetter wieder offen", () => {
  const w = liesWetter(antwort, fang(), jetzt), mit = fang({ wetter: w });
  assert.equal(wetterPasst(mit), true);
  assert.equal(wetterOffen(mit, jetzt), false);
  assert.equal(wetterPasst({ ...mit, zeit: "2026-10-10T14:59" }), true, "dieselbe Stunde");
  assert.equal(wetterPasst({ ...mit, position: { lat: 48.4049, lon: 8.0151, genauigkeit: 30 } }), true, "dasselbe Raster");
  for (const anders of [{ zeit: "2026-10-10T15:00" }, { position: { lat: 48.45, lon: 8.02, genauigkeit: 5 } }, { position: null }])
    assert.equal(wetterPasst({ ...mit, ...anders }), false, JSON.stringify(anders));
  assert.equal(wetterOffen({ ...mit, zeit: "2026-10-10T15:00" }, jetzt), true);

  assert.equal(wetterOffen(fang(), jetzt), true);
  assert.equal(wetterOffen(fang({ position: null }), jetzt), false, "ohne Position kein Wetter");
  assert.equal(wetterOffen(fang({ zeit: "2026-10-11T20:45" }), jetzt), true, "die laufende Stunde zählt");
  assert.equal(wetterOffen(fang({ zeit: "2026-10-11T21:00" }), jetzt), false, "Zukunft: eine Vorhersage ist keine Messung");
  assert.equal(wetterOffen(fang({ zeit: "2026-07-14T08:00" }), jetzt), true, "89 Tage alt");
  assert.equal(wetterOffen(fang({ zeit: "2026-07-12T08:00" }), jetzt), false, "älter, als die Adresse zurückreicht");
  assert.equal(TAGE_ZURUECK, 90);
});

test("holeWetter: fragt genau die eine Adresse, wirft ohne Netz und bei Serverfehler", async () => {
  const gerufen = [];
  const hole = async (adresse, optionen) => { gerufen.push([adresse, optionen]); return { ok: true, json: async () => antwort }; };
  const w = await holeWetter(fang(), hole, jetzt);
  assert.equal(w.luftdruck, 1014.8);
  assert.equal(gerufen.length, 1);
  assert.equal(gerufen[0][0], wetterAdresse(fang()));
  assert.ok(gerufen[0][1].signal instanceof AbortSignal, "Wartezeit fehlt");
  await assert.rejects(holeWetter(fang(), async () => { throw new TypeError("Failed to fetch"); }, jetzt), /Failed to fetch/);
  await assert.rejects(holeWetter(fang(), async () => ({ ok: false, status: 503 }), jetzt), /antwortet nicht \(503\)/);
  assert.equal(await holeWetter(fang({ zeit: "2026-10-11T14:30" }), hole, jetzt), null);
});

test("Anzeige: Trend, Windrichtung, Bewölkung, Zeile für die Fangkarte", () => {
  assert.deepEqual([-3, -1, -0.9, 0, 0.9, 1, 4].map(drucktrendName),
    ["fallend", "fallend", "gleichbleibend", "gleichbleibend", "gleichbleibend", "steigend", "steigend"]);
  assert.equal(drucktrendName(null), "");
  assert.deepEqual([0, 22, 23, 90, 135, 180, 225, 264, 315, 338, 360].map(windrichtung),
    ["N", "N", "NO", "O", "SO", "S", "SW", "W", "NW", "N", "N"]);
  assert.deepEqual([0, 12, 13, 50, 87, 88, 100].map(bewoelkungName), ["klar", "klar", "heiter", "wolkig", "stark bewölkt", "bedeckt", "bedeckt"]);
  const w = liesWetter(antwort, fang(), jetzt);
  assert.equal(wetterText(w), "15,5 °C · 1015 hPa gleichbleibend (−0,2 in 6 h) · Wind 7 km/h aus W · wolkig");
  assert.equal(wetterText({ ...w, temperatur: -2.5, drucktrend: 3.4, windrichtung: 45 }), "−2,5 °C · 1015 hPa steigend (+3,4 in 6 h) · Wind 7 km/h aus NO · wolkig");
  assert.equal(wetterText({ ...w, drucktrend: null }), "15,5 °C · 1015 hPa · Wind 7 km/h aus W · wolkig");
});
