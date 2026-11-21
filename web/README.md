# 42 (Browser-App, früher LernGate)

Quiz vor dem Öffnen von Instagram/Reddit – als reine Web-App, ohne Xcode, **ohne harte Sperre**.
Die Logik ist aus `../Swift-Core` (Swift) nach JavaScript portiert und gleich getestet.

## Starten
```
cd web
npm start          # Server auf Port 8080 (PORT=9000 npm start für anderen Port)
```
Das Terminal zeigt zwei Adressen: `localhost` für diesen Rechner, "Im selben WLAN" fürs iPhone.

## Testen
```
npm test           # node --test mit TZ=Europe/Berlin (367 Tests, inkl. Prüfung aller Decks – je genau 42 Karten – und Zufallsaufgaben)
```
Keine Abhängigkeiten, kein `npm install` nötig (Node 20 oder neuer).

## Veröffentlichen
```
npm run bauen      # prüft alle Decks, erzeugt decks/index.json und den Ordner dist/
```
Den Ordner `dist` bei Netlify neu hochladen (Deploys → Ordner hineinziehen).

## Decks
- 53 fertige Decks mit je 42 Karten (2226 insgesamt) liegen als JSON in `decks/` und erscheinen in der App unter "Bibliothek".
- Format: siehe `js/core/deckformat.js` (Felder `frage`, `richtig`, `falsch` (3×), optional `erklaerung`, `quelle`).
- Neues Deck hinzufügen: Datei in `decks/` anlegen, `npm run bauen` (bricht bei Formatfehlern ab), hochladen.
- In der App: "Deck importieren" nimmt denselben Text (z. B. von Claude erzeugt) mit Vorschau.
- Erneutes Einspielen erzeugt keine Dubletten (gleiche Frage im selben Deck = dieselbe Karte, Box bleibt).

## Aufbau
- `js/core/` – Leitner, Kartenauswahl, Gate-Sitzung, Freischaltung/Notfall-Skip (reine Logik, getestet)
- `js/core/deckformat.js` – Deck-Format, Import-Logik (Zusammenführen ohne Dubletten), Prompt-Vorlage
- `js/core/generator.js` – Zufallsaufgaben (18 Rechenaufgaben-Typen), Zahleneingabe lesen
- `js/core/gateaufbau.js` – Quiz zusammenstellen: Decks pro App, Reibung (steigende Kartenzahl), Nachtruhe
- `js/core/statistik.js` – Tageszähler, Serie, Wochenübersicht, Zähler für das Tageslimit
- `js/core/kaufbremse.js` – Wunschliste mit Wartezeit
- `sw.js` – Service Worker (Offline), `npm run bauen` setzt Version und Dateiliste ein
- `js/storage.js` – localStorage, Export/Import als JSON
- `js/app.js` – Oberfläche (Router, Ansichten)
- `test/` – Unit-Tests, `testhilfen/` – Hilfsfunktionen für Tests

## Daten
Alles liegt im localStorage des Browsers (Schlüssel `lerngate.v1`). Safari und ein
Home-Bildschirm-Symbol speichern getrennt. Backup unter Einstellungen → Datensicherung.

## Automation (Kurzbefehle)
Je Ziel-App eine Automation "App ist geöffnet" → "URLs öffnen" mit `https://<seite>/?quiz=<Name der Ziel-App>`.
Die Adressen zeigt die App unter "Einrichtung". Der Direktlink `?quiz=` lädt die Seite immer neu und
springt ins Quiz (ein `#/quiz/…` am Ende ging bei geöffneter Seite verloren).
Das Einstellungsfeld "Kurzbefehl zum Freischalten" ist optional und wird nicht gebraucht.

## Freischaltung
Jede Ziel-App hat ihre eigene Frist (`settings.freischaltungen[appName]`, 15 Minuten nach bestandenem Quiz).
Der Notfall-Skip gilt einmal pro Kalendertag für alle Apps zusammen und schaltet die gerade gewählte App frei.
Hinweis: Die Namen der Ziel-Apps sind der Schlüssel – wer eine App umbenennt, verliert deren laufende Freischaltung.

## Funktionen im Überblick
- **Zufallsaufgaben:** Prozent- und Wirtschaftsmathe-Aufgaben mit frischen Zahlen, teils als Zahleneingabe. Zu jeder Aufgabe gibt es einen **Tipp** vor der Antwort und danach den **Kopfrechen-Weg** mit den echten Zahlen (`js/core/kopfrechnen.js`, alles berechnet, getestet); Spickzettel unter `#/kopfrechnen`. Jede Zufallsaufgaben-Gruppe lässt sich auf der Startseite **pausieren**.
- **Decks pro App**, **Tageslimit pro App**, **steigende Kartenzahl** (3, 4, 5 … je Quiz am Tag), **Nachtruhe**.
- **Bremse** pro App: "Absicht" (5 Sekunden Pause) oder "Kaufbremse" (Wunschliste, Wartezeit).
- **Statistik**, **Serie**, **Tagesziel**, **Freies Üben**, **Backup-Erinnerung**, **Offline**.
- **Probelauf** pro Deck (Deck-Seite: „Alle Karten üben“, oder in der Bibliothek „Ausprobieren“): jede Karte einmal, gemischt, ohne Boxen und Statistik, mit Ergebnisliste und „Frage melden“.
- **Quiz auf kleinen Displays:** „Weiter“ klebt am unteren Rand, kompakteres Layout unter 760 px Höhe.
- **Name und Look:** App heißt „42“ (Netlify: zweiundvierzig.netlify.app). Farben: Nachtblau `#0f1b3d` und Signalgelb `#ffc233`; Logo und Symbole in `icons/` (Quelle: `icons/icon.svg`). Interne Namen (`lerngate.v1`, `lerngate-deck-v1`) bleiben bewusst, damit alte Daten und Decks weiter funktionieren.
- **Kartentypen:** Auswahl (4 Antworten), Wahr/Falsch, Lückentext (`___` im Satz, 4 Antworten) und Reihenfolge (3–6 Schritte antippen). Format siehe `js/core/deckformat.js`; drei Beispiel-Decks in der Bibliothek.
- **„Doch nicht öffnen“** im Quiz zählt als Sieg; **Deine Woche** (`#/woche`) vergleicht mit der Vorwoche.
- **Lernmodus „intelligent“ (Standard) oder „einfach“** (Einstellungen): Jede Karte hat ihren eigenen Abstand (1, 3, dann Abstand × Faktor, bis 180 Tage). Falsch = Abstand 0, morgen wieder, Faktor sinkt. Die Antwortzeit (unter 6 s schnell, über 20 s langsam; je Kartentyp anders) verschiebt Faktor und Wachstum, leicht zu ratende Typen (Wahr/Falsch) wachsen langsamer. Höchstens „Neue Karten pro Quiz“ (Standard 2) neue Karten, solange genug Wiederholungen fällig sind. „Einfach“ = feste Leitner-Abstände wie vorher. Siehe `js/core/intervall.js`.
- **Deck pausieren** (Deck-Seite): Das Deck kommt in keinem Quiz und nicht im freien Üben vor, der Lernstand bleibt; der Probelauf („Alle Karten üben“) geht weiter.
- **Fällige Karten** (heute/morgen/bis Tag 7) und **Problemkarten** stehen in „Deine Woche“.
- **Kartenstatistik:** Trefferquote pro Karte; knifflige Karten (unter 50 %) kommen bevorzugt, leichte (ab 5 Versuchen 90 %) zuletzt.
- **Melden:** Nach jeder Antwort „Frage unklar oder falsch? Melden“; die Liste (`#/meldungen`) lässt sich kopieren.
- **Einrichtung** mit Intro und Anleitung für iPhone (Kurzbefehle) und Android (MacroDroid, nicht auf einem Gerät getestet).
- Notfall-Skip: 1× pro Tag für alle Apps zusammen, umgeht Limit, Nachtruhe und Bremse, zählt aber als Freischaltung.
- **Willkommensseite** (`#/willkommen`): erklärt neuen Nutzern, was 42 ist, bevor sie die Einrichtung sehen. Sie erscheint nur auf der Startseite, solange `settings.willkommenGesehen` fehlt **und** es noch keine Karten und keine Statistik gibt. Abrufbar bleibt sie über „Was ist 42?“ in der Fußzeile.
- **Impressum und Datenschutz** (`#/impressum`, `#/datenschutz`, Fußzeile): Vorlage in `js/rechtliches.js`. **Vor dem öffentlichen Teilen** dort Name, Anschrift und E-Mail eintragen (`ANBIETER`). Solange Felder leer sind, zeigen die Seiten Platzhalter und einen roten Hinweis, und `npm run bauen` warnt. Keine Rechtsberatung.
- **Inhaltsprüfung:** Alle 53 Decks wurden Karte für Karte auf sachliche Richtigkeit durchgesehen (Okt 2026), zeitabhängige Fakten gegen aktuelle Quellen geprüft; die Zufallsaufgaben sind rechnerisch getestet.
- **Startseite für neue Nutzer** ist jetzt nutzenorientiert (Hero „Mach aus Scroll-Zeit Lern-Zeit“, sechs Vorteile mit ehrlichen Einschränkungen). **Lernseite** `#/lernen` (`js/lernen.js`): fünf Regeln aus der Lernforschung (Spacing, Abfragen, Mischen, Fehler/Feedback, Schlaf), was Gehirnjogging belegt und was nicht, mit Quellenliste. Neue Aussagen dort nur mit Quelle ergänzen (Test prüft, dass jede genannte Studie in `QUELLEN` steht).
- **Neue Alltags-Decks** (7, je 42 Karten, teils Wahr/Falsch und Reihenfolge): Abzocke & Betrugsmaschen erkennen, Job & Arbeitsrecht, Notfall & Vorsorge zu Hause, Verhandeln & Menschenkenntnis, Heimwerken & Reparieren, Behörden, Fristen & Vorsorge, Unterwegs & Reisen. Stand: 60 Decks, 2.520 Karten. Rechtliche und zeitabhängige Angaben (Fristen, Nummern) bei Gelegenheit gegenprüfen.

## Noch offen
- Import aus Link und PDF, Teilen-Funktion als Kurzbefehl
- Karten direkt in der Import-Vorschau bearbeiten (derzeit nach dem Speichern im Deck)
- Decks als Link teilen, Karten neuer Typen (Wahr/Falsch, Reihenfolge) direkt in der App anlegen (derzeit nur per Import)

## Update 7 (2026-10-20)
- Antwort-Hinweise entfernt: Bei 26 Karten begann die richtige Antwort als Einzige mit "Nein" (die falschen mit "Ja") und war damit erratbar. Sie sind jetzt Wahr/Falsch-Karten. Bei rund 240 weiteren Karten begannen die drei falschen Antworten gleich (Weil/Man/Sie/Ein/Eine/Der/Die …) und die richtige anders; Anfänge wurden angeglichen oder variiert, bei Artikeln wurde der Artikel weggelassen.
- Neuer Test in `test/decks.test.js` (pro Deck): fällt durch, wenn die richtige Antwort das einzige Ja/Nein-Gegenteil ist oder wenn alle drei falschen Antworten mit demselben Wort beginnen. Stand: 450 Tests grün.
- Noch offen (schwächerer Hinweis): bei rund 300 Karten enthalten mehrere falsche Antworten Absolutwörter wie "immer", "nie", "nur", "ausschließlich", die richtige nicht.

## Update 8 (2026-10-20)
- Landingpage "Was ist 42?" gekürzt (4 statt 6 Vorteile, kompaktere Abschnitte) und sprachlich bereinigt.
- Bibliothek: Suchfeld, Kategorie-Filter (Chips mit Anzahl), kompaktere Deck-Einträge mit Badge "✓ Drin" für bereits hinzugefügte Decks, Kategorie-Überschriften mit Anzahl.

## Update 9 (2026-10-20)
- Neuer Look im Apple-Stil: helles Grau als Hintergrund, weiße Karten mit weichem Schatten und großen Rundungen, ein Akzent (iOS-Blau) statt Blau-Gelb, große fette Titel, Glas-Kopfleiste mit Unschärfe, getönte Zweitknöpfe, Eingabefelder ohne Rahmen, Druck-Animation auf Knöpfen, Dunkelmodus in echtem Schwarz.
- Neues App-Icon (blau-violetter Verlauf, weiße 42), Statusleistenfarbe passend zu Hell/Dunkel. Altes Icon und altes CSS liegen unter /tmp/lg (nicht im Projekt).
- Bibliothek: Kategorie-Chips als waagerecht wischbare Zeile.

## Update 10 (2026-10-20)
- Landingpage und Lernseite: fette Kernsätze stehen jetzt in einer eigenen Zeile, die Erklärung darunter (grau, kleiner). Vorteile mit Symbol-Kachel, saubere Umbrüche (text-wrap balance/pretty).

## Update 11 (2026-10-21)
- Landingpage: neue Hero-Chips (Fit im Kopf / Weniger Doomscrolling / Zufriedener mit deiner Zeit), neutrale Formulierungen ohne Geräte- oder Browserempfehlung, positive Beispiele (Ernährung, Sport, Psychologie, Finanzen …) statt Abzocke/Mietrecht.
- Lernstand pro Deck (`js/core/fortschritt.js`): "sicher" = Box 4–5, "im Lernen", "neu"; Fortschrittsbalken (hell = gesehen, grün = sicher) in der Deck-Liste, Karte "Dein Stand" mit Fehlerquote auf der Deck-Seite, Hinweis "Gemeistert" bei 100 % sicher, Gesamtstand in "Karten pro Box".
- Neu: "Schwachstellen üben" (`#/ueben/schwach` und `#/ueben/schwach/<deck>`): bis zu 10 Karten, die schon falsch waren und noch nicht sicher sind. Fehler setzen sofort zurück; richtige Antworten rücken den Zeitplan nur vor, wenn die Karte fällig ist (`zeitplanSchonen`), damit sich Abstände nicht durch Büffeln in Minuten aufblähen. 459 Tests grün.
- Offen: gemeisterte Decks kommen als Auffüllung weiter vor, wenn nichts fällig ist (Pausieren ist der Weg); automatisches Überspringen wäre ein möglicher nächster Schritt.

## Update 12 (2026-10-21)
- Statistik-Dashboard (`#/statistik`, Logik in `js/core/insights.js`): Zeitraum 7/30/90 Tage, Kacheln (Antworten, Richtig-Quote, App-Zugriffe, „Doch nicht geöffnet“) mit Vergleich zum Zeitraum davor, Serie und längste Serie, automatische „Auffälligkeiten“ (Quote-Trend, meistgenutzte App, Stoßzeit, stärkster Wochentag, stärkstes/schwächstes Deck), Verlaufsdiagramm richtig/falsch je Tag (Tippen zeigt Tagesdetails inkl. Apps), Zugriffe je App, Wochentage, Uhrzeiten, Quote je Deck, Lernstand gesamt, knifflige Karten.
- Neu erfasst: Freischaltungen nach Uhrzeit (`u` pro Tag, optional, abwärtskompatibel). Gilt erst ab diesem Update, ältere Tage haben keine Uhrzeit.
- 471 Tests grün.

## Update 13 (2026-11-21)
- Quiz auf kleinen Displays (iPhone 13 mini, 375 × ~629 px): Nach der Antwort bleiben nur die richtige und die gewählte Antwort sichtbar, das Urteil („Richtig!“ / „Leider falsch“) ist eine schlanke Zeile. Die Erklärung steht dadurch ohne Scrollen über der „Weiter“-Leiste. Ragt sie bei sehr langen Texten doch darunter, scrollt `erklaerungSichtbar()` (`js/app.js`) genau so weit, dass sie ganz lesbar ist.
- Gemessen im 375 × 629-Fenster: vorher lag die Erklärung bei 4 Antworten 601–650 px tief (unter der Leiste), jetzt bei 507–559 px.

## Update 14 (2026-11-21)
- Kartenqualität: Deck „Ernährung“ als Muster überarbeitet. Falsche Antworten sind jetzt typische Irrtümer und Verwechslungen aus demselben Feld (z. B. Zitrone statt Paprika bei Vitamin C, Sonnenblumenöl bei Omega-3), gleich lang und gleich gebaut, ohne verräterische Wörter wie „immer“, „nur“, „garantiert“. Einige Fragen fragen jetzt nach Vergleich oder Begründung statt nach Wiedererkennen.
- Deckformat: optionales Feld `vorher` (frühere Fassung der Frage). Beim Aktualisieren wird die alte Karte darüber gefunden und umgeschrieben, Box und Fälligkeit bleiben erhalten, es entstehen keine Dubletten.
- Bibliothek: Knopf „Meine N Decks aktualisieren“ holt alle verbesserten Decks auf einmal.
- KI-Vorlage (`promptVorlage`): Regeln für plausible falsche Antworten ergänzt.
- Messung vor der Überarbeitung (alle Decks): bei 769 von 2.321 Auswahlkarten stehen Absolutwörter nur in den falschen Antworten.

## Update 15 (2026-11-21)
- Auffüllung im Quiz (`js/core/auswahl.js`): Sind zu wenige Karten fällig, kommen zuerst noch nicht sichere Karten, deren Abstand am weitesten abgelaufen ist. Gerade beantwortete Karten mit kurzem Abstand landen hinten, sichere Karten (Box 4–5) nur, wenn sonst nichts übrig ist. Vorher kamen immer die am frühesten fälligen, also oft dieselben gerade geübten Karten.
- Erklärungen kompakter: im Deck „Ernährung“ höchstens 130 Zeichen, auf kleinen Displays 15 px und engere Zeilen.
