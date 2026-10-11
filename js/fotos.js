// Fotos der Arten: prüft die Nachweise aus data/fotos.json und baut den Text für Urheber und Lizenz.
// Kein DOM-Zugriff. Ein Foto ohne gültigen Nachweis gibt es nicht, dann bleibt die Zeichnung.

const text = (v, max) => typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null;

// Nur Lizenzen, die Weitergabe und Bearbeitung (Verkleinern) erlauben. Kein NC, kein ND, keine GFDL allein.
export function lizenzErlaubt(lizenz) {
  return typeof lizenz === "string" && /^(CC0( 1\.0)?|Public domain|CC BY(-SA)? [1-4]\.\d( [a-z]{2,5})?)$/i.test(lizenz.trim());
}
const gemeinfrei = lizenz => /^(CC0|Public domain)/i.test(lizenz);

function adresse(v, host) {
  try { const u = new URL(v); return u.protocol === "https:" && u.hostname === host ? u.href : null; } catch (e) { return null; }
}

// Macht aus dem Inhalt von fotos.json eine Tabelle Art-ID → Foto. Unvollständige Einträge fallen weg.
export function bereinigeFotos(daten) {
  const fotos = {}, roh = daten && typeof daten.fotos === "object" && daten.fotos || {};
  for (const [id, f] of Object.entries(roh)) {
    if (!f || typeof f !== "object" || !/^[a-z0-9_]+$/.test(id) || f.datei !== id + ".webp") continue;
    const urheber = text(f.urheber, 120), lizenz = text(f.lizenz, 40), quelle = adresse(f.quelle, "commons.wikimedia.org");
    if (!urheber || !lizenz || !lizenzErlaubt(lizenz) || !quelle) continue;
    const lizenzUrl = adresse(f.lizenzUrl, "creativecommons.org");
    // CC BY und CC BY-SA verlangen den Verweis auf den Lizenztext.
    if (!gemeinfrei(lizenz) && !lizenzUrl) continue;
    const zahl = v => Number.isInteger(v) && v > 0 && v <= 4000 ? v : null;
    fotos[id] = { id, src: "assets/fotos/" + f.datei, urheber, lizenz, lizenzUrl, quelle,
      bearbeitung: text(f.bearbeitung, 80), zeigt: text(f.zeigt, 80), breite: zahl(f.breite), hoehe: zahl(f.hoehe) };
  }
  return fotos;
}

export const lizenzName = f => gemeinfrei(f.lizenz) ? "gemeinfrei" : f.lizenz;

// Text unter dem Bild, z. B. "Foto: Erika Muster, CC BY-SA 4.0, Wikimedia Commons, verkleinert"
export function nachweis(f) {
  return (f.zeigt ? "Beispiel: " + f.zeigt + ". " : "") + "Foto: " + f.urheber + ", " + lizenzName(f) + ", Wikimedia Commons" +
    (f.bearbeitung ? ", " + f.bearbeitung : "");
}

// Inhalt von assets/fotos/QUELLEN.md. namen: Art-ID → Name der Art.
export function quellenMd(fotos, namen) {
  const zeilen = Object.values(fotos).sort((a, b) => a.id.localeCompare(b.id)).map(f =>
    `| ${namen[f.id] || f.id}${f.zeigt ? " (Beispiel: " + f.zeigt + ")" : ""} | \`${f.id}.webp\` | ${f.urheber.replaceAll("|", "/")} | ` +
    `${f.lizenzUrl ? `[${f.lizenz}](${f.lizenzUrl})` : lizenzName(f)} | [Wikimedia Commons](${f.quelle}) | ${f.bearbeitung || "–"} |`);
  return ["# Bildnachweise", "",
    "Alle Fotos stammen von Wikimedia Commons und stehen unter einer freien Lizenz.",
    "Diese Datei wird aus `data/fotos.json` erzeugt (`node tools/foto.mjs --quellen`), nicht von Hand ändern.", "",
    "| Art | Datei | Urheber | Lizenz | Quelle | Bearbeitung |", "|---|---|---|---|---|---|",
    ...zeilen, ""].join("\n");
}
