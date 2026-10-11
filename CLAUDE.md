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

## Struktur (Stand nach Phase 8)

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
js/fangbuch.js          Speicherlogik für Fangbuch, Gewässer und Papierkorb: IndexedDB, Prüfung, Filter, CSV, Backup  (kein DOM!)
js/fangbuch-ui.js       Oberfläche des Fangbuchs: Formular, Liste, Foto verkleinern, GPS, Download, Wechsel der Ansichten, Wetter nachladen
js/fangblatt.js         Fangblatt: Sonnenstand, Modell und SVG des gezeichneten Himmels, Mond, Kacheln  (kein DOM!)
js/fangblatt-ui.js      Oberfläche des Fangblatts: ein Fang groß zum Ansehen, Blättern, kleine Karte der Stelle
js/papierkorb-ui.js     Oberfläche des Papierkorbs: wiederherstellen, endgültig löschen, leeren
js/karte.js             Karte der Fänge: Ausschnitt, Blasen, Hinweise, Adresse der Kacheln  (kein DOM!)
js/karte-ui.js          Zeichnet die Karte mit Leaflet: Punkte, Blasen, Kartenbild. Lädt Leaflet erst beim ersten Öffnen
js/auswertung.js        Auswertung: zählt Fänge nach Monat, Art, Gewässer, Uhrzeit, Sonnenstand, Luftdrucktrend, Mondphase  (kein DOM!)
js/auswertung-ui.js     Zeichnet die Auswertung als Balken und Säulen aus gewöhnlichem HTML und CSS
js/wetter.js            Mondphase berechnen, Wetter von Open-Meteo holen und lesen, Texte für die Anzeige  (kein DOM!)
js/pwa.js               Meldet den Service Worker an, zeigt "Update verfügbar"
data/regeln-bw.json     Arten, Schonzeiten, Mindestmaße, Merkmale, Quelle
data/arten-info.json    Bestimmungshilfe pro Art: Merkmale mit Markierung, Größe, Lebensraum, Nahrung (keine Rechtsdaten)
data/fotos.json         Nachweis pro Foto: Urheber, Lizenz, Quelle auf Wikimedia Commons
assets/fotos/           Fotos der Arten (<art-id>.webp, 800 px) und QUELLEN.md mit allen Nachweisen
tools/beispiel-fangbuch.mjs  Hilfsskript, nicht Teil der App: erfundenes Fangbuch als Backup-Datei, das alle Ansichten zeigt
tools/foto.mjs          Hilfsskript, nicht Teil der App: Foto von Commons holen, Lizenz prüfen, verkleinern, Nachweis eintragen
assets/vendor/leaflet/  Leaflet 1.9.4 und Leaflet.markercluster 1.5.3, unverändert (Lizenztexte liegen daneben)
assets/fonts/           Schriften (woff2, OFL-Lizenztexte liegen daneben)
assets/icons/           icon.svg, daraus icon-192.png und icon-512.png
tests/regeln.test.js    Tests der Prüflogik
tests/gewaesser.test.js Tests der Gewässerregeln und ihrer Kombination mit dem Landesrecht
tests/fangbuch.test.js  Tests der Speicherlogik (mit kleinem IndexedDB-Ersatz, Node hat keins)
tests/arteninfo.test.js Tests der Bestimmungshilfe
tests/fotos.test.js     Tests der Fotonachweise: Lizenz, Vollständigkeit, Dateigröße, QUELLEN.md
tests/wetter.test.js    Tests für Mondphase und Wetter (open-meteo-antwort.json ist eine gespeicherte echte Antwort)
tests/fangblatt.test.js Tests für Sonnenstand, Himmel, Mond und Kacheln des Fangblatts
tests/karte.test.js     Tests der Kartenlogik
tests/auswertung.test.js Tests der Zähllogik der Auswertung
tests/sw.test.js        Tests für Cache-Listen, VERSION, FOTO_VERSION, Manifest, fremde Adressen und den Kachel-Cache
manifest.webmanifest    PWA: Name, Icons, Start als eigenständige App
sw.js                   Service Worker: cached alle Dateien für Offline, dazu angesehene Kartenkacheln
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
  in einem Unterordner liegt. Nichts von fremden Servern laden. Ausnahmen sind nur das Wetter und das Kartenbild
  (siehe unten), beide mit Zustimmung. `tests/sw.test.js` lässt keine andere Adresse zu.
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
- Anlandepflicht (§ 2 LFischVO): Aal außerhalb des Rhein-Systems, Huchen und Rapfen außerhalb des Donau-Systems dürfen
  nicht zurückgesetzt werden (§ 8 Abs. 2). `pruefe()` nennt das als Grund, der Status bleibt unverändert. Die Fälle aus
  § 8 Abs. 1 (Aal in der Forellen- und Äschenregion, Regenbogenforelle und Bachsaibling in Zuflüssen des Bodensee-Obersees)
  kennt die App nicht und nennt sie nur unter "In Baden-Württemberg". § 2 gilt für Fische, nicht für Krebse.
- Vereinsregeln können strenger sein als das Landesrecht, nie lockerer.

## Fangbuch

- Datenbank `fang-check` (Version 3), Tabellen `faenge`, `gewaesser` und `papierkorb`, Schlüssel `id` (UUID). Namen nicht ändern,
  sonst sind vorhandene Fangbücher leer.
  Neue Felder brauchen keine höhere Versionsnummer in `oeffne()`. Eine neue Tabelle oder ein neuer Index braucht sie,
  und `onupgradeneeded` darf dann nur anlegen, was nach `oldVersion` noch fehlt.
- `zeit` ist Ortszeit als Text (`2026-10-11T14:30`), nie über `toISOString()` umrechnen.
- Jeder Eintrag läuft durch `bereinige()`, auch beim Einspielen eines Backups.
- Ein Foto, das aus der Datenbank gelesen wurde, nie wieder hineinschreiben. Es ist nur ein Verweis auf die Datei hinter
  seinem Eintrag und kann nach dem Überschreiben kaputt sein (so gemeldet vom Handy nach dem Bearbeiten). `tabelle()` kopiert
  deshalb jedes Foto vor dem Schreiben mit `mitEigenenFotos()`, außerhalb der Transaktion. Der IndexedDB-Ersatz in den Tests
  zählt Verstöße.
- Die CSV ist für den Verein und enthält bewusst keine Position und keine Fotos. Das Backup enthält alles.
- Backup einspielen löscht nie. Bei gleicher `id` gewinnt der zuletzt geänderte Eintrag.
- "Entnommen" wird nur vorbelegt, wenn der Check "erlaubt" sagt.

## Fangblatt

- Tippen auf einen Fang (Liste oder Karte) öffnet ihn groß. Das Fangblatt ist nur zum Ansehen. Bearbeiten und Löschen
  gibt es nur dort, die Karten der Liste haben keine Knöpfe mehr. Nach dem Bearbeiten führt das Formular zurück zum Blatt.
- Der Himmel ist eine Zeichnung, kein Messwert: Tag, Dämmerung oder Nacht aus dem Sonnenstand (`sonnenstand()`, Grenzen
  bei −6° und +6°), Wolken, Regen und Wind nur aus Wetter, das zum Fang passt (`wetterPasst()`), der Mond in seiner Phase.
  Wo Sonne und Mond standen, zeigt er nicht. Der Hinweis dazu unter dem Blatt bleibt stehen.
- Ohne Wetter zeigt der Himmel nur Tageszeit und Mond und sagt das. Nie Wetter erfinden.
- Die Uhrzeit des Fangs ist Ortszeit in Baden-Württemberg. `weltzeit()` rechnet Sommer- und Winterzeit selbst um und
  hängt nicht von der Zeitzone des Geräts ab.
- `himmelSvg()` baut den SVG-Text nur aus Zahlen und festen Farben. Keine Texte des Nutzers hineinsetzen, er wird mit
  `innerHTML` eingefügt.
- Die Bewegung (Wolken, Regen, Sterne, Wasser) steht in `css/app.css` und ruht bei `prefers-reduced-motion`.
- Die Nennung von Open-Meteo steht auch unter dem Fangblatt, sobald es Wetter zeigt.
- `node tools/beispiel-fangbuch.mjs` erzeugt ein erfundenes Fangbuch zum Einspielen. Alle Notizen beginnen mit "Beispiel",
  alle ids mit `beispiel-`. Nicht in ein echtes Fangbuch einspielen, das danach an den Verein geht.

## Papierkorb

- Nichts wird sofort endgültig gelöscht. `loesche()` legt den Eintrag in die Tabelle `papierkorb`, `speichere()` und
  `uebernimm()` legen die Fassung vor einer Änderung dort ab (Grund `geloescht` oder `geaendert`). Das gilt für Fänge und
  Gewässer und geschieht in derselben Transaktion wie das Löschen oder Überschreiben.
- Speichern ohne inhaltliche Änderung und nachgetragenes Wetter (`ergaenze()`) füllen den Papierkorb nicht.
- Wiederherstellen setzt `geaendert` auf jetzt, damit ein älteres Backup den Eintrag nicht wieder überschreibt. Gibt es
  inzwischen eine andere Fassung, kommt die dafür in den Papierkorb.
- Nach 30 Tagen (`KORB_TAGE`) räumt der Start der App auf. "Endgültig löschen" und "Papierkorb leeren" gibt es bewusst:
  Wer eine Angelstelle wirklich loswerden will, muss das können.
- Der Papierkorb liegt nur auf dem Gerät und steht weder im Backup noch in der CSV.
- Neue Wege, etwas zu löschen oder zu überschreiben, müssen über `tabelle()` laufen, sonst fehlt der Weg zurück.

## Wetter und Mond

- Wetter wird nur mit Zustimmung geladen (Schalter im Fang-Formular, anfangs aus, gemerkt in `localStorage`).
  An Open-Meteo gehen der Tag des Fangs und die auf zwei Nachkommastellen gerundete Position (`gerundet()`, Raster rund 1 km).
  Die genaue Position verlässt das Gerät nie.
- Das Speichern eines Fangs wartet nie auf das Wetter. Es wird danach geholt, beim Start, wenn das Handy wieder Netz meldet,
  und per Knopf im Fangbuch. Geschrieben wird es mit `ergaenze()`, das `geaendert` stehen lässt.
- `wetter` gilt für eine volle Stunde und einen gerundeten Ort. `bereinige()` verwirft es, sobald Uhrzeit oder Position
  nicht mehr passen (`wetterPasst()`). Unlesbares Wetter wird zu `null`, der Fang bleibt gültig.
- Kein Wetter für die Zukunft und keins für Fänge, die älter als 90 Tage sind (so weit reicht die Adresse zurück).
- Der Drucktrend ist als Zahl gespeichert (hPa in 6 Stunden). "Steigend" und "fallend" entstehen erst bei der Anzeige.
- Die Mondphase wird aus Datum und Uhrzeit berechnet und nicht gespeichert.
- Die Nennung "Wetterdaten: Open-Meteo.com" mit Link ist Pflicht der Lizenz (CC BY 4.0) und bleibt sichtbar, sobald Wetter angezeigt wird.
- Das Wetter steht im Backup, nicht in der CSV.
- `niederschlag` (mm in der Stunde) gibt es erst seit dem Fangblatt. Älteres Wetter hat `null` und bleibt gültig.
  `null` heißt "unbekannt", nicht "trocken". Die App holt Wetter dafür nicht neu.

## Karte der Fänge

- Die Karte zeigt die Fänge mit Position aus der gefilterten Liste. Die Positionen verlassen das Gerät nie.
- Das Kartenbild von OpenStreetMap wird nur mit Zustimmung geladen (einmal gefragt, Schalter unter der Karte, gemerkt in
  `localStorage`). Ohne Zustimmung und ohne Netz stehen die Punkte auf grauem Grund.
- Es gelten die Nutzungsregeln für Kacheln (https://operations.osmfoundation.org/policies/tiles/). Daraus folgt:
  nur die Adresse in `KACHELN`, Nennung "© OpenStreetMap-Mitwirkende" immer sichtbar in der Karte, kein Laden auf Vorrat,
  keine Funktion "Gebiet speichern", kein `Referrer-Policy`, das die Herkunft verschweigt.
- Der Kachel-Cache (`fang-check-kacheln-1` in `sw.js`) ist kein Offline-Speicher, sondern ein Cache nach den Angaben des
  Servers: frisch bis `Expires`, ohne Netz noch `stale-if-error` lang, zusammen rund zwei Wochen. Danach bleibt die Stelle
  grau, bis sie mit Netz wieder angesehen wird. Diese Fristen nicht verlängern.
- Der Kachel-Cache hat keinen Fingerabdruck und überlebt Updates. `activate` darf ihn nicht löschen. Obergrenze 1000 Kacheln.
- Leaflet ist kein ES-Modul und liegt unter `assets/vendor/`, nicht unter `js/`, weil der Test auf fremde Adressen dort
  jede Adresse im Quelltext beanstandet. Die Dateien nicht bearbeiten, bei einem Update ganz ersetzen.
- Punkte zeigen das Vorschaufoto oder die Zeichnung als `<img>` (`zeichnungAlsBild()`), nie als eingebettetes SVG:
  dessen IDs würden mit der Bildauswahl kollidieren.
- Der Ausschnitt wird nur neu gesucht, wenn sich die Auswahl ändert (`auswahlSchluessel()`), nicht nach jedem Neuzeichnen.

## Auswertung

- Dritte Darstellung im Fangbuch neben Liste und Karte. Sie zählt dieselbe gefilterte Auswahl, entnommene und
  zurückgesetzte Fänge zusammen. Der Papierkorb zählt nicht.
- Gezählt werden Fänge, nicht Angelstunden. Das Fangbuch kennt keine Stunden ohne Fang, die Diagramme sagen also nicht,
  wann es am besten beißt. Der Satz dazu über den Diagrammen bleibt stehen. Keine Prozente, keine "beste Zeit".
- Unter 20 Fängen (`WENIGE`) steht dabei, dass der Zufall überwiegt.
- Tageszeit gibt es zweimal: zwölf gleich lange Blöcke nach der Uhr und fünf Abschnitte nach dem Sonnenstand
  (`sonnenAbschnitt()`, Grenzen wie im Fangblatt). Die Abschnitte nach Sonnenstand sind ungleich lang, das steht darunter.
- Luftdrucktrend zählt nur Fänge, deren Wetter passt (`wetterPasst()`). Die übrigen werden als "ohne" genannt, nie geschätzt.
- Monat und Stunde kommen aus dem Text von `zeit`, nie über `Date`.
- Arten und Gewässer zeigen die acht häufigsten, der Rest steht als "n weitere" ohne Balken darunter.
- Diagramme sind gewöhnliches HTML mit Breite oder Höhe in Prozent. Keine Bibliothek, kein Canvas. Jede Zahl steht als
  Text da, Farbe allein trägt keine Angabe.

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
