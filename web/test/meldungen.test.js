import assert from 'node:assert/strict';
import { test } from 'node:test';
import { istGemeldet, meldungEntfernen, meldungHinzu, meldungenNormalisieren, meldungsText } from '../js/core/meldungen.js';

test('Meldung hinzufügen, doppelt ignorieren, entfernen', () => {
  let l = [];
  l = meldungHinzu(l, { deck: 'Biologie', frage: 'Was ist X?', antwort: 'Y', zeit: 1 });
  l = meldungHinzu(l, { deck: 'biologie', frage: ' was ist x? ', antwort: 'Y', zeit: 2 });
  assert.equal(l.length, 1);
  assert.equal(istGemeldet(l, 'Biologie', 'Was ist X?'), true);
  assert.equal(istGemeldet(l, 'Chemie', 'Was ist X?'), false);
  assert.deepEqual(meldungEntfernen(l, 'Biologie', 'Was ist X?'), []);
});

test('Text zum Kopieren ist nach Deck gruppiert', () => {
  let l = meldungHinzu([], { deck: 'A', frage: 'F1?', antwort: 'R1', zeit: 1 });
  l = meldungHinzu(l, { deck: 'B', frage: 'F2?', antwort: 'R2', zeit: 2 });
  l = meldungHinzu(l, { deck: 'A', frage: 'F3?', antwort: 'R3', zeit: 3 });
  assert.equal(meldungsText(l), 'Deck: A\n- F1? → R1\n- F3? → R3\n\nDeck: B\n- F2? → R2');
});

test('Normalisieren: Kaputtes entfällt', () => {
  assert.deepEqual(meldungenNormalisieren('x'), []);
  assert.equal(meldungenNormalisieren([{ deck: 'A', frage: 'F?', antwort: 'R' }, { deck: 'A' }, 1]).length, 1);
});
