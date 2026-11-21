import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BELIEBTE_APPS } from '../js/core/apps.js';

test('Beliebte Apps: Namen eindeutig, Schemes eigene App-Schemes (kein http)', () => {
  const namen = BELIEBTE_APPS.map((a) => a.name.toLowerCase());
  assert.equal(new Set(namen).size, namen.length);
  for (const a of BELIEBTE_APPS) {
    assert.match(a.urlScheme, /^[a-z][a-z0-9+.-]*:\/\/$/, a.name);
    assert.doesNotMatch(a.urlScheme, /^https?:/, a.name);
    assert.ok(a.gruppe && a.name.trim() === a.name, a.name);
  }
});

test('Beliebte Apps enthalten die bestätigten Apps des Nutzers', () => {
  const bestaetigt = BELIEBTE_APPS.filter((a) => a.bestaetigt).map((a) => a.name);
  for (const name of ['Instagram', 'Reddit', 'WhatsApp', 'mydealz', 'Kleinanzeigen']) assert.ok(bestaetigt.includes(name), name);
});
