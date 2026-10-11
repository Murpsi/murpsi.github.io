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
