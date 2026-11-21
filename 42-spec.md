# 42 (früher Lern-Gate) – Spezifikation (Prototyp A)

## Ziel
iPhone-App (SwiftUI, nur privat). Vor dem Öffnen ausgewählter Social-Media-Apps (Instagram, Reddit) muss der Nutzer 5 Multiple-Choice-Karteikarten richtig beantworten. Danach ist die Ziel-App 15 Minuten freigeschaltet. Karten lassen sich manuell anlegen oder per KI aus Text, PDF und Link erzeugen.

## Rahmen
- Zielgerät: iPhone 13 mini, aktuelles iOS. Gebaut auf MacBook M4 mit aktuellem Xcode.
- Swift + SwiftUI, SwiftData für Persistenz, keine Fremdbibliotheken wenn vermeidbar.
- Signierung mit kostenlosem Apple-Account (Personal Team). Läuft 7 Tage, dann neu installieren.
- Sprache der App: Deutsch.
- Kein eigenes Backend. KI-Aufrufe direkt aus der App an die Claude API, API-Key im Keychain, Eingabe in den Einstellungen.
- Android, YouTube-Import und Screen-Time-API (Variante B) sind NICHT Teil dieses Prototyps.

## Datenmodell
- Deck: id, name, Erstelldatum
- Card: id, deckId, frage, antworten[4], indexRichtig, Leitner-Box (1–5), fälligAm, Quelle (optional)
- Settings: Freischaltdauer (Standard 15 min), Karten pro Gate (Standard 5), freigeschaltetBis (Datum), notfallSkipLetzterTag (Datum)

## Gate-Logik
1. Quiz wird für eine Ziel-App gestartet (Parameter, z. B. Instagram).
2. Es werden 5 fällige Karten gezogen, gemischt aus allen Decks. Niedrige Leitner-Box und überfällige Karten zuerst.
3. Pro Karte: Frage, 4 Antworten (Reihenfolge zufällig). Nach Antwort sofort Feedback mit richtiger Lösung.
4. Falsche Antwort: Karte rutscht in Box 1 und wird später im selben Gate erneut gestellt. Das Gate gilt erst als bestanden, wenn 5 Antworten richtig waren.
5. Richtige Antwort: Karte steigt eine Box auf (Leitner-Intervalle: 1, 2, 4, 8, 16 Tage).
6. Bestanden: freigeschaltetBis = jetzt + 15 min. Die Ziel-App wird per URL-Scheme geöffnet (instagram://, reddit://). Ziel-Apps und URL-Schemes sind in den Einstellungen konfigurierbar.
7. Notfall-Skip: Button im Quiz, 1× pro Kalendertag. Setzt freigeschaltetBis wie ein bestandenes Gate und öffnet die Ziel-App. Zeigt „heute noch 1 Skip" bzw. „heute verbraucht".
8. Sind weniger als 5 Karten vorhanden, wird mit den vorhandenen Karten gespielt. Bei 0 Karten Hinweis „Erst Karten anlegen" und Notfall-Skip erlaubt.

## App Intents (für Kurzbefehle)
- `IstFreigeschaltet` → Bool (true, wenn jetzt < freigeschaltetBis). Läuft ohne die App in den Vordergrund zu holen.
- `QuizStarten(app: Zielapp)` → öffnet die App direkt im Quiz für die gewählte Ziel-App.

## Einrichtung der Automation (muss die App als Anleitung anzeigen)
Je Ziel-App eine persönliche Automation: Auslöser „App ist geöffnet" → „Sofort ausführen" → Kurzbefehl: Wenn `IstFreigeschaltet` = nein → `QuizStarten(app)`. Die App enthält einen Bildschirm „Einrichtung" mit dieser Schritt-für-Schritt-Anleitung.

## Karten-Import
- Share Extension: Text, PDF und URL aus dem Teilen-Menü an die App senden, Deck auswählen oder neu anlegen.
- Pipeline: URL → Seitentext laden und bereinigen; PDF → Text mit PDFKit; Text → an Claude API.
- Prompt: pro Quelle 10–20 Karten, strikt JSON (Frage, 4 Antworten, Index der richtigen, kurze Erklärung). Falschantworten plausibel, aber eindeutig falsch. Deutsch.
- Vorschau-Liste vor dem Speichern: Karten einzeln abwählen oder bearbeiten.
- Lange Texte in Abschnitte teilen und je Abschnitt separat anfragen. Fehlerbehandlung bei Netzfehler und ungültigem JSON.

## Manuelle Karten
Deck-Verwaltung, Karte anlegen/bearbeiten/löschen (Frage + 4 Antworten + richtige markieren).

## Bildschirme
Start (Decks, Statistik: Karten pro Box), Deck-Detail, Karte bearbeiten, Import-Vorschau, Quiz, Einstellungen (API-Key, Dauer, Karten pro Gate, Ziel-Apps), Einrichtung.

## Abnahmekriterien
- Instagram öffnen → Quiz erscheint; 5 richtig → Instagram öffnet, bleibt 15 min frei ohne erneutes Quiz.
- Nach 15 min erscheint beim nächsten Öffnen wieder das Quiz.
- Notfall-Skip nur 1× pro Tag.
- Teilen einer Webseite und einer PDF erzeugt Karten, die vor dem Speichern bearbeitbar sind.

## Reihenfolge der Umsetzung
1. Datenmodell, Deck/Karten manuell, Quiz-Logik, Leitner.
2. App Intents + Freischaltung + Notfall-Skip + Einrichtungsanleitung. Mit echten Automationen testen.
3. KI-Import (Text), dann URL, dann PDF, dann Share Extension.
4. Feinschliff.
