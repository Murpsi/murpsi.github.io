// Hilfsskript, nicht Teil der App: erzeugt ein Beispiel-Fangbuch als Backup-Datei zum Einspielen.
// Die Fänge sind erfunden und so gewählt, dass Fangblatt und Karte alles zeigen: Tag, Dämmerung und Nacht,
// jede Bewölkung, Regen, Sturm, alle Mondphasen, Fänge ohne Wetter und ohne Position, nahe und entfernte Stellen.
// Auch das Wetter ist erfunden, nicht gemessen. Jede Notiz beginnt deshalb mit "Beispiel".
//
// Aufruf: node tools/beispiel-fangbuch.mjs [Zieldatei]
import { writeFileSync } from "node:fs";
import { alsBackup, liesBackup } from "../js/fangbuch.js";
import { gerundet, stunde, mondphase } from "../js/wetter.js";
import { himmel } from "../js/fangblatt.js";

// Der Name endet auf .backup.json, damit Git die Datei nicht aufnimmt.
const ziel = process.argv[2] || "beispiel-fangbuch.backup.json";
const STAND = "2026-10-11T18:00:00.000Z";

// Stellen an bekannten Gewässern der Ortenau, grob gesetzt. Es sind keine echten Angelstellen.
const ORTE = {
  kinzig1: ["Kinzig", 48.40450, 8.01480], kinzig2: ["Kinzig", 48.40490, 8.01560], kinzig3: ["Kinzig", 48.40810, 8.02230],
  rench1: ["Rench", 48.53050, 8.07620], rench2: ["Rench", 48.53420, 8.06480],
  see1: ["Baggersee", 48.45610, 7.92840], see2: ["Baggersee", 48.45610, 7.92840],
  rhein: ["Rhein", 48.57350, 7.80420]
};

// [Art, Name, Länge, Zeit, Ort, Verbleib, Notiz, Wetter: Temperatur, Druck, Trend, Wind, Richtung, Böen, Bewölkung, Niederschlag]
const FAENGE = [
  ["hecht", "Hecht", 78, "2026-06-21T13:20", "see1", "entnommen", "Heller Mittag, klarer Himmel, Sonne hoch.", [27.4, 1021.3, 0.4, 6, 90, 14, 4, 0]],
  ["zander", "Zander", 61.5, "2026-06-29T23:40", "rhein", "entnommen", "Klare Nacht bei Vollmond, viele Sterne.", [17.8, 1018.9, 1.2, 4, 40, 9, 2, 0]],
  ["aal", "Aal", 64, "2026-06-15T02:10", "rhein", "entnommen", "Neumond: dunkle Nacht, der Mond ist kaum zu sehen.", [15.2, 1012.6, -0.3, 8, 250, 16, 10, 0]],
  ["bachforelle", "Bachforelle", 31, "2026-05-23T05:35", "rench1", "entnommen", "Morgendämmerung mit zunehmendem Halbmond, leicht bewölkt.", [8.9, 1016.2, 0.9, 5, 20, 11, 30, 0]],
  ["barsch", "Barsch", 27.5, "2026-08-05T21:05", "kinzig1", "zurueckgesetzt", "Abenddämmerung, abnehmender Mond, wolkig.", [21.6, 1014.8, -1.4, 11, 230, 24, 55, 0]],
  ["doebel", "Döbel", 44, "2026-07-24T16:45", "kinzig2", "zurueckgesetzt", "Nachmittag, stark bewölkt, grauer Himmel.", [22.3, 1009.4, -2.1, 14, 240, 30, 78, 0]],
  ["karpfen", "Karpfen", 72, "2026-09-12T10:15", "see2", "zurueckgesetzt", "Bedeckt mit leichtem Regen. Gleiche Stelle wie der Hecht: die Punkte fächern sich auf.", [14.1, 1006.7, -3.2, 9, 200, 21, 96, 0.6]],
  ["barbe", "Barbe", 53, "2026-09-27T15:30", "kinzig3", "zurueckgesetzt", "Starker Regen bei bedecktem Himmel.", [12.4, 1001.9, -4.6, 22, 260, 48, 100, 6.4]],
  ["zander", "Zander", 55, "2026-10-03T20:50", "rhein", "entnommen", "Sturm in der Nacht: die Wolken ziehen schnell, dazu Regen.", [11.3, 996.2, -6.8, 58, 270, 94, 92, 2.8]],
  ["quappe", "Quappe", 38, "2025-12-20T17:40", "rench2", "entnommen", "Winterabend bei Frost: um halb sechs ist es schon Nacht. Neumond.", [-2.5, 1029.7, 2.3, 3, 70, 7, 15, 0]],
  ["aesche", "Äsche", 36, "2026-03-28T12:05", "rench1", "zurueckgesetzt", "Heiter im Frühjahr, einzelne Wolken, steigender Druck.", [11.8, 1024.1, 3.1, 13, 10, 26, 35, 0]],
  ["wels", "Wels", 124, "2026-07-08T03:15", "rhein", "entnommen", "Nacht mit abnehmendem Halbmond, halb bewölkt.", [18.6, 1013.3, 0.2, 7, 180, 15, 50, 0]],
  ["schleie", "Schleie", 41, "2026-08-22T06:20", "see1", "zurueckgesetzt", "Früher Morgen ohne Wetterdaten: der Himmel zeigt nur Tageszeit und Mond.", null],
  ["rotauge", "Rotauge", 22, "2026-04-18T14:00", null, "zurueckgesetzt", "Ohne Position: kein Wetter, kein Punkt auf der Karte.", null],
  ["edelkrebs_m", "Edelkrebs", null, "2026-06-03T22:30", "rench2", "zurueckgesetzt", "Ohne Länge, mit der Zeichnung des Krebses. Fast Vollmond, bewölkt.", [14.9, 1015.5, -0.8, 6, 300, 13, 68, 0]],
  ["bachforelle", "Bachforelle", 28.5, "2026-05-23T07:30", "rench1", "zurueckgesetzt", "Zweite Forelle am selben Morgen an derselben Stelle, jetzt ist es Tag.", [11.2, 1016.4, 1.0, 5, 30, 12, 25, 0]],
  ["aal", "Aal", 58, "2026-08-16T22:15", "kinzig1", "entnommen", "Nacht mit zunehmender Sichel, fast klar.", [19.4, 1017.2, 0.6, 5, 120, 10, 18, 0]],
  ["zander", "Zander", 49, "2026-07-11T04:00", "kinzig3", "zurueckgesetzt", "Ende der Nacht mit abnehmender Sichel, heiter.", [16.1, 1015.0, -0.5, 4, 160, 8, 22, 0]]
];

const faenge = FAENGE.map(([art, artName, laenge, zeit, ort, verbleib, notiz, w], i) => {
  const o = ort ? ORTE[ort] : null, position = o ? { lat: o[1], lon: o[2], genauigkeit: 8 } : null;
  const wetter = w && position ? { zeit: stunde(zeit), ...gerundet(position), temperatur: w[0], luftdruck: w[1], drucktrend: w[2], wind: w[3],
    windrichtung: w[4], boeen: w[5], bewoelkung: w[6], niederschlag: w[7], abgerufen: STAND } : null;
  return { id: "beispiel-" + String(i + 1).padStart(2, "0"), art, artName, laenge, zeit, gewaesser: o ? o[0] : "Vereinsweiher",
    position, foto: null, vorschau: null, verbleib, notiz: "Beispiel: " + notiz, wetter, erstellt: STAND, geaendert: STAND };
});

const text = await (await alsBackup(faenge, new Date(STAND), [])).text();
// Dieselbe Prüfung wie beim Einspielen in der App: kein Eintrag darf durchfallen, kein Wetter verloren gehen.
const gelesen = liesBackup(text);
if (gelesen.fehlerhaft || gelesen.faenge.length !== faenge.length) throw new Error(gelesen.fehlerhaft + " Einträge sind nicht lesbar.");
const ohneWetter = gelesen.faenge.filter((e, i) => faenge[i].wetter && !e.wetter);
if (ohneWetter.length) throw new Error("Wetter passt nicht zum Fang: " + ohneWetter.map(e => e.id).join(", "));
writeFileSync(ziel, text);

for (const e of gelesen.faenge) {
  const h = himmel(e), m = mondphase(e.zeit);
  console.log([e.id, e.zeit, e.artName.padEnd(12), h.tageszeit.padEnd(10), (m.name + " " + Math.round(m.beleuchtet * 100) + " %").padEnd(24),
    h.bewoelkung === null ? "ohne Wetter" : h.bewoelkung + " % Wolken, " + h.regen + " mm, Wind " + h.wind].join("  "));
}
console.log(gelesen.faenge.length + " Fänge nach " + ziel);
