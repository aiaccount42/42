import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bereinige,
  erfasseAntwort,
  erfasseFreischaltung,
  freischaltungenHeute,
  richtigHeute,
  serie,
  tagKey,
  uebersicht,
} from '../js/core/statistik.js';
import {
  neuerWunsch,
  offeneWuensche,
  stundenBis,
  wunschAbschliessen,
  wunschHinzufuegen,
} from '../js/core/kaufbremse.js';
import { datum } from '../testhilfen/helfer.js';

const jetzt = datum(2026, 10, 20, 15, 0);
const HEUTE = datum(2026, 10, 20, 9, 0);
const tag = (n, stunde = 12) => datum(2026, 10, 20 - n, stunde);

function mitQuiz(...tageZurueck) {
  const t = {};
  for (const n of tageZurueck) erfasseFreischaltung(t, { zeit: tag(n), app: 'Reddit' });
  return t;
}

// --- Zähler ---

test('tagKey: Ortszeit-Tag, auch kurz vor und nach Mitternacht', () => {
  assert.equal(tagKey(datum(2026, 10, 20, 0, 0, 1)), '2026-10-20');
  assert.equal(tagKey(datum(2026, 10, 20, 23, 59, 59)), '2026-10-20');
  assert.equal(tagKey(datum(2026, 1, 5)), '2026-01-05');
});

test('Antworten werden gezählt: gesamt, richtig und je Deck', () => {
  const t = {};
  erfasseAntwort(t, { zeit: HEUTE, deckId: 'a', richtig: true });
  erfasseAntwort(t, { zeit: HEUTE, deckId: 'a', richtig: false });
  erfasseAntwort(t, { zeit: HEUTE, deckId: 'b', richtig: true });
  const heute = t['2026-10-20'];
  assert.equal(heute.a, 3);
  assert.equal(heute.r, 2);
  assert.deepEqual(heute.d, { a: [2, 1], b: [1, 1] });
  assert.equal(richtigHeute(t, jetzt), 2);
});

test('Freischaltungen: Quiz und Skip getrennt gezählt, je App und gesamt', () => {
  const t = {};
  erfasseFreischaltung(t, { zeit: HEUTE, app: 'Reddit' });
  erfasseFreischaltung(t, { zeit: HEUTE, app: 'Reddit' });
  erfasseFreischaltung(t, { zeit: HEUTE, app: 'WhatsApp', skip: true });
  assert.equal(t['2026-10-20'].q, 2);
  assert.equal(t['2026-10-20'].s, 1);
  assert.equal(freischaltungenHeute(t, jetzt, 'Reddit'), 2);
  assert.equal(freischaltungenHeute(t, jetzt, 'WhatsApp'), 1);
  assert.equal(freischaltungenHeute(t, jetzt, 'mydealz'), 0);
  assert.equal(freischaltungenHeute(t, jetzt), 3);
});

test('gestern zählt nicht als heute', () => {
  const t = mitQuiz(1);
  assert.equal(freischaltungenHeute(t, jetzt, 'Reddit'), 0);
  assert.equal(freischaltungenHeute(t, jetzt), 0);
  assert.equal(richtigHeute(t, jetzt), 0);
});

test('Tageswechsel um Mitternacht: neuer Zähler', () => {
  const t = {};
  erfasseFreischaltung(t, { zeit: datum(2026, 10, 20, 23, 59, 59), app: 'Reddit' });
  assert.equal(freischaltungenHeute(t, datum(2026, 10, 21, 0, 0, 1), 'Reddit'), 0);
  assert.equal(freischaltungenHeute(t, datum(2026, 10, 20, 23, 59, 59), 'Reddit'), 1);
});

// --- Serie ---

test('Serie: leer = 0', () => {
  assert.equal(serie({}, jetzt), 0);
});

test('Serie: heute, gestern, vorgestern = 3', () => {
  assert.equal(serie(mitQuiz(0, 1, 2), jetzt), 3);
});

test('Serie läuft weiter, wenn heute noch nichts gemacht wurde (bis gestern)', () => {
  assert.equal(serie(mitQuiz(1, 2, 3), jetzt), 3);
});

test('Serie reißt, wenn gestern fehlt', () => {
  assert.equal(serie(mitQuiz(2, 3), jetzt), 0);
  assert.equal(serie(mitQuiz(0, 2, 3), jetzt), 1);
});

test('Serie: nur Skips zählen nicht', () => {
  const t = {};
  erfasseFreischaltung(t, { zeit: tag(0), app: 'Reddit', skip: true });
  erfasseFreischaltung(t, { zeit: tag(1), app: 'Reddit', skip: true });
  assert.equal(serie(t, jetzt), 0);
});

test('Serie über Monats- und Jahresgrenze', () => {
  const t = {};
  for (const [j, m, d] of [[2026, 12, 30], [2026, 12, 31], [2027, 1, 1], [2027, 1, 2]]) {
    erfasseFreischaltung(t, { zeit: datum(j, m, d), app: 'X' });
  }
  assert.equal(serie(t, datum(2027, 1, 2, 20)), 4);
});

test('Serie über die Sommerzeitumstellung (25.10.2026)', () => {
  const t = {};
  for (const d of [23, 24, 25, 26]) erfasseFreischaltung(t, { zeit: datum(2026, 10, d), app: 'X' });
  assert.equal(serie(t, datum(2026, 10, 26, 18)), 4);
});

// --- Übersicht ---

test('Übersicht der letzten 7 Tage: Summen, Quote, je App und je Deck', () => {
  const t = {};
  erfasseAntwort(t, { zeit: tag(0), deckId: 'a', richtig: true });
  erfasseAntwort(t, { zeit: tag(0), deckId: 'a', richtig: false });
  erfasseAntwort(t, { zeit: tag(3), deckId: 'b', richtig: true });
  erfasseAntwort(t, { zeit: tag(8), deckId: 'b', richtig: false }); // außerhalb
  erfasseFreischaltung(t, { zeit: tag(0), app: 'Reddit' });
  erfasseFreischaltung(t, { zeit: tag(3), app: 'Reddit' });
  erfasseFreischaltung(t, { zeit: tag(3), app: 'WhatsApp', skip: true });
  const u = uebersicht(t, jetzt, 7);
  assert.equal(u.antworten, 3);
  assert.equal(u.richtig, 2);
  assert.ok(Math.abs(u.quote - 2 / 3) < 1e-9);
  assert.equal(u.quizze, 2);
  assert.equal(u.skips, 1);
  assert.equal(u.tageMitQuiz, 2);
  assert.deepEqual(u.proApp, { Reddit: 2, WhatsApp: 1 });
  assert.deepEqual(u.proDeck, { a: { antworten: 2, richtig: 1 }, b: { antworten: 1, richtig: 1 } });
});

test('Übersicht ohne Daten: Quote ist null', () => {
  const u = uebersicht({}, jetzt, 7);
  assert.equal(u.quote, null);
  assert.equal(u.antworten, 0);
});

test('Bereinigen: alte Tage verschwinden, neue bleiben', () => {
  const t = { '2020-01-01': { a: 1, r: 1, q: 0, s: 0, f: {}, d: {} }, '2026-10-19': { a: 1, r: 1, q: 0, s: 0, f: {}, d: {} } };
  bereinige(t, jetzt, 400);
  assert.deepEqual(Object.keys(t), ['2026-10-19']);
});

// --- Kaufbremse / Wunschliste ---

test('Wunsch: Text wird getrimmt, leere Wünsche gibt es nicht, Frist = Stunden', () => {
  assert.equal(neuerWunsch('   ', jetzt), null);
  assert.equal(neuerWunsch(null, jetzt), null);
  const w = neuerWunsch('  Kopfhörer  ', jetzt, 24);
  assert.equal(w.text, 'Kopfhörer');
  assert.equal(w.status, 'wartet');
  assert.equal(w.reifAm, jetzt + 24 * 3_600_000);
});

test('Wünsche: wartend bis zur Frist, danach reif', () => {
  const w = neuerWunsch('A', jetzt, 24);
  assert.deepEqual(offeneWuensche([w], jetzt + 23 * 3_600_000).wartend.map((x) => x.text), ['A']);
  assert.equal(offeneWuensche([w], jetzt + 23 * 3_600_000).reif.length, 0);
  const reif = offeneWuensche([w], jetzt + 24 * 3_600_000);
  assert.equal(reif.wartend.length, 0);
  assert.deepEqual(reif.reif.map((x) => x.text), ['A']);
});

test('verbleibende Stunden: aufgerundet, mindestens 1', () => {
  const w = neuerWunsch('A', jetzt, 24);
  assert.equal(stundenBis(w, jetzt), 24);
  assert.equal(stundenBis(w, jetzt + 23 * 3_600_000 + 1), 1);
  assert.equal(stundenBis(w, jetzt + 30 * 3_600_000), 1);
});

test('Wunsch abschließen: gekauft oder verworfen, nur einmal, nur gültige Status', () => {
  const w = neuerWunsch('A', jetzt, 1);
  const liste = wunschAbschliessen([w], w.id, 'verworfen', jetzt + 5);
  assert.equal(liste[0].status, 'verworfen');
  assert.equal(liste[0].erledigtAm, jetzt + 5);
  assert.equal(wunschAbschliessen(liste, w.id, 'gekauft', jetzt + 9)[0].status, 'verworfen');
  assert.throws(() => wunschAbschliessen([w], w.id, 'vielleicht'));
  assert.equal(offeneWuensche(liste, jetzt + 99).reif.length, 0);
});

test('Wunsch hinzufügen: neueste zuerst; bei zu vielen fallen alte erledigte heraus, offene bleiben', () => {
  let liste = [];
  for (let i = 0; i < 205; i++) {
    let w = neuerWunsch(`W${i}`, jetzt + i, 1);
    if (i % 2 === 0 && i > 3) w = { ...w, status: 'gekauft' };
    liste = wunschHinzufuegen(liste, w);
  }
  assert.ok(liste.length <= 200);
  assert.ok(liste.some((w) => w.text === 'W1'), 'offene Wünsche bleiben erhalten');
  assert.equal(wunschHinzufuegen(liste, null), liste);
});

test('„Doch nicht geöffnet“ wird gezählt, summiert und in der Wochenübersicht verglichen', async () => {
  const { erfasseNichtGeoeffnet, nichtGeoeffnetHeute, uebersicht, wochenUebersicht } = await import('../js/core/statistik.js');
  const { datum } = await import('../testhilfen/helfer.js');
  const jetzt = datum(2026, 10, 20, 12);
  const tage = {};
  erfasseNichtGeoeffnet(tage, { zeit: jetzt });
  erfasseNichtGeoeffnet(tage, { zeit: jetzt });
  erfasseNichtGeoeffnet(tage, { zeit: datum(2026, 10, 18) });
  erfasseNichtGeoeffnet(tage, { zeit: datum(2026, 10, 10) }); // Vorwoche
  assert.equal(nichtGeoeffnetHeute(tage, jetzt), 2);
  assert.equal(uebersicht(tage, jetzt).nichtGeoeffnet, 3);
  assert.equal(uebersicht(tage, jetzt, 7, 7).nichtGeoeffnet, 1);
  const w = wochenUebersicht(tage, jetzt);
  assert.equal(w.tage.length, 7);
  assert.equal(w.tage[6].key, '2026-10-20');
  assert.equal(w.tage[6].nichtGeoeffnet, 2);
  assert.equal(w.woche.nichtGeoeffnet, 3);
  assert.equal(w.vorwoche.nichtGeoeffnet, 1);
});
