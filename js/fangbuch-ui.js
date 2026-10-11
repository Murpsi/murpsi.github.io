// Oberfläche des Fangbuchs: Formular, Liste, Filter, Export und Backup. Die Speicherlogik steckt in fangbuch.js.
import { oeffne, filtere, filterWerte, letzteGewaesser, alsCsv, alsBackup, liesBackup, zielGroesse, VERBLEIB } from "./fangbuch.js";
import { mondphase, holeWetter, wetterPasst, wetterOffen, wetterText } from "./wetter.js";
import { hinweis as kartenHinweis } from "./karte.js";
import { initKarte } from "./karte-ui.js";

// Die Zustimmung zum Wetterabruf. localStorage ist ein kleiner Merkzettel des Browsers für einzelne Einstellungen.
// In privaten Fenstern kann er gesperrt sein, dann gilt: keine Zustimmung.
const WETTER_SCHALTER = "fang-check-wetter";
function wetterErlaubt() { try { return localStorage.getItem(WETTER_SCHALTER) === "ja"; } catch (e) { return false; } }
function merkeWetter(an) { try { an ? localStorage.setItem(WETTER_SCHALTER, "ja") : localStorage.removeItem(WETTER_SCHALTER); } catch (e) {} }
// Die Zustimmung zum Kartenbild von OpenStreetMap: "ja", "nein" oder noch nicht gefragt (null).
const KARTEN_SCHALTER = "fang-check-karte";
function gemerktesKartenbild() { try { const w = localStorage.getItem(KARTEN_SCHALTER); return w === "ja" || w === "nein" ? w : null; } catch (e) { return null; } }
function merkeKartenbild(wahl) { try { localStorage.setItem(KARTEN_SCHALTER, wahl); } catch (e) {} }
// Höchstens so viele Abrufe am Stück, damit ein eingespieltes Backup den Wetterdienst nicht überrennt.
const WETTER_AM_STUECK = 20;

const $ = id => document.getElementById(id);
const zz = n => String(n).padStart(2, "0");
const tagLokal = d => d.getFullYear() + "-" + zz(d.getMonth() + 1) + "-" + zz(d.getDate());
const cm = l => String(l).replace(".", ",") + " cm";
const el = (tag, klasse, text) => { const e = document.createElement(tag); if (klasse) e.className = klasse; if (text != null) e.textContent = text; return e; };

function zeitText(zeit) {
  const [j, m, t] = zeit.slice(0, 10).split("-");
  return Number(t) + "." + Number(m) + "." + j + ", " + zeit.slice(11) + " Uhr";
}
function positionText(p) {
  return p.lat.toFixed(5) + ", " + p.lon.toFixed(5) + (p.genauigkeit === null ? "" : " (± " + Math.round(p.genauigkeit) + " m)");
}

// Liest ein Bild und liefert es verkleinert als JPEG: einmal groß fürs Fangbuch, einmal klein für die Liste.
async function verkleinere(datei) {
  let bild;
  // imageOrientation dreht Hochkant-Fotos richtig herum, die Kameras nur per Vermerk in der Datei markieren.
  try { bild = await createImageBitmap(datei, { imageOrientation: "from-image" }); }
  catch (e) {
    const url = URL.createObjectURL(datei);
    try { bild = new Image(); bild.src = url; await bild.decode(); } finally { URL.revokeObjectURL(url); }
  }
  const skaliert = max => new Promise((ok, fehler) => {
    const g = zielGroesse(bild.width, bild.height, max), c = document.createElement("canvas");
    c.width = g.breite; c.height = g.hoehe;
    c.getContext("2d").drawImage(bild, 0, 0, g.breite, g.hoehe);
    c.toBlob(b => b ? ok(b) : fehler(new Error("kein Bild")), "image/jpeg", 0.85);
  });
  try { return { foto: await skaliert(1600), vorschau: await skaliert(320) }; }
  finally { if (bild.close) bild.close(); }
}

function ladeHerunter(blob, name) {
  const url = URL.createObjectURL(blob), a = el("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ARTEN: Arten aus den Regeln (leer, wenn sie nicht geladen werden konnten).
// aktuellerCheck(): { art, datum, laenge, status, gewaesser } aus dem Regel-Check, als Vorbelegung für einen neuen Fang.
// haken.geaendert(): nach jeder Änderung am Fangbuch, damit der Check die Limits neu zählt.
// haken.gewaesserGeaendert(): nach einem Backup, das Gewässer mitgebracht hat.
// Ergebnis: { zeige(name), bereit (Promise mit der geöffneten Datenbank oder null), faenge() }
export function initFangbuch(ARTEN, aktuellerCheck, haken = {}) {
  let buch = null, faenge = [], geladen = false, entwurf = null, fotoUrl = null, listenUrls = [], dauerhaft = false;
  let wetterLaeuft = false;
  // Liste oder Karte, und der Fang, der auf der Karte angetippt wurde.
  let darstellung = "liste", gewaehlt = null, kartenbild = gemerktesKartenbild();
  const ohneWetter = new Set();
  const ansichten = { check: $("ansichtCheck"), buch: $("ansichtBuch"), fang: $("ansichtFang"), gewaesser: $("ansichtGewaesser"), gewaesserForm: $("ansichtGewaesserForm") };

  function zeige(name) {
    for (const [n, a] of Object.entries(ansichten)) a.hidden = n !== name;
    $("tabCheck").setAttribute("aria-pressed", String(name === "check"));
    $("tabBuch").setAttribute("aria-pressed", String(name === "buch"));
    $("tabGewaesser").setAttribute("aria-pressed", String(name === "gewaesser"));
    window.scrollTo({ top: 0 });
  }
  function melde(text, fehler) {
    const m = $("buchMeldung");
    m.textContent = text || ""; m.hidden = !text; m.classList.toggle("fehler", !!fehler);
  }
  $("tabCheck").onclick = () => zeige("check");
  $("tabBuch").onclick = () => { melde(""); zeige("buch"); };
  $("tabGewaesser").onclick = () => zeige("gewaesser");

  // ---------- Liste und Filter ----------
  function fuelle(select, alleText, werte) {
    const vorher = select.value;
    select.replaceChildren(new Option(alleText, ""), ...werte.map(w => new Option(w.name, w.id)));
    select.value = werte.some(w => w.id === vorher) ? vorher : "";
  }
  const gefiltert = () => filtere(faenge, { jahr: $("fJahr").value, art: $("fArt").value, gewaesser: $("fGewaesser").value });

  function zeigeListe() {
    $("anzahl").textContent = faenge.length ? "(" + faenge.length + ")" : "";
    const w = filterWerte(faenge);
    fuelle($("fJahr"), "Alle Jahre", w.jahre.map(j => ({ id: j, name: j })));
    fuelle($("fArt"), "Alle Arten", w.arten);
    fuelle($("fGewaesser"), "Alle Gewässer", w.gewaesser.map(g => ({ id: g, name: g })));
    $("gewaesserListe").replaceChildren(...letzteGewaesser(faenge).map(g => new Option(g)));

    const sicht = gefiltert(), entnommen = sicht.filter(e => e.verbleib === "entnommen").length;
    $("buchSumme").textContent = !faenge.length ? "Noch kein Fang eingetragen. Im Check auf „Fang eintragen“ tippen."
      : sicht.length + (sicht.length === 1 ? " Fang" : " Fänge") + ", davon " + entnommen + " entnommen" + (sicht.length < faenge.length ? " (gefiltert, insgesamt " + faenge.length + ")" : "");
    $("csv").disabled = !sicht.length;

    listenUrls.forEach(u => URL.revokeObjectURL(u)); listenUrls = [];
    $("liste").replaceChildren(...sicht.map(karte));
    $("liste").hidden = darstellung !== "liste";
    $("kartenBereich").hidden = darstellung !== "karte";
    if (darstellung === "karte") zeigeLandkarte(sicht);
    zeigeWetterStand();
  }

  // ---------- Karte ----------
  // Die Karte zeigt dieselbe gefilterte Auswahl wie die Liste. Der angetippte Fang erscheint darunter als Fangkarte
  // mit Bearbeiten und Löschen.
  const landkarte = initKarte($("karte"), e => {
    gewaehlt = e.id;
    zeigeGewaehlt(gefiltert());
    $("kartenFang").scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  function zeigeGewaehlt(sicht) {
    const e = sicht.find(x => x.id === gewaehlt && x.position);
    if (!e) gewaehlt = null;
    $("kartenFang").replaceChildren(...(e ? [karte(e)] : []));
    $("kartenHinweis").textContent = [kartenHinweis(sicht), !e && sicht.some(x => x.position) ? "Einen Fang antippen, um ihn zu öffnen." : ""].filter(Boolean).join(" ");
  }
  function zeigeLandkarte(sicht) {
    zeigeGewaehlt(sicht);
    // Gefragt wird einmal. Danach lässt sich die Entscheidung mit dem Schalter unter der Karte ändern.
    $("kartenFrage").hidden = kartenbild !== null;
    $("kKacheln").checked = kartenbild === "ja";
    landkarte.zeige(sicht, kartenbild === "ja").then(ok => { if (!ok) $("kartenHinweis").textContent = "Die Karte konnte nicht geladen werden."; });
  }
  const waehleKartenbild = an => { kartenbild = an ? "ja" : "nein"; merkeKartenbild(kartenbild); zeigeLandkarte(gefiltert()); };
  $("kartenJa").onclick = () => waehleKartenbild(true);
  $("kartenNein").onclick = () => waehleKartenbild(false);
  $("kKacheln").onchange = () => waehleKartenbild($("kKacheln").checked);
  for (const [id, name] of [["sichtListe", "liste"], ["sichtKarte", "karte"]]) $(id).onclick = () => {
    darstellung = name;
    $("sichtListe").setAttribute("aria-pressed", String(name === "liste"));
    $("sichtKarte").setAttribute("aria-pressed", String(name === "karte"));
    zeigeListe();
  };

  // ---------- Wetter ----------
  const wetterFehlt = () => wetterErlaubt() ? faenge.filter(e => wetterOffen(e) && !ohneWetter.has(e.id + e.zeit)) : [];
  function zeigeWetterStand(hinweis) {
    const n = wetterFehlt().length;
    $("wetterOffen").hidden = !n;
    $("wetterStand").textContent = hinweis || (n === 1 ? "Bei einem Fang fehlt das Wetter noch." : "Bei " + n + " Fängen fehlt das Wetter noch.");
    $("wetterNachladen").disabled = wetterLaeuft;
    $("wetterQuelle").hidden = !faenge.some(wetterPasst);
  }

  // Holt fehlendes Wetter, einen Fang nach dem anderen. Läuft nach dem Speichern, beim Start und sobald das Handy
  // wieder Netz meldet. Ohne Zustimmung passiert nichts.
  async function ladeWetterNach() {
    if (wetterLaeuft || !buch || !wetterFehlt().length) return;
    wetterLaeuft = true;
    zeigeWetterStand("Wetter wird geladen …");
    let neu = 0, hinweis = "";
    for (const e of wetterFehlt().slice(0, WETTER_AM_STUECK)) {
      let wetter;
      // Kein Netz oder der Dienst antwortet nicht: aufhören, der nächste Anlass versucht es wieder.
      try { wetter = await holeWetter(e); }
      catch (f) { hinweis = "Kein Netz oder der Wetterdienst antwortet nicht. Das Wetter kommt später nach."; break; }
      // Antwort ohne Werte für diese Stunde: in dieser Sitzung nicht noch einmal fragen.
      if (!wetter) { ohneWetter.add(e.id + e.zeit); continue; }
      try {
        // Wurde der Fang inzwischen geändert, passt das Wetter nicht mehr und wird nicht eingetragen.
        if (await buch.ergaenze(e.id, aktuell => { const mit = { ...aktuell, wetter }; return wetterPasst(mit) ? mit : null; })) neu++;
      } catch (f) { hinweis = "Wetter konnte nicht gespeichert werden."; break; }
    }
    wetterLaeuft = false;
    if (neu) { try { faenge = await buch.alle(); } catch (f) {} zeigeListe(); }
    zeigeWetterStand(wetterFehlt().length ? hinweis : "");
  }
  $("wetterNachladen").onclick = ladeWetterNach;
  $("eWetter").onchange = () => { merkeWetter($("eWetter").checked); zeigeListe(); };
  window.addEventListener("online", ladeWetterNach);

  function karte(e) {
    const k = el("article", "card fang"), kopf = el("div", "fang-kopf"), text = el("div", "fang-text");
    if (e.vorschau) {
      const url = URL.createObjectURL(e.vorschau), img = el("img");
      listenUrls.push(url);
      img.src = url; img.alt = "Foto: " + e.artName; img.loading = "lazy";
      kopf.appendChild(img);
    }
    text.append(el("strong", "fang-art", e.artName + (e.laenge === null ? "" : " · " + cm(e.laenge))), el("span", "fang-zeit", zeitText(e.zeit)));
    const marken = el("div", "marken");
    marken.appendChild(el("span", "marke " + e.verbleib, VERBLEIB[e.verbleib]));
    if (e.gewaesser) marken.appendChild(el("span", "marke", e.gewaesser));
    text.appendChild(marken);
    kopf.appendChild(text);
    k.appendChild(kopf);
    if (e.notiz) k.appendChild(el("p", "fang-notiz", e.notiz));
    if (e.position) k.appendChild(el("p", "note", "Position: " + positionText(e.position)));
    if (wetterPasst(e)) k.appendChild(el("p", "note", "Wetter: " + wetterText(e.wetter)));
    else if (wetterErlaubt() && wetterOffen(e)) k.appendChild(el("p", "note", "Wetter folgt, sobald Netz da ist."));
    const mond = mondphase(e.zeit);
    if (mond) k.appendChild(el("p", "note", "Mond: " + mond.name + " (" + Math.round(mond.beleuchtet * 100) + " % beleuchtet)"));

    const knoepfe = el("div", "knoepfe");
    const normal = () => {
      const bearbeiten = el("button", "btn", "Bearbeiten"), loeschen = el("button", "btn", "Löschen");
      bearbeiten.type = loeschen.type = "button";
      bearbeiten.onclick = () => oeffneFormular(e);
      loeschen.onclick = frage;
      knoepfe.replaceChildren(bearbeiten, loeschen);
    };
    // Rückfrage in der Seite statt als Browser-Dialog: der wird in installierten Apps teils unterdrückt.
    const frage = () => {
      const ja = el("button", "btn gefahr", "Ja, löschen"), nein = el("button", "btn", "Abbrechen");
      ja.type = nein.type = "button";
      ja.onclick = async () => {
        try { await buch.loesche(e.id); await lade(); melde("Fang gelöscht."); }
        catch (f) { melde("Löschen fehlgeschlagen: " + f.message, true); }
      };
      nein.onclick = normal;
      knoepfe.replaceChildren(el("span", "frage", "Diesen Fang wirklich löschen?"), ja, nein);
      nein.focus();
    };
    normal();
    k.appendChild(knoepfe);
    return k;
  }

  async function lade() { faenge = await buch.alle(); geladen = true; zeigeListe(); haken.geaendert?.(); }
  ["fJahr", "fArt", "fGewaesser"].forEach(id => $(id).addEventListener("change", zeigeListe));

  // ---------- Formular ----------
  function zeigeFoto() {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    fotoUrl = entwurf.foto ? URL.createObjectURL(entwurf.foto) : null;
    $("eFoto").hidden = !fotoUrl;
    if (fotoUrl) $("eFoto").src = fotoUrl; else $("eFoto").removeAttribute("src");
    $("eFotoWeg").hidden = !fotoUrl;
  }
  function zeigePosition(hinweis) {
    $("ePosText").textContent = hinweis || (entwurf.position ? positionText(entwurf.position) : "Keine Position gespeichert.");
    $("ePosWeg").hidden = !entwurf.position;
    $("ePosHolen").textContent = entwurf.position ? "Position neu holen" : "Position holen";
  }
  function fehlerImFormular(text) { $("eFehler").textContent = text || ""; $("eFehler").hidden = !text; }

  // eintrag: vorhandener Fang zum Bearbeiten, ohne Angabe ein neuer Fang aus dem aktuellen Check.
  function oeffneFormular(eintrag) {
    const check = eintrag ? null : aktuellerCheck(), jetzt = new Date();
    entwurf = eintrag ? { ...eintrag } : { position: null, foto: null, vorschau: null };
    $("fangTitel").textContent = eintrag ? "Fang bearbeiten" : "Fang eintragen";

    const arten = ARTEN.map(a => ({ id: a.id, name: a.name }));
    // Ein alter Eintrag kann eine Art haben, die es in den Regeln nicht mehr gibt. Sie bleibt wählbar.
    if (eintrag && !arten.some(a => a.id === eintrag.art)) arten.unshift({ id: eintrag.art, name: eintrag.artName });
    $("eArt").replaceChildren(...arten.map(a => new Option(a.name, a.id)));
    $("eArt").value = eintrag ? eintrag.art : check.art;

    $("eDatum").value = eintrag ? eintrag.zeit.slice(0, 10) : check.datum || tagLokal(jetzt);
    $("eUhrzeit").value = eintrag ? eintrag.zeit.slice(11) : zz(jetzt.getHours()) + ":" + zz(jetzt.getMinutes());
    const laenge = eintrag ? eintrag.laenge : check.laenge;
    $("eLaenge").value = laenge === null ? "" : laenge;
    // Ist im Check ein Gewässer gewählt, gehört der Fang dorthin. Nur so zählt er für dessen Limits.
    $("eGewaesser").value = eintrag ? eintrag.gewaesser : check.gewaesser || letzteGewaesser(faenge, 1)[0] || "";
    $("eNotiz").value = eintrag ? eintrag.notiz : "";
    // Nur ein klares "erlaubt" aus dem Check belegt "entnommen" vor, alles andere "zurückgesetzt".
    const verbleib = eintrag ? eintrag.verbleib : check.status === "ok" ? "entnommen" : "zurueckgesetzt";
    document.querySelectorAll('input[name="eVerbleib"]').forEach(r => r.checked = r.value === verbleib);
    $("eFotoText").textContent = "";
    $("eWetter").checked = wetterErlaubt();
    fehlerImFormular(""); zeigeFoto(); zeigePosition();
    zeige("fang");
  }

  $("ePosHolen").onclick = () => {
    if (!navigator.geolocation) return zeigePosition("Dieses Gerät liefert keine Position.");
    const ziel = entwurf;
    const gefunden = p => {
      if (ziel !== entwurf) return;
      entwurf.position = { lat: p.coords.latitude, lon: p.coords.longitude, genauigkeit: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null };
      zeigePosition();
    };
    // Fehlercodes des Browsers: 1 = nicht erlaubt, 2 = keine Position verfügbar, 3 = Wartezeit abgelaufen.
    const MELDUNG = {
      1: "Standortzugriff ist gesperrt. In den Einstellungen des Handys den Standort für den Browser und für diese Seite erlauben, dann noch einmal tippen.",
      2: "Das Handy liefert gerade keine Position. Ist der Standort (GPS) eingeschaltet?",
      3: "Keine Position innerhalb der Wartezeit. Unter freiem Himmel noch einmal versuchen."
    };
    // Erst genau per GPS. Klappt das nicht (im Haus, unter Bäumen), noch einmal grob über Mobilfunk und WLAN.
    const suche = genau => navigator.geolocation.getCurrentPosition(gefunden, f => {
      if (ziel !== entwurf) return;
      if (genau && f.code !== 1) { zeigePosition("Kein GPS-Empfang, versuche es ungenauer …"); return suche(false); }
      zeigePosition(MELDUNG[f.code] || "Position konnte nicht bestimmt werden.");
    }, { enableHighAccuracy: genau, timeout: genau ? 15000 : 10000, maximumAge: 60000 });
    zeigePosition("Position wird bestimmt …");
    suche(true);
  };
  $("ePosWeg").onclick = () => { entwurf.position = null; zeigePosition(); };

  $("eKamera").onclick = () => $("eKameraDatei").click();
  $("eGalerie").onclick = () => $("eGalerieDatei").click();
  for (const id of ["eKameraDatei", "eGalerieDatei"]) $(id).addEventListener("change", async ev => {
    const datei = ev.target.files[0], ziel = entwurf;
    ev.target.value = "";
    if (!datei) return;
    $("eFotoText").textContent = "Foto wird verkleinert …";
    // Solange das läuft, nicht speichern lassen, sonst fehlt das Foto im Eintrag.
    $("eSpeichern").disabled = true;
    try {
      const bilder = await verkleinere(datei);
      if (ziel !== entwurf) return;
      Object.assign(entwurf, bilder);
      $("eFotoText").textContent = "";
      zeigeFoto();
    } catch (e) { if (ziel === entwurf) $("eFotoText").textContent = "Dieses Bild kann nicht gelesen werden."; }
    finally { $("eSpeichern").disabled = false; }
  });
  $("eFotoWeg").onclick = () => { entwurf.foto = entwurf.vorschau = null; zeigeFoto(); };

  $("eAbbrechen").onclick = () => zeige(entwurf && entwurf.id ? "buch" : "check");
  $("ansichtFang").addEventListener("submit", async ev => {
    ev.preventDefault();
    const art = $("eArt").value, laenge = $("eLaenge").value.trim();
    const verbleib = document.querySelector('input[name="eVerbleib"]:checked');
    $("eSpeichern").disabled = true;
    try {
      await buch.speichere({ ...entwurf, art, artName: $("eArt").selectedOptions[0]?.textContent || "",
        laenge: laenge === "" ? null : Number(laenge.replace(",", ".")),
        zeit: $("eDatum").value + "T" + $("eUhrzeit").value, gewaesser: $("eGewaesser").value,
        verbleib: verbleib ? verbleib.value : "", notiz: $("eNotiz").value });
      // Bittet den Browser, das Fangbuch nicht von sich aus zu löschen, wenn der Speicher knapp wird.
      if (!dauerhaft && navigator.storage && navigator.storage.persist) { dauerhaft = true; navigator.storage.persist().catch(() => {}); }
      await lade();
      melde("Fang gespeichert.");
      zeige("buch");
      // Nicht abwarten: Der Fang ist gespeichert, das Wetter kommt dazu, wenn es da ist.
      ladeWetterNach();
    } catch (e) { fehlerImFormular(e.message || "Speichern fehlgeschlagen."); }
    finally { $("eSpeichern").disabled = false; }
  });

  // ---------- Export und Backup ----------
  $("csv").onclick = () => ladeHerunter(new Blob([alsCsv(gefiltert())], { type: "text/csv;charset=utf-8" }), "fangliste-" + ($("fJahr").value || tagLokal(new Date())) + ".csv");
  $("backup").onclick = async () => {
    try { ladeHerunter(await alsBackup(faenge, new Date(), await buch.gewaesser.alle()), "fang-check-backup-" + tagLokal(new Date()) + ".json"); }
    catch (e) { melde("Backup fehlgeschlagen: " + e.message, true); }
  };
  $("einspielen").onclick = () => $("backupDatei").click();
  $("backupDatei").addEventListener("change", async ev => {
    const datei = ev.target.files[0];
    ev.target.value = "";
    if (!datei) return;
    try {
      const b = liesBackup(await datei.text()), fehlerhaft = b.fehlerhaft + b.gewaesserFehlerhaft;
      const r = await buch.uebernimm(b.faenge), rg = await buch.gewaesser.uebernimm(b.gewaesser);
      await lade();
      await haken.gewaesserGeaendert?.();
      const zahlen = x => x.neu + " neu, " + x.aktualisiert + " aktualisiert, " + x.unveraendert + " unverändert";
      melde("Backup eingespielt. Fänge: " + zahlen(r) + (b.gewaesser.length ? ". Gewässer: " + zahlen(rg) : "") + (fehlerhaft ? ". " + fehlerhaft + " fehlerhafte Einträge übersprungen" : "") + ".", fehlerhaft > 0);
      ladeWetterNach();
    } catch (e) { melde("Backup nicht eingespielt: " + e.message, true); }
    window.scrollTo({ top: 0 });
  });

  // ---------- Start ----------
  const eintragen = $("fangEintragen");
  eintragen.disabled = true;
  eintragen.onclick = () => oeffneFormular();
  for (const id of ["csv", "backup", "einspielen"]) $(id).disabled = true;
  const bereit = oeffne().then(b => { buch = b; return lade(); }).then(() => {
    eintragen.disabled = !ARTEN.length;
    $("einspielen").disabled = $("backup").disabled = false;
    ladeWetterNach();
    return buch;
  }).catch(e => { melde("Das Fangbuch kann nicht geöffnet werden: " + (e && e.message || "unbekannter Fehler"), true); return null; });
  // Solange das Fangbuch nicht gelesen ist, gibt es keine Liste. Limits gelten dann als nicht prüfbar.
  return { zeige, bereit, faenge: () => geladen ? faenge : null };
}
