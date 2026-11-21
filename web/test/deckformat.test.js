import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DECK_FORMAT, DeckFormatFehler, mergeImport, normFrage, parseDeck, promptVorlage } from '../js/core/deckformat.js';
import { istGueltig } from '../js/core/models.js';
import { richtigBeantwortet } from '../js/core/leitner.js';
import { GateSitzung } from '../js/core/sitzung.js';
import { leereDaten } from '../js/storage.js';
import { seeded } from '../js/core/zufall.js';

const karte = (frage, extra = {}) => ({ frage, richtig: 'R', falsch: ['A', 'B', 'C'], ...extra });
const deckText = (karten, extra = {}) => JSON.stringify({ format: DECK_FORMAT, name: 'Testdeck', karten, ...extra });

// --- parseDeck ---

test('gültiges Deck wird gelesen; richtige Antwort steht vorn (Index 0)', () => {
  const d = parseDeck(deckText([karte('Frage 1?', { erklaerung: 'Darum.', quelle: 'Buch' })]));
  assert.equal(d.name, 'Testdeck');
  assert.equal(d.karten.length, 1);
  const k = d.karten[0];
  assert.deepEqual(k.antworten, ['R', 'A', 'B', 'C']);
  assert.equal(k.indexRichtig, 0);
  assert.equal(k.erklaerung, 'Darum.');
  assert.equal(k.quelle, 'Buch');
  assert.equal(k.fehler, null);
});

test('Text vor/nach dem JSON und ```json-Zäune werden toleriert', () => {
  const eingabe = `Klar, hier ist dein Deck:\n\`\`\`json\n${deckText([karte('F?')])}\n\`\`\`\nViel Erfolg!`;
  assert.equal(parseDeck(eingabe).karten.length, 1);
});

test('Format-Feld ist optional, ein fremdes Format wird abgelehnt', () => {
  assert.equal(parseDeck(JSON.stringify({ name: 'X', karten: [karte('F?')] })).karten.length, 1);
  assert.throws(() => parseDeck(JSON.stringify({ format: 'anki', karten: [karte('F?')] })), DeckFormatFehler);
});

test('Name fehlt → Standardname; Leerraum wird entfernt', () => {
  const d = parseDeck(JSON.stringify({ karten: [{ frage: '  F?  ', richtig: ' R ', falsch: [' A', 'B ', ' C '] }] }));
  assert.equal(d.name, 'Importiertes Deck');
  assert.deepEqual(d.karten[0].antworten, ['R', 'A', 'B', 'C']);
  assert.equal(d.karten[0].frage, 'F?');
});

test('nicht lesbare Eingaben werfen verständliche Fehler', () => {
  assert.throws(() => parseDeck(''), DeckFormatFehler);
  assert.throws(() => parseDeck('hallo welt'), DeckFormatFehler);
  assert.throws(() => parseDeck('{kaputt: }'), /fehlerhaft/);
  assert.throws(() => parseDeck('{"karten": []}'), /keine Karten/);
  assert.throws(() => parseDeck('{"name": "X"}'), /keine Karten/);
  assert.throws(() => parseDeck(null), DeckFormatFehler);
});

test('kaputte Einzelkarten werden markiert, nicht verworfen', () => {
  const d = parseDeck(
    deckText([
      karte('ok?'),
      { richtig: 'R', falsch: ['A', 'B', 'C'] },
      { frage: 'ohne richtig?', falsch: ['A', 'B', 'C'] },
      { frage: 'zwei falsche?', richtig: 'R', falsch: ['A', 'B'] },
      { frage: 'leere falsche?', richtig: 'R', falsch: ['A', '', 'C'] },
      { frage: 'gleiche?', richtig: 'R', falsch: ['r', 'B', 'C'] },
      'kein objekt',
      karte('ok?'),
    ]),
  );
  assert.deepEqual(
    d.karten.map((k) => k.fehler !== null),
    [false, true, true, true, true, true, true, true],
  );
  assert.match(d.karten[1].fehler, /Frage fehlt/);
  assert.match(d.karten[2].fehler, /richtige Antwort fehlt/);
  assert.match(d.karten[3].fehler, /3 falsche/);
  assert.match(d.karten[5].fehler, /gleich/);
  assert.match(d.karten[7].fehler, /doppelt/);
});

test('geparste gültige Karten sind als Spielkarten gültig', () => {
  const d = parseDeck(deckText([karte('F?')]));
  assert.equal(istGueltig({ ...d.karten[0] }), true);
});

test('Prompt-Vorlage nennt das Format und lässt sich selbst als Deck-Beispiel nicht fehlinterpretieren', () => {
  const p = promptVorlage();
  assert.ok(p.includes(DECK_FORMAT));
  assert.ok(p.includes('"falsch"'));
});

// --- mergeImport ---

const gueltige = (...fragen) => parseDeck(deckText(fragen.map((f) => karte(f)))).karten;

test('neues Deck und neue Karten werden angelegt, sofort fällig', () => {
  const jetzt = 1_000_000;
  const r = mergeImport(leereDaten(), 'Neu', gueltige('F1?', 'F2?'), jetzt);
  assert.equal(r.daten.decks.length, 1);
  assert.equal(r.daten.decks[0].name, 'Neu');
  assert.equal(r.hinzugefuegt, 2);
  assert.equal(r.daten.cards.length, 2);
  assert.ok(r.daten.cards.every((k) => k.deckId === r.deck.id && k.box === 1 && k.faelligAm === jetzt));
  assert.ok(r.daten.cards.every(istGueltig));
});

test('Original-Daten bleiben unverändert', () => {
  const daten = leereDaten();
  mergeImport(daten, 'Neu', gueltige('F1?'));
  assert.equal(daten.decks.length, 0);
  assert.equal(daten.cards.length, 0);
});

test('Import in bestehendes Deck (Name egal in Groß-/Kleinschreibung) legt kein zweites Deck an', () => {
  const erst = mergeImport(leereDaten(), 'Biologie', gueltige('F1?'));
  const zweit = mergeImport(erst.daten, '  biologie ', gueltige('F2?'));
  assert.equal(zweit.daten.decks.length, 1);
  assert.equal(zweit.daten.cards.length, 2);
  assert.equal(zweit.deck.id, erst.deck.id);
});

test('erneuter Import derselben Karten erzeugt keine Dubletten', () => {
  const karten = gueltige('F1?', 'F2?', 'F3?');
  const erst = mergeImport(leereDaten(), 'D', karten);
  const zweit = mergeImport(erst.daten, 'D', karten);
  assert.equal(zweit.daten.cards.length, 3);
  assert.equal(zweit.hinzugefuegt, 0);
  assert.equal(zweit.aktualisiert, 0);
  assert.equal(zweit.uebersprungen, 3);
});

test('gleiche Frage mit anderem Text wird aktualisiert, Lernfortschritt bleibt', () => {
  const erst = mergeImport(leereDaten(), 'D', gueltige('Frage?'), 1000);
  const fortgeschritten = richtigBeantwortet(erst.daten.cards[0], 5000);
  const daten = { ...erst.daten, cards: [fortgeschritten] };

  const neu = parseDeck(deckText([{ frage: '  FRAGE?  ', richtig: 'Neu', falsch: ['x', 'y', 'z'], erklaerung: 'E' }])).karten;
  const r = mergeImport(daten, 'D', neu, 9000);

  assert.equal(r.daten.cards.length, 1);
  assert.equal(r.aktualisiert, 1);
  const k = r.daten.cards[0];
  assert.equal(k.id, fortgeschritten.id);
  assert.equal(k.box, fortgeschritten.box);
  assert.equal(k.faelligAm, fortgeschritten.faelligAm);
  assert.deepEqual(k.antworten, ['Neu', 'x', 'y', 'z']);
  assert.equal(k.erklaerung, 'E');
});

test('umformulierte Frage mit "vorher" ersetzt die alte Karte, Lernfortschritt bleibt', () => {
  const erst = mergeImport(leereDaten(), 'D', gueltige('Alte Frage?', 'Andere?'), 1000);
  const alt = richtigBeantwortet(erst.daten.cards[0], 5000);
  const daten = { ...erst.daten, cards: [alt, erst.daten.cards[1]] };

  const neu = parseDeck(deckText([karte('Neue Frage?', { vorher: 'alte frage?' }), karte('Noch eine?', { vorher: ['Gibt es nicht?'] })])).karten;
  assert.deepEqual(neu[0].vorher, ['alte frage?']);
  const r = mergeImport(daten, 'D', neu, 9000);

  assert.equal(r.aktualisiert, 1);
  assert.equal(r.hinzugefuegt, 1);
  assert.equal(r.daten.cards.length, 4 - 1);
  const k = r.daten.cards.find((c) => c.id === alt.id);
  assert.equal(k.frage, 'Neue Frage?');
  assert.equal(k.box, alt.box);
  assert.equal(k.faelligAm, alt.faelligAm);
});

test('"vorher" fehlt oder ist leer: leere Liste', () => {
  const [a, b] = parseDeck(deckText([karte('A?'), karte('B?', { vorher: ['  ', 3] })])).karten;
  assert.deepEqual(a.vorher, []);
  assert.deepEqual(b.vorher, []);
});

test('gleiche Frage in anderem Deck ist eine andere Karte', () => {
  const a = mergeImport(leereDaten(), 'A', gueltige('Frage?'));
  const b = mergeImport(a.daten, 'B', gueltige('Frage?'));
  assert.equal(b.daten.cards.length, 2);
  assert.equal(b.daten.decks.length, 2);
});

test('normFrage ignoriert Groß-/Kleinschreibung und mehrfachen Leerraum', () => {
  assert.equal(normFrage('  Was   ist\nX? '), normFrage('was ist x?'));
});

// --- Erklärung im Quiz ---

test('Erklärung wird in der Quizfrage mitgeliefert', () => {
  const d = parseDeck(deckText([karte('F?', { erklaerung: 'Darum.' }), karte('G?')]));
  const { daten } = mergeImport(leereDaten(), 'D', d.karten);
  const s = new GateSitzung({ zielApp: { name: 'X', urlScheme: 'x://' }, gezogeneKarten: daten.cards, zufall: seeded(1) });
  const frage = s.aktuelleFrage;
  assert.equal(frage.erklaerung, frage.frage === 'F?' ? 'Darum.' : null);
  assert.equal(frage.antworten[frage.indexRichtig], 'R');
});
