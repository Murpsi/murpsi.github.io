// Oberflächenlogik: lädt die Regeln, baut Auswahl und Bildkatalog und zeigt das Urteil an.
import { pruefe, regeln, inSchonzeit, fmt, MONATE } from "./regeln.js";
import { bildFuer } from "./fischbilder.js";

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

  function render() {
    const art = ARTEN.find(a => a.id === sel.value);
    const system = $("system").value, lage = $("lage").value;
    const date = $("datum").value ? new Date($("datum").value + "T12:00:00") : new Date();
    const lz = $("laengeZahl").value === "" ? null : parseFloat($("laengeZahl").value);
    $("lageFeld").hidden = art.id !== "bachforelle";

    $("bild").innerHTML = BILDER[art.id];
    $("bild").querySelector("svg").setAttribute("aria-label", "Zeichnung: " + art.name);
    $("merk").innerHTML = "<b>Erkennen:</b> ";
    $("merk").append(art.merkmale);
    $("verw").hidden = !art.verwechslung;
    $("verw").textContent = art.verwechslung ? "Verwechslung: " + art.verwechslung : "";
    document.querySelectorAll(".tile").forEach(t => t.classList.toggle("on", t.dataset.id === art.id));

    const res = pruefe(art, system, lage, date, lz);
    $("verdict").className = "verdict " + res.status;
    $("vTitle").textContent = res.titel;
    $("vList").innerHTML = "";
    res.gruende.forEach(g => { const li = document.createElement("li"); li.dataset.i = "›"; li.textContent = g; $("vList").appendChild(li); });
    const r = res.r;
    $("fSchon").textContent = r.unklar ? "unklar" : r.ganzjaehrig ? "ganzjährig" : r.schonzeit ? fmt(r.schonzeit.von) + " – " + fmt(r.schonzeit.bis) : "keine";
    $("fMass").textContent = r.unklar ? "unklar" : r.ganzjaehrig ? "–" : r.mindestmass ? r.mindestmass + " cm" : "keins";

    const max = Math.max(100, Math.ceil(((r.mindestmass||0) + 20) / 20) * 20);
    $("laenge").max = max;
    document.querySelectorAll(".ticks span").forEach((t, i) => t.textContent = Math.round(max * i / 5));
    $("fill").style.width = Math.min(100, ((lz||0) / max) * 100) + "%";
    const mm = $("minmark");
    if (r.mindestmass) { mm.hidden = false; mm.style.left = (r.mindestmass / max * 100) + "%"; $("minlabel").textContent = r.mindestmass; } else mm.hidden = true;

    const m = date.getMonth()+1, d = date.getDate();
    $("heuteTitel").textContent = "Geschont am " + d + ". " + MONATE[m-1] + " " + date.getFullYear();
    const chips = $("chips"); chips.innerHTML = "";
    ARTEN.filter(a => !a.ganzjaehrig).forEach(a => {
      const rr = regeln(a, system, a.id === "bachforelle" ? lage : "uebrig");
      if (rr.unklar || !inSchonzeit(rr.schonzeit, m, d)) return;
      const b = document.createElement("button"); b.className = "chip" + (a.id === art.id ? " on" : "");
      b.type = "button"; b.textContent = a.name + " bis " + fmt(rr.schonzeit.bis);
      b.onclick = () => { sel.value = a.id; save(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); };
      chips.appendChild(b);
    });
    if (!chips.children.length) chips.innerHTML = '<span class="note">Keine Art mit befristeter Schonzeit an diesem Tag.</span>';
  }
  function save() { store.set("fc_art", sel.value); store.set("fc_system", $("system").value); store.set("fc_lage", $("lage").value); }
  ["art","system","lage","datum"].forEach(id => $(id).addEventListener("change", () => { save(); render(); }));
  $("laenge").addEventListener("input", e => { $("laengeZahl").value = e.target.value; render(); });
  $("laengeZahl").addEventListener("input", e => { if (e.target.value !== "") $("laenge").value = e.target.value; render(); });
  render();
}

fetch("data/regeln-bw.json")
  .then(res => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
  .then(daten => { if (!Array.isArray(daten.arten) || !daten.arten.length) throw new Error("keine Arten"); return daten.arten; })
  .then(start, zeigeLadefehler);
