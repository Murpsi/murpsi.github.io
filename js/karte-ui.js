// Oberfläche der Karte im Fangbuch. Gezeichnet wird mit Leaflet, einer Bibliothek für Karten zum Schieben und Zoomen.
// Sie liegt als Datei im Projekt (assets/vendor/leaflet/) und wird erst geladen, wenn die Karte zum ersten Mal aufgeht.
import { BW, ZOOM, KACHELN, mitPosition, rahmen, auswahlSchluessel, blase, punktName, zeichnungAlsBild } from "./karte.js";
import { bildFuer } from "./fischbilder.js";

const ORDNER = "assets/vendor/leaflet/";
let bibliothek = null;

// Leaflet ist kein ES-Modul. Es wird als gewöhnliches Skript eingehängt und legt sich als window.L ab.
function ladeLeaflet() {
  if (bibliothek) return bibliothek;
  const haenge = (tag, felder) => new Promise((ok, fehler) => {
    const e = Object.assign(document.createElement(tag), felder);
    e.onload = ok; e.onerror = () => fehler(new Error("nicht geladen"));
    document.head.appendChild(e);
  });
  const stil = datei => haenge("link", { rel: "stylesheet", href: ORDNER + datei });
  const skript = datei => haenge("script", { src: ORDNER + datei });
  bibliothek = Promise.all([stil("leaflet.css"), stil("MarkerCluster.css"), skript("leaflet.js").then(() => skript("leaflet.markercluster.js"))]).then(() => window.L);
  // Nach einem Fehlschlag darf der nächste Versuch neu laden.
  bibliothek.catch(() => { bibliothek = null; });
  return bibliothek;
}

// behaelter: das Element, in dem die Karte liegt. waehle(fang): nach dem Tippen auf einen einzelnen Fang.
// Ergebnis: { zeige(faenge, mitKacheln), entferne() }. zeige liefert false, wenn die Karte nicht geladen werden konnte.
export function initKarte(behaelter, waehle) {
  let L = null, karte = null, gruppe = null, kacheln = null, urls = [], schluessel = null, gefragt = null, anpassen = false, beobachter = null, weg = false;

  function punkt(e) {
    const bild = document.createElement("img"), zeichnung = e.vorschau ? "" : zeichnungAlsBild(bildFuer(e.art));
    bild.alt = "";
    if (e.vorschau) { const url = URL.createObjectURL(e.vorschau); urls.push(url); bild.src = url; }
    else if (zeichnung) { bild.src = zeichnung; bild.className = "zeichnung"; }
    const icon = L.divIcon({ className: "kartenpunkt", html: bild.src ? bild : "", iconSize: [52, 52] });
    return L.marker([e.position.lat, e.position.lon], { icon, title: punktName(e), riseOnHover: true }).on("click", () => waehle(e));
  }

  // Solange die Karte verdeckt ist, hat sie keine Größe und kann keinen Ausschnitt berechnen. Dann wartet das Anpassen.
  function passeAn() {
    if (!behaelter.offsetWidth) { anpassen = true; return; }
    anpassen = false;
    karte.invalidateSize();
    const r = rahmen(gefragt);
    if (r) karte.fitBounds(r, { padding: [40, 40], maxZoom: ZOOM.einzeln, animate: false }); else karte.setView(BW.mitte, BW.zoom);
  }

  async function zeige(faenge, mitKacheln) {
    gefragt = faenge;
    try { L = await ladeLeaflet(); } catch (e) { return false; }
    // Kam inzwischen ein neuerer Aufruf, zeichnet der.
    if (gefragt !== faenge || weg) return true;
    if (!karte) {
      karte = L.map(behaelter, { minZoom: ZOOM.min, maxZoom: ZOOM.max }).setView(BW.mitte, BW.zoom);
      karte.attributionControl.setPrefix(false);
      gruppe = L.markerClusterGroup({
        showCoverageOnHover: false, maxClusterRadius: 60,
        iconCreateFunction: c => { const b = blase(c.getChildCount()); return L.divIcon({ className: "kartenblase", html: "<span>" + b.text + "</span>", iconSize: [b.groesse, b.groesse] }); }
      });
      karte.addLayer(gruppe);
      // Meldet, wenn die Karte sichtbar wird oder ihre Größe ändert (Handy gedreht).
      beobachter = new ResizeObserver(() => { karte.invalidateSize(); if (anpassen) passeAn(); });
      beobachter.observe(behaelter);
    }
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    gruppe.clearLayers();
    gruppe.addLayers(mitPosition(faenge).map(punkt));
    const s = auswahlSchluessel(faenge);
    if (s !== schluessel) { schluessel = s; passeAn(); }
    // Das Kartenbild gibt es nur mit Zustimmung. Ohne sie fragt die Karte keinen fremden Server. Es kommt erst nach dem
    // Ausschnitt dazu, sonst würden zuerst Kacheln für ganz Baden-Württemberg geladen, die niemand ansieht.
    // crossOrigin: Die Kacheln werden so angefragt, dass der Service Worker ihre Cache-Angaben lesen darf.
    // keepBuffer: nur eine Reihe Kacheln um den sichtbaren Ausschnitt, nichts auf Vorrat.
    if (mitKacheln && !kacheln) kacheln = L.tileLayer(KACHELN.adresse, { attribution: KACHELN.nachweis, maxZoom: ZOOM.max, crossOrigin: true, keepBuffer: 1 }).addTo(karte);
    if (!mitKacheln && kacheln) { kacheln.remove(); kacheln = null; }
    return true;
  }

  // Gibt die Karte und ihre Bilder wieder frei, wenn ihr Element aus der Seite verschwindet.
  function entferne() {
    weg = true;
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    if (beobachter) beobachter.disconnect();
    if (karte) karte.remove();
    karte = null;
  }

  return { zeige, entferne };
}
