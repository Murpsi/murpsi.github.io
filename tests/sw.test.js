// Prüft, dass der Service Worker alle Dateien der App cached und dass VERSION zum Inhalt passt.
// Ohne neue VERSION bekämen installierte Apps geänderte Regeln nie zu sehen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const wurzel = new URL("../", import.meta.url);
const lies = pfad => readFileSync(new URL(pfad, wurzel));
const sw = lies("sw.js").toString("utf8");

const VERSION = sw.match(/const VERSION = "([^"]*)";/)[1];
const DATEIEN = JSON.parse(sw.match(/const DATEIEN = (\[[^\]]*\]);/)[1]);

function alleDateien(ordner) {
  return readdirSync(new URL(ordner + "/", wurzel), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? alleDateien(ordner + "/" + e.name) : [ordner + "/" + e.name]);
}

test("Service Worker cached genau die Dateien der App", () => {
  // Lizenztexte liegen im Repo, die App lädt sie aber nicht.
  const vorhanden = ["index.html", "manifest.webmanifest", ...["css", "js", "data", "assets"].flatMap(alleDateien)]
    .filter(d => !/\.(txt|md)$/.test(d));
  assert.deepEqual(DATEIEN.filter(d => d !== "./").sort(), vorhanden.sort());
  assert.ok(DATEIEN.includes("./"), "Startadresse ./ fehlt");
});

test("Manifest: Name, Startadresse und Icons stimmen", () => {
  const m = JSON.parse(lies("manifest.webmanifest"));
  assert.equal(m.name, "Fang-Check");
  assert.equal(m.display, "standalone");
  // Relative Adressen, weil die App auf GitHub Pages in einem Unterordner liegt.
  assert.equal(m.start_url, "./");
  for (const groesse of ["192x192", "512x512"])
    assert.ok(m.icons.some(i => i.sizes === groesse && i.type === "image/png"), "Icon " + groesse + " fehlt");
  for (const i of m.icons) {
    assert.ok(DATEIEN.includes(i.src), i.src + " wird nicht gecached");
    if (i.type !== "image/png") continue;
    const [b, h] = i.sizes.split("x").map(Number), png = lies(i.src);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [b, h], i.src + " hat die falsche Größe");
  }
});

test("VERSION in sw.js passt zum Inhalt der Dateien", () => {
  const hash = createHash("sha256");
  for (const d of DATEIEN.filter(d => d !== "./").sort()) {
    let inhalt = lies(d);
    // Zeilenenden angleichen, damit Windows und Linux denselben Wert liefern.
    if (!/\.(woff2|png)$/.test(d)) inhalt = inhalt.toString("utf8").replaceAll("\r\n", "\n");
    hash.update(d).update(inhalt);
  }
  const soll = hash.digest("hex").slice(0, 10);
  assert.equal(VERSION, soll, `Dateien geändert: in sw.js VERSION = "${soll}" eintragen`);
});

test("Keine Datei lädt etwas von fremden Servern", () => {
  for (const d of ["index.html", "css/app.css", "js/app.js", "js/pwa.js"])
    assert.doesNotMatch(lies(d).toString("utf8"), /https?:\/\//, d + " verweist ins Netz");
});
