import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ziehen } from '../js/core/auswahl.js';
import { seeded } from '../js/core/zufall.js';
import { DECK_A, DECK_B, TAG, datum, faelligeKarten, karte } from '../testhilfen/helfer.js';

const jetzt = datum(2026, 10, 19, 12, 0);
const vergangen = (tage) => jetzt - tage * TAG;
const zieh = (karten, anzahl = 5, seed = 42) => ziehen(karten, anzahl, jetzt, seeded(seed));

test('0 Karten → leere Auswahl', () => {
  assert.deepEqual(zieh([]), []);
});

test('weniger als 5 Karten: alle werden gezogen', () => {
  const karten = faelligeKarten(3);
  const gezogen = zieh(karten);
  assert.equal(gezogen.length, 3);
  assert.deepEqual(new Set(gezogen.map((k) => k.id)), new Set(karten.map((k) => k.id)));
});

test('genau 5 Karten', () => {
  assert.equal(zieh(faelligeKarten(5)).length, 5);
});

test('mehr als 5 Karten: genau 5, ohne Duplikate', () => {
  const gezogen = zieh(faelligeKarten(20));
  assert.equal(gezogen.length, 5);
  assert.equal(new Set(gezogen.map((k) => k.id)).size, 5);
});

test('Anzahl 0, negativ oder ungültig → leere Auswahl', () => {
  const karten = faelligeKarten(5);
  assert.deepEqual(zieh(karten, 0), []);
  assert.deepEqual(zieh(karten, -2), []);
  assert.deepEqual(zieh(karten, NaN), []);
});

test('niedrige Box zuerst', () => {
  const karten = [1, 2, 3, 4, 5].flatMap((box) => [0, 1].map(() => karte('F', { box, faelligAm: vergangen(1) })));
  const boxen = zieh(karten, 4).map((k) => k.box).sort();
  assert.deepEqual(boxen, [1, 1, 2, 2]);
});

test('bei gleicher Box zuerst die am längsten überfälligen', () => {
  const sehrAlt = karte('alt', { box: 2, faelligAm: vergangen(10) });
  const mittel = karte('mittel', { box: 2, faelligAm: vergangen(5) });
  const neu = karte('neu', { box: 2, faelligAm: vergangen(1) });
  const fragen = zieh([neu, mittel, sehrAlt], 2).map((k) => k.frage).sort();
  assert.deepEqual(fragen, ['alt', 'mittel']);
});

test('Box schlägt Überfälligkeit', () => {
  const box1 = karte('box1', { box: 1, faelligAm: vergangen(1) });
  const box3Alt = karte('box3', { box: 3, faelligAm: vergangen(30) });
  assert.deepEqual(zieh([box3Alt, box1], 1).map((k) => k.frage), ['box1']);
});

test('Karten aus mehreren Decks werden gemischt', () => {
  const a = [0, 1, 2].map((i) => karte(`A${i}`, { deck: DECK_A, faelligAm: vergangen(1) }));
  const b = [0, 1, 2].map((i) => karte(`B${i}`, { deck: DECK_B, faelligAm: vergangen(1) }));
  const gezogen = zieh([...a, ...b], 5);
  assert.equal(gezogen.length, 5);
  assert.deepEqual(new Set(gezogen.map((k) => k.deckId)), new Set([DECK_A, DECK_B]));
});

test('fällige Karten vor nicht fälligen', () => {
  const faellig = karte('faellig', { box: 5, faelligAm: vergangen(1) });
  const spaeter = karte('spaeter', { box: 1, faelligAm: jetzt + TAG });
  assert.deepEqual(zieh([spaeter, faellig], 1).map((k) => k.frage), ['faellig']);
});

test('nicht fällige Karten füllen auf, wenn zu wenige fällig sind (früher fällige zuerst)', () => {
  const faellig = karte('faellig', { faelligAm: vergangen(1) });
  const bald = karte('bald', { faelligAm: jetzt + TAG });
  const weit = karte('weit', { faelligAm: jetzt + 10 * TAG });
  const fragen = zieh([weit, bald, faellig], 2).map((k) => k.frage).sort();
  assert.deepEqual(fragen, ['bald', 'faellig']);
});

test('nur nicht fällige Karten ergeben trotzdem ein Gate', () => {
  const karten = [0, 1, 2].map(() => karte('F', { faelligAm: jetzt + TAG }));
  assert.equal(zieh(karten).length, 3);
});

test('Karte genau jetzt fällig gilt als fällig', () => {
  const genau = karte('genau', { box: 5, faelligAm: jetzt });
  const spaeter = karte('spaeter', { box: 1, faelligAm: jetzt + 1 });
  assert.deepEqual(zieh([spaeter, genau], 1).map((k) => k.frage), ['genau']);
});

test('ungültige Karten werden ignoriert', () => {
  const zuWenigAntworten = { ...karte('kaputt', { faelligAm: vergangen(1) }), antworten: ['a', 'b', 'c'] };
  const indexAusserhalb = { ...karte('index', { faelligAm: vergangen(1) }), indexRichtig: 4 };
  const leereFrage = { ...karte('x', { faelligAm: vergangen(1) }), frage: '  ' };
  const gut = karte('gut', { faelligAm: vergangen(1) });
  assert.deepEqual(zieh([zuWenigAntworten, indexAusserhalb, leereFrage, gut]).map((k) => k.frage), ['gut']);
});

test('gleicher Seed → gleiches Ergebnis', () => {
  const karten = faelligeKarten(30);
  assert.deepEqual(zieh(karten, 5, 7).map((k) => k.id), zieh(karten, 5, 7).map((k) => k.id));
});

test('Gleichstände werden zufällig aufgelöst', () => {
  const karten = faelligeKarten(30);
  const verschiedene = new Set();
  for (let seed = 0; seed < 20; seed++) {
    verschiedene.add(
      zieh(karten, 5, seed)
        .map((k) => k.id)
        .sort()
        .join(),
    );
  }
  assert.ok(verschiedene.size > 1);
});
