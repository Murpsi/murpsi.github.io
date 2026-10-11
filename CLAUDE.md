# Fang-Check BW

Web-App (später PWA) für Angler in Baden-Württemberg. Prüft, ob ein gefangener Fisch nach
Schonzeit und Mindestmaß entnommen werden darf, hilft beim Bestimmen der Art und führt ein Fangbuch.

Entwickler: Marcus. Erfahrener Testingenieur (Python, Datenauswertung), aber neu in Web- und App-Entwicklung.
Erkläre neue Web-Konzepte kurz, wenn du sie zum ersten Mal einsetzt (z. B. Service Worker, IndexedDB).

## Grundregeln

- **Rechtsdaten nie raten.** Schonzeiten, Mindestmaße und geschützte Arten kommen nur aus der
  Landesfischereiverordnung BW (LFischVO § 1). Jede Regel in `data/regeln-bw.json` hat ein Feld `quelle`.
  Wenn eine Angabe unklar ist: nachfragen statt erfinden.
- **Die App ist eine Hilfe, keine Rechtsauskunft.** Der Hinweis dazu bleibt immer sichtbar.
- **Im Zweifel "Zurücksetzen".** Wenn Daten fehlen oder widersprüchlich sind, zeigt die App nie "erlaubt".
- **Kein Framework, kein Build-Schritt**, solange es ohne geht. Reines HTML, CSS und JavaScript (ES-Module).
  Ein Framework nur nach Rückfrage.
- **Mobile first und offline first.** Am Wasser gibt es oft kein Netz. Alles Wichtige muss offline gehen.
- **Daten bleiben auf dem Gerät.** Fangbuch, Fotos und GPS-Spots werden lokal gespeichert (IndexedDB).
  Kein Upload ohne ausdrückliche Zustimmung. Angelstellen sind privat.
- **Oberfläche auf Deutsch**, Code und Kommentare dürfen Deutsch oder Englisch sein, aber einheitlich pro Datei.
- **Kleine Schritte.** Nach jeder Änderung: Tests laufen lassen, im Browser prüfen, dann committen.

## Struktur (Stand in Phase 5)

```
index.html              Oberfläche: Check, Fangbuch, Gewässer und die Formulare als Ansichten einer Seite
css/app.css             Styles (Farben als CSS-Variablen, Hell- und Dunkelmodus)
js/app.js               Oberflächenlogik
js/regeln.js            Reine Prüflogik des Landesrechts: pruefe(), inSchonzeit(), regeln()  (kein DOM!)
js/gewaesser.js         Vereins- und Gewässerregeln über dem Landesrecht: pruefeGewaesser(), Limits, Datei zum Teilen  (kein DOM!)
js/gewaesser-ui.js      Oberfläche der Gewässer: Liste, Formular für Regeln und Limits, Export, Teilen, Import
js/fischbilder.js       SVG-Zeichnungen der Arten
js/arteninfo.js         Bestimmungshilfe: benannte Merkmale mit Position im Bild, weitere Eigenschaften der Art  (kein DOM!)
js/fotos.js             Fotonachweise prüfen, Text für Urheber und Lizenz, Inhalt von QUELLEN.md  (kein DOM!)
js/fangbuch.js          Speicherlogik für Fangbuch und Gewässer: IndexedDB, Prüfung, Filter, CSV, Backup  (kein DOM!)
js/fangbuch-ui.js       Oberfläche des Fangbuchs: Formular, Liste, Foto verkleinern, GPS, Download, Wechsel der Ansichten
js/pwa.js               Meldet den Service Worker an, zeigt "Update verfügbar"
data/regeln-bw.json     Arten, Schonzeiten, Mindestmaße, Merkmale, Quelle
data/arten-info.json    Bestimmungshilfe pro Art: Merkmale mit Markierung, Größe, Lebensraum, Nahrung (keine Rechtsdaten)
data/fotos.json         Nachweis pro Foto: Urheber, Lizenz, Quelle auf Wikimedia Commons
assets/fotos/           Fotos der Arten (<art-id>.webp, 800 px) und QUELLEN.md mit allen Nachweisen
tools/foto.mjs          Hilfsskript, nicht Teil der App: Foto von Commons holen, Lizenz prüfen, verkleinern, Nachweis eintragen
assets/fonts/           Schriften (woff2, OFL-Lizenztexte liegen daneben)
assets/icons/           icon.svg, daraus icon-192.png und icon-512.png
tests/regeln.test.js    Tests der Prüflogik
tests/gewaesser.test.js Tests der Gewässerregeln und ihrer Kombination mit dem Landesrecht
tests/fangbuch.test.js  Tests der Speicherlogik (mit kleinem IndexedDB-Ersatz, Node hat keins)
tests/arteninfo.test.js Tests der Bestimmungshilfe
tests/fotos.test.js     Tests der Fotonachweise: Lizenz, Vollständigkeit, Dateigröße, QUELLEN.md
tests/sw.test.js        Tests für Cache-Listen, VERSION, FOTO_VERSION und Manifest
manifest.webmanifest    PWA: Name, Icons, Start als eigenständige App
sw.js                   Service Worker: cached alle Dateien für Offline
```

## Befehle

- Lokal starten: `python -m http.server 8000` und dann http://localhost:8000 öffnen
  (ES-Module und Service Worker brauchen einen Server, Doppelklick auf die Datei reicht nicht mehr).
- Tests: `node --test` oder `npm test`  (eingebauter Test-Runner von Node, keine Abhängigkeiten;
  findet `tests/*.test.js` selbst. `node --test tests/` mit Ordnerangabe schlägt ab Node 22 fehl).
  `package.json` enthält nur `"type": "module"` und das Test-Skript, keine Pakete.

## Service Worker und Updates

- Jede neue Datei der App muss in `DATEIEN` in `sw.js` stehen, sonst fehlt sie offline.
- `VERSION` in `sw.js` ist ein Fingerabdruck dieser Dateien. Nach jeder Änderung schlägt
  `tests/sw.test.js` fehl und nennt den neuen Wert. Eintragen, erst dann committen. Ohne neue
  VERSION bleiben installierte Apps auf dem alten Stand, auch bei geänderten Regeln.
- Auf localhost fragt der Service Worker zuerst das Netz, damit Änderungen sofort sichtbar sind.
  Veröffentlicht gilt: zuerst Cache.
- Alle Adressen relativ (`css/app.css`, nicht `/css/app.css`), weil die App auf GitHub Pages
  in einem Unterordner liegt. Nichts von fremden Servern laden.
- Icons neu erzeugen: `assets/icons/icon.svg` mit Chrome headless in 192 und 512 px rendern.

## Fotos

- Nur Fotos von Wikimedia Commons mit CC0, gemeinfrei, CC BY oder CC BY-SA. Kein NC, kein ND. `lizenzErlaubt()` entscheidet.
- Jedes Foto braucht einen vollständigen Eintrag in `data/fotos.json`. Ohne ihn zeigt die App die Zeichnung, nie ein Foto ohne Nachweis.
- Fotos holt nur `node tools/foto.mjs <art-id> "<Dateiname auf Commons>"`. Es schreibt Foto, Nachweis und `QUELLEN.md`.
  Danach das Foto in `FOTOS` in `sw.js` eintragen und `VERSION` und `FOTO_VERSION` nach der Testmeldung setzen.
- Ein falsch bestimmtes Foto ist schlimmer als keins. Marcus gibt jedes Foto einzeln frei, bevor es geladen wird.
- Fotos liegen in einem eigenen Cache (`FOTO_VERSION`), damit ein Update der Regeln sie nicht neu lädt.
- Die Bildauswahl der Art zeigt immer die Zeichnungen. Das Foto erscheint nur in der Artansicht, mit Umschalter zur Zeichnung.
- Sammelarten (Felchen, Neunaugen, Großmuscheln) bekommen im Nachweis das Feld `zeigt` ("Beispiel: Bachneunauge").

## Bestimmungshilfe (Merkmale und Eigenschaften)

- `data/arten-info.json` ist Artwissen, kein Recht. Schonzeit und Mindestmaß stehen nur in `regeln-bw.json`.
  Keine Laichzeiten eintragen, sie würden mit der Schonzeit verwechselt.
- Jedes Merkmal hat Name, Text und eine Position in Prozent (von links, von oben), getrennt für `foto` und `zeichnung`.
  Im Bild endet dort nur ein dünner Strich. Die Nummer steht in einer Leiste über oder unter dem Bild (`anordnung()`), damit der Fisch nicht verdeckt wird.
  Die Position im Foto gilt nur für genau dieses Foto. Nach einem Fototausch neu setzen und im Browser ansehen.
- Ohne Eintrag zeigt die App den Kurztext `merkmale` aus `regeln-bw.json` wie bisher.
- Das Feld `bw` ("In Baden-Württemberg") nennt Vorkommen und Gefährdung im Land. Einstufungen der Roten Liste immer
  mit Jahr der Ausgabe (2014 oder 2025). Die Quellen stehen in `quellen` am Kopf der Datei.
- Arten, die § 1 LFischVO nicht nennt (z. B. Karausche, Rotauge, Barsch), stehen ohne Schonzeit und Mindestmaß in
  `regeln-bw.json`. Ob eine Art in § 1 fehlt, am Verordnungstext prüfen, nicht annehmen.
- Jede Art mit Foto braucht markierte Merkmale, der Test prüft das.
- Bei Bearbeitungen (freigestellte Bilder) und Sammelkonten den eigentlichen Fotografen als Urheber eintragen
  (`--urheber`), nicht den Namen des Kontos oder Bots, der die Datei hochgeladen hat.
- Die Zeichnung in der Artansicht wird mit `bildFuer()` neu erzeugt, nicht aus der Kachel kopiert. Ihre SVG-IDs
  (Verlauf, Umriss) greifen sonst ins Leere, solange die Bildauswahl zugeklappt ist.

## Fachliches, das leicht falsch gemacht wird

- Schonzeiten über den Jahreswechsel (z. B. Forelle 1.10. bis 28.2., Aal 15.9. bis 1.3.). Beide Grenztage zählen mit.
- Schaltjahr: "bis 28. Februar" bleibt der 28., auch im Schaltjahr.
- Gemessen wird von der Kopfspitze bis zum Ende der natürlich ausgebreiteten Schwanzflosse.
- Gewässerabhängige Regeln: Bachforelle (Hochrhein 35, über 800 m ü. NN 20, sonst 25 cm),
  Hecht und Zander im Main abweichend, Aal nur im Rhein-System, Huchen und Rapfen nur im Donau-System.
- Bodensee hat eigene Ordnungen und ist bewusst nicht enthalten.
- Vereinsregeln können strenger sein als das Landesrecht, nie lockerer.

## Fangbuch

- Datenbank `fang-check` (Version 2), Tabellen `faenge` und `gewaesser`, Schlüssel `id` (UUID). Namen nicht ändern,
  sonst sind vorhandene Fangbücher leer.
  Neue Felder brauchen keine höhere Versionsnummer in `oeffne()`. Eine neue Tabelle oder ein neuer Index braucht sie,
  und `onupgradeneeded` darf dann nur anlegen, was nach `oldVersion` noch fehlt.
- `zeit` ist Ortszeit als Text (`2026-10-11T14:30`), nie über `toISOString()` umrechnen.
- Jeder Eintrag läuft durch `bereinige()`, auch beim Einspielen eines Backups.
- Die CSV ist für den Verein und enthält bewusst keine Position und keine Fotos. Das Backup enthält alles.
- Backup einspielen löscht nie. Bei gleicher `id` gewinnt der zuletzt geänderte Eintrag.
- "Entnommen" wird nur vorbelegt, wenn der Check "erlaubt" sagt.

## Vereins- und Gewässerregeln

- **Keine Vereinsregeln ausliefern.** Die App enthält keine vorausgefüllten Regeln eines Vereins. Jeder legt sein
  Gewässer selbst nach dem Erlaubnisschein an. Zahlen in den Tests sind Beispiele.
- Die strengere Regel gewinnt: höheres Mindestmaß, geschont wenn Land oder Verein schont. `pruefe()` bleibt unverändert,
  `pruefeGewaesser()` legt die Vereinsebene darüber. Ganzjährig geschonte Arten kann kein Verein freigeben.
- Jeder Grund im Urteil trägt seine Ebene (`land` oder `verein`). "Zurücksetzen (Vereinsregel)" heißt es nur,
  wenn das Landesrecht allein nicht gestoppt hätte.
- Limits gelten für eine Liste von Arten, pro Kalendertag und pro Woche von Montag bis Sonntag. Gezählt werden
  entnommene Fänge im Fangbuch mit demselben Gewässernamen (ohne Rücksicht auf Groß- und Kleinschreibung).
  Ist das Fangbuch nicht lesbar, gilt ein Limit als nicht prüfbar und das Urteil ist nie "erlaubt".
- Entnahmepflicht ist nur ein Hinweis und ändert den Status nicht.
- Jedes Gewässer läuft durch `bereinigeGewaesser()`, auch beim Import und im Check. Unlesbare Regeln ergeben "Zurücksetzen".
- Die Datei zum Teilen enthält nur Regeln, keine Fänge und keine Positionen. Import löscht nie, bei gleicher `id`
  gewinnt der zuletzt geänderte Stand.
- Rutenzahl, Köder und Nachtangeln stehen nur im Freitext "Weitere Regeln" und werden nicht geprüft.
