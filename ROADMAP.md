# Fang-Check: Fahrplan für Claude Code

Ausgangspunkt: `index.html` (eine Datei, funktioniert bereits: Regel-Check, 47 Arten mit Zeichnung, Messbrett).

**Arbeitsweise:** Eine Phase pro Sitzung. Prompt kopieren, Claude Code erst einen Plan machen lassen,
Plan prüfen, dann umsetzen lassen. Am Ende jeder Phase am Handy testen und committen.

| Phase | Ergebnis | Aufwand | Neu gelernt |
|---|---|---|---|
| 0 | Projekt eingerichtet, Git läuft | 15 min | Git, Claude Code |
| 1 | Code aufgeteilt, Regeln getestet | 1 Abend | Module, Tests |
| 2 | App auf dem Handy-Homescreen, offline | 1 Abend | PWA, Hosting |
| 3 | Fangbuch mit Foto, GPS, Export | 1 Wochenende | IndexedDB, Kamera, GPS |
| 4 | Eigene Vereins- und Gewässerregeln | 1 Abend | Datenmodell |
| 5 | Echte Fotos statt Zeichnungen | 1 Abend | Bildrechte, Caching |
| 6 | Wetter und Luftdruck automatisch im Fangbuch | 1 Abend | Web-APIs |
| 7 | Auswertung "wann beißt was" | 1 Abend | Diagramme |
| 8 | KI-Bestimmung per Foto, Länge per Messmatte | 2 Wochenenden | Backend, KI-API, Bildverarbeitung |

---

## Phase 0: Einrichten

1. Ordner `fang-check` anlegen, `index.html`, `CLAUDE.md` und `ROADMAP.md` hineinlegen.
2. Claude Code in diesem Ordner starten.
3. Prompt:

> Lies CLAUDE.md und ROADMAP.md. Richte ein Git-Repository ein, lege eine passende .gitignore an
> und mache den ersten Commit mit dem aktuellen Stand. Erkläre mir in drei Sätzen, was die App
> gerade kann und wie der Code aufgebaut ist.

**Fertig, wenn:** `git log` einen Commit zeigt.

---

## Phase 1: Aufräumen und Tests

> Teile index.html in die Struktur aus CLAUDE.md auf: Arten und Regeln nach data/regeln-bw.json
> (jede Art mit Feld "quelle": "LFischVO BW § 1"), Prüflogik nach js/regeln.js ohne DOM-Zugriff,
> Zeichnungen nach js/fischbilder.js, Oberfläche nach js/app.js, Styles nach css/app.css.
> Das Verhalten und Aussehen soll exakt gleich bleiben.
> Schreibe danach Tests mit `node --test` für js/regeln.js. Pflichtfälle:
> - Bachforelle 11.10. → Schonzeit; 1.3. mit 24 cm → untermaßig; 1.3. mit 26 cm → erlaubt
> - Grenztage: Hecht 15.2. und 15.5. geschont, 14.2. und 16.5. erlaubt
> - Jahreswechsel: Aal 31.12. und 1.3. geschont, 2.3. erlaubt
> - Schaltjahr: Forelle 29.2.2028 erlaubt
> - Hecht im Main am 10.5. erlaubt, im Rhein-System geschont
> - Huchen im Rhein-System: keine Landesregel, Hinweis erscheint
> - Lachs: immer "ganzjährig geschont"
> - Fehlende Länge bei Art mit Mindestmaß → nie "erlaubt"

**Fertig, wenn:** Alle Tests grün, App sieht im Browser aus wie vorher.

---

## Phase 2: Auf das Handy (PWA)

> Mach aus der App eine installierbare PWA: manifest.webmanifest mit Name "Fang-Check",
> App-Icons (einfaches Fischsymbol als SVG, daraus PNG 192 und 512), Service Worker, der alle
> Dateien cached, damit die App komplett offline läuft. Bei einer neuen Version soll ein Hinweis
> "Update verfügbar" erscheinen. Erkläre mir danach, wie ich das kostenlos auf GitHub Pages
> veröffentliche, Schritt für Schritt.

**Hinweise:**
- PWA, Kamera und GPS brauchen HTTPS. GitHub Pages liefert das automatisch.
- Kostenloses GitHub Pages braucht ein öffentliches Repo. Alternative für privat: Cloudflare Pages oder Netlify.
- Am Handy: Seite öffnen, "Zum Startbildschirm hinzufügen".
- Erledigt: Die Schriften liegen in assets/fonts/ und werden mit gecached.
- Erledigt: Veröffentlicht unter https://murpsi.github.io/ (Repo murpsi/murpsi.github.io), am Handy getestet.

**Fertig, wenn:** Die App startet vom Homescreen im Flugmodus.

---

## Phase 3: Fangbuch

> Baue ein Fangbuch. Nach dem Regel-Check gibt es den Knopf "Fang eintragen". Ein Eintrag speichert:
> Art, Länge, Datum und Uhrzeit, Gewässer (Freitext, zuletzt genutzte als Vorschlag), GPS-Position
> (optional, per Knopf), Foto (Kamera oder Galerie, vor dem Speichern auf max. 1600 px verkleinern),
> "entnommen" oder "zurückgesetzt", Notiz. Speichern in IndexedDB, komplett offline.
> Dazu eine Liste aller Fänge mit Filter nach Jahr, Art und Gewässer, Bearbeiten und Löschen
> (mit Bestätigung in der Seite) und Export als CSV. Zusätzlich Backup und Wiederherstellen
> als JSON-Datei inklusive Fotos. Halte die Speicherlogik in einer eigenen Datei js/fangbuch.js mit Tests.

**Hinweise:**
- Viele Vereine verlangen am Jahresende eine Fangliste. Die CSV ist genau dafür da.
- Fotos und GPS bleiben auf dem Handy. Ohne Backup sind sie beim Löschen der Browserdaten weg.
- Erledigt: Umgesetzt, am PC geprüft und am Handy getestet: Kamera und GPS gehen.

**Fertig, wenn:** Fang mit Foto und GPS eingetragen, App geschlossen, wieder geöffnet, Eintrag ist noch da.

---

## Phase 4: Vereins- und Gewässerregeln

> Ergänze eigene Regeln pro Gewässer, die zusätzlich zum Landesrecht gelten und nur strenger
> sein dürfen: höheres Mindestmaß, Höchstmaß (Entnahmefenster), längere Schonzeit, Tageslimit
> pro Art, Art komplett gesperrt. Ich lege ein Gewässer an (z. B. "Vereinssee Haslach"),
> wähle es beim Check aus, und das Urteil berücksichtigt beide Ebenen und sagt, welche Regel
> gegriffen hat. Tageslimit wird aus dem Fangbuch gezählt. Regeln als JSON exportierbar,
> damit ich sie mit Vereinskollegen teilen kann. Tests für die Kombination beider Ebenen.

**Hinweise:**
- Erledigt: Umgesetzt und am PC geprüft. Am Handy noch testen, vor allem den Knopf "Teilen".
- Abweichend vom Prompt gelten Limits für Artengruppen ("Edelfische") pro Tag und pro Woche. So regeln es
  die Vereine in der Ortenau, deren Ordnungen im Netz stehen (Lahr-Kinzigtal, Achern, Kehl).
- Dazugekommen: Sperrzeit für das ganze Gewässer, Entnahmepflicht als Hinweis, Freitext für weitere Regeln.
- Die App liefert keine Vereinsregeln mit. Das eigene Gewässer nach dem Erlaubnisschein anlegen.

**Fertig, wenn:** Ein Hecht mit 55 cm ist am Vereinsgewässer mit 60-cm-Regel "Zurücksetzen (Vereinsregel)".

---

## Phase 5: Echte Fotos

> Ersetze in der Artansicht die Zeichnung durch ein echtes Foto, die Zeichnung bleibt als
> Umschalter erhalten. Nutze nur frei lizenzierte Bilder von Wikimedia Commons, lade sie ins
> Projekt (assets/fotos/, verkleinert auf 800 px, WebP) und zeige Urheber und Lizenz unter dem Bild.
> Lege eine Datei assets/fotos/QUELLEN.md mit allen Nachweisen an. Die Fotos sollen offline verfügbar sein.

**Hinweise:**
- Lizenz und Urhebernennung sind Pflicht, sonst drohen Abmahnungen.
- Erledigt: Umschalter, Nachweis, eigener Foto-Cache, Hilfsskript tools/foto.mjs. 42 von 47 Arten haben ein Foto.
- Dazugekommen: Die Fischart wird oben per Bild gewählt statt aus einer Textliste.
- Dazugekommen: Bestimmungshilfe. Nummerierte Markierungen der Merkmale im Foto und in der Zeichnung, dazu "Mehr zur Art"
  (wissenschaftlicher Name, Größe, Lebensraum, Nahrung, Besonderes). Stand: alle 47 Arten.
- Ohne Foto, nur mit Zeichnung (kein brauchbares freies Foto gefunden): Seeforelle, Edelkrebs-Weibchen, Meerforelle,
  Stör, Frauennerfling. Alle anderen 42 Arten haben ein Foto.
- Offen: am Handy im Flugmodus testen. Texte in data/arten-info.json gegenlesen.

**Fertig, wenn:** Im Flugmodus zeigt die installierte App beim Hecht das Foto mit Urheber und Lizenz, der Umschalter
zeigt die Zeichnung, und assets/fotos/QUELLEN.md listet jedes Foto.

---

## Phase 6: Wetter im Fangbuch

> Beim Eintragen eines Fangs mit GPS sollen Lufttemperatur, Luftdruck, Luftdrucktrend der letzten
> 6 Stunden, Wind, Bewölkung und Mondphase automatisch gespeichert werden. Nutze Open-Meteo
> (kostenlos, kein API-Schlüssel). Ohne Netz: Eintrag trotzdem speichern und Wetter später nachladen.

---

## Phase 7: Auswertung

> Baue eine Auswertungsseite für das Fangbuch: Fänge pro Monat, pro Art, pro Gewässer,
> nach Tageszeit, nach Luftdrucktrend und Mondphase. Diagramme ohne schwere Bibliothek,
> gut lesbar am Handy, im Hell- und Dunkelmodus.

**Hinweis:** Aussagekräftig wird das erst nach einer Saison mit vielen Einträgen.

---

## Phase 8: KI-Bestimmung und Längenmessung per Foto

Erst angehen, wenn Phase 1 bis 4 laufen. Hier kommt zum ersten Mal ein Server dazu.

**8a: Art per Foto**
> Ich möchte die Fischart per Foto vorschlagen lassen. Plane mit mir eine Lösung, bei der der
> API-Schlüssel nie im Browser landet: ein kleiner Proxy (z. B. Cloudflare Worker), der das Foto
> an ein multimodales KI-Modell schickt und die Top-3-Arten mit Sicherheit zurückgibt, eingeschränkt
> auf die Arten aus data/regeln-bw.json. Die App zeigt die Vorschläge mit Bild und Merkmalen zum
> Vergleich, die Auswahl trifft immer der Angler. Bei geringer Sicherheit Hinweis "unsicher, Merkmale prüfen".
> Ohne Netz funktioniert die manuelle Auswahl wie bisher.

**8b: Länge per Messmatte**
> Erzeuge eine druckbare Messmatte (A4 quer, mehrere Blätter aneinander) mit ArUco-Markern in
> bekanntem Abstand. Die App erkennt auf dem Foto die Marker mit OpenCV.js, korrigiert die Perspektive
> und lässt mich Kopfspitze und Schwanzende antippen. Daraus rechnet sie die Länge in cm. Zeige die
> geschätzte Messunsicherheit an. Erst mit Testbildern bekannter Länge validieren.

**Hinweise:**
- KI-Aufrufe kosten pro Foto ein paar Zehntel Cent, deshalb ein Limit pro Tag einbauen.
- Rotauge und Rotfeder, Aland und Döbel verwechselt auch die KI. Die Verwechslungshinweise bleiben wichtig.
- 8b ist dein Ingenieursthema: Kalibrierung, Messunsicherheit, Validierung gegen Referenz.

---

## Tipps für die Arbeit mit Claude Code

- **Zuerst planen lassen.** Bei größeren Phasen erst einen Plan verlangen und lesen, bevor Code entsteht.
- **Eine Phase, eine Sitzung.** Danach eine neue Sitzung starten, CLAUDE.md liefert den Kontext.
- **Am echten Handy testen**, nicht nur am PC. Kamera, GPS und Offline verhalten sich dort anders.
- **Oft committen.** Wenn etwas schiefgeht: "Setz auf den letzten Commit zurück."
- **Regeln jährlich prüfen.** Die LFischVO wird gelegentlich geändert (zuletzt 2026). Prompt dafür:
  "Vergleiche data/regeln-bw.json mit der aktuellen LFischVO BW § 1 und zeige mir Abweichungen."
