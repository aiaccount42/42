import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUELLEN, lernenAnsicht } from '../js/lernen.js';

test('jede Quelle hat Kurzname, Titel und einen https-Link', () => {
  assert.ok(QUELLEN.length >= 8);
  for (const q of QUELLEN) {
    assert.ok(q.kurz && q.text, q.kurz);
    assert.match(q.url, /^https:\/\//);
  }
});

test('Lernseite: jede im Text genannte Studie steht auch in den Quellen', () => {
  const html = lernenAnsicht();
  for (const name of ['Cepeda', 'Dunlosky', 'Roediger', 'Brunmair', 'Rohrer', 'Simons', 'Raichle', 'Kornell', 'Butterfield']) {
    assert.match(html, new RegExp(name), `${name} fehlt im Text`);
    assert.ok(QUELLEN.some((q) => q.kurz.includes(name)), `${name} fehlt in den Quellen`);
  }
  assert.match(html, /ACTIVE/);
});

test('Lernseite: Externe Links öffnen sicher und der Text benennt Grenzen der Forschung', () => {
  const html = lernenAnsicht();
  for (const link of html.match(/<a [^>]*href="https:[^>]*>/g) ?? []) assert.match(link, /rel="noopener"/);
  assert.match(html, /kein Wundermittel/);
  assert.match(html, /kein Beweis/);
  assert.match(html, /Abnehm-Trick/);
});
