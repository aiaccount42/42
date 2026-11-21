import assert from 'node:assert/strict';
import { test } from 'node:test';
import { istGueltig, neueId, neueKarte, neuesDeck, standardSettings } from '../js/core/models.js';
import { SCHLUESSEL, exportJson, importJson, laden, leereDaten, speichern } from '../js/storage.js';
import { datum } from '../testhilfen/helfer.js';

function fakeSpeicher(start = {}) {
  const daten = new Map(Object.entries(start));
  return {
    getItem: (k) => (daten.has(k) ? daten.get(k) : null),
    setItem: (k, v) => void daten.set(k, String(v)),
    daten,
  };
}

function beispiel() {
  const deck = neuesDeck({ name: 'Biologie', erstelltAm: datum(2026, 10, 19) });
  const karte = neueKarte({
    deckId: deck.id,
    frage: 'Hauptstadt von Frankreich?',
    antworten: ['Lyon', 'Paris', 'Nizza', 'Lille'],
    indexRichtig: 1,
    box: 3,
    faelligAm: datum(2026, 10, 25),
    quelle: 'https://example.com',
  });
  const settings = standardSettings({ freischaltdauerMinuten: 20, freischaltungen: { Instagram: datum(2026, 10, 19, 12, 15), Reddit: datum(2026, 10, 19, 12, 30) } });
  return { version: 1, decks: [deck], cards: [karte], settings, tage: {}, wuensche: [], meldungen: [] };
}

test('leerer Speicher → leere Daten mit Standardeinstellungen', () => {
  assert.deepEqual(laden(fakeSpeicher()), leereDaten());
});

test('speichern und laden ergibt dieselben Daten (Roundtrip)', () => {
  const speicher = fakeSpeicher();
  const daten = beispiel();
  speichern(speicher, daten);
  assert.deepEqual(laden(speicher), daten);
});

test('Export und Import ergeben dieselben Daten', () => {
  const daten = beispiel();
  assert.deepEqual(importJson(exportJson(daten)), daten);
});

test('kaputter Speicher: leere Daten, Original wird unter .defekt aufgehoben', () => {
  const speicher = fakeSpeicher({ [SCHLUESSEL]: '{kaputt' });
  assert.deepEqual(laden(speicher), leereDaten());
  assert.equal(speicher.getItem(`${SCHLUESSEL}.defekt`), '{kaputt');
});

test('fehlende Settings-Felder werden mit Standardwerten ergänzt', () => {
  const daten = importJson(JSON.stringify({ decks: [], cards: [], settings: { kartenProGate: 7 } }));
  assert.equal(daten.settings.kartenProGate, 7);
  assert.equal(daten.settings.freischaltdauerMinuten, 15);
  assert.deepEqual(daten.settings.zielApps.map((a) => a.name), ['Instagram', 'Reddit']);
});

test('Karten ohne existierendes Deck und kaputte Einträge entfallen', () => {
  const deck = { id: 'd1', name: 'D', erstelltAm: 1 };
  const gut = { id: 'k1', deckId: 'd1', frage: 'F', antworten: ['a', 'b', 'c', 'd'], indexRichtig: 0, box: 2, faelligAm: 5 };
  const verwaist = { ...gut, id: 'k2', deckId: 'gibt-es-nicht' };
  const daten = importJson(JSON.stringify({ decks: [deck, 42, { id: 1 }], cards: [gut, verwaist, null, 'x'] }));
  assert.equal(daten.decks.length, 1);
  assert.deepEqual(daten.cards.map((k) => k.id), ['k1']);
});

test('ungültige Box wird beim Import begrenzt', () => {
  const deck = { id: 'd1', name: 'D', erstelltAm: 1 };
  const k = { id: 'k1', deckId: 'd1', frage: 'F', antworten: ['a', 'b', 'c', 'd'], indexRichtig: 0, box: 99, faelligAm: 5 };
  assert.equal(importJson(JSON.stringify({ decks: [deck], cards: [k] })).cards[0].box, 5);
});

test('Import wirft bei ungültigem JSON und fremdem Format', () => {
  assert.throws(() => importJson('nein'));
  assert.throws(() => importJson('[]'));
  assert.throws(() => importJson('null'));
});

test('Karten-Gültigkeit', () => {
  const gut = neueKarte({ deckId: 'd', frage: 'F', antworten: ['a', 'b', 'c', 'd'], indexRichtig: 0 });
  assert.equal(istGueltig(gut), true);
  assert.equal(istGueltig({ ...gut, antworten: ['a', 'b', ' ', 'd'] }), false);
  assert.equal(istGueltig({ ...gut, antworten: [...gut.antworten, 'e'] }), false);
  assert.equal(istGueltig({ ...gut, indexRichtig: -1 }), false);
  assert.equal(istGueltig({ ...gut, indexRichtig: 1.5 }), false);
  assert.equal(istGueltig({ ...gut, frage: '   ' }), false);
});

test('neueId liefert eindeutige UUIDs ohne crypto.randomUUID', () => {
  const ids = new Set(Array.from({ length: 200 }, neueId));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('alte gemeinsame Freischaltung (freigeschaltetBis) wird verworfen, nichts bleibt frei', () => {
  const daten = importJson(JSON.stringify({ decks: [], cards: [], settings: { freigeschaltetBis: Date.now() + 600_000 } }));
  assert.deepEqual(daten.settings.freischaltungen, {});
  assert.equal('freigeschaltetBis' in daten.settings, false);
});

test('kaputte Einträge bei den Freischaltungen entfallen', () => {
  const daten = importJson(
    JSON.stringify({ decks: [], cards: [], settings: { freischaltungen: { Instagram: 123, Reddit: 'bald', WhatsApp: null } } }),
  );
  assert.deepEqual(daten.settings.freischaltungen, { Instagram: 123 });
});

// --- neue Einstellungen und Daten ---

test('alte Daten ohne neue Felder bekommen sinnvolle Standardwerte', () => {
  const daten = importJson(JSON.stringify({ decks: [], cards: [], settings: { kartenProGate: 5, zielApps: [{ name: 'Reddit', urlScheme: 'reddit://' }] } }));
  const s = daten.settings;
  assert.deepEqual(s.reibung, { an: true, start: 3, schritt: 1, max: 8 });
  assert.deepEqual(s.nachtruhe, { an: false, von: '22:00', bis: '06:00', modus: 'streng' });
  assert.equal(s.generatorFragen, 2);
  assert.equal(s.eingabeAnteil, 0.5);
  assert.equal(s.tagesziel, 20);
  assert.equal(s.kaufbremseStunden, 24);
  assert.equal(s.letztesBackup, null);
  assert.deepEqual(s.appDecks, {});
  assert.deepEqual(daten.tage, {});
  assert.deepEqual(daten.wuensche, []);
});

test('Ziel-Apps behalten Bremse und Tageslimit, ungültige Werte entfallen', () => {
  const daten = importJson(
    JSON.stringify({
      decks: [], cards: [],
      settings: { zielApps: [
        { name: 'mydealz', urlScheme: 'mydealz://', bremse: 'kauf', tageslimit: 3 },
        { name: 'Reddit', urlScheme: 'reddit://', bremse: 'quatsch', tageslimit: -1 },
        { name: 'X', urlScheme: 'x://', tageslimit: 500 },
      ] },
    }),
  );
  assert.deepEqual(daten.settings.zielApps[0], { name: 'mydealz', urlScheme: 'mydealz://', bremse: 'kauf', tageslimit: 3 });
  assert.deepEqual(daten.settings.zielApps[1], { name: 'Reddit', urlScheme: 'reddit://' });
  assert.equal(daten.settings.zielApps[2].tageslimit, 99);
});

test('Einstellungen werden auf gültige Bereiche begrenzt', () => {
  const s = importJson(
    JSON.stringify({
      decks: [], cards: [],
      settings: {
        reibung: { an: 'ja', start: 99, schritt: -4, max: 2 },
        nachtruhe: { an: true, von: '25:00', bis: '6:00', modus: 'wild' },
        generatorFragen: 99, eingabeAnteil: 7, tagesziel: 0, kaufbremseStunden: 9999,
      },
    }),
  ).settings;
  assert.deepEqual(s.reibung, { an: true, start: 20, schritt: 0, max: 20 });
  assert.deepEqual(s.nachtruhe, { an: true, von: '22:00', bis: '06:00', modus: 'streng' });
  assert.equal(s.generatorFragen, 20);
  assert.equal(s.eingabeAnteil, 1);
  assert.equal(s.tagesziel, 1);
  assert.equal(s.kaufbremseStunden, 168);
});

test('Decks pro App: leere und kaputte Listen entfallen', () => {
  const s = importJson(JSON.stringify({ decks: [], cards: [], settings: { appDecks: { A: ['d1', 'gen:prozentrechnen'], B: [], C: 'x', D: [1, 2] } } })).settings;
  assert.deepEqual(s.appDecks, { A: ['d1', 'gen:prozentrechnen'] });
});

test('Tageszähler werden bereinigt: falsche Schlüssel und unmögliche Zahlen entfallen', () => {
  const heute = new Date();
  const key = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, '0')}-${String(heute.getDate()).padStart(2, '0')}`;
  const daten = importJson(
    JSON.stringify({
      decks: [], cards: [],
      tage: {
        [key]: { a: 5, r: 9, q: 1, s: 0, f: { Reddit: 2, X: 0, Y: 'a' }, d: { d1: [4, 7], d2: 'x' } },
        'kein-datum': { a: 1 },
        '2000-01-01': { a: 1, r: 1, q: 0, s: 0, f: {}, d: {} },
      },
    }),
  );
  assert.deepEqual(Object.keys(daten.tage), [key]);
  assert.equal(daten.tage[key].r, 5, 'richtig kann nicht größer als gesamt sein');
  assert.deepEqual(daten.tage[key].f, { Reddit: 2 });
  assert.deepEqual(daten.tage[key].d, { d1: [4, 4] });
});

test('Wünsche: Roundtrip, kaputte Einträge entfallen, unbekannter Status wird "wartet"', () => {
  const gut = { id: 'w1', text: 'Kopfhörer', erstelltAm: 1, reifAm: 2, status: 'gekauft', erledigtAm: 3 };
  const daten = importJson(
    JSON.stringify({
      decks: [], cards: [],
      wuensche: [gut, { id: 'w2', text: 'Maus', erstelltAm: 1, reifAm: 2, status: '???' }, { id: 'w3', text: '  ', erstelltAm: 1, reifAm: 2 }, 'x', { id: 'w4' }],
    }),
  );
  assert.deepEqual(daten.wuensche, [gut, { id: 'w2', text: 'Maus', erstelltAm: 1, reifAm: 2, status: 'wartet' }]);
});

test('Zufallsaufgaben-Karten (gen:…) werden nie gespeichert, auch wenn sie in cards auftauchen', () => {
  const daten = importJson(JSON.stringify({ decks: [], cards: [{ id: 'gen-1', deckId: 'gen:prozentrechnen', frage: 'F', antworten: ['a', 'b', 'c', 'd'], indexRichtig: 0 }] }));
  assert.equal(daten.cards.length, 0);
});

test('neue Felder: Kartentyp, Versuche, Meldungen und „nicht geöffnet“ überleben Speichern und Laden', () => {
  const daten = beispiel();
  const reihenfolge = neueKarte({ deckId: daten.decks[0].id, typ: 'reihenfolge', frage: 'Ordne:', antworten: ['A', 'B', 'C'], indexRichtig: 0, versuche: 4, treffer: 3 });
  daten.cards.push(reihenfolge);
  daten.meldungen = [{ id: 'biologie|frage?', deck: 'Biologie', frage: 'Frage?', antwort: 'Antwort', erstelltAm: datum(2026, 10, 19) }];
  daten.tage['2026-10-19'] = { a: 2, r: 1, q: 1, s: 0, n: 3, f: {}, d: {} };
  const zurueck = importJson(exportJson(daten));
  assert.deepEqual(zurueck, daten);
  assert.equal(zurueck.cards[1].typ, 'reihenfolge');
  assert.equal(zurueck.tage['2026-10-19'].n, 3);
});

test('alte Daten ohne neue Felder: Karten werden zu Auswahlfragen ohne Versuche, keine Meldungen', () => {
  const daten = importJson(
    JSON.stringify({ decks: [{ id: 'd', name: 'D' }], cards: [{ id: 'k', deckId: 'd', frage: 'F?', antworten: ['a', 'b', 'c', 'd'], indexRichtig: 2 }], tage: { '2026-10-19': { a: 1, r: 1, q: 0, s: 0, f: {}, d: {} } } }),
  );
  assert.equal(daten.cards[0].typ, 'auswahl');
  assert.equal(daten.cards[0].versuche, 0);
  assert.deepEqual(daten.meldungen, []);
  assert.equal(daten.tage['2026-10-19'].n, 0);
});

test('kaputte Meldungen entfallen, doppelte werden zusammengeführt', () => {
  const daten = importJson(JSON.stringify({ meldungen: [{ deck: 'D', frage: 'F?', antwort: 'A' }, { deck: 'D', frage: ' f? ', antwort: 'A' }, { deck: '', frage: 'x' }, 7, null] }));
  assert.equal(daten.meldungen.length, 1);
});

test('Lernmodus-Felder: Abstand, Faktor, Modus und neue Karten pro Quiz werden gespeichert und begrenzt', () => {
  const daten = beispiel();
  daten.cards[0] = { ...daten.cards[0], intervall: 12, ease: 2.7 };
  daten.settings.lernmodus = 'einfach';
  daten.settings.neueProQuiz = 4;
  const zurueck = importJson(exportJson(daten));
  assert.deepEqual(zurueck, daten);
  assert.equal(zurueck.cards[0].intervall, 12);
  const grenzen = importJson(JSON.stringify({ decks: [{ id: 'd', name: 'D' }], cards: [{ id: 'k', deckId: 'd', frage: 'F?', antworten: ['a', 'b', 'c', 'd'], indexRichtig: 0, intervall: 9999, ease: 99 }], settings: { lernmodus: 'quatsch', neueProQuiz: 99 } }));
  assert.equal(grenzen.cards[0].intervall, 365);
  assert.equal(grenzen.cards[0].ease, 3);
  assert.equal(grenzen.settings.lernmodus, 'intelligent');
  assert.equal(grenzen.settings.neueProQuiz, 10);
});

test('Deck-Pause wird gespeichert; ältere Decks sind nicht pausiert', () => {
  const daten = beispiel();
  daten.decks[0] = { ...daten.decks[0], pausiert: true };
  assert.equal(importJson(exportJson(daten)).decks[0].pausiert, true);
  const alt = importJson(JSON.stringify({ decks: [{ id: 'd', name: 'D' }, { id: 'e', name: 'E', pausiert: 'ja' }] }));
  assert.deepEqual(alt.decks.map((d) => d.pausiert), [false, false]);
});

test('pausierte Zufallsaufgaben: nur bekannte Ids, ohne Doppelte', () => {
  const id = 'gen:prozentrechnen';
  const d = importJson(JSON.stringify({ settings: { pausierteGeneratoren: [id, id, 'gen:quatsch', 5] } }));
  assert.deepEqual(d.settings.pausierteGeneratoren, [id]);
  assert.deepEqual(importJson('{}').settings.pausierteGeneratoren, []);
});

test('Begrüßung: willkommenGesehen ist standardmäßig aus, wird gespeichert und bei kaputten Werten ignoriert', () => {
  assert.equal(standardSettings().willkommenGesehen, false);
  const speicher = fakeSpeicher();
  const daten = beispiel();
  daten.settings.willkommenGesehen = true;
  speichern(speicher, daten);
  assert.equal(laden(speicher).settings.willkommenGesehen, true);

  daten.settings.willkommenGesehen = 'ja';
  const kaputt = fakeSpeicher({ [SCHLUESSEL]: JSON.stringify(daten) });
  assert.equal(laden(kaputt).settings.willkommenGesehen, false);
});
