// Hilfsskript, gehört nicht zur App: holt ein Foto von Wikimedia Commons, prüft die Lizenz, verkleinert es
// auf 800 px als WebP und trägt den Nachweis in data/fotos.json und assets/fotos/QUELLEN.md ein.
//
//   node tools/foto.mjs hecht "Esox lucius (no).JPG"
//   node tools/foto.mjs neunaugen "Lampetra planeri.jpg" --zeigt "Bachneunauge"
//   node tools/foto.mjs --quellen          nur QUELLEN.md neu erzeugen
//
// Braucht Netz und lädt beim ersten Lauf das Paket sharp-cli über npx (Bildumwandlung).
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { lizenzErlaubt, bereinigeFotos, quellenMd } from "../js/fotos.js";
import { webpGroesse } from "./webp.mjs";

const wurzel = fileURLToPath(new URL("../", import.meta.url));
const pfad = (...teile) => join(wurzel, ...teile);
const BREITE = 800, QUALITAET = 78;
// Wikimedia verlangt einen User-Agent, der das Werkzeug nennt.
const kopf = { "User-Agent": "FangCheckBW-Fototool/1.0 (https://murpsi.github.io/)" };

const liesJson = p => JSON.parse(readFileSync(pfad(p), "utf8"));
const ohneHtml = s => String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

function schreibeQuellen(daten) {
  const namen = Object.fromEntries(liesJson("data/regeln-bw.json").arten.map(a => [a.id, a.name]));
  writeFileSync(pfad("assets/fotos/QUELLEN.md"), quellenMd(bereinigeFotos(daten), namen));
}

async function hole(id, datei, zeigt, urheberVorgabe) {
  if (!liesJson("data/regeln-bw.json").arten.some(a => a.id === id)) throw new Error("Unbekannte Art-ID: " + id);
  const titel = "File:" + datei.replace(/^File:/i, "");
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.search = new URLSearchParams({ action: "query", format: "json", titles: titel, prop: "imageinfo",
    iiprop: "url|extmetadata", iiurlwidth: "1280", iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl" });
  const antwort = await (await fetch(api, { headers: kopf })).json();
  const info = Object.values(antwort.query.pages)[0].imageinfo?.[0];
  if (!info) throw new Error("Auf Commons nicht gefunden: " + titel);

  const meta = info.extmetadata, lizenz = ohneHtml(meta.LicenseShortName?.value);
  const urheber = urheberVorgabe || ohneHtml(meta.Artist?.value);
  if (!lizenzErlaubt(lizenz)) throw new Error(`Lizenz "${lizenz}" ist nicht erlaubt. Anderes Foto wählen.`);
  if (!urheber) throw new Error("Kein Urheber angegeben. Auf der Commons-Seite nachsehen und mit --urheber \"Name\" übergeben.");

  const tmp = mkdtempSync(join(tmpdir(), "fangcheck-foto-"));
  try {
    const bild = await fetch(info.thumburl || info.url, { headers: kopf });
    if (!bild.ok) throw new Error("Download fehlgeschlagen: HTTP " + bild.status);
    const roh = join(tmp, "roh"), aus = join(tmp, "aus");
    writeFileSync(roh, Buffer.from(await bild.arrayBuffer()));
    mkdirSync(aus);
    execFileSync("npx", ["--yes", "sharp-cli", "-i", roh, "-o", aus, "-f", "webp", "-q", String(QUALITAET),
      "resize", String(BREITE), "--withoutEnlargement"], { stdio: "inherit", shell: process.platform === "win32" });
    const webp = readFileSync(join(aus, "roh.webp")), groesse = webpGroesse(webp);
    if (!groesse) throw new Error("Umwandlung hat keine WebP-Datei geliefert.");
    mkdirSync(pfad("assets/fotos"), { recursive: true });
    writeFileSync(pfad("assets/fotos", id + ".webp"), webp);

    const daten = liesJson("data/fotos.json");
    daten.fotos[id] = { datei: id + ".webp", urheber, lizenz,
      ...(meta.LicenseUrl?.value && !/^(CC0|Public domain)/i.test(lizenz) ? { lizenzUrl: meta.LicenseUrl.value.replace(/^http:/, "https:") } : {}),
      quelle: info.descriptionurl, bearbeitung: "verkleinert", ...(zeigt ? { zeigt } : {}), ...groesse };
    daten.fotos = Object.fromEntries(Object.entries(daten.fotos).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(pfad("data/fotos.json"), JSON.stringify(daten, null, 2) + "\n");
    if (!bereinigeFotos(daten)[id]) throw new Error("Der Nachweis ist unvollständig, die App würde das Foto nicht zeigen. data/fotos.json prüfen.");
    schreibeQuellen(daten);
    console.log(`${id}: ${groesse.breite}×${groesse.hoehe} px, ${Math.round(webp.length / 1024)} KB, ${urheber}, ${lizenz}`);
    console.log("Jetzt npm test laufen lassen und VERSION und FOTO_VERSION in sw.js nachtragen.");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

const args = process.argv.slice(2), option = name => { const i = args.indexOf(name); return i < 0 ? null : args.splice(i, 2)[1]; };
const zeigt = option("--zeigt"), urheber = option("--urheber");
try {
  if (args[0] === "--quellen") schreibeQuellen(liesJson("data/fotos.json"));
  else if (args.length === 2) await hole(args[0], args[1], zeigt, urheber);
  else { console.log('Aufruf: node tools/foto.mjs <art-id> "<Dateiname auf Commons>" [--zeigt "Art"] [--urheber "Name"]'); process.exitCode = 1; }
} catch (e) { console.error("Fehler: " + e.message); process.exitCode = 1; }
