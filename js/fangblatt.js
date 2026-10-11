// Fangblatt: die große Ansicht eines Fangs. Hier steht die reine Logik: Sonnenstand, das Modell für den gezeichneten
// Himmel, die Zeichnung als SVG-Text und die Angaben für die Kacheln. Kein DOM-Zugriff, damit sie in Node testbar bleibt.
import { mondphase, wetterPasst, windrichtung, drucktrendName, bewoelkungName, niederschlagName } from "./wetter.js";

const GRAD = Math.PI / 180;
const komma = z => String(z).replace(".", ",").replace("-", "−");
const zwischen = (z, min, max) => Math.min(max, Math.max(min, z));
// Ohne Position gilt die Mitte von Baden-Württemberg. Für Tag oder Nacht reicht das überall im Land.
const MITTE = { lat: 48.6, lon: 9.0 };

// Die Uhrzeit eines Fangs ist Ortszeit in Baden-Württemberg. Für den Sonnenstand wird sie in Weltzeit umgerechnet:
// Sommerzeit gilt vom letzten Sonntag im März bis zum letzten Sonntag im Oktober, jeweils ab 1 Uhr Weltzeit.
export function weltzeit(zeit) {
  const m = typeof zeit === "string" && /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(zeit);
  if (!m) return null;
  const [j, mo, t, h, mi] = m.slice(1).map(Number);
  const letzterSonntag = monat => { const ende = new Date(Date.UTC(j, monat + 1, 0, 1)); return ende.getTime() - ende.getUTCDay() * 86400000; };
  const winter = Date.UTC(j, mo - 1, t, h - 1, mi);
  return winter >= letzterSonntag(2) && winter < letzterSonntag(9) ? winter - 3600000 : winter;
}

// Höhe der Sonne über dem Horizont in Grad und ob sie noch steigt (Vormittag). Näherung aus dem Astronomical Almanac,
// auf Bruchteile eines Grads genau. Das reicht, um Tag, Dämmerung und Nacht zu unterscheiden.
export function sonnenstand(zeit, position) {
  const utc = weltzeit(zeit);
  if (utc === null) return null;
  const p = position || MITTE, n = utc / 86400000 - 10957.5;
  const l = (280.460 + 0.9856474 * n) * GRAD, g = (357.528 + 0.9856003 * n) * GRAD;
  const lambda = l + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * GRAD, schiefe = (23.439 - 0.0000004 * n) * GRAD;
  const deklination = Math.asin(Math.sin(schiefe) * Math.sin(lambda));
  const rektaszension = Math.atan2(Math.cos(schiefe) * Math.sin(lambda), Math.cos(lambda));
  const sternzeit = (18.697374558 + 24.06570982441908 * n) * 15 * GRAD;
  // Stundenwinkel: 0 beim höchsten Stand, negativ am Vormittag.
  const winkel = Math.atan2(Math.sin(sternzeit + p.lon * GRAD - rektaszension), Math.cos(sternzeit + p.lon * GRAD - rektaszension));
  const hoehe = Math.asin(Math.sin(p.lat * GRAD) * Math.sin(deklination) + Math.cos(p.lat * GRAD) * Math.cos(deklination) * Math.cos(winkel)) / GRAD;
  return { hoehe, steigend: winkel < 0, winkel: winkel / GRAD };
}

// Unter −6° ist es dunkel genug für Sterne (Ende der bürgerlichen Dämmerung), über +6° ist es heller Tag.
export function tageszeit(hoehe) {
  return hoehe < -6 ? "nacht" : hoehe < 6 ? "daemmerung" : "tag";
}

// Was der Himmel über einem Fang zeigt. Wetter gibt es nur, wenn es zu Stunde und Ort des Fangs passt, sonst sind
// bewoelkung, regen und wind null und der Himmel zeigt nur Tageszeit und Mond.
export function himmel(eintrag) {
  const sonne = sonnenstand(eintrag.zeit, eintrag.position), mond = mondphase(eintrag.zeit);
  if (!sonne || !mond) return null;
  const w = wetterPasst(eintrag) ? eintrag.wetter : null;
  return { tageszeit: tageszeit(sonne.hoehe), sonne, mond: { beleuchtet: mond.beleuchtet, zunehmend: mond.zunehmend, name: mond.name },
    bewoelkung: w ? w.bewoelkung : null, regen: w ? w.niederschlag : null, wind: w ? w.wind : null };
}

// Der Mond als SVG: dunkle Scheibe, darüber der beleuchtete Teil. Auf der Nordhalbkugel ist beim zunehmenden Mond die
// rechte Seite hell. Die Grenze zwischen Licht und Schatten ist eine halbe Ellipse, die mit dem beleuchteten Anteil wandert.
export function mondSvg(mond, x, y, r) {
  const k = zwischen(mond.beleuchtet, 0, 1), rx = (Math.abs(1 - 2 * k) * r).toFixed(2);
  const licht = `M0,${-r} A${r},${r} 0 0 1 0,${r} A${rx},${r} 0 0 ${k > 0.5 ? 1 : 0} 0,${-r}Z`;
  return `<g transform="translate(${x},${y})${mond.zunehmend ? "" : " scale(-1,1)"}"><circle r="${r}" fill="#2a3352"/><path d="${licht}" fill="#f4efd6"/></g>`;
}

// Feste Reihenfolge von Zufallszahlen aus einem Text, damit derselbe Fang immer denselben Himmel bekommt.
function zufall(saat) {
  let h = 2166136261;
  for (const c of String(saat)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

const FARBEN = {
  tag: { oben: "#2f7fc4", unten: "#a9d6f0", trueb: ["#6f8494", "#c3cdd3"], wolke: "#ffffff", wasser: "#1d5c55" },
  daemmerung: { oben: "#2b3566", unten: "#f0a070", trueb: ["#3a4160", "#b08a80"], wolke: "#d9b3a8", wasser: "#1a3f4a" },
  nacht: { oben: "#070b1c", unten: "#1b2a4d", trueb: ["#0b0f1c", "#232b3d"], wolke: "#4a5470", wasser: "#0c2430" }
};
const WOLKENPLAETZE = [[70, 52, 1], [210, 36, 1.25], [330, 66, .9], [135, 92, .8], [275, 104, 1.05]];

// Der Himmel als SVG-Text (400 × 200). m: Ergebnis von himmel(), saat: z. B. die id des Fangs.
// Die Klassen wolke, regen, stern und welle bewegt css/app.css, außer das Handy wünscht wenig Bewegung.
export function himmelSvg(m, saat = "") {
  const f = FARBEN[m.tageszeit], z = zufall(saat), bedeckt = m.bewoelkung ?? 0;
  // Ab starker Bewölkung wird der Himmel grau.
  const [oben, unten] = bedeckt >= 63 ? f.trueb : [f.oben, f.unten];
  let s = `<svg class="himmel" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`
    + `<defs><linearGradient id="himmelVerlauf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${oben}"/><stop offset="1" stop-color="${unten}"/></linearGradient></defs>`
    + `<rect width="400" height="200" fill="url(#himmelVerlauf)"/>`;
  if (m.tageszeit === "nacht") {
    // Je mehr Wolken, desto weniger Sterne.
    const anzahl = Math.round(40 * (1 - bedeckt / 100));
    for (let i = 0; i < anzahl; i++) s += `<circle class="stern" cx="${(z() * 400).toFixed(1)}" cy="${(z() * 150).toFixed(1)}" r="${(0.5 + z() * 0.9).toFixed(2)}" fill="#fff" style="animation-delay:${(-z() * 6).toFixed(1)}s"/>`;
  }
  // Unter einer geschlossenen Wolkendecke sind weder Sonne noch Mond zu sehen.
  const frei = bedeckt < 88;
  if (m.tageszeit === "tag" && frei) {
    // Vormittags steht die Sonne links, nachmittags rechts, mittags am höchsten.
    const x = zwischen(200 + m.sonne.winkel * 1.7, 40, 360), y = zwischen(150 - m.sonne.hoehe * 1.9, 30, 140);
    s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="34" fill="#fff6c9" opacity=".35"/><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="20" fill="#ffe680"/>`;
  } else if (m.tageszeit !== "tag") {
    if (m.tageszeit === "daemmerung" && frei) s += `<ellipse cx="${m.sonne.steigend ? 70 : 330}" cy="172" rx="150" ry="46" fill="#ffd08a" opacity=".55"/>`;
    if (frei) s += mondSvg(m.mond, m.tageszeit === "daemmerung" && !m.sonne.steigend ? 90 : 310, 58, 24);
  }
  // Eine Wolke je 20 % Bewölkung. Je stärker der Wind, desto schneller ziehen sie.
  const dauer = m.wind === null ? 70 : zwischen(110 - m.wind * 3, 18, 110);
  WOLKENPLAETZE.slice(0, Math.round(bedeckt / 20)).forEach(([x, y, g], i) => {
    s += `<g class="wolke" style="animation-duration:${Math.round(dauer + i * 7)}s" fill="${f.wolke}" opacity=".92" transform="translate(${x},${y}) scale(${g})">`
      + `<ellipse cx="0" cy="0" rx="34" ry="13"/><ellipse cx="-16" cy="-9" rx="17" ry="12"/><ellipse cx="6" cy="-14" rx="20" ry="15"/><ellipse cx="24" cy="-5" rx="15" ry="10"/></g>`;
  });
  if (bedeckt >= 88) s += `<rect width="400" height="170" fill="${f.wolke}" opacity=".28"/>`;
  if (m.regen !== null && m.regen >= 0.1) {
    const anzahl = m.regen < 1 ? 14 : m.regen < 4 ? 26 : 40;
    s += `<g class="regen" stroke="#dcebf7" stroke-width="1" stroke-linecap="round" stroke-dasharray="7 9" opacity=".6">`;
    for (let i = 0; i < anzahl; i++) { const x = (z() * 440 - 20).toFixed(0); s += `<line x1="${x}" y1="-10" x2="${x - 30}" y2="180" style="animation-delay:${(-z()).toFixed(2)}s"/>`; }
    s += `</g>`;
  }
  // Das Wasser unten: zwei Wellenbänder, die gegeneinander laufen.
  const welle = (y, hoehe) => { let d = `M-80,${y}`; for (let x = -80; x < 480; x += 40) d += ` q10,${-hoehe} 20,0 t20,0`; return d + ` V200 H-80Z`; };
  s += `<path class="welle" d="${welle(174, 5)}" fill="${f.wasser}" opacity=".7"/><path class="welle zurueck" d="${welle(182, 4)}" fill="${f.wasser}"/>`;
  return s + `</svg>`;
}

// Die Angaben eines Fangs für die Kacheln des Fangblatts: [{ name, wert }]. verbleib: Namen aus fangbuch.js.
export function fakten(e, verbleib = {}) {
  const [j, m, t] = e.zeit.slice(0, 10).split("-"), mond = mondphase(e.zeit), liste = [];
  const dazu = (name, wert) => { if (wert) liste.push({ name, wert }); };
  dazu("Länge", e.laenge === null ? "" : komma(e.laenge) + " cm");
  dazu("Datum", Number(t) + "." + Number(m) + "." + j);
  dazu("Uhrzeit", e.zeit.slice(11) + " Uhr");
  dazu("Gewässer", e.gewaesser);
  dazu("Verbleib", verbleib[e.verbleib] || e.verbleib);
  dazu("Mond", mond ? mond.name + " · " + Math.round(mond.beleuchtet * 100) + " %" : "");
  if (wetterPasst(e)) {
    const w = e.wetter;
    dazu("Luft", komma(w.temperatur) + " °C");
    dazu("Luftdruck", Math.round(w.luftdruck) + " hPa" + (w.drucktrend === null ? "" : " · " + drucktrendName(w.drucktrend)));
    dazu("Wind", Math.round(w.wind) + " km/h aus " + windrichtung(w.windrichtung) + (w.boeen === null ? "" : " · Böen " + Math.round(w.boeen)));
    dazu("Himmel", bewoelkungName(w.bewoelkung));
    dazu("Niederschlag", w.niederschlag === null ? "" : w.niederschlag < 0.1 ? "trocken" : niederschlagName(w.niederschlag) + " · " + komma(w.niederschlag) + " mm");
  }
  return liste;
}

// Voriger und nächster Fang in der Reihenfolge der Liste (neueste zuerst): { stelle (ab 1), anzahl, vor, nach } oder null.
export function nachbarn(liste, id) {
  const i = liste.findIndex(e => e.id === id);
  return i < 0 ? null : { stelle: i + 1, anzahl: liste.length, vor: liste[i - 1] ?? null, nach: liste[i + 1] ?? null };
}
