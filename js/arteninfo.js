// Bestimmungshilfe pro Art aus data/arten-info.json: benannte Merkmale mit Position im Bild und weitere
// Eigenschaften. Kein DOM-Zugriff, keine Rechtsdaten. Unlesbare Einträge fallen weg.

const text = (v, max) => typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;

// Position der Markierung in Prozent von links und von oben, oder null.
const punkt = v => Array.isArray(v) && v.length === 2 && v.every(z => typeof z === "number" && z >= 0 && z <= 100) ? [v[0], v[1]] : null;

const FELDER = [["wissenschaftlich", "Wissenschaftlicher Name"], ["groesse", "Größe"], ["lebensraum", "Lebensraum"],
  ["nahrung", "Nahrung"], ["besonderes", "Besonderes"], ["bw", "In Baden-Württemberg"]];

// Macht aus dem Inhalt von arten-info.json eine Tabelle Art-ID → { merkmale, eigenschaften }.
export function bereinigeInfo(daten) {
  const info = {}, roh = daten && typeof daten.arten === "object" && !Array.isArray(daten.arten) && daten.arten || {};
  for (const [id, a] of Object.entries(roh)) {
    if (!a || typeof a !== "object" || !/^[a-z0-9_]+$/.test(id)) continue;
    const merkmale = (Array.isArray(a.merkmale) ? a.merkmale : []).filter(m => m && typeof m === "object").map(m =>
      ({ name: text(m.name, 40), text: text(m.text, 200), foto: punkt(m.foto), zeichnung: punkt(m.zeichnung) })).filter(m => m.name && m.text);
    const eigenschaften = FELDER.map(([feld, name]) => ({ name, text: text(a[feld], 400) })).filter(e => e.text);
    if (merkmale.length || eigenschaften.length) info[id] = { merkmale, eigenschaften };
  }
  return info;
}

// Verteilt die Nummern auf die Leisten über und unter dem Bild: jede an den näheren Rand, möglichst genau
// über oder unter ihr Merkmal, aber mit Mindestabstand zueinander. lx ist die Stelle in Prozent von links.
export function anordnung(liste, abstand = 10) {
  const plaetze = liste.filter(m => m.ort).map(m => ({ nr: m.nr, seite: m.ort[1] < 50 ? "oben" : "unten", lx: m.ort[0] }));
  for (const seite of ["oben", "unten"]) {
    const r = plaetze.filter(p => p.seite === seite).sort((a, b) => a.lx - b.lx);
    r.forEach((p, i) => p.lx = Math.max(p.lx, i ? r[i - 1].lx + abstand : 4));
    // Rechts über den Rand geschoben: von hinten wieder nach links rücken.
    for (let i = r.length - 1; i >= 0; i--) r[i].lx = Math.min(r[i].lx, i === r.length - 1 ? 96 : r[i + 1].lx - abstand);
  }
  return plaetze;
}

// Merkmale mit Nummer und der Position für die gezeigte Bildart ("foto" oder "zeichnung").
export function markierungen(artInfo, bildart) {
  return (artInfo ? artInfo.merkmale : []).map((m, i) => ({ nr: i + 1, name: m.name, text: m.text, ort: m[bildart] || null }));
}
