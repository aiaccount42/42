import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ProbeSitzung } from '../js/core/probe.js';
import { seeded } from '../js/core/zufall.js';
import { faelligeKarten, falsch, karte, richtig } from '../testhilfen/helfer.js';

const probe = (karten, seed = 1) => new ProbeSitzung({ karten, zufall: seeded(seed) });

test('Probelauf stellt jede Karte genau einmal, auch bei falschen Antworten', () => {
  const karten = faelligeKarten(10);
  const s = probe(karten);
  const gestellt = [];
  while (s.aktuelleFrage) {
    gestellt.push(s.aktuelleFrage.kartenId);
    s.beantworte(gestellt.length % 2 ? falsch(s) : richtig(s));
  }
  assert.equal(gestellt.length, 10);
  assert.equal(new Set(gestellt).size, 10);
  assert.equal(s.istBestanden, true);
  assert.equal(s.status, 'bestanden');
  assert.equal(s.richtigeAntworten, 5);
});

test('Probelauf verändert die Karten nicht', () => {
  const karten = faelligeKarten(4);
  const vorher = JSON.stringify(karten);
  const s = probe(karten);
  while (s.aktuelleFrage) s.beantworte(falsch(s));
  assert.equal(JSON.stringify(karten), vorher);
  assert.equal(s.aktuelleFrage, null);
});

test('Ergebnisse nennen Frage, richtige Antwort und Trefferstatus', () => {
  const s = probe([karte('Wer?')]);
  s.beantworte(falsch(s));
  assert.deepEqual(s.ergebnisse.map(({ frage, richtigeAntwort, richtig: r }) => ({ frage, richtigeAntwort, r })), [
    { frage: 'Wer?', richtigeAntwort: 'R', r: false },
  ]);
});

test('Probelauf ignoriert ungültige Karten und doppelte IDs; leer = keineKarten', () => {
  const k = karte('A?');
  const kaputt = { ...karte('B?'), antworten: ['x', '', 'y', 'z'] };
  const s = probe([k, k, kaputt]);
  assert.equal(s.benoetigteRichtige, 1);
  assert.equal(probe([]).status, 'keineKarten');
  assert.equal(probe([]).hinweis !== null, true);
});

test('Fortschrittstext und ungültige Antwortindizes', () => {
  const s = probe(faelligeKarten(3));
  assert.equal(s.fortschrittText, 'Karte 1 von 3 · 0 richtig');
  assert.throws(() => s.beantworte(7));
  s.beantworte(richtig(s));
  assert.equal(s.fortschrittText, 'Karte 2 von 3 · 1 richtig');
  assert.equal(s.fortschritt, 1 / 3);
});

test('Die Reihenfolge der Karten ist gemischt', () => {
  const karten = faelligeKarten(20);
  const ids = (seed) => {
    const s = probe(karten, seed);
    const r = [];
    while (s.aktuelleFrage) {
      r.push(s.aktuelleFrage.kartenId);
      s.beantworte(0);
    }
    return r;
  };
  assert.notDeepEqual(ids(1), karten.map((k) => k.id));
  assert.notDeepEqual(ids(1), ids(2));
});
