import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  INTERVALLE_TAGE,
  begrenzt,
  falschBeantwortet,
  hoehereBox,
  intervallInTagen,
  richtigBeantwortet,
} from '../js/core/leitner.js';
import { istFaellig, neueKarte } from '../js/core/models.js';
import { TAG, datum, karte } from '../testhilfen/helfer.js';

const jetzt = datum(2026, 10, 19, 21, 30);

test('Intervalle pro Box: 1/2/4/8/16 Tage', () => {
  assert.deepEqual(INTERVALLE_TAGE, [1, 2, 4, 8, 16]);
  assert.deepEqual([1, 2, 3, 4, 5].map(intervallInTagen), [1, 2, 4, 8, 16]);
});

test('Box wird auf 1–5 begrenzt', () => {
  assert.equal(begrenzt(0), 1);
  assert.equal(begrenzt(-3), 1);
  assert.equal(begrenzt(6), 5);
  assert.equal(begrenzt(NaN), 1);
  assert.equal(intervallInTagen(99), 16);
  assert.equal(intervallInTagen(0), 1);
});

test('richtig: eine Box höher, Box 5 bleibt Box 5', () => {
  assert.deepEqual([1, 2, 3, 4].map(hoehereBox), [2, 3, 4, 5]);
  assert.equal(hoehereBox(5), 5);
});

test('Karte steigt auf und bekommt das Intervall der neuen Box (ab Tagesbeginn)', () => {
  const neu = richtigBeantwortet(karte('F', { box: 1, faelligAm: jetzt }), jetzt);
  assert.equal(neu.box, 2);
  assert.equal(neu.faelligAm, datum(2026, 10, 21, 0, 0));
});

test('Original-Karte bleibt unverändert', () => {
  const alt = karte('F', { box: 1, faelligAm: jetzt });
  richtigBeantwortet(alt, jetzt);
  falschBeantwortet(alt, jetzt);
  assert.equal(alt.box, 1);
  assert.equal(alt.faelligAm, jetzt);
});

test('alle Boxen durchlaufen: Abstände 2/4/8/16 Tage', () => {
  let k = karte('F', { box: 1, faelligAm: jetzt });
  const heute = datum(2026, 10, 19, 0, 0);
  const tage = [];
  for (let i = 0; i < 4; i++) {
    k = richtigBeantwortet(k, jetzt);
    tage.push(Math.round((k.faelligAm - heute) / TAG)); // Sommerzeitwechsel dazwischen → runden
  }
  assert.equal(k.box, 5);
  assert.deepEqual(tage, [2, 4, 8, 16]);
});

test('Box 5 richtig: bleibt Box 5 mit 16 Tagen', () => {
  const k = richtigBeantwortet(karte('F', { box: 5, faelligAm: jetzt }), jetzt);
  assert.equal(k.box, 5);
  assert.equal(k.faelligAm, datum(2026, 11, 4, 0, 0));
});

test('falsch: Box 1, morgen fällig', () => {
  const k = falschBeantwortet(karte('F', { box: 4, faelligAm: jetzt }), jetzt);
  assert.equal(k.box, 1);
  assert.equal(k.faelligAm, datum(2026, 10, 20, 0, 0));
});

test('falsch in Box 1 bleibt Box 1', () => {
  assert.equal(falschBeantwortet(karte('F', { box: 1, faelligAm: jetzt }), jetzt).box, 1);
});

test('neue Karte: Box 1 und sofort fällig', () => {
  const k = neueKarte({ deckId: 'd', frage: 'F', antworten: ['a', 'b', 'c', 'd'], indexRichtig: 0, faelligAm: jetzt });
  assert.equal(k.box, 1);
  assert.equal(istFaellig(k, jetzt), true);
});

test('fällig erst ab Fälligkeitszeitpunkt', () => {
  const k = karte('F', { faelligAm: jetzt });
  assert.equal(istFaellig(k, jetzt - 1), false);
  assert.equal(istFaellig(k, jetzt), true);
  assert.equal(istFaellig(k, jetzt + 1), true);
});

test('Erstellen begrenzt ungültige Box', () => {
  assert.equal(karte('F', { box: 0, faelligAm: jetzt }).box, 1);
  assert.equal(karte('F', { box: 9, faelligAm: jetzt }).box, 5);
});

test('Intervall über die Sommerzeitumstellung landet am Tagesbeginn', () => {
  // Zeitumstellung in Deutschland: 25.10.2026 (03:00 → 02:00)
  const abends = datum(2026, 10, 24, 23, 30);
  const k = richtigBeantwortet(karte('F', { box: 1, faelligAm: abends }), abends);
  assert.equal(k.faelligAm, datum(2026, 10, 26, 0, 0));
});
