// Bestimmungshilfe pro Art aus data/arten-info.json: benannte Merkmale mit Position im Bild und weitere
// Eigenschaften. Kein DOM-Zugriff, keine Rechtsdaten. Unlesbare Einträge fallen weg.

const text = (v, max) => typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;

// Position der Markierung in Prozent von links und von oben, oder null.
const punkt = v => Array.isArray(v) && v.length === 2 && v.every(z => typeof z === "number" && z >= 0 && z <= 100) ? [v[0], v[1]] : null;

const FELDER = [["wissenschaftlich", "Wissenschaftlicher Name"], ["groesse", "Größe"], ["lebensraum", "Lebensraum"],
  ["nahrung", "Nahrung"], ["besonderes", "Besonderes"]];

// Macht aus dem Inhalt von arten-info.json eine Tabelle Art-ID → { merkmale, eigenschaften }.
export function bereinigeInfo(daten) {
  const info = {}, roh = daten && typeof daten.arten === "object" && !Array.isArray(daten.arten) && daten.arten || {};
  for (const [id, a] of Object.entries(roh)) {
    if (!a || typeof a !== "object" || !/^[a-z0-9_]+$/.test(id)) continue;
    const merkmale = (Array.isArray(a.merkmale) ? a.merkmale : []).filter(m => m && typeof m === "object").map(m =>
      ({ name: text(m.name, 40), text: text(m.text, 200), foto: punkt(m.foto), zeichnung: punkt(m.zeichnung) })).filter(m => m.name && m.text);
    const eigenschaften = FELDER.map(([feld, name]) => ({ name, text: text(a[feld], 200) })).filter(e => e.text);
    if (merkmale.length || eigenschaften.length) info[id] = { merkmale, eigenschaften };
  }
  return info;
}

// Merkmale mit Nummer und der Position für die gezeigte Bildart ("foto" oder "zeichnung").
export function markierungen(artInfo, bildart) {
  return (artInfo ? artInfo.merkmale : []).map((m, i) => ({ nr: i + 1, name: m.name, text: m.text, ort: m[bildart] || null }));
}
