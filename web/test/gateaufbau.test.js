import assert from 'node:assert/strict';
import { test } from 'node:test';
import { baueGateKarten, erlaubteQuellen, inNachtruhe, kartenAnzahl, nachtruheGesperrt } from '../js/core/gateaufbau.js';
import { GENERATOREN, istGeneratorId } from '../js/core/generator.js';
import { standardSettings } from '../js/core/models.js';
import { GateSitzung } from '../js/core/sitzung.js';
import { festeUhr } from '../js/core/uhr.js';
import { seeded } from '../js/core/zufall.js';
import { DECK_A, DECK_B, datum, faelligeKarten, karte } from '../testhilfen/helfer.js';

const jetzt = datum(2026, 10, 20, 15, 0);
const ohneReibung = (extra = {}) => standardSettings({ reibung: { an: false, start: 3, schritt: 1, max: 8 }, ...extra });
const gate = (opts) => baueGateKarten({ jetzt, zufall: seeded(1), ...opts });

// --- Kartenzahl ---

test('ohne Reibung gilt "Karten pro Gate"', () => {
  assert.equal(kartenAnzahl(ohneReibung({ kartenProGate: 5 }), jetzt, 0), 5);
  assert.equal(kartenAnzahl(ohneReibung({ kartenProGate: 5 }), jetzt, 7), 5);
});

test('Reibung: Start 3, +1 pro Freischaltung des Tages, höchstens max', () => {
  const s = standardSettings({ reibung: { an: true, start: 3, schritt: 1, max: 8 } });
  assert.deepEqual([0, 1, 2, 5, 6, 20].map((n) => kartenAnzahl(s, jetzt, n)), [3, 4, 5, 8, 8, 8]);
});

test('Reibung: Schritt 2 und Schritt 0', () => {
  assert.equal(kartenAnzahl(standardSettings({ reibung: { an: true, start: 2, schritt: 2, max: 10 } }), jetzt, 3), 8);
  assert.equal(kartenAnzahl(standardSettings({ reibung: { an: true, start: 4, schritt: 0, max: 10 } }), jetzt, 9), 4);
});

test('Kartenzahl ist mindestens 1', () => {
  assert.equal(kartenAnzahl(ohneReibung({ kartenProGate: 0 }), jetzt, 0), 1);
});

// --- Nachtruhe ---

const nacht = (extra = {}) => ({ an: true, von: '22:00', bis: '06:00', modus: 'streng', ...extra });

test('Nachtruhe über Mitternacht (22:00–06:00)', () => {
  assert.equal(inNachtruhe(datum(2026, 10, 20, 21, 59), nacht()), false);
  assert.equal(inNachtruhe(datum(2026, 10, 20, 22, 0), nacht()), true);
  assert.equal(inNachtruhe(datum(2026, 10, 20, 23, 59), nacht()), true);
  assert.equal(inNachtruhe(datum(2026, 10, 21, 0, 0), nacht()), true);
  assert.equal(inNachtruhe(datum(2026, 10, 21, 5, 59), nacht()), true);
  assert.equal(inNachtruhe(datum(2026, 10, 21, 6, 0), nacht()), false);
  assert.equal(inNachtruhe(datum(2026, 10, 21, 12, 0), nacht()), false);
});

test('Nachtruhe am selben Tag (13:00–15:00) und Sonderfälle', () => {
  const mittag = nacht({ von: '13:00', bis: '15:00' });
  assert.equal(inNachtruhe(datum(2026, 10, 20, 13, 0), mittag), true);
  assert.equal(inNachtruhe(datum(2026, 10, 20, 14, 59), mittag), true);
  assert.equal(inNachtruhe(datum(2026, 10, 20, 15, 0), mittag), false);
  assert.equal(inNachtruhe(jetzt, nacht({ an: false })), false);
  assert.equal(inNachtruhe(jetzt, undefined), false);
  assert.equal(inNachtruhe(jetzt, nacht({ von: '10:00', bis: '10:00' })), false);
  assert.equal(inNachtruhe(jetzt, nacht({ von: 'abc' })), false);
});

test('Nachtruhe "streng" verdoppelt die Kartenzahl (höchstens 20)', () => {
  const s = standardSettings({ reibung: { an: false, start: 3, schritt: 1, max: 8 }, kartenProGate: 5, nachtruhe: nacht() });
  assert.equal(kartenAnzahl(s, datum(2026, 10, 20, 23, 0), 0), 10);
  assert.equal(kartenAnzahl(s, datum(2026, 10, 20, 12, 0), 0), 5);
  assert.equal(kartenAnzahl({ ...s, kartenProGate: 15 }, datum(2026, 10, 20, 23, 0), 0), 20);
});

test('Nachtruhe "gesperrt": nur dann gesperrt, wenn aktiv, in der Zeit und im richtigen Modus', () => {
  const gesperrt = nacht({ modus: 'gesperrt' });
  assert.equal(nachtruheGesperrt(datum(2026, 10, 20, 23, 0), gesperrt), true);
  assert.equal(nachtruheGesperrt(datum(2026, 10, 20, 12, 0), gesperrt), false);
  assert.equal(nachtruheGesperrt(datum(2026, 10, 20, 23, 0), nacht()), false);
});

// --- Decks pro App ---

test('ohne Einstellung gelten alle Decks und alle Zufallsaufgaben', () => {
  const q = erlaubteQuellen(standardSettings(), 'Instagram');
  assert.equal(q.deckIds, null);
  assert.equal(q.generatoren.length, GENERATOREN.length);
});

test('Freies Üben (ohne App-Name) nutzt immer alles', () => {
  const s = standardSettings({ appDecks: { Instagram: [DECK_A] } });
  assert.equal(erlaubteQuellen(s, null).deckIds, null);
});

test('App mit eigener Auswahl: nur die angekreuzten Decks und Generatoren', () => {
  const s = standardSettings({ appDecks: { Reddit: [DECK_A, GENERATOREN[0].id] } });
  const q = erlaubteQuellen(s, 'Reddit');
  assert.deepEqual([...q.deckIds], [DECK_A, GENERATOREN[0].id]);
  assert.deepEqual(q.generatoren, [GENERATOREN[0].id]);
});

test('Quiz zieht nur Karten aus den erlaubten Decks', () => {
  const karten = [
    ...Array.from({ length: 10 }, (_, i) => karte(`A${i}`, { deck: DECK_A, faelligAm: datum(2026, 1, 1) })),
    ...Array.from({ length: 10 }, (_, i) => karte(`B${i}`, { deck: DECK_B, faelligAm: datum(2026, 1, 1) })),
  ];
  const s = ohneReibung({ kartenProGate: 5, generatorFragen: 0, appDecks: { Reddit: [DECK_A] } });
  for (let seed = 0; seed < 20; seed++) {
    const gezogen = baueGateKarten({ settings: s, karten, appName: 'Reddit', jetzt, zufall: seeded(seed) });
    assert.equal(gezogen.length, 5);
    assert.ok(gezogen.every((k) => k.deckId === DECK_A));
  }
});

// --- Zufallsaufgaben im Quiz ---

test('Zufallsaufgaben: generatorFragen davon, der Rest aus den Karten', () => {
  const s = ohneReibung({ kartenProGate: 5, generatorFragen: 2 });
  const gezogen = gate({ settings: s, karten: faelligeKarten(30) });
  assert.equal(gezogen.length, 5);
  assert.equal(gezogen.filter((k) => istGeneratorId(k.deckId)).length, 2);
});

test('generatorFragen 0: keine Zufallsaufgaben, solange genug Karten da sind', () => {
  const s = ohneReibung({ kartenProGate: 5, generatorFragen: 0 });
  const gezogen = gate({ settings: s, karten: faelligeKarten(30) });
  assert.equal(gezogen.filter((k) => istGeneratorId(k.deckId)).length, 0);
});

test('zu wenig Karten: Zufallsaufgaben füllen auf, das Quiz hat trotzdem die volle Kartenzahl', () => {
  const s = ohneReibung({ kartenProGate: 5, generatorFragen: 1 });
  const gezogen = gate({ settings: s, karten: faelligeKarten(2) });
  assert.equal(gezogen.length, 5);
  assert.equal(gezogen.filter((k) => istGeneratorId(k.deckId)).length, 3);
});

test('keine Karten: das Quiz besteht nur aus Zufallsaufgaben (kein "Erst Karten anlegen")', () => {
  const s = ohneReibung({ kartenProGate: 4 });
  const gezogen = gate({ settings: s, karten: [] });
  assert.equal(gezogen.length, 4);
  assert.ok(gezogen.every((k) => istGeneratorId(k.deckId)));
});

test('App ohne erlaubten Generator und ohne Karten: leeres Quiz', () => {
  const s = ohneReibung({ appDecks: { X: [DECK_B] } });
  assert.deepEqual(gate({ settings: s, karten: faelligeKarten(3), appName: 'X' }), []);
});

test('mehr Zufallsaufgaben gewünscht als Kartenzahl: Kartenzahl gewinnt', () => {
  const s = ohneReibung({ kartenProGate: 3, generatorFragen: 10 });
  assert.equal(gate({ settings: s, karten: faelligeKarten(30) }).length, 3);
});

test('Zufallsaufgaben werden beim Aufbau nicht doppelt gezogen und sind gemischt einsortiert', () => {
  const s = ohneReibung({ kartenProGate: 6, generatorFragen: 3 });
  const orte = new Set();
  for (let seed = 0; seed < 30; seed++) {
    const g = baueGateKarten({ settings: s, karten: faelligeKarten(30), jetzt, zufall: seeded(seed) });
    assert.equal(new Set(g.map((k) => k.id)).size, 6);
    orte.add(g.findIndex((k) => istGeneratorId(k.deckId)));
  }
  assert.ok(orte.size > 1, 'Position der ersten Zufallsaufgabe sollte variieren');
});

// --- Zusammenspiel mit der Sitzung ---

test('Sitzung mit Zufallsaufgaben (Auswahl und Zahleneingabe) lässt sich durchspielen', () => {
  const uhr = festeUhr(jetzt);
  const s = ohneReibung({ kartenProGate: 5, generatorFragen: 5, eingabeAnteil: 1 });
  const karten = baueGateKarten({ settings: s, karten: [], jetzt, zufall: seeded(9) });
  const sitzung = new GateSitzung({ zielApp: { name: 'X', urlScheme: 'x://' }, gezogeneKarten: karten, uhr, zufall: seeded(2) });
  assert.equal(sitzung.benoetigteRichtige, 5);
  while (sitzung.aktuelleFrage) {
    const f = sitzung.aktuelleFrage;
    assert.ok(f.eingabe, 'bei Anteil 1 wird jede Aufgabe eingetippt');
    sitzung.beantworteZahl(String(f.eingabe.wert).replace('.', ','));
  }
  assert.equal(sitzung.istBestanden, true);
});

test('pausierte Decks kommen in keinem Quiz vor (Karten bleiben erhalten)', async () => {
  const { baueGateKarten } = await import('../js/core/gateaufbau.js');
  const { standardSettings } = await import('../js/core/models.js');
  const { karte, datum, DECK_A, DECK_B } = await import('../testhilfen/helfer.js');
  const a = Array.from({ length: 5 }, (_, i) => karte(`A${i}`, { deck: DECK_A, faelligAm: datum(2026, 1, 1) }));
  const b = Array.from({ length: 5 }, (_, i) => karte(`B${i}`, { deck: DECK_B, faelligAm: datum(2026, 1, 1) }));
  const settings = standardSettings({ generatorFragen: 0, reibung: { an: false, start: 5, schritt: 0, max: 5 }, kartenProGate: 5 });
  const gate = (pausierteDecks) => baueGateKarten({ settings, karten: [...a, ...b], appName: null, jetzt: datum(2026, 10, 20), pausierteDecks });
  assert.ok(gate([DECK_A]).every((k) => k.deckId === DECK_B));
  assert.ok(gate([DECK_B]).every((k) => k.deckId === DECK_A));
  assert.equal(gate([]).length, 5);
  // alle pausiert: es bleiben nur Zufallsaufgaben (die nicht zu einem Deck gehören)
  assert.ok(gate([DECK_A, DECK_B]).every((k) => k.deckId !== DECK_A && k.deckId !== DECK_B));
});

test('pausierte Zufallsaufgaben kommen in keinem Quiz vor', async () => {
  const { erlaubteQuellen, baueGateKarten } = await import('../js/core/gateaufbau.js');
  const { GENERATOREN, istGeneratorId } = await import('../js/core/generator.js');
  const { standardSettings } = await import('../js/core/models.js');
  const [prozent, wirtschaft] = GENERATOREN.map((g) => g.id);
  const s = standardSettings({ pausierteGeneratoren: [prozent] });
  assert.deepEqual(erlaubteQuellen(s, 'X').generatoren, [wirtschaft]);
  // auch bei Auswahl pro App
  const mitAuswahl = standardSettings({ pausierteGeneratoren: [prozent], appDecks: { X: [prozent, wirtschaft] } });
  assert.deepEqual(erlaubteQuellen(mitAuswahl, 'X').generatoren, [wirtschaft]);
  const alle = standardSettings({ pausierteGeneratoren: [prozent, wirtschaft], generatorFragen: 5 });
  assert.deepEqual(erlaubteQuellen(alle, 'X').generatoren, []);
  const gate = baueGateKarten({ settings: standardSettings({ pausierteGeneratoren: [prozent], generatorFragen: 5 }), karten: [], appName: 'X', jetzt: datum(2026, 10, 20), anzahl: 5 });
  assert.equal(gate.length, 5);
  assert.ok(gate.every((k) => k.deckId === wirtschaft && istGeneratorId(k.deckId)));
});
