import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SICHER_AB_BOX, deckFortschritt, istSchwachstelle, kartenStufe, schwachstellen, zeitplanSchonen } from '../js/core/fortschritt.js';
import { intelligentFalsch, intelligentRichtig } from '../js/core/intervall.js';
import { neueKarte } from '../js/core/models.js';
import { seeded } from '../js/core/zufall.js';
import { TAG, datum, karte } from '../testhilfen/helfer.js';

/** Gültige Karte mit Lernstand. */
const stand = (frage, { box = 1, versuche = 0, treffer = 0 } = {}) => {
  const k = karte(frage, { box });
  return neueKarte({ ...k, deckId: k.deckId, versuche, treffer });
};

test('Stufe: ohne Versuche neu, ab Box 4 sicher, sonst lernend', () => {
  assert.equal(SICHER_AB_BOX, 4);
  assert.equal(kartenStufe(stand('a')), 'neu');
  assert.equal(kartenStufe(stand('a', { box: 1, versuche: 1, treffer: 1 })), 'lernend');
  assert.equal(kartenStufe(stand('a', { box: 3, versuche: 4, treffer: 4 })), 'lernend');
  assert.equal(kartenStufe(stand('a', { box: 4, versuche: 4, treffer: 4 })), 'sicher');
  assert.equal(kartenStufe(stand('a', { box: 5, versuche: 6, treffer: 5 })), 'sicher');
});

test('Schwachstelle: schon falsch beantwortet und noch nicht sicher', () => {
  assert.equal(istSchwachstelle(stand('a')), false);
  assert.equal(istSchwachstelle(stand('a', { box: 2, versuche: 3, treffer: 3 })), false);
  assert.equal(istSchwachstelle(stand('a', { box: 1, versuche: 2, treffer: 1 })), true);
  assert.equal(istSchwachstelle(stand('a', { box: 3, versuche: 5, treffer: 3 })), true);
  assert.equal(istSchwachstelle(stand('a', { box: 4, versuche: 5, treffer: 3 })), false, 'wieder sicher');
});

test('deckFortschritt zählt Stufen, Fehlerquote und Anteile', () => {
  const karten = [
    stand('neu1'),
    stand('neu2'),
    stand('lern', { box: 2, versuche: 3, treffer: 2 }),
    stand('sicher1', { box: 4, versuche: 4, treffer: 4 }),
    stand('sicher2', { box: 5, versuche: 3, treffer: 3 }),
  ];
  const f = deckFortschritt(karten);
  assert.deepEqual([f.gesamt, f.neu, f.lernend, f.sicher, f.schwach], [5, 2, 1, 2, 1]);
  assert.equal(f.antworten, 10);
  assert.equal(f.fehler, 1);
  assert.equal(f.fehlerquote, 0.1);
  assert.equal(f.anteilSicher, 0.4);
  assert.equal(f.anteilGesehen, 0.6);
  assert.equal(f.gemeistert, false);
});

test('Fehlerquote gibt es erst ab 5 Antworten', () => {
  assert.equal(deckFortschritt([stand('a', { box: 1, versuche: 4, treffer: 0 })]).fehlerquote, null);
  assert.equal(deckFortschritt([stand('a', { box: 1, versuche: 5, treffer: 0 })]).fehlerquote, 1);
});

test('gemeistert: alle Karten sicher, leeres Deck nie', () => {
  assert.equal(deckFortschritt([]).gemeistert, false);
  assert.equal(deckFortschritt([]).anteilSicher, 0);
  assert.equal(deckFortschritt([stand('a', { box: 4, versuche: 4, treffer: 4 }), stand('b', { box: 5, versuche: 5, treffer: 5 })]).gemeistert, true);
  assert.equal(deckFortschritt([stand('a', { box: 4, versuche: 4, treffer: 4 }), stand('b')]).gemeistert, false);
});

test('ungültige Karten zählen nicht mit', () => {
  const kaputt = { ...stand('x', { box: 4, versuche: 2, treffer: 2 }), antworten: ['nur eine'] };
  const f = deckFortschritt([kaputt, stand('ok')]);
  assert.equal(f.gesamt, 1);
  assert.equal(f.sicher, 0);
});

test('schwachstellen: meiste Fehler zuerst, begrenzt auf die Anzahl, ohne sichere und unbekannte Karten', () => {
  const wenig = stand('wenig', { box: 1, versuche: 3, treffer: 2 });
  const viel = stand('viel', { box: 1, versuche: 6, treffer: 2 });
  const mittel = stand('mittel', { box: 2, versuche: 4, treffer: 2 });
  const sicher = stand('sicher', { box: 4, versuche: 9, treffer: 4 });
  const neu = stand('neu');
  const alle = [wenig, viel, mittel, sicher, neu];

  assert.deepEqual(new Set(schwachstellen(alle, 10, seeded(1)).map((k) => k.frage)), new Set(['wenig', 'viel', 'mittel']));
  assert.deepEqual(new Set(schwachstellen(alle, 2, seeded(1)).map((k) => k.frage)), new Set(['viel', 'mittel']));
  assert.deepEqual(schwachstellen(alle, 0), []);
  assert.deepEqual(schwachstellen([sicher, neu], 5), []);
});

// --- Zeitplan schonen ---

test('zeitplanSchonen: richtig vor der Zeit ändert nichts, falsch und fällige Karten zählen voll', () => {
  const jetzt = datum(2026, 10, 21, 12, 0);
  const nichtFaellig = { ...stand('später', { box: 2, versuche: 3, treffer: 2 }), faelligAm: jetzt + 2 * TAG, intervall: 3 };
  const faellig = { ...stand('fällig', { box: 2, versuche: 3, treffer: 2 }), faelligAm: jetzt - TAG, intervall: 3 };
  const vorher = new Map([nichtFaellig, faellig].map((k) => [k.id, k]));

  const nachRichtig = [intelligentRichtig(nichtFaellig, jetzt), intelligentRichtig(faellig, jetzt)];
  const [a, b] = zeitplanSchonen(nachRichtig, vorher, jetzt);
  assert.deepEqual(a, nichtFaellig, 'noch nicht dran: unverändert, kein Vorrücken');
  assert.equal(b.intervall, nachRichtig[1].intervall, 'fällig: normal gewertet');
  assert.ok(b.intervall > 3);

  const nachFalsch = zeitplanSchonen([intelligentFalsch(nichtFaellig, jetzt)], vorher, jetzt)[0];
  assert.equal(nachFalsch.box, 1, 'ein Fehler setzt auch eine noch nicht fällige Karte zurück');
  assert.equal(nachFalsch.versuche, 4);
  assert.equal(nachFalsch.treffer, 2);
});

test('zeitplanSchonen: unbekannte Karten bleiben wie sie sind', () => {
  const k = stand('neu', { box: 2, versuche: 1, treffer: 1 });
  assert.deepEqual(zeitplanSchonen([k], new Map(), datum(2026, 10, 21)), [k]);
});
