import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ziehen } from '../js/core/auswahl.js';
import { falschBeantwortet, richtigBeantwortet } from '../js/core/leitner.js';
import { schwierigkeit, trefferquote } from '../js/core/schwierigkeit.js';
import { seeded } from '../js/core/zufall.js';
import { datum, karte } from '../testhilfen/helfer.js';

const jetzt = datum(2026, 10, 20);
const mit = (versuche, treffer, extra = {}) => ({ ...karte('F', { faelligAm: datum(2026, 1, 1), ...extra }), versuche, treffer });

test('Zähler: richtig erhöht Versuche und Treffer, falsch nur Versuche', () => {
  const k = karte('F', { faelligAm: jetzt });
  const a = richtigBeantwortet(k, jetzt);
  const b = falschBeantwortet(a, jetzt);
  assert.deepEqual([k.versuche, k.treffer], [0, 0]);
  assert.deepEqual([a.versuche, a.treffer], [1, 1]);
  assert.deepEqual([b.versuche, b.treffer], [2, 1]);
});

test('Schwierigkeit: erst ab 3 Versuchen, schwer unter 50 %, leicht ab 5 Versuchen und 90 %', () => {
  assert.equal(trefferquote(mit(2, 0)), null);
  assert.equal(schwierigkeit(mit(2, 0)), 'normal');
  assert.equal(schwierigkeit(mit(4, 1)), 'schwer');
  assert.equal(schwierigkeit(mit(4, 2)), 'normal');
  assert.equal(schwierigkeit(mit(4, 4)), 'normal');
  assert.equal(schwierigkeit(mit(5, 5)), 'leicht');
  assert.equal(schwierigkeit(mit(10, 9)), 'leicht');
  assert.equal(schwierigkeit({ ...karte('F') }), 'normal');
});

test('Auswahl: schwere Karten zuerst, leichte zuletzt (nur unter fälligen)', () => {
  const leicht = mit(6, 6, { box: 1 });
  const normal = mit(0, 0, { box: 1 });
  const schwer = mit(4, 1, { box: 3 });
  const ids = (anzahl) => ziehen([leicht, normal, schwer], anzahl, jetzt, seeded(1)).map((x) => x.id);
  assert.deepEqual(new Set(ids(1)), new Set([schwer.id]));
  assert.deepEqual(new Set(ids(2)), new Set([schwer.id, normal.id]));
  assert.deepEqual(new Set(ids(3)), new Set([schwer.id, normal.id, leicht.id]));
});
