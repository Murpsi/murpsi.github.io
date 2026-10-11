// Auswertung des Fangbuchs: zählt die Fänge nach Monat, Art, Gewässer, Tageszeit, Luftdrucktrend und Mondphase.
// Kein DOM-Zugriff, damit die Logik in Node testbar bleibt. Die Diagramme zeichnet auswertung-ui.js.
//
// Gezählt werden Fänge, nicht Angelstunden: Das Fangbuch kennt keine Stunden ohne Fang. Die Zahlen sagen deshalb,
// wann gefangen wurde, und nicht, wann es am besten beißt.
import { mondphase, wetterPasst, drucktrendName, MONDPHASEN } from "./wetter.js";
import { sonnenstand, tageszeit } from "./fangblatt.js";

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const SONNE = ["Morgendämmerung", "Vormittag", "Nachmittag", "Abenddämmerung", "Nacht"];
const TREND = ["steigend", "gleichbleibend", "fallend"];
// Unter so vielen Fängen sagt die Auswertung dazu, dass der Zufall überwiegt. Die Grenze ist eine Wahl, kein Rechenergebnis.
export const WENIGE = 20;
// Arten und Gewässer: so viele Balken, der Rest steht zusammengefasst darunter.
export const BALKEN = 8;

// Abschnitt des Tages nach dem Stand der Sonne am Ort des Fangs (ohne Position: Mitte von Baden-Württemberg).
// Dämmerung ist zwischen −6° und +6°, wie im Fangblatt. Vormittag und Nachmittag teilt der höchste Stand der Sonne,
// nicht 12 Uhr. Die Abschnitte sind ungleich lang und wandern mit der Jahreszeit.
export function sonnenAbschnitt(eintrag) {
  const s = sonnenstand(eintrag.zeit, eintrag.position);
  if (!s) return null;
  const t = tageszeit(s.hoehe);
  return t === "nacht" ? "Nacht" : t === "daemmerung" ? (s.steigend ? "Morgendämmerung" : "Abenddämmerung") : s.steigend ? "Vormittag" : "Nachmittag";
}

// Häufigste zuerst, bei Gleichstand nach Name. Ab mehr als BALKEN + 1 Gruppen wird der Rest zusammengefasst.
function rangliste(zaehler, rest) {
  const alle = [...zaehler.values()].sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, "de"));
  if (alle.length <= BALKEN + 1) return alle;
  const uebrig = alle.slice(BALKEN);
  return [...alle.slice(0, BALKEN), { name: uebrig.length + " weitere " + rest, anzahl: uebrig.reduce((n, g) => n + g.anzahl, 0) }];
}

// faenge: bereinigte Einträge, z. B. die gefilterte Auswahl des Fangbuchs. Jede Gruppe ist { name, lang, anzahl },
// lang ist der ausgeschriebene Name zum Vorlesen. Beim Luftdrucktrend zählen nur Fänge mit passendem Wetter,
// die übrigen stehen in ohne.
export function auswertung(faenge) {
  const leer = (namen, lang = namen) => namen.map((name, i) => ({ name, lang: lang[i], anzahl: 0 }));
  const monat = leer(KURZ, MONATE), mond = leer(MONDPHASEN), sonne = leer(SONNE), trend = leer(TREND);
  const uhrzeit = Array.from({ length: 12 }, (_, i) => ({ name: String(2 * i), lang: 2 * i + " bis " + (2 * i + 2) + " Uhr", anzahl: 0 }));
  const arten = new Map(), gewaesser = new Map();
  const zaehle = (zaehler, schluessel, name) => {
    const g = zaehler.get(schluessel) || { name, anzahl: 0 };
    g.name = name; g.anzahl++;
    zaehler.set(schluessel, g);
  };
  let ohne = 0;
  for (const e of faenge) {
    // Monat und Stunde kommen aus dem Text der Ortszeit, nie über Date: das würde je nach Zeitzone des Geräts verschieben.
    monat[e.zeit.slice(5, 7) - 1].anzahl++;
    uhrzeit[Math.floor(e.zeit.slice(11, 13) / 2)].anzahl++;
    zaehle(arten, e.art, e.artName);
    zaehle(gewaesser, e.gewaesser, e.gewaesser || "ohne Angabe");
    const abschnitt = sonne.find(g => g.name === sonnenAbschnitt(e)), phase = mondphase(e.zeit);
    if (abschnitt) abschnitt.anzahl++;
    if (phase) mond[phase.index].anzahl++;
    const t = wetterPasst(e) && e.wetter.drucktrend !== null ? trend.find(g => g.name === drucktrendName(e.wetter.drucktrend)) : null;
    if (t) t.anzahl++; else ohne++;
  }
  return { anzahl: faenge.length, wenige: faenge.length > 0 && faenge.length < WENIGE, monat, art: rangliste(arten, "Arten"),
    gewaesser: rangliste(gewaesser, "Gewässer"), uhrzeit, sonne, drucktrend: { gruppen: trend, ohne }, mond };
}
