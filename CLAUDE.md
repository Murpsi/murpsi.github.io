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

## Struktur (Zielbild nach Phase 1)

```
index.html              Oberfläche
css/app.css             Styles (Farben als CSS-Variablen, Hell- und Dunkelmodus)
js/app.js               Oberflächenlogik
js/regeln.js            Reine Prüflogik: pruefe(), inSchonzeit(), regeln()  (kein DOM!)
js/fischbilder.js       SVG-Zeichnungen der Arten
data/regeln-bw.json     Arten, Schonzeiten, Mindestmaße, Merkmale, Quelle
tests/regeln.test.js    Tests der Prüflogik
manifest.webmanifest    PWA (ab Phase 2)
sw.js                   Service Worker für Offline (ab Phase 2)
```

## Befehle

- Lokal starten: `python3 -m http.server 8000` und dann http://localhost:8000 öffnen
  (ES-Module und Service Worker brauchen einen Server, Doppelklick auf die Datei reicht nicht mehr).
- Tests: `node --test tests/`  (eingebauter Test-Runner von Node, keine Abhängigkeiten)

## Fachliches, das leicht falsch gemacht wird

- Schonzeiten über den Jahreswechsel (z. B. Forelle 1.10. bis 28.2., Aal 15.9. bis 1.3.). Beide Grenztage zählen mit.
- Schaltjahr: "bis 28. Februar" bleibt der 28., auch im Schaltjahr.
- Gemessen wird von der Kopfspitze bis zum Ende der natürlich ausgebreiteten Schwanzflosse.
- Gewässerabhängige Regeln: Bachforelle (Hochrhein 35, über 800 m ü. NN 20, sonst 25 cm),
  Hecht und Zander im Main abweichend, Aal nur im Rhein-System, Huchen und Rapfen nur im Donau-System.
- Bodensee hat eigene Ordnungen und ist bewusst nicht enthalten.
- Vereinsregeln können strenger sein als das Landesrecht, nie lockerer.
