// Karte der Fänge: reine Logik. Kein DOM-Zugriff, damit sie in Node testbar bleibt.
// Die Karte selbst zeichnet karte-ui.js mit Leaflet.

// Ausschnitt ohne Fänge mit Position: ganz Baden-Württemberg.
export const BW = { mitte: [48.6, 9.0], zoom: 8 };
// Näher als Stufe 16 zoomt die Karte von selbst nicht heran, sonst zeigt ein einzelner Fang nur noch Wasser.
export const ZOOM = { min: 6, max: 19, einzeln: 16 };

export const mitPosition = faenge => faenge.filter(e => e.position);

// Kleinstes Rechteck um alle Fänge mit Position: [[Süd, West], [Nord, Ost]] oder null.
export function rahmen(faenge) {
  const p = mitPosition(faenge).map(e => e.position);
  if (!p.length) return null;
  const lat = p.map(x => x.lat), lon = p.map(x => x.lon);
  return [[Math.min(...lat), Math.min(...lon)], [Math.max(...lat), Math.max(...lon)]];
}

// Ändert sich dieser Text, zeigt die Karte andere Fänge oder andere Orte und sucht ihren Ausschnitt neu.
// Bleibt er gleich (z. B. nach nachgeladenem Wetter), bleibt der Ausschnitt stehen.
export const auswahlSchluessel = faenge => mitPosition(faenge).map(e => e.id + "@" + e.position.lat + "," + e.position.lon).sort().join("|");

// Blase für mehrere nahe Fänge: wächst in drei Stufen mit der Anzahl.
export function blase(anzahl) {
  return { text: anzahl > 999 ? "999+" : String(anzahl), groesse: anzahl < 10 ? 40 : anzahl < 100 ? 48 : 56, name: anzahl + " Fänge, tippen zum Vergrößern" };
}

export function punktName(e) {
  const [j, m, t] = e.zeit.slice(0, 10).split("-");
  return e.artName + (e.laenge === null ? "" : ", " + String(e.laenge).replace(".", ",") + " cm") + ", " + Number(t) + "." + Number(m) + "." + j;
}

export function hinweis(faenge) {
  const n = mitPosition(faenge).length;
  if (!faenge.length) return "Kein Fang in dieser Auswahl.";
  if (!n) return "Kein Fang in dieser Auswahl hat eine Position. Beim Eintragen auf „Position holen“ tippen.";
  return n === faenge.length ? "" : n + " von " + faenge.length + " Fängen " + (n === 1 ? "hat eine Position und steht" : "haben eine Position und stehen") + " auf der Karte.";
}

// Die Zeichnung einer Art als Adresse für ein <img>. So bleiben ihre SVG-IDs von denen der Bildauswahl getrennt.
// Farben aus CSS-Variablen der Seite kennt ein Bild nicht, deshalb wird die Umrissfarbe fest eingesetzt.
export function zeichnungAlsBild(svg) {
  return svg ? "data:image/svg+xml," + encodeURIComponent(svg.replaceAll("var(--fishline)", "rgba(20,30,28,.55)")) : "";
}
