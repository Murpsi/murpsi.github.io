// Oberfläche des Papierkorbs im Fangbuch: gelöschte Fänge und Gewässer und die Fassungen vor einer Änderung
// ansehen, wiederherstellen oder endgültig löschen. Die Speicherlogik steckt in fangbuch.js.
import { korbText } from "./fangbuch.js";

const $ = id => document.getElementById(id);
const el = (tag, klasse, text) => { const e = document.createElement(tag); if (klasse) e.className = klasse; if (text != null) e.textContent = text; return e; };
const knopf = (text, klasse = "btn") => { const b = el("button", klasse, text); b.type = "button"; return b; };

// buch: das geöffnete Fangbuch. geaendert(art): nach dem Wiederherstellen, art ist "fang" oder "gewaesser".
// Ergebnis: { lade() } liest den Papierkorb neu und zeigt ihn.
export function initPapierkorb(buch, geaendert) {
  let liste = [];

  function melde(text, fehler) {
    const m = $("korbMeldung");
    m.textContent = text || ""; m.hidden = !text; m.classList.toggle("fehler", !!fehler);
  }

  function zeile(k) {
    const t = korbText(k), kasten = el("div", "regel"), knoepfe = el("div", "knoepfe");
    kasten.appendChild(el("strong", "fang-art", t.titel));
    t.zeilen.forEach(z => kasten.appendChild(el("p", "note", z)));
    const normal = () => {
      const zurueck = knopf("Wiederherstellen"), weg = knopf("Endgültig löschen");
      zurueck.onclick = async () => {
        try { await buch.papierkorb.stelleWiederHer(k.id); await geaendert(k.art); melde("„" + t.titel + "“ ist wiederhergestellt."); }
        catch (f) { await lade(); melde("Wiederherstellen fehlgeschlagen: " + f.message, true); }
      };
      weg.onclick = frage;
      knoepfe.replaceChildren(zurueck, weg);
    };
    const frage = () => {
      const ja = knopf("Ja, endgültig löschen", "btn gefahr"), nein = knopf("Abbrechen");
      ja.onclick = async () => {
        try { await buch.papierkorb.loesche(k.id); await lade(); melde("Endgültig gelöscht."); }
        catch (f) { melde("Löschen fehlgeschlagen: " + f.message, true); }
      };
      nein.onclick = normal;
      knoepfe.replaceChildren(el("span", "frage", "Das lässt sich nicht zurücknehmen."), ja, nein);
      nein.focus();
    };
    normal();
    kasten.appendChild(knoepfe);
    return kasten;
  }

  function zeige() {
    $("korbAnzahl").textContent = liste.length ? "(" + liste.length + ")" : "";
    $("korbListe").replaceChildren(...(liste.length ? liste.map(zeile) : [el("p", "note", "Der Papierkorb ist leer.")]));
    leerenNormal();
  }

  function leerenNormal() {
    const leeren = knopf("Papierkorb leeren");
    leeren.hidden = !liste.length;
    leeren.onclick = () => {
      const ja = knopf("Ja, alles endgültig löschen", "btn gefahr"), nein = knopf("Abbrechen");
      ja.onclick = async () => {
        try { await buch.papierkorb.leere(); await lade(); melde("Papierkorb geleert."); }
        catch (f) { melde("Leeren fehlgeschlagen: " + f.message, true); }
      };
      nein.onclick = leerenNormal;
      $("korbKnoepfe").replaceChildren(el("span", "frage", "Alle " + liste.length + " Einträge endgültig löschen? Das lässt sich nicht zurücknehmen."), ja, nein);
      nein.focus();
    };
    $("korbKnoepfe").replaceChildren(leeren);
  }

  async function lade() {
    melde("");
    try { liste = await buch.papierkorb.alle(); } catch (f) { liste = []; }
    zeige();
  }

  return { lade };
}
