import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freischaltLink, zeitZahl } from '../js/core/shortcut.js';
import { datum } from '../testhilfen/helfer.js';

const instagram = { name: 'Instagram', urlScheme: 'instagram://' };

const eingabeAus = (link) => JSON.parse(decodeURIComponent(new URL(link).searchParams.get('text')));

test('zeitZahl: Ortszeit als jjjjMMttHHmm', () => {
  assert.equal(zeitZahl(datum(2026, 10, 19, 22, 15, 59)), 202610192215);
  assert.equal(zeitZahl(datum(2026, 1, 2, 3, 4)), 202601020304);
});

test('zeitZahl: lässt sich über Monats- und Jahresgrenzen als Zahl vergleichen', () => {
  assert.ok(zeitZahl(datum(2026, 11, 1, 0, 5)) > zeitZahl(datum(2026, 10, 31, 23, 55)));
  assert.ok(zeitZahl(datum(2027, 1, 1, 0, 0)) > zeitZahl(datum(2026, 12, 31, 23, 59)));
});

test('zeitZahl: nach der Sommerzeitumstellung stimmt die Ortszeit', () => {
  assert.equal(zeitZahl(datum(2026, 10, 25, 4, 30)), 202610250430);
});

test('ohne Kurzbefehl-Name: direkt das URL-Scheme der Ziel-App', () => {
  assert.equal(freischaltLink({ kurzbefehl: '', zielApp: instagram, bis: datum(2026, 10, 19, 22, 15) }), 'instagram://');
  assert.equal(freischaltLink({ kurzbefehl: '   ', zielApp: instagram, bis: 0 }), 'instagram://');
  assert.equal(freischaltLink({ zielApp: instagram, bis: 0 }), 'instagram://');
});

test('mit Kurzbefehl-Name: shortcuts://run-shortcut mit JSON-Eingabe', () => {
  const link = freischaltLink({ kurzbefehl: 'LernGate Frei', zielApp: instagram, bis: datum(2026, 10, 19, 22, 15) });
  assert.ok(link.startsWith('shortcuts://run-shortcut?name=LernGate%20Frei&input=text&text='));
  assert.deepEqual(eingabeAus(link), { app: 'Instagram', url: 'instagram://', bis: 202610192215 });
});

test('Ablaufzeit wird auf die nächste volle Minute aufgerundet', () => {
  const l1 = freischaltLink({ kurzbefehl: 'K', zielApp: instagram, bis: datum(2026, 10, 19, 22, 15, 1) });
  const l2 = freischaltLink({ kurzbefehl: 'K', zielApp: instagram, bis: datum(2026, 10, 19, 22, 15, 0) });
  assert.equal(eingabeAus(l1).bis, 202610192216);
  assert.equal(eingabeAus(l2).bis, 202610192215);
});

test('Sonderzeichen in Namen werden sauber kodiert', () => {
  const app = { name: 'Reddit & Co', urlScheme: 'reddit://' };
  const link = freischaltLink({ kurzbefehl: 'Frei schalten & los', zielApp: app, bis: datum(2026, 10, 19, 22, 15) });
  const url = new URL(link);
  assert.equal(url.searchParams.get('name'), 'Frei schalten & los');
  assert.equal(eingabeAus(link).app, 'Reddit & Co');
});
