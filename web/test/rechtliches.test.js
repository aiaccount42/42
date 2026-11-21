import assert from 'node:assert/strict';
import { test } from 'node:test';
import { datenschutzAnsicht, fehlendeAngaben, impressumAnsicht } from '../js/rechtliches.js';

const voll = { name: 'Max Muster', strasse: 'Musterweg 1', ort: '12345 Musterstadt', email: 'max@example.org' };

test('ohne Angaben: Platzhalter und roter Hinweis in beiden Seiten', () => {
  for (const html of [impressumAnsicht({}), datenschutzAnsicht({})]) {
    assert.match(html, /class="hinweis fehler"/);
    assert.match(html, /\[Vor- und Nachname\]/);
    assert.match(html, /\[E-Mail-Adresse\]/);
  }
});

test('mit allen Angaben: keine Platzhalter und kein Hinweis', () => {
  for (const html of [impressumAnsicht(voll), datenschutzAnsicht(voll)]) {
    assert.doesNotMatch(html, /fehler/);
    assert.doesNotMatch(html, /platzhalter/);
    assert.match(html, /Max Muster/);
    assert.match(html, /mailto:max@example\.org/);
  }
});

test('fehlendeAngaben nennt genau die leeren Felder; Leerzeichen zählen als leer', () => {
  assert.deepEqual(fehlendeAngaben(voll), []);
  assert.deepEqual(fehlendeAngaben({ ...voll, strasse: '   ', email: '' }), ['Straße und Hausnummer', 'E-Mail-Adresse']);
});

test('Angaben werden maskiert (kein HTML-Einschleusen)', () => {
  const html = impressumAnsicht({ ...voll, name: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test('Datenschutz nennt Hosting, lokale Speicherung und Betroffenenrechte; Impressum verweist auf § 5 DDG', () => {
  const ds = datenschutzAnsicht(voll);
  assert.match(ds, /Netlify/);
  assert.match(ds, /localStorage/);
  assert.match(ds, /Art\. 15/);
  assert.match(impressumAnsicht(voll), /§ 5 DDG/);
});
