import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  auffaelligkeiten,
  kennzahlen,
  laengsteSerie,
  proApp,
  proDeck,
  proStunde,
  proWochentag,
  stosszeit,
  tageListe,
} from '../js/core/insights.js';
import { erfasseAntwort, erfasseFreischaltung } from '../js/core/statistik.js';
import { importJson, exportJson, leereDaten } from '../js/storage.js';
import { datum } from '../testhilfen/helfer.js';

const jetzt = datum(2026, 10, 21, 15, 0); // Mittwoch
const tag = (n, stunde = 12) => datum(2026, 10, 21 - n, stunde);

function beispiel() {
  const t = {};
  const antworten = (n, richtig, deck, zeit) => {
    for (let i = 0; i < n; i++) erfasseAntwort(t, { zeit, deckId: deck, richtig: i < richtig });
  };
  antworten(10, 8, 'a', tag(0));
  antworten(10, 5, 'b', tag(1));
  antworten(4, 4, 'a', tag(3));
  erfasseFreischaltung(t, { zeit: tag(0, 20), app: 'Instagram' });
  erfasseFreischaltung(t, { zeit: tag(0, 21), app: 'Instagram' });
  erfasseFreischaltung(t, { zeit: tag(1, 20), app: 'Reddit' });
  erfasseFreischaltung(t, { zeit: tag(3, 9), app: 'Instagram', skip: true });
  return t;
}

test('tageListe: genau n Tage, älteste zuerst, leere Tage mit Nullen', () => {
  const liste = tageListe(beispiel(), jetzt, 7);
  assert.equal(liste.length, 7);
  assert.equal(liste[6].key, '2026-10-21');
  assert.equal(liste[0].key, '2026-10-15');
  assert.deepEqual([liste[6].antworten, liste[6].richtig, liste[6].falsch, liste[6].freischaltungen], [10, 8, 2, 2]);
  assert.deepEqual([liste[4].antworten, liste[4].freischaltungen], [0, 0], 'Tag ohne Daten');
  assert.equal(liste[6].wochentag, 3, 'Mittwoch');
});

test('tageListe: versatz liefert die Vorperiode ohne Überlappung', () => {
  const jetztListe = tageListe({}, jetzt, 7);
  const davor = tageListe({}, jetzt, 7, 7);
  assert.equal(davor[6].key, '2026-10-14');
  assert.equal(davor[0].key, '2026-10-08');
  assert.ok(davor[6].key < jetztListe[0].key);
});

test('kennzahlen: Summen, Quote, aktive Tage', () => {
  const k = kennzahlen(tageListe(beispiel(), jetzt, 7));
  assert.deepEqual([k.antworten, k.richtig, k.falsch, k.freischaltungen, k.skips, k.aktiveTage], [24, 17, 7, 4, 1, 3]);
  assert.equal(k.quote, 17 / 24);
  assert.equal(kennzahlen(tageListe({}, jetzt, 7)).quote, null);
});

test('proApp: häufigste zuerst, Anteile summieren zu 1', () => {
  const apps = proApp(tageListe(beispiel(), jetzt, 7));
  assert.deepEqual(apps.map((a) => [a.name, a.anzahl]), [['Instagram', 3], ['Reddit', 1]]);
  assert.equal(apps[0].anteil, 0.75);
});

test('proDeck: meistgeübte zuerst, Quote je Deck', () => {
  const decks = proDeck(tageListe(beispiel(), jetzt, 7));
  assert.deepEqual(decks.map((d) => [d.id, d.antworten, d.quote]), [['a', 14, 12 / 14], ['b', 10, 0.5]]);
});

test('proWochentag: Mo–So, Schnitt pro vorhandenem Tag', () => {
  const w = proWochentag(tageListe(beispiel(), jetzt, 14));
  assert.deepEqual(w.map((x) => x.name), ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
  assert.ok(w.every((x) => x.tage === 2), '14 Tage = jeder Wochentag zweimal');
  const mittwoch = w[2];
  assert.equal(mittwoch.freischaltungen, 2);
  assert.equal(mittwoch.schnitt, 1);
});

test('proStunde: Freischaltungen nach Uhrzeit', () => {
  const h = proStunde(tageListe(beispiel(), jetzt, 7));
  assert.equal(h.length, 24);
  assert.deepEqual([h[9], h[20], h[21], h[3]], [1, 2, 1, 0]);
});

test('stosszeit: erst ab 8 Zugriffen, dann das 2-Stunden-Fenster mit den meisten', () => {
  assert.equal(stosszeit(Array(24).fill(0)), null);
  const h = Array(24).fill(0);
  h[20] = 5;
  h[21] = 3;
  h[8] = 2;
  const s = stosszeit(h);
  assert.deepEqual([s.von, s.bis], [20, 22]);
  assert.equal(s.anteil, 0.8);
});

test('laengsteSerie: Tage in Folge mit bestandenem Quiz, über Monatsgrenzen', () => {
  const t = {};
  for (const [j, m, d] of [[2026, 9, 29], [2026, 9, 30], [2026, 10, 1], [2026, 10, 2], [2026, 10, 10], [2026, 10, 11]]) {
    erfasseFreischaltung(t, { zeit: datum(j, m, d), app: 'X' });
  }
  assert.equal(laengsteSerie(t), 4);
  assert.equal(laengsteSerie({}), 0);
});

test('auffaelligkeiten: wenig Daten = keine Sätze, genug Daten = konkrete Aussagen', () => {
  assert.deepEqual(auffaelligkeiten({ liste: tageListe({}, jetzt, 30), vorher: tageListe({}, jetzt, 30, 30) }), []);

  const t = {};
  for (let i = 0; i < 10; i++) erfasseAntwort(t, { zeit: tag(1), deckId: 'a', richtig: i < 9 });
  for (let i = 0; i < 10; i++) erfasseAntwort(t, { zeit: tag(2), deckId: 'b', richtig: i < 5 });
  for (let i = 0; i < 10; i++) erfasseAntwort(t, { zeit: tag(10), deckId: 'a', richtig: i < 6 });
  for (let i = 0; i < 6; i++) erfasseFreischaltung(t, { zeit: tag(1, 20), app: 'Instagram' });
  for (let i = 0; i < 3; i++) erfasseFreischaltung(t, { zeit: tag(2, 21), app: 'Reddit' });
  const saetze = auffaelligkeiten({ liste: tageListe(t, jetzt, 7), vorher: tageListe(t, jetzt, 7, 7), deckName: (id) => `Deck ${id}` });
  const text = saetze.join('\n');
  assert.match(text, /Richtig-Quote liegt bei 70 %/);
  assert.match(text, /Instagram: 67 %/);
  assert.match(text, /zwischen 20 und 22 Uhr/);
  assert.match(text, /Stärkstes Deck: Deck a \(90 %\).*Deck b \(50 %\)/);
  assert.ok(saetze.length <= 6);
});

test('Uhrzeit-Zähler überlebt Export und Import, alte Tage ohne Uhrzeit bleiben gültig', () => {
  const daten = leereDaten();
  erfasseFreischaltung(daten.tage, { zeit: tag(0, 20), app: 'Reddit' });
  daten.tage['2026-10-01'] = { a: 1, r: 1, q: 0, s: 0, n: 0, f: {}, d: {} };
  const zurueck = importJson(exportJson(daten));
  assert.deepEqual(zurueck.tage['2026-10-21'].u, { 20: 1 });
  assert.equal('u' in zurueck.tage['2026-10-01'], false);
  assert.deepEqual(zurueck, daten);
});

test('Uhrzeit-Zähler: ungültige Stunden und Zahlen werden verworfen', () => {
  const roh = { version: 1, decks: [], cards: [], tage: { [new Date().toISOString().slice(0, 10)]: { a: 0, r: 0, q: 0, s: 0, n: 0, f: {}, d: {}, u: { 5: 2, 24: 3, x: 1, 7: -4 } } } };
  const t = Object.values(importJson(JSON.stringify(roh)).tage)[0];
  assert.deepEqual(t.u, { 5: 2 });
});
