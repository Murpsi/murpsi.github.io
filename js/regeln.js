// Reine Prüflogik für Schonzeit und Mindestmaß. Kein DOM-Zugriff, damit sie in Node testbar bleibt.
// Die Arten kommen aus data/regeln-bw.json. Grundsatz: Fehlt etwas oder passt etwas nicht, nie "erlaubt".

export const MONATE = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
export const SYSTEME = ["rhein", "main", "donau"];
// t: { tag, monat }
export const fmt = t => t.tag + ". " + MONATE[t.monat - 1];

const istTag = t => !!t && Number.isInteger(t.tag) && Number.isInteger(t.monat) && t.monat >= 1 && t.monat <= 12 && t.tag >= 1 && t.tag <= 31;
const schonzeitOk = s => s === null || (!!s && istTag(s.von) && istTag(s.bis));
const massOk = m => m === null || (typeof m === "number" && m > 0);

// s: { von: { tag, monat }, bis: { tag, monat } } oder null. Beide Grenztage zählen mit, auch über den Jahreswechsel.
export function inSchonzeit(s, m, d) {
  if (!s) return false;
  const x = m*100 + d, a = s.von.monat*100 + s.von.tag, b = s.bis.monat*100 + s.bis.tag;
  return a <= b ? (x >= a && x <= b) : (x >= a || x <= b);
}
// Tage bis zum ersten Tag nach der Schonzeit. Am letzten Schontag ist das 1. Die Uhrzeit spielt keine Rolle.
export function tageBisEnde(s, date) {
  const y = date.getFullYear(), tag = new Date(y, date.getMonth(), date.getDate());
  let end = new Date(y, s.bis.monat-1, s.bis.tag);
  if (end < tag) end = new Date(y+1, s.bis.monat-1, s.bis.tag);
  return Math.round((end - tag) / 864e5) + 1;
}
// Liefert die für Art, Gewässersystem und Lage geltende Landesregel.
// { ganzjaehrig } | { schonzeit, mindestmass, ausserhalb? } | { unklar: "Grund" }
export function regeln(art, system, lage) {
  if (!art) return { unklar: "Art unbekannt." };
  if (!SYSTEME.includes(system)) return { unklar: "Gewässersystem unbekannt." };
  if (art.ganzjaehrig) return { ganzjaehrig: true };
  if (art.nurSystem && art.nurSystem !== system && !(art.nurSystem === "rhein" && system === "main")) return { schonzeit: null, mindestmass: null, ausserhalb: true };
  let schonzeit = art.schonzeit, mindestmass = art.mindestmass;
  const abw = art.abweichung && art.abweichung[system];
  if (abw) { schonzeit = abw.schonzeit; mindestmass = abw.mindestmass; }
  if (mindestmass && typeof mindestmass === "object") {
    if (!Object.hasOwn(mindestmass, lage)) return { unklar: "Lage des Gewässers unbekannt." };
    mindestmass = mindestmass[lage];
  }
  if (!schonzeitOk(schonzeit) || !massOk(mindestmass)) return { unklar: "Regeldaten für " + art.name + " sind unvollständig." };
  return { schonzeit, mindestmass };
}
export function pruefe(art, system, lage, date, laenge) {
  let r = regeln(art, system, lage);
  if (!r.unklar && !(date instanceof Date && !isNaN(date))) r = { unklar: "Datum fehlt oder ist ungültig." };
  if (r.unklar) return { status: "stop", titel: "Zurücksetzen", gruende: [r.unklar + " Ohne sichere Angaben keine Entnahme."], r };
  const m = date.getMonth()+1, d = date.getDate();
  const gruende = []; let status = "ok";
  if (r.ganzjaehrig) return { status: "stop", titel: "Ganzjährig geschont", gruende: ["Diese Art darf das ganze Jahr nicht entnommen werden. Sofort schonend zurücksetzen."], r };
  if (r.ausserhalb) {
    const heimat = art.nurSystem === "donau" ? "Donau" : "Rhein";
    gruende.push(art.name + " hat nach Landesrecht nur im " + heimat + "-System Schonzeit und Mindestmaß. Vereinsregeln prüfen.");
    // § 2 Satz 2 mit § 8 Abs. 2 LFischVO: Arten des einen Systems dürfen im anderen nicht zurückgesetzt werden.
    gruende.push("Anlandepflicht (§ 2 LFischVO): Außerhalb des " + heimat + "-Systems darf ein gefangener " + art.name + " nicht zurückgesetzt werden.");
  }
  if (inSchonzeit(r.schonzeit, m, d)) {
    const tage = tageBisEnde(r.schonzeit, date);
    status = "stop"; gruende.push("Schonzeit bis " + fmt(r.schonzeit.bis) + ". Wieder erlaubt " + (tage === 1 ? "ab morgen." : "in " + tage + " Tagen."));
  }
  if (r.mindestmass) {
    if (typeof laenge !== "number" || !Number.isFinite(laenge)) { if (status === "ok") status = "warn"; gruende.push("Länge eingeben, Mindestmaß ist " + r.mindestmass + " cm."); }
    else if (laenge < r.mindestmass) { status = "stop"; gruende.push("Untermaßig: " + laenge + " cm, es fehlen " + (Math.round((r.mindestmass - laenge)*10)/10) + " cm bis " + r.mindestmass + " cm."); }
    else gruende.push("Maßig: " + laenge + " cm, Mindestmaß " + r.mindestmass + " cm.");
  }
  if (!r.schonzeit && !r.mindestmass && !r.ausserhalb) gruende.push("Keine gesetzliche Schonzeit und kein Mindestmaß. Gewässerordnung beachten.");
  if (status === "ok" && r.schonzeit) gruende.push("Außerhalb der Schonzeit (" + fmt(r.schonzeit.von) + " bis " + fmt(r.schonzeit.bis) + ").");
  const titel = status === "ok" ? "Entnahme erlaubt" : status === "warn" ? "Länge fehlt" : "Zurücksetzen";
  return { status, titel, gruende, r };
}
