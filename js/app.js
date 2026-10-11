// Oberflächenlogik: lädt die Regeln, baut Auswahl und Bildkatalog und zeigt das Urteil an.
import { pruefe, regeln, inSchonzeit, tageBisEnde, fmt, MONATE } from "./regeln.js";
import { pruefeGewaesser, vereinGeschont } from "./gewaesser.js";
import { bildFuer } from "./fischbilder.js";
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

function start(ARTEN) {
  const BILDER = {}; ARTEN.forEach(a => BILDER[a.id] = bildFuer(a.id));
  const sel = $("art");
  const gruppen = [...new Set(ARTEN.map(a => a.gruppe))];
  gruppen.forEach(g => {
    const og = document.createElement("optgroup"); og.label = g;
    ARTEN.filter(a => a.gruppe === g).forEach(a => { const o = document.createElement("option"); o.value = a.id; o.textContent = a.name; og.appendChild(o); });
    sel.appendChild(og);
  });
  // Bildkatalog
  const grid = $("grid");
  gruppen.forEach(g => {
    const h = document.createElement("div"); h.className = "grp"; h.textContent = g; grid.appendChild(h);
    const wrap = document.createElement("div"); wrap.className = "grid";
    ARTEN.filter(a => a.gruppe === g).forEach(a => {
      const b = document.createElement("button"); b.type = "button"; b.className = "tile"; b.dataset.id = a.id;
      b.innerHTML = `<span class="pic">${BILDER[a.id]}</span><span>${a.name}</span>`;
      b.onclick = () => { sel.value = a.id; save(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); };
      wrap.appendChild(b);
    });
    grid.appendChild(wrap);
  });

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

  function render() {
    const art = ARTEN.find(a => a.id === sel.value);
    // Ein gewähltes Gewässer bringt System und Lage mit, die Felder dafür entfallen.
    const g = gewaehlt();
    const system = g ? g.system : $("system").value, lage = g ? g.lage : $("lage").value;
    const date = $("datum").value ? new Date($("datum").value + "T12:00:00") : new Date();
    const lz = $("laengeZahl").value === "" ? null : parseFloat($("laengeZahl").value);
    $("systemFeld").hidden = !!g;
    $("lageFeld").hidden = !!g || art.id !== "bachforelle";

    $("bild").innerHTML = BILDER[art.id];
    $("bild").querySelector("svg").setAttribute("aria-label", "Zeichnung: " + art.name);
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
  $("laenge").addEventListener("input", e => { $("laengeZahl").value = e.target.value; render(); });
  $("laengeZahl").addEventListener("input", e => { if (e.target.value !== "") $("laenge").value = e.target.value; render(); });
  render();
  fb = initFangbuch(ARTEN, () => {
    const lz = parseFloat($("laengeZahl").value), g = gewaehlt();
    return { art: sel.value, datum: $("datum").value, laenge: Number.isFinite(lz) && lz > 0 ? lz : null, status, gewaesser: g ? g.name : "" };
  }, { geaendert: render, gewaesserGeaendert: () => gw.lade() });
  gw = initGewaesser(ARTEN, fb, fuelleGewaesser);
}

fetch("data/regeln-bw.json")
  .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
  .then(daten => { if (!Array.isArray(daten.arten) || !daten.arten.length) throw new Error("keine Arten"); return daten.arten; })
  .then(start, zeigeLadefehler);
