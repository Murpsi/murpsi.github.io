// Oberfläche der Auswertung: zeichnet die Diagramme aus dem Ergebnis von auswertung.js.
// Die Balken sind gewöhnliches HTML mit einer Breite oder Höhe in Prozent, kein Canvas und keine Bibliothek. So nehmen
// sie die Farben der Seite (Hell- und Dunkelmodus), und jede Zahl steht als Text da, auch für Vorleseprogramme.
import { auswertung, WENIGE } from "./auswertung.js";

const el = (tag, klasse, text) => { const e = document.createElement(tag); if (klasse) e.className = klasse; if (text != null) e.textContent = text; return e; };
const faenge = n => n + (n === 1 ? " Fang" : " Fänge");

function karte(titel, hinweis, ...inhalt) {
  const k = el("section", "card");
  k.setAttribute("aria-label", titel);
  k.append(el("h2", "", titel), ...inhalt);
  if (hinweis) k.appendChild(el("p", "note", hinweis));
  return k;
}

// Waagrechte Balken für Gruppen mit langen Namen: Name und Zahl in einer Zeile, der Balken darunter.
function balken(gruppen) {
  const max = Math.max(1, ...gruppen.filter(g => !g.rest).map(g => g.anzahl)), liste = el("ul", "balken");
  for (const g of gruppen) {
    const zeile = el("li", g.anzahl && !g.rest ? "" : "null"), spur = el("span", "spur"), fuellung = el("span");
    fuellung.style.width = g.anzahl / max * 100 + "%";
    spur.setAttribute("aria-hidden", "true");
    spur.appendChild(fuellung);
    zeile.append(el("span", "name", g.name), el("span", "zahl", g.anzahl));
    // Die Sammelgruppe "weitere" steht ohne Balken da: Sie ist keine Gruppe wie die anderen.
    if (!g.rest) zeile.appendChild(spur);
    liste.appendChild(zeile);
  }
  return liste;
}

// Säulen nebeneinander für Gruppen mit fester Reihenfolge: die Zahl über der Säule, der kurze Name darunter.
function saeulen(gruppen) {
  const max = Math.max(1, ...gruppen.map(g => g.anzahl)), liste = el("ol", "saeulen");
  liste.style.gridTemplateColumns = "repeat(" + gruppen.length + ", minmax(0, 1fr))";
  for (const g of gruppen) {
    const spalte = el("li", g.anzahl ? "" : "null"), spur = el("span", "spur"), fuellung = el("span");
    spalte.setAttribute("aria-label", g.lang + ": " + faenge(g.anzahl));
    fuellung.style.height = g.anzahl / max * 100 + "%";
    spur.appendChild(fuellung);
    for (const teil of [el("span", "zahl", g.anzahl || ""), spur, el("span", "name", g.name)]) { teil.setAttribute("aria-hidden", "true"); spalte.appendChild(teil); }
    liste.appendChild(spalte);
  }
  return liste;
}

// Der längste Fang jeder Art als Liste. Tippen öffnet den Fang.
function rekorde(groesste, oeffne) {
  const liste = el("ul", "rekorde");
  for (const g of groesste) {
    const zeile = el("li"), knopf = el("button"), [j, m, t] = g.zeit.slice(0, 10).split("-");
    knopf.type = "button";
    knopf.append(el("span", "name", g.name), el("span", "zahl", String(g.laenge).replace(".", ",") + " cm"),
      el("span", "note", [Number(t) + "." + Number(m) + "." + j, g.gewaesser].filter(Boolean).join(" · ")));
    knopf.onclick = () => oeffne(g.id);
    zeile.appendChild(knopf);
    liste.appendChild(zeile);
  }
  return liste;
}

// ziel: das Element, in dem die Auswertung steht. liste: die gefilterte Auswahl des Fangbuchs.
// oeffne(id): zeigt einen Fang groß.
export function zeigeAuswertung(ziel, liste, oeffne) {
  const a = auswertung(liste);
  if (!a.anzahl) return ziel.replaceChildren(el("p", "note", "Kein Fang in dieser Auswahl."));
  const t = a.drucktrend, mitWetter = a.anzahl - t.ohne;
  const teile = [
    el("p", "note", "Auswertung von " + (a.anzahl === 1 ? "einem Fang" : a.anzahl + " Fängen") + ". Gezählt werden Fänge, nicht Angelstunden: Die Diagramme zeigen, wann und wo du gefangen hast, nicht, wann es am besten beißt."
      + (a.wenige ? " Unter " + WENIGE + " Fängen überwiegt der Zufall." : "")),
    karte("Nach Monat", "Alle Jahre der Auswahl zusammen.", saeulen(a.monat)),
    karte("Nach Art", "", balken(a.art)),
    a.groesste.length && karte("Größter Fang je Art", "Tippen öffnet den Fang.", rekorde(a.groesste, oeffne)),
    karte("Nach Gewässer", "", balken(a.gewaesser)),
    a.koeder.length && karte("Nach Köder", "Gezählt wird, womit du gefangen hast. Ein Köder, der oft am Haken hängt, fängt auch oft.", balken(a.koeder)),
    karte("Nach Uhrzeit", "Blöcke von zwei Stunden, unter jeder Säule steht die Stunde, mit der der Block beginnt.", saeulen(a.uhrzeit)),
    karte("Nach Sonnenstand", "Dämmerung: die Sonne steht zwischen 6° unter und 6° über dem Horizont. Vormittag und Nachmittag teilt ihr höchster Stand, im Sommer gegen halb zwei. Die Abschnitte sind ungleich lang: Die Dämmerung dauert rund eine Stunde, der Tag im Sommer bis zu fünfzehn.", balken(a.sonne)),
    karte("Nach Luftdrucktrend", "Änderung in den 6 Stunden vor dem Fang, ab 1 hPa steigend oder fallend. "
      + (t.ohne ? (mitWetter ? faenge(mitWetter) + " mit Wetter, " + t.ohne + " ohne." : "Kein Fang dieser Auswahl hat Wetter.") : "Alle Fänge dieser Auswahl haben Wetter."), balken(t.gruppen)),
    karte("Nach Mondphase", "Die Mondphase berechnet die App aus Datum und Uhrzeit.", balken(a.mond))
  ];
  ziel.replaceChildren(...teile.filter(Boolean));
}
