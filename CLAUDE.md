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

## Struktur (Stand nach Phase 4)

```
index.html              Oberfläche: Check, Fangbuch, Gewässer und die Formulare als Ansichten einer Seite
css/app.css             Styles (Farben als CSS-Variablen, Hell- und Dunkelmodus)
js/app.js               Oberflächenlogik
js/regeln.js            Reine Prüflogik des Landesrechts: pruefe(), inSchonzeit(), regeln()  (kein DOM!)
js/gewaesser.js         Vereins- und Gewässerregeln über dem Landesrecht: pruefeGewaesser(), Limits, Datei zum Teilen  (kein DOM!)
js/gewaesser-ui.js      Oberfläche der Gewässer: Liste, Formular für Regeln und Limits, Export, Teilen, Import
js/fischbilder.js       SVG-Zeichnungen der Arten
js/fangbuch.js          Speicherlogik für Fangbuch und Gewässer: IndexedDB, Prüfung, Filter, CSV, Backup  (kein DOM!)
js/fangbuch-ui.js       Oberfläche des Fangbuchs: Formular, Liste, Foto verkleinern, GPS, Download, Wechsel der Ansichten
js/pwa.js               Meldet den Service Worker an, zeigt "Update verfügbar"
data/regeln-bw.json     Arten, Schonzeiten, Mindestmaße, Merkmale, Quelle
assets/fonts/           Schriften (woff2, OFL-Lizenztexte liegen daneben)
assets/icons/           icon.svg, daraus icon-192.png und icon-512.png
tests/regeln.test.js    Tests der Prüflogik
tests/gewaesser.test.js Tests der Gewässerregeln und ihrer Kombination mit dem Landesrecht
tests/fangbuch.test.js  Tests der Speicherlogik (mit kleinem IndexedDB-Ersatz, Node hat keins)
tests/sw.test.js        Tests für Cache-Liste, VERSION und Manifest
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
