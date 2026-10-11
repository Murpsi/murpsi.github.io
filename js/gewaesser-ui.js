// Oberfläche der Gewässer: Liste, Formular für die Regeln, Export, Teilen und Import. Die Prüflogik steckt in gewaesser.js.
import { regeln, fmt, MONATE } from "./regeln.js";
import { bereinigeGewaesser, gleichesGewaesser, alsGewaesserDatei, liesGewaesserDatei } from "./gewaesser.js";

const $ = id => document.getElementById(id);
const el = (tag, klasse, text) => { const e = document.createElement(tag); if (klasse) e.className = klasse; if (text != null) e.textContent = text; return e; };
const knopf = (text, klasse = "btn") => { const b = el("button", klasse, text); b.type = "button"; return b; };
const SYSTEM_NAME = { rhein: "Rhein-System", main: "Main-System", donau: "Donau-System" };
const LAGE_NAME = { uebrig: "", "800": "über 800 m ü. NN", hochrhein: "Hochrhein" };
const zeitraumText = z => fmt(z.von) + " – " + fmt(z.bis);
// Leeres Feld heißt "keine Angabe". Unlesbares wird NaN und fällt beim Speichern mit einer Meldung auf.
const zahl = text => text.trim() === "" ? null : Number(text.trim().replace(",", "."));

function ladeHerunter(blob, name) {
  const url = URL.createObjectURL(blob), a = el("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Vier Auswahlfelder für "von Tag Monat bis Tag Monat". wert: { von, bis } oder null.
// lies() liefert null, wenn alles leer ist, sonst den Zeitraum. Halb ausgefüllt fällt beim Speichern auf.
function zeitraumFeld(wert, name, geaendert) {
  const box = el("div", "zeitraum");
  const wahl = (leer, anzahl, text, vor, beschriftung) => {
    const s = el("select");
    s.setAttribute("aria-label", name + " " + beschriftung);
    s.append(new Option(leer, ""), ...Array.from({ length: anzahl }, (_, i) => new Option(text(i + 1), i + 1)));
    s.value = vor ?? "";
    s.onchange = () => geaendert(lies());
    return s;
  };
  const teil = (wort, t) => {
    const tag = wahl("Tag", 31, n => n + ".", t && t.tag, wort + " Tag"), monat = wahl("Monat", 12, n => MONATE[n - 1], t && t.monat, wort + " Monat");
    box.append(el("span", "lbl", wort), tag, monat);
    return () => ({ tag: tag.value === "" ? null : Number(tag.value), monat: monat.value === "" ? null : Number(monat.value) });
  };
  const von = teil("von", wert && wert.von), bis = teil("bis", wert && wert.bis);
  function lies() {
    const z = { von: von(), bis: bis() };
    return [z.von.tag, z.von.monat, z.bis.tag, z.bis.monat].every(x => x === null) ? null : z;
  }
  return box;
}

// ARTEN: Arten aus den Regeln (leer, wenn sie nicht geladen werden konnten).
// fangbuch: Ergebnis von initFangbuch, liefert die geöffnete Datenbank und den Wechsel der Ansicht.
// geaendert(): wird nach jeder Änderung an den Gewässern aufgerufen, damit der Check neu rechnet.
export function initGewaesser(ARTEN, fangbuch, geaendert = () => {}) {
  let buch = null, liste = [], entwurf = null;
  // Ganzjährig geschonte Arten bleiben gesperrt, egal was ein Verein einträgt. Für sie gibt es deshalb keine Regeln.
  const WAEHLBAR = ARTEN.filter(a => !a.ganzjaehrig);
  const artName = id => (ARTEN.find(a => a.id === id) || { name: id }).name;
  const kannTeilen = typeof navigator.share === "function" && typeof navigator.canShare === "function";

  function melde(text, fehler) {
    const m = $("gwMeldung");
    m.textContent = text || ""; m.hidden = !text; m.classList.toggle("fehler", !!fehler);
  }
  function fehlerImFormular(text) { $("gFehler").textContent = text || ""; $("gFehler").hidden = !text; }

  // ---------- Export, Teilen, Import ----------
  const dateiName = gewaesser => "fang-check-" + (gewaesser.length === 1
    ? gewaesser[0].name.toLocaleLowerCase("de").replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "") || "gewaesser" : "gewaesser");
  const exportiere = gewaesser => ladeHerunter(new Blob([alsGewaesserDatei(gewaesser)], { type: "application/json" }), dateiName(gewaesser) + ".json");

  // Öffnet das Teilen-Menü des Handys (Web Share API), damit die Datei direkt an WhatsApp oder Mail geht.
  // Manche Browser teilen keine .json-Dateien. Dann geht dieselbe Datei als .txt, der Import liest beides.
  async function teile(gewaesser) {
    const text = alsGewaesserDatei(gewaesser), name = dateiName(gewaesser);
    const dateien = [new File([text], name + ".json", { type: "application/json" }), new File([text], name + ".txt", { type: "text/plain" })];
    const datei = dateien.find(d => navigator.canShare({ files: [d] }));
    if (!datei) { exportiere(gewaesser); return melde("Dieser Browser kann die Datei nicht teilen. Sie wurde stattdessen heruntergeladen."); }
    try { await navigator.share({ files: [datei], title: "Fang-Check Gewässerregeln" }); }
    // AbortError heißt nur: Der Nutzer hat das Menü wieder geschlossen.
    catch (e) { if (e.name !== "AbortError") melde("Teilen fehlgeschlagen: " + e.message, true); }
  }

  $("gwAlleExport").onclick = () => exportiere(liste);
  $("gwAlleTeilen").onclick = () => teile(liste);
  $("gwImport").onclick = () => $("gwDatei").click();
  $("gwDatei").addEventListener("change", async ev => {
    const datei = ev.target.files[0];
    ev.target.value = "";
    if (!datei) return;
    try {
      const { gewaesser, fehlerhaft } = liesGewaesserDatei(await datei.text());
      const r = await buch.gewaesser.uebernimm(gewaesser);
      await lade();
      melde("Regeln importiert: " + r.neu + " neu, " + r.aktualisiert + " aktualisiert, " + r.unveraendert + " unverändert" + (fehlerhaft ? ", " + fehlerhaft + " fehlerhaft und übersprungen" : "") + ". Bitte mit dem Erlaubnisschein vergleichen.", fehlerhaft > 0);
    } catch (e) { melde("Regeln nicht importiert: " + e.message, true); }
    window.scrollTo({ top: 0 });
  });

  // ---------- Liste ----------
  function karte(g) {
    const k = el("article", "card fang"), text = el("div", "fang-text"), marken = el("div", "marken");
    text.appendChild(el("strong", "fang-art", g.name));
    marken.appendChild(el("span", "marke", SYSTEM_NAME[g.system]));
    if (LAGE_NAME[g.lage]) marken.appendChild(el("span", "marke", LAGE_NAME[g.lage]));
    text.appendChild(marken);
    k.appendChild(text);

    const zeilen = [];
    if (g.sperrzeit) zeilen.push("Ganz gesperrt " + zeitraumText(g.sperrzeit));
    for (const [id, r] of Object.entries(g.regeln)) {
      const teile = [];
      if (r.gesperrt) teile.push("gesperrt");
      if (r.mindestmass !== null) teile.push("ab " + r.mindestmass + " cm");
      if (r.hoechstmass !== null) teile.push("bis " + r.hoechstmass + " cm");
      if (r.schonzeit) teile.push("Schonzeit " + zeitraumText(r.schonzeit));
      if (r.entnahmepflicht) teile.push("Entnahmepflicht");
      zeilen.push(artName(id) + ": " + teile.join(", "));
    }
    for (const l of g.limits) zeilen.push(l.name + ": " + [l.proTag !== null ? l.proTag + " pro Tag" : "", l.proWoche !== null ? l.proWoche + " pro Woche" : ""].filter(Boolean).join(", "));
    if (!zeilen.length) zeilen.push("Keine eigenen Regeln, es gilt das Landesrecht.");
    const ul = el("ul", "regel-liste");
    zeilen.forEach(z => ul.appendChild(el("li", "", z)));
    k.appendChild(ul);
    if (g.weitereRegeln) k.appendChild(el("p", "fang-notiz", g.weitereRegeln));

    const knoepfe = el("div", "knoepfe");
    const normal = () => {
      const bearbeiten = knopf("Bearbeiten"), exportieren = knopf("Exportieren"), teilen = knopf("Teilen"), loeschen = knopf("Löschen");
      bearbeiten.disabled = !WAEHLBAR.length;
      bearbeiten.onclick = () => oeffneFormular(g);
      exportieren.onclick = () => exportiere([g]);
      teilen.onclick = () => teile([g]);
      teilen.hidden = !kannTeilen;
      loeschen.onclick = frage;
      knoepfe.replaceChildren(bearbeiten, exportieren, teilen, loeschen);
    };
    const frage = () => {
      const ja = knopf("Ja, löschen", "btn gefahr"), nein = knopf("Abbrechen");
      ja.onclick = async () => {
        try { await buch.gewaesser.loesche(g.id); await lade(); melde("Gewässer gelöscht. Die Fänge im Fangbuch bleiben erhalten."); }
        catch (f) { melde("Löschen fehlgeschlagen: " + f.message, true); }
      };
      nein.onclick = normal;
      knoepfe.replaceChildren(el("span", "frage", "„" + g.name + "“ mit allen Regeln wirklich löschen?"), ja, nein);
      nein.focus();
    };
    normal();
    k.appendChild(knoepfe);
    return k;
  }

  function zeigeListe() {
    $("gwListe").replaceChildren(...(liste.length ? liste.map(karte) : [el("p", "note", "Noch kein Gewässer angelegt. Ohne Gewässer prüft der Check nur das Landesrecht.")]));
    $("gwAlleExport").disabled = $("gwAlleTeilen").disabled = !liste.length;
    $("gwAlleTeilen").hidden = !kannTeilen;
  }
  async function lade() { liste = await buch.gewaesser.alle(); zeigeListe(); geaendert(); }

  // ---------- Formular ----------
  function landText(art) {
    const r = regeln(art, $("gSystem").value, $("gLage").value);
    if (r.unklar) return "Landesrecht: unklar.";
    if (r.ausserhalb) return "Landesrecht: in diesem Gewässersystem keine Schonzeit und kein Mindestmaß.";
    return "Landesrecht: " + (r.schonzeit ? "Schonzeit " + zeitraumText(r.schonzeit) : "keine Schonzeit") + ", " + (r.mindestmass ? "Mindestmaß " + r.mindestmass + " cm" : "kein Mindestmaß") + ".";
  }

  function regelKarte(id) {
    const art = ARTEN.find(a => a.id === id), r = entwurf.regeln[id], k = el("div", "regel");
    const kopf = el("div", "regel-kopf"), weg = knopf("Entfernen"), hinweis = el("p", "note warnung");
    kopf.append(el("strong", "", artName(id)), weg);
    weg.onclick = () => { delete entwurf.regeln[id]; zeigeRegeln(); };
    k.append(kopf, el("p", "note", art ? landText(art) : "Diese Art gibt es in den Regeln nicht mehr."));

    // Ein Vereinsmaß, das nicht über dem Landesmaß liegt, ändert nichts. Das soll beim Eintragen auffallen.
    const pruefeMass = () => {
      const land = art ? regeln(art, $("gSystem").value, $("gLage").value).mindestmass || 0 : 0;
      const wirkungslos = typeof r.mindestmass === "number" && r.mindestmass <= land;
      hinweis.textContent = wirkungslos ? "Das Mindestmaß liegt nicht über dem Landesmaß von " + land + " cm und bleibt wirkungslos." : "";
      hinweis.hidden = !wirkungslos;
    };
    const mass = (titel, feld) => {
      const f = el("div", "field"), l = el("label", "lbl", titel), i = el("input");
      i.type = "number"; i.min = 0; i.max = 300; i.step = 0.5; i.inputMode = "decimal"; i.id = "g-" + feld + "-" + id; l.htmlFor = i.id;
      i.value = r[feld] ?? "";
      i.oninput = () => { r[feld] = zahl(i.value); pruefeMass(); };
      f.append(l, i);
      return f;
    };
    const zeile = el("div", "row");
    zeile.append(mass("Mindestmaß in cm", "mindestmass"), mass("Höchstmaß in cm", "hoechstmass"));
    const schon = el("div", "field");
    schon.append(el("span", "lbl", "Schonzeit des Vereins"), zeitraumFeld(r.schonzeit, "Schonzeit " + artName(id), z => r.schonzeit = z));
    const haken = (titel, feld) => {
      const l = el("label", "haken"), i = el("input");
      i.type = "checkbox"; i.checked = !!r[feld];
      i.onchange = () => r[feld] = i.checked;
      l.append(i, el("span", "", titel));
      return l;
    };
    k.append(zeile, hinweis, schon, haken("Ganzjährig gesperrt", "gesperrt"), haken("Entnahmepflicht (nur Hinweis im Check)", "entnahmepflicht"));
    pruefeMass();
    return k;
  }

  function zeigeRegeln() {
    const ids = Object.keys(entwurf.regeln).sort((a, b) => artName(a).localeCompare(artName(b), "de"));
    $("gRegeln").replaceChildren(...ids.map(regelKarte));
    const frei = WAEHLBAR.filter(a => !Object.hasOwn(entwurf.regeln, a.id));
    $("gArtNeu").replaceChildren(...frei.map(a => new Option(a.name, a.id)));
    $("gRegelNeu").disabled = !frei.length;
  }

  function limitKarte(l) {
    const k = el("div", "regel"), kopf = el("div", "regel-kopf"), weg = knopf("Entfernen");
    const feld = (titel, typ, wert, schreibe) => {
      const f = el("div", "field"), lab = el("label", "lbl", titel), i = el("input");
      i.type = typ; i.value = wert ?? "";
      if (typ === "number") { i.min = 1; i.max = 999; i.step = 1; i.inputMode = "numeric"; } else i.maxLength = 40;
      i.oninput = () => schreibe(i.value);
      lab.appendChild(i);
      f.appendChild(lab);
      return f;
    };
    const name = feld("Name des Limits", "text", l.name, v => l.name = v);
    name.classList.add("breit");
    weg.onclick = () => { entwurf.limits.splice(entwurf.limits.indexOf(l), 1); zeigeLimits(); };
    kopf.append(name, weg);
    const zeile = el("div", "row");
    zeile.append(feld("Höchstens pro Tag", "number", l.proTag, v => l.proTag = zahl(v)), feld("Höchstens pro Woche", "number", l.proWoche, v => l.proWoche = zahl(v)));

    const arten = el("details", "artwahl"), kurz = el("summary"), gitter = el("div", "artgitter");
    const zeigeKurz = () => kurz.textContent = l.arten.length ? "Arten (" + l.arten.length + "): " + l.arten.map(artName).join(", ") : "Arten wählen";
    // Arten aus einer importierten Datei, die es hier nicht gibt, bleiben erhalten und abwählbar.
    const alle = [...WAEHLBAR, ...l.arten.filter(id => !WAEHLBAR.some(a => a.id === id)).map(id => ({ id, name: id }))];
    for (const a of alle) {
      const lab = el("label", "haken"), i = el("input");
      i.type = "checkbox"; i.checked = l.arten.includes(a.id);
      i.onchange = () => { l.arten = i.checked ? [...l.arten, a.id] : l.arten.filter(x => x !== a.id); zeigeKurz(); };
      lab.append(i, el("span", "", a.name));
      gitter.appendChild(lab);
    }
    arten.open = !l.arten.length;
    arten.append(kurz, gitter);
    zeigeKurz();
    k.append(kopf, zeile, arten);
    return k;
  }
  function zeigeLimits() {
    $("gLimits").replaceChildren(...entwurf.limits.map(limitKarte));
    $("gLimitNeu").disabled = entwurf.limits.length >= 20;
  }

  // gewaesser: vorhandenes Gewässer zum Bearbeiten, ohne Angabe ein neues.
  function oeffneFormular(gewaesser) {
    // structuredClone kopiert auch die verschachtelten Regeln. So ändert das Formular nichts, bevor gespeichert ist.
    entwurf = gewaesser ? structuredClone(gewaesser) : { name: "", system: $("system").value, lage: $("lage").value, sperrzeit: null, regeln: {}, limits: [], weitereRegeln: "" };
    $("gTitel").textContent = gewaesser ? "Gewässer bearbeiten" : "Gewässer anlegen";
    $("gName").value = entwurf.name;
    $("gSystem").value = entwurf.system;
    $("gLage").value = entwurf.lage;
    $("gWeitere").value = entwurf.weitereRegeln;
    $("gSperrzeit").replaceChildren(zeitraumFeld(entwurf.sperrzeit, "Sperrzeit", z => entwurf.sperrzeit = z));
    fehlerImFormular(""); zeigeRegeln(); zeigeLimits();
    fangbuch.zeige("gewaesserForm");
  }

  // Das Landesrecht hängt von System und Lage ab, die Hinweise in den Regelkarten deshalb auch.
  $("gSystem").onchange = $("gLage").onchange = () => zeigeRegeln();
  $("gRegelNeu").onclick = () => {
    const id = $("gArtNeu").value;
    if (!id) return;
    entwurf.regeln[id] = { gesperrt: false, mindestmass: null, hoechstmass: null, schonzeit: null, entnahmepflicht: false };
    zeigeRegeln();
    document.getElementById("g-mindestmass-" + id)?.focus();
  };
  $("gLimitNeu").onclick = () => { entwurf.limits.push({ name: "", arten: [], proTag: null, proWoche: null }); zeigeLimits(); };
  $("gAbbrechen").onclick = () => fangbuch.zeige("gewaesser");
  $("ansichtGewaesserForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const roh = { ...entwurf, name: $("gName").value, system: $("gSystem").value, lage: $("gLage").value, weitereRegeln: $("gWeitere").value };
    $("gSpeichern").disabled = true;
    try {
      // Vorab prüfen, damit die Meldung die Art beim Namen nennt.
      bereinigeGewaesser({ ...roh, id: roh.id || "neu", erstellt: roh.erstellt || "neu", geaendert: "neu" }, artName);
      if (liste.some(g => g.id !== roh.id && gleichesGewaesser(g.name, roh.name))) throw new Error("Ein Gewässer mit diesem Namen gibt es schon.");
      const g = await buch.gewaesser.speichere(roh);
      await lade();
      melde("„" + g.name + "“ gespeichert.");
      fangbuch.zeige("gewaesser");
    } catch (e) { fehlerImFormular(e.message || "Speichern fehlgeschlagen."); }
    finally { $("gSpeichern").disabled = false; }
  });

  // ---------- Start ----------
  $("gwNeu").onclick = () => oeffneFormular();
  for (const id of ["gwNeu", "gwAlleExport", "gwAlleTeilen", "gwImport"]) $(id).disabled = true;
  fangbuch.bereit.then(b => {
    if (!b) return melde("Die Gewässer können nicht geladen werden, weil das Fangbuch nicht geöffnet werden kann.", true);
    buch = b;
    $("gwNeu").disabled = !WAEHLBAR.length;
    $("gwImport").disabled = false;
    return lade();
  }).catch(e => melde("Die Gewässer können nicht geladen werden: " + (e && e.message || "unbekannter Fehler"), true));

  return { liste: () => liste, lade: () => buch ? lade() : Promise.resolve() };
}
