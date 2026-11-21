import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GENERATOREN, erzeugeAufgabe, zahlText } from '../js/core/generator.js';
import { GateFehler, GateSitzung } from '../js/core/sitzung.js';
import { festeUhr } from '../js/core/uhr.js';
import { seeded } from '../js/core/zufall.js';
import { datum, faelligeKarten } from '../testhilfen/helfer.js';

const uhr = festeUhr(datum(2026, 10, 20, 12, 0));
const app = { name: 'Reddit', urlScheme: 'reddit://' };
const aufgabe = (alsEingabe, seed = 1) => ({ ...erzeugeAufgabe(GENERATOREN[0].id, 'prozentwert', seeded(seed)), alsEingabe });
const sitzung = (karten) => new GateSitzung({ zielApp: app, gezogeneKarten: karten, uhr, zufall: seeded(1) });

test('Eingabe-Frage meldet "eingabe" mit Einheit; normale Frage nicht', () => {
  assert.equal(sitzung([aufgabe(true)]).aktuelleFrage.eingabe.einheit, '€');
  assert.equal(sitzung([aufgabe(false)]).aktuelleFrage.eingabe, null);
  assert.equal(sitzung(faelligeKarten(1)).aktuelleFrage.eingabe, null);
});

test('richtige Zahl (Komma, Einheit, Leerzeichen egal) besteht', () => {
  const k = aufgabe(true);
  const s = sitzung([k]);
  const e = s.beantworteZahl(`  ${zahlText(k.eingabe.wert)} € `);
  assert.equal(e.richtig, true);
  assert.equal(e.loesungText, k.antworten[0]);
  assert.equal(s.istBestanden, true);
});

test('falsche Zahl: Ergebnis zeigt Lösung und Eingabe, Karte kommt später wieder (Box 1)', () => {
  const k = aufgabe(true);
  const s = sitzung([k]);
  const e = s.beantworteZahl('1');
  assert.equal(e.richtig, false);
  assert.equal(e.eingabe, '1');
  assert.equal(e.loesungText, k.antworten[0]);
  assert.equal(s.istBestanden, false);
  assert.equal(s.aktuelleFrage.kartenId, k.id);
  assert.equal(s.aktualisierteKarten[0].box, 1);
});

test('Unsinn als Zahl zählt als falsch, nicht als Fehler', () => {
  const s = sitzung([aufgabe(true)]);
  assert.equal(s.beantworteZahl('abc').richtig, false);
  assert.equal(sitzung([aufgabe(true)]).beantworteZahl('').richtig, false);
});

test('Zahl bei einer Auswahlfrage wirft', () => {
  const s = sitzung([aufgabe(false)]);
  assert.throws(() => s.beantworteZahl('5'), (e) => e instanceof GateFehler && e.code === 'keineEingabeFrage');
  assert.equal(s.richtigeAntworten, 0);
});

test('Antwort-Index bei einer Eingabefrage ist trotzdem möglich (Rückfall)', () => {
  const s = sitzung([aufgabe(true)]);
  assert.equal(s.beantworte(s.aktuelleFrage.indexRichtig).richtig, true);
});

test('Zahl ohne offene Frage und ungültiger Typ wirft', () => {
  const s = sitzung([]);
  assert.throws(() => s.beantworteZahl('5'), (e) => e.code === 'keineAktuelleFrage');
  const t = sitzung([aufgabe(true)]);
  assert.throws(() => t.beantworteZahl({}), (e) => e.code === 'ungueltigeEingabe');
  assert.throws(() => t.beantworteZahl(null), (e) => e.code === 'ungueltigeEingabe');
});

test('Ergebnis der Auswahlfrage enthält Lösungstext und Karten-ID', () => {
  const s = sitzung(faelligeKarten(2));
  const id = s.aktuelleFrage.kartenId;
  const e = s.beantworte(s.aktuelleFrage.indexRichtig);
  assert.equal(e.kartenId, id);
  assert.equal(e.loesungText, 'R');
});

test('Zufallsaufgaben ändern die gespeicherten Karten nicht: aktualisierteKarten enthält sie aber (App filtert)', () => {
  const k = aufgabe(true);
  const s = sitzung([k]);
  s.beantworteZahl(String(k.eingabe.wert));
  assert.equal(s.aktualisierteKarten.length, 1);
  assert.equal(s.aktualisierteKarten[0].id, k.id);
});
