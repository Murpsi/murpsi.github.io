// Oberfläche des Fangblatts: ein Fang groß zum Ansehen, mit gezeichnetem Himmel, Foto, Kacheln und kleiner Karte.
// Bearbeitet wird hier nichts, dafür gibt es den Knopf zum Formular. Die Logik steckt in fangblatt.js.
import { himmel, himmelSvg, mondSvg, fakten, nachbarn } from "./fangblatt.js";
import { mondphase, wetterPasst } from "./wetter.js";
import { VERBLEIB } from "./fangbuch.js";
import { zeichnungAlsBild } from "./karte.js";
import { bildFuer } from "./fischbilder.js";
import { initKarte } from "./karte-ui.js";

const $ = id => document.getElementById(id);
const el = (tag, klasse, text) => { const e = document.createElement(tag); if (klasse) e.className = klasse; if (text != null) e.textContent = text; return e; };
const knopf = (text, klasse = "btn") => { const b = el("button", klasse, text); b.type = "button"; return b; };

// haken: { liste() (die Fänge in der Reihenfolge der Liste), zurueck(), bearbeite(fang), loesche(fang), kartenbild() }
// Ergebnis: { zeige(fang), offen() (id des gezeigten Fangs oder null), schliesse() }
export function initFangblatt(haken) {
  let fang = null, urls = [], lageplan = null;

  function raeumeAuf() {
    urls.forEach(u => URL.revokeObjectURL(u)); urls = [];
    if (lageplan) { lageplan.entferne(); lageplan = null; }
  }

  function kopf(e) {
    const k = el("div", "blatt-kopf"), m = himmel(e), titel = el("div", "blatt-titel");
    // Der Himmel besteht nur aus berechneten Zahlen und festen Farben, kein Text des Nutzers landet im SVG.
    if (m) k.innerHTML = himmelSvg(m, e.id);
    const [j, mo, t] = e.zeit.slice(0, 10).split("-");
    titel.append(el("span", "blatt-datum", Number(t) + "." + Number(mo) + "." + j + " · " + e.zeit.slice(11) + " Uhr" + (e.gewaesser ? " · " + e.gewaesser : "")),
      el("h2", "", e.artName));
    if (e.laenge !== null) titel.appendChild(el("strong", "blatt-laenge", String(e.laenge).replace(".", ",") + " cm"));
    k.appendChild(titel);
    return k;
  }

  function bild(e) {
    const img = el("img");
    if (e.foto) {
      const url = URL.createObjectURL(e.foto);
      urls.push(url);
      img.src = url; img.alt = "Foto: " + e.artName; img.className = "blatt-foto";
      return img;
    }
    const zeichnung = zeichnungAlsBild(bildFuer(e.art));
    if (!zeichnung) return null;
    const rahmen = el("figure", "blatt-zeichnung");
    img.src = zeichnung; img.alt = "Zeichnung: " + e.artName;
    rahmen.append(img, el("figcaption", "note", "Kein Foto gespeichert. Zeichnung der Art."));
    return rahmen;
  }

  function kacheln(e) {
    const gitter = el("div", "facts"), mond = mondphase(e.zeit);
    for (const f of fakten(e, VERBLEIB)) {
      const kachel = el("div", "fact"), wert = el("strong", "", f.wert);
      // Der Mond bekommt ein kleines Bild in seiner Phase.
      if (f.name === "Mond" && mond) wert.insertAdjacentHTML("afterbegin", '<svg class="mondbild" viewBox="-13 -13 26 26" aria-hidden="true">' + mondSvg(mond, 0, 0, 12) + "</svg>");
      kachel.append(el("span", "lbl", f.name), wert);
      gitter.appendChild(kachel);
    }
    return gitter;
  }

  function knoepfe(e) {
    const reihe = el("div", "knoepfe");
    const normal = () => {
      const bearbeiten = knopf("Bearbeiten", "btn haupt"), loeschen = knopf("Löschen");
      bearbeiten.onclick = () => haken.bearbeite(e);
      loeschen.onclick = frage;
      reihe.replaceChildren(bearbeiten, loeschen);
    };
    // Rückfrage in der Seite statt als Browser-Dialog: der wird in installierten Apps teils unterdrückt.
    const frage = () => {
      const ja = knopf("Ja, löschen", "btn gefahr"), nein = knopf("Abbrechen");
      ja.onclick = () => haken.loesche(e);
      nein.onclick = normal;
      reihe.replaceChildren(el("span", "frage", "Diesen Fang löschen? Er bleibt 30 Tage im Papierkorb."), ja, nein);
      nein.focus();
    };
    normal();
    return reihe;
  }

  function zeige(e) {
    raeumeAuf();
    fang = e;
    const teile = [kopf(e), bild(e), kacheln(e)];
    if (e.notiz) teile.push(el("p", "fang-notiz", e.notiz));
    if (e.position) {
      const karte = el("div", "karte blatt-karte"), p = e.position;
      karte.setAttribute("aria-label", "Karte der Fangstelle");
      teile.push(karte, el("p", "note", "Position: " + p.lat.toFixed(5) + ", " + p.lon.toFixed(5) + (p.genauigkeit === null ? "" : " (± " + Math.round(p.genauigkeit) + " m)")));
      lageplan = initKarte(karte, () => {});
      lageplan.zeige([e], haken.kartenbild());
    }
    teile.push(knoepfe(e));
    $("blatt").replaceChildren(...teile.filter(Boolean));
    $("bWetterQuelle").hidden = !wetterPasst(e);
    $("bOhneWetter").hidden = wetterPasst(e);

    const n = nachbarn(haken.liste(), e.id);
    $("bZaehler").textContent = n ? n.stelle + " von " + n.anzahl : "";
    $("bVor").disabled = !n || !n.vor;
    $("bNach").disabled = !n || !n.nach;
  }

  // Blättern mit den Pfeilen oder durch Wischen. Die Liste zeigt die neuesten Fänge zuerst.
  function blaettere(richtung) {
    const n = fang && nachbarn(haken.liste(), fang.id), ziel = n && n[richtung];
    if (ziel) { zeige(ziel); window.scrollTo({ top: 0 }); }
  }
  $("bVor").onclick = () => blaettere("vor");
  $("bNach").onclick = () => blaettere("nach");
  $("bZurueck").onclick = () => haken.zurueck();
  let start = null;
  // Auf der kleinen Karte verschiebt der Finger die Karte, dort wird nicht geblättert.
  $("blatt").addEventListener("touchstart", ev => { start = ev.touches.length === 1 && !ev.target.closest(".karte") ? ev.touches[0] : null; }, { passive: true });
  $("blatt").addEventListener("touchend", ev => {
    if (!start) return;
    const dx = ev.changedTouches[0].clientX - start.clientX, dy = ev.changedTouches[0].clientY - start.clientY;
    start = null;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) blaettere(dx < 0 ? "nach" : "vor");
  }, { passive: true });

  return { zeige, offen: () => fang ? fang.id : null, schliesse() { raeumeAuf(); fang = null; $("blatt").replaceChildren(); } };
}
