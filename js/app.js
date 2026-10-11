// Oberflächenlogik: lädt die Regeln, baut die Bildauswahl und zeigt das Urteil an.
import { pruefe, regeln, inSchonzeit, tageBisEnde, fmt, MONATE } from "./regeln.js";
import { pruefeGewaesser, vereinGeschont } from "./gewaesser.js";
import { bildFuer } from "./fischbilder.js";
import { bereinigeFotos, nachweis } from "./fotos.js";
import { bereinigeInfo, markierungen, anordnung } from "./arteninfo.js";
import { initFangbuch } from "./fangbuch-ui.js";
import { initGewaesser } from "./gewaesser-ui.js";

const $ = id => document.getElementById(id);
const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} } };

// Ohne Regeln gibt es keine Aussage, also nie "erlaubt".
function zeigeLadefehler() {
  $("verdict").className = "verdict stop";
  $("vTitle").textContent = "Zurücksetzen";
  $("vList").innerHTML = "";
  const li = document.createElement("li"); li.dataset.i = "›";
  li.textContent = "Die Regeln konnten nicht geladen werden. Ohne Regeln keine Aussage, im Zweifel zurücksetzen.";
  $("vList").appendChild(li);
  $("fSchon").textContent = "–"; $("fMass").textContent = "–";
  // Fangbuch und Gewässer bleiben lesbar, neue Einträge gehen ohne Artenliste nicht.
  initGewaesser([], initFangbuch([], null));
}

function start(ARTEN, FOTOS, INFO) {
  const BILDER = {}; ARTEN.forEach(a => BILDER[a.id] = bildFuer(a.id));
  // Fotos, die nicht laden (z. B. fehlt im Offline-Cache), zeigen für den Rest der Sitzung die Zeichnung.
  const kaputt = new Set();
  const sel = $("art");
  const gruppen = [...new Set(ARTEN.map(a => a.gruppe))];
  gruppen.forEach(g => {
    const og = document.createElement("optgroup"); og.label = g;
    ARTEN.filter(a => a.gruppe === g).forEach(a => { const o = document.createElement("option"); o.value = a.id; o.textContent = a.name; og.appendChild(o); });
    sel.appendChild(og);
  });
  // Bildauswahl der Art
  const grid = $("grid");
  gruppen.forEach(g => {
    const h = document.createElement("div"); h.className = "grp"; h.textContent = g; grid.appendChild(h);
    const wrap = document.createElement("div"); wrap.className = "grid";
    ARTEN.filter(a => a.gruppe === g).forEach(a => {
      const b = document.createElement("button"); b.type = "button"; b.className = "tile"; b.dataset.id = a.id;
      b.innerHTML = `<span class="pic">${BILDER[a.id]}</span><span>${a.name}</span>`;
      b.onclick = () => { sel.value = a.id; save(); render(); zeigeListe(false); $("artKnopf").focus(); };
      wrap.appendChild(b);
    });
    grid.appendChild(wrap);
  });
  // Die Bildauswahl klappt unter dem Knopf auf und nach der Wahl wieder zu.
  function zeigeListe(offen) {
    grid.hidden = !offen; $("artKnopf").setAttribute("aria-expanded", offen);
    if (!offen) return;
    const an = grid.querySelector(".tile.on");
    if (an) { an.focus({ preventScroll: true }); an.scrollIntoView({ block: "nearest" }); }
  }
  $("artKnopf").onclick = () => zeigeListe(grid.hidden);
  grid.addEventListener("keydown", e => { if (e.key === "Escape") { zeigeListe(false); $("artKnopf").focus(); } });

  // Lokales Datum, nicht toISOString(): das rechnet in UTC und zeigt kurz nach Mitternacht den Vortag.
  const heute = new Date(), zz = n => String(n).padStart(2, "0");
  $("datum").value = heute.getFullYear() + "-" + zz(heute.getMonth()+1) + "-" + zz(heute.getDate());
  sel.value = store.get("fc_art") || "bachforelle";
  if (!sel.value) sel.value = "bachforelle";
  $("system").value = store.get("fc_system") || "rhein";
  $("lage").value = store.get("fc_lage") || "uebrig";
  $("laenge").value = 28; $("laengeZahl").value = 28;
  let status = "stop", fb = null, gw = null;
  const gewaehlt = () => gw && gw.liste().find(g => g.id === $("gewaesser").value) || null;

  // Auswahl "Nur Landesrecht" oder ein angelegtes Gewässer. Bleibt über das Neuladen der Liste erhalten.
  function fuelleGewaesser() {
    const vorher = $("gewaesser").value || store.get("fc_gewaesser") || "", liste = gw.liste();
    $("gewaesser").replaceChildren(new Option("Nur Landesrecht", ""), ...liste.map(g => new Option(g.name, g.id)));
    $("gewaesser").value = liste.some(g => g.id === vorher) ? vorher : "";
    render();
  }

  // Foto mit Urheber und Lizenz, wenn es eins gibt und "Foto" gewählt ist. Sonst die Zeichnung.
  function zeigeBild(art) {
    const foto = kaputt.has(art.id) ? null : FOTOS[art.id], alsFoto = !!foto && store.get("fc_bild") !== "zeichnung";
    $("bildwahl").hidden = !foto;
    $("bildFoto").setAttribute("aria-pressed", alsFoto); $("bildZeichnung").setAttribute("aria-pressed", !alsFoto);
    $("nachweis").hidden = !alsFoto;
    const rahmen = document.createElement("div"); rahmen.className = "bildrahmen";
    // Die Nummern stehen in Leisten über und unter dem Bild, damit sie den Fisch nicht verdecken.
    const oben = document.createElement("div"), unten = document.createElement("div"); oben.className = unten.className = "marken";
    $("bild").replaceChildren(oben, rahmen, unten);
    rahmen.leisten = { oben, unten };
    zeigeMerkmale(art, rahmen, alsFoto ? "foto" : "zeichnung");
    if (!alsFoto) {
      // Neu erzeugen statt die Kachel zu kopieren: Verlauf und Umriss hängen an IDs, und die der Kachel
      // gelten nicht, solange die Bildauswahl zugeklappt ist.
      rahmen.insertAdjacentHTML("afterbegin", bildFuer(art.id));
      rahmen.querySelector("svg").setAttribute("aria-label", "Zeichnung: " + art.name);
      return;
    }
    const img = document.createElement("img");
    img.alt = "Foto: " + (foto.zeigt || art.name);
    if (foto.breite && foto.hoehe) { img.width = foto.breite; img.height = foto.hoehe; }
    img.onerror = () => { kaputt.add(art.id); if (sel.value === art.id) zeigeBild(art); };
    img.src = foto.src;
    rahmen.prepend(img);
    const quelle = document.createElement("a"); quelle.href = foto.quelle; quelle.target = "_blank"; quelle.rel = "noopener";
    quelle.textContent = "Quelle";
    $("nachweis").replaceChildren(nachweis(foto) + " · ", quelle);
    if (foto.lizenzUrl) { const l = document.createElement("a"); l.href = foto.lizenzUrl; l.target = "_blank"; l.rel = "noopener"; l.textContent = "Lizenztext"; $("nachweis").append(" · ", l); }
  }

  // Nummerierte Markierungen im Bild und die Liste dazu. Ohne Angaben zur Art bleibt der Text "Erkennen".
  function zeigeMerkmale(art, rahmen, bildart) {
    const liste = markierungen(INFO[art.id], bildart), plaetze = anordnung(liste);
    // Dünne Linien von der Nummer zum Merkmal. Das SVG wird auf die Bildfläche gestreckt, die Strichstärke bleibt gleich.
    rahmen.insertAdjacentHTML("beforeend", '<svg class="linien" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"></svg>');
    const linien = rahmen.lastElementChild;
    for (const seite of ["oben", "unten"]) rahmen.leisten[seite].hidden = !plaetze.some(p => p.seite === seite);
    $("merk").hidden = liste.length > 0; $("merkListe").hidden = !liste.length;
    const zeilen = liste.map(m => {
      const li = document.createElement("li"), nr = document.createElement("span"), t = document.createElement("span"), name = document.createElement("b");
      nr.className = "nr" + (m.ort ? "" : " ohne"); nr.textContent = m.nr;
      name.textContent = m.name; t.append(name, " ", m.text);
      if (!m.ort) { const s = document.createElement("small"); s.textContent = bildart === "foto" ? "Auf diesem Foto nicht markiert." : "In der Zeichnung nicht markiert."; t.append(s); }
      li.append(nr, t);
      if (!m.ort) return li;
      const platz = plaetze.find(p => p.nr === m.nr), ziel = document.createElement("span");
      // Dunkler Rand unter hellem Kern, damit der Strich auf jedem Untergrund zu sehen ist.
      const von = `x1="${platz.lx}" y1="${platz.seite === "oben" ? 0 : 100}" x2="${m.ort[0]}" y2="${m.ort[1]}"`;
      linien.insertAdjacentHTML("beforeend", `<g><line class="rand" ${von}/><line class="kern" ${von}/></g>`);
      const strich = linien.lastElementChild;
      ziel.className = "ziel"; ziel.style.left = m.ort[0] + "%"; ziel.style.top = m.ort[1] + "%"; rahmen.appendChild(ziel);
      const marke = document.createElement("button"); marke.type = "button"; marke.className = "marke";
      marke.style.left = platz.lx + "%";
      marke.textContent = m.nr; marke.setAttribute("aria-label", m.nr + ": " + m.name);
      // Tippen auf die Nummer hebt die Zeile hervor, noch einmal tippen nimmt es zurück.
      marke.onclick = () => {
        const an = !marke.classList.contains("on");
        $("bild").querySelectorAll(".on").forEach(x => x.classList.remove("on")); zeilen.forEach(z => z.classList.remove("on"));
        for (const x of [marke, li, ziel, strich]) x.classList.toggle("on", an);
        if (an) li.scrollIntoView({ block: "nearest", behavior: "smooth" });
      };
      rahmen.leisten[platz.seite].appendChild(marke);
      return li;
    });
    $("merkListe").replaceChildren(...zeilen);
    const eig = INFO[art.id] ? INFO[art.id].eigenschaften : [];
    $("artInfo").hidden = !eig.length;
    $("artInfoListe").replaceChildren(...eig.map(e => { const d = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = e.name; dd.textContent = e.text; d.append(dt, dd); return d; }));
  }

  function render() {
    const art = ARTEN.find(a => a.id === sel.value);
    // Ein gewähltes Gewässer bringt System und Lage mit, die Felder dafür entfallen.
    const g = gewaehlt();
    const system = g ? g.system : $("system").value, lage = g ? g.lage : $("lage").value;
    const date = $("datum").value ? new Date($("datum").value + "T12:00:00") : new Date();
    const lz = $("laengeZahl").value === "" ? null : parseFloat($("laengeZahl").value);
    $("systemFeld").hidden = !!g;
    $("lageFeld").hidden = !!g || art.id !== "bachforelle";

    $("artName").textContent = art.name;
    zeigeBild(art);
    $("merk").innerHTML = "<b>Erkennen:</b> ";
    $("merk").append(art.merkmale);
    $("verw").hidden = !art.verwechslung;
    $("verw").textContent = art.verwechslung ? "Verwechslung: " + art.verwechslung : "";
    document.querySelectorAll(".tile").forEach(t => t.classList.toggle("on", t.dataset.id === art.id));

    const res = g ? pruefeGewaesser(art, g, date, lz, fb ? fb.faenge() : null) : pruefe(art, system, lage, date, lz);
    status = res.status;
    $("verdict").className = "verdict " + res.status;
    $("vTitle").textContent = res.titel;
    $("vList").innerHTML = "";
    // Mit Gewässer steht vor jedem Grund, ob er aus dem Landesrecht oder vom Verein kommt.
    res.gruende.forEach(grund => {
      const li = document.createElement("li"), text = document.createElement("span"); li.dataset.i = "›";
      if (grund.ebene) { const marke = document.createElement("b"); marke.className = "ebene " + grund.ebene; marke.textContent = grund.ebene === "verein" ? "Verein" : "Land"; text.append(marke, " "); }
      text.append(grund.text || grund);
      li.appendChild(text); $("vList").appendChild(li);
    });
    const r = res.r, w = res.wirksam || {};
    const zeitraum = z => fmt(z.von) + " – " + fmt(z.bis);
    const landSchon = r.unklar ? "unklar" : r.ganzjaehrig ? "ganzjährig" : r.schonzeit ? zeitraum(r.schonzeit) : "keine";
    $("fSchon").textContent = w.gesperrt ? "gesperrt (Verein)" : w.schonzeit ? (r.schonzeit ? landSchon + ", " : "") + zeitraum(w.schonzeit) + " (Verein)" : landSchon;
    const mass = w.mindestmass ?? r.mindestmass, hoechst = w.hoechstmass ?? null;
    $("fMass").textContent = r.unklar ? "unklar" : r.ganzjaehrig ? "–" : mass ? mass + " cm" + (w.mindestmassEbene === "verein" ? " (Verein)" : "") : "keins";
    $("fHoechstFeld").hidden = !hoechst;
    $("fHoechst").textContent = hoechst ? hoechst + " cm (Verein)" : "";
    $("vWeitere").hidden = !(g && g.weitereRegeln);
    $("vWeitere").textContent = g && g.weitereRegeln ? "Weitere Regeln am Gewässer, nicht geprüft: " + g.weitereRegeln : "";

    const max = Math.max(100, Math.ceil((Math.max(mass||0, hoechst||0) + 20) / 20) * 20);
    $("laenge").max = max;
    document.querySelectorAll(".ticks span").forEach((t, i) => t.textContent = Math.round(max * i / 5));
    $("fill").style.width = Math.min(100, ((lz||0) / max) * 100) + "%";
    const mm = $("minmark"), xm = $("maxmark");
    if (mass) { mm.hidden = false; mm.style.left = (mass / max * 100) + "%"; $("minlabel").textContent = mass; } else mm.hidden = true;
    if (hoechst) { xm.hidden = false; xm.style.left = (hoechst / max * 100) + "%"; $("maxlabel").textContent = hoechst; } else xm.hidden = true;

    const m = date.getMonth()+1, d = date.getDate();
    $("heuteTitel").textContent = "Geschont am " + d + ". " + MONATE[m-1] + " " + date.getFullYear();
    const chips = $("chips"); chips.innerHTML = "";
    if (g && inSchonzeit(g.sperrzeit, m, d)) { const s = document.createElement("span"); s.className = "note"; s.textContent = "Das ganze Gewässer ist bis " + fmt(g.sperrzeit.bis) + " gesperrt (Verein)."; chips.appendChild(s); }
    ARTEN.filter(a => !a.ganzjaehrig).forEach(a => {
      const rr = regeln(a, system, a.id === "bachforelle" ? lage : "uebrig");
      const land = !rr.unklar && inSchonzeit(rr.schonzeit, m, d) ? rr.schonzeit : null, verein = g ? vereinGeschont(g, a.id, date) : null;
      if (!land && !verein) return;
      // Schonen beide Ebenen, zählt das spätere Ende.
      const vereinZaehlt = verein && (verein.gesperrt || !land || tageBisEnde({ bis: verein.bis }, date) > tageBisEnde(land, date));
      const b = document.createElement("button"); b.className = "chip" + (a.id === art.id ? " on" : "");
      b.type = "button"; b.textContent = a.name + (!vereinZaehlt ? " bis " + fmt(land.bis) : verein.gesperrt ? " gesperrt (Verein)" : " bis " + fmt(verein.bis) + " (Verein)");
      b.onclick = () => { sel.value = a.id; save(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); };
      chips.appendChild(b);
    });
    if (!chips.children.length) chips.innerHTML = '<span class="note">Keine Art mit befristeter Schonzeit an diesem Tag.</span>';
  }
  function save() { store.set("fc_art", sel.value); store.set("fc_system", $("system").value); store.set("fc_lage", $("lage").value); store.set("fc_gewaesser", $("gewaesser").value); }
  ["art","system","lage","datum","gewaesser"].forEach(id => $(id).addEventListener("change", () => { save(); render(); }));
  $("bildFoto").onclick = () => { store.set("fc_bild", "foto"); render(); };
  $("bildZeichnung").onclick = () => { store.set("fc_bild", "zeichnung"); render(); };
  $("laenge").addEventListener("input", e => { $("laengeZahl").value = e.target.value; render(); });
  $("laengeZahl").addEventListener("input", e => { if (e.target.value !== "") $("laenge").value = e.target.value; render(); });
  render();
  fb = initFangbuch(ARTEN, () => {
    const lz = parseFloat($("laengeZahl").value), g = gewaehlt();
    return { art: sel.value, datum: $("datum").value, laenge: Number.isFinite(lz) && lz > 0 ? lz : null, status, gewaesser: g ? g.name : "" };
  }, { geaendert: render, gewaesserGeaendert: () => gw.lade() });
  gw = initGewaesser(ARTEN, fb, fuelleGewaesser);
}

// Fehlen die Fotonachweise oder die Bestimmungshilfe, läuft die App mit Zeichnung und Kurztext weiter.
const fotos = fetch("data/fotos.json").then(res => res.ok ? res.json() : null).then(bereinigeFotos, () => ({}));
const info = fetch("data/arten-info.json").then(res => res.ok ? res.json() : null).then(bereinigeInfo, () => ({}));

fetch("data/regeln-bw.json")
  .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
  .then(daten => { if (!Array.isArray(daten.arten) || !daten.arten.length) throw new Error("keine Arten"); return daten.arten; })
  .then(async arten => start(arten, await fotos, await info), zeigeLadefehler);
