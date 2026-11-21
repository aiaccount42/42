import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GENERATOREN,
  erzeugeAufgabe,
  erzeugeAufgaben,
  generatorIds,
  istRichtigeZahl,
  parseZahl,
  zahlText,
} from '../js/core/generator.js';
import { istGueltig } from '../js/core/models.js';
import { seeded } from '../js/core/zufall.js';

// Unabhängige Nachrechnung je Aufgabentyp (bewusst nicht aus generator.js übernommen).
const nachrechnen = {
  prozentwert: ({ g, p }) => (g / 100) * p,
  aufschlag: ({ g, p }) => g + (g * p) / 100,
  abschlag: ({ g, p }) => g - (g * p) / 100,
  prozentsatz: ({ a, b }) => (a / b) * 100,
  grundwert: ({ w, p }) => (w / p) * 100,
  mwstBrutto: ({ n, satz }) => n + (n * satz) / 100,
  mwstNetto: ({ brutto, satz }) => brutto / (1 + satz / 100),
  prozentpunkte: ({ a, b }) => ((b - a) * 100) / a,
  zinsenJahr: ({ k, zins }) => (k * zins) / 100,
  zinsenMonate: ({ k, zins, m }) => (k * zins * m) / 1200,
  skonto: ({ r, s }) => r - (r * s) / 100,
  umsatzrendite: ({ g, u }) => (g / u) * 100,
  gewinnschwelle: ({ f, preis, v }) => f / (preis - v),
  mittelwert: ({ zahlen }) => zahlen.reduce((x, y) => x + y, 0) / zahlen.length,
  dreisatz: ({ a, t, b }) => (a * t) / b,
  aufteilung: ({ x, y, g }) => (g / (x + y)) * Math.max(x, y),
  wechselkurs: ({ kurs, e }) => e * kurs,
  abschreibung: ({ a, j }) => a / j,
};

const ALLE = GENERATOREN.flatMap((g) => g.typen.map((typ) => [g.id, typ]));

test('es gibt für jeden Aufgabentyp eine Nachrechnung', () => {
  assert.deepEqual(new Set(ALLE.map(([, typ]) => typ)), new Set(Object.keys(nachrechnen)));
  assert.equal(ALLE.length, 18);
});

for (const [id, typ] of ALLE) {
  test(`Aufgabe ${typ}: richtig gerechnet, 4 verschiedene Antworten, gültige Karte (300 Zufallswerte)`, () => {
    const gesehen = new Set();
    for (let seed = 0; seed < 300; seed++) {
      const k = erzeugeAufgabe(id, typ, seeded(seed));
      gesehen.add(k.frage);

      assert.ok(istGueltig(k), `ungültige Karte: ${k.frage}`);
      assert.equal(k.indexRichtig, 0);
      assert.equal(new Set(k.antworten).size, 4, `doppelte Antworten: ${k.antworten.join(' | ')}`);
      assert.equal(k.deckId, id);

      const soll = nachrechnen[typ](k.generiert.werte);
      assert.ok(Math.abs(soll - k.eingabe.wert) < 1e-9, `${k.frage}: ${soll} != ${k.eingabe.wert}`);
      assert.equal(k.antworten[0], zahlText(soll, k.eingabe.einheit), `${k.frage}: richtige Antwort falsch angezeigt`);
      assert.ok(soll > 0, `Lösung nicht positiv: ${k.frage}`);
      // Lösung hat höchstens 2 Nachkommastellen, sonst wäre die Eingabe unfair
      assert.ok(Math.abs(Math.round(soll * 100) - soll * 100) < 1e-6, `mehr als 2 Nachkommastellen: ${k.frage} → ${soll}`);
      // eingetippt wird die Lösung als Zahl akzeptiert
      assert.ok(istRichtigeZahl(zahlText(soll), soll));
    }
    assert.ok(gesehen.size > 10, `zu wenig Abwechslung bei ${typ}: ${gesehen.size} verschiedene Fragen`);
  });
}

test('falsche Antworten sind nie die richtige Lösung und immer positiv', () => {
  for (const [id, typ] of ALLE) {
    for (let seed = 0; seed < 100; seed++) {
      const k = erzeugeAufgabe(id, typ, seeded(seed));
      const richtig = k.eingabe.wert;
      for (const text of k.antworten.slice(1)) {
        const n = parseZahl(text);
        assert.ok(n > 0, `${typ}: nicht positiv: ${text}`);
        assert.notEqual(Math.round(n * 100), Math.round(richtig * 100), `${typ}: falsche Antwort = Lösung (${text})`);
      }
    }
  }
});

test('gleicher Seed → gleiche Aufgabe, anderer Seed → andere', () => {
  const a = erzeugeAufgabe(GENERATOREN[0].id, 'prozentwert', seeded(1));
  const b = erzeugeAufgabe(GENERATOREN[0].id, 'prozentwert', seeded(1));
  assert.equal(a.frage, b.frage);
  const viele = new Set(Array.from({ length: 50 }, (_, i) => erzeugeAufgabe(GENERATOREN[0].id, 'prozentwert', seeded(i)).frage));
  assert.ok(viele.size > 10);
});

test('unbekannte Aufgabe wirft', () => {
  assert.throws(() => erzeugeAufgabe('gen:gibtsnicht', 'prozentwert'));
  assert.throws(() => erzeugeAufgabe(GENERATOREN[0].id, 'zinsenJahr'));
});

test('erzeugeAufgaben: gewünschte Anzahl, verschiedene Typen, eindeutige IDs', () => {
  const aufgaben = erzeugeAufgaben(generatorIds(), 5, seeded(3), 0.5);
  assert.equal(aufgaben.length, 5);
  assert.equal(new Set(aufgaben.map((a) => a.generiert.typ)).size, 5);
  assert.equal(new Set(aufgaben.map((a) => a.id)).size, 5);
});

test('erzeugeAufgaben: nur aus erlaubten Generatoren, Anzahl 0 und unbekannte Ids', () => {
  const nurProzent = erzeugeAufgaben([GENERATOREN[0].id], 4, seeded(1));
  assert.ok(nurProzent.every((a) => a.deckId === GENERATOREN[0].id));
  assert.deepEqual(erzeugeAufgaben(generatorIds(), 0), []);
  assert.deepEqual(erzeugeAufgaben(['gen:xyz', 'deck-1'], 3), []);
  assert.deepEqual(erzeugeAufgaben([], 3), []);
});

test('erzeugeAufgaben: mehr Aufgaben als Typen wiederholt Typen, aber nie die gleiche Reihe zweimal hintereinander gleich', () => {
  const aufgaben = erzeugeAufgaben([GENERATOREN[0].id], 20, seeded(5));
  assert.equal(aufgaben.length, 20);
});

test('Eingabeanteil: 0 = nie, 1 = immer', () => {
  assert.ok(erzeugeAufgaben(generatorIds(), 10, seeded(1), 0).every((a) => a.alsEingabe === false));
  assert.ok(erzeugeAufgaben(generatorIds(), 10, seeded(1), 1).every((a) => a.alsEingabe === true));
});

// --- Zahlen lesen ---

test('zahlText: deutsche Schreibweise', () => {
  assert.equal(zahlText(1200, '€'), '1.200 €');
  assert.equal(zahlText(12.5, '%'), '12,50 %');
  assert.equal(zahlText(0.075), '0,08');
  assert.equal(zahlText(33.333333, '%'), '33,33 %');
  assert.equal(zahlText(25), '25');
});

test('parseZahl: Komma, Punkt, Tausender, Einheiten', () => {
  assert.equal(parseZahl('30'), 30);
  assert.equal(parseZahl('30 €'), 30);
  assert.equal(parseZahl('12,5'), 12.5);
  assert.equal(parseZahl('12.5'), 12.5);
  assert.equal(parseZahl('1.200'), 1200);
  assert.equal(parseZahl('1.200,50'), 1200.5);
  assert.equal(parseZahl('1200,5 €'), 1200.5);
  assert.equal(parseZahl('25 %'), 25);
  assert.equal(parseZahl('  8 Tage '), 8);
  assert.equal(parseZahl('1.200.000'), 1200000);
  assert.equal(parseZahl('.5'), 0.5);
  assert.equal(parseZahl('1 200'), 1200);
});

test('parseZahl: Unsinn ergibt NaN', () => {
  for (const s of ['', '   ', 'abc', '1,2,3', '1.2.3', '12a', '--5', '€', null, undefined]) {
    assert.ok(Number.isNaN(parseZahl(s)), `sollte NaN sein: ${JSON.stringify(s)}`);
  }
});

test('istRichtigeZahl: auf zwei Nachkommastellen genau', () => {
  assert.equal(istRichtigeZahl('22,5', 22.5), true);
  assert.equal(istRichtigeZahl('22.50', 22.5), true);
  assert.equal(istRichtigeZahl('22,51', 22.5), false);
  assert.equal(istRichtigeZahl('22', 22.5), false);
  assert.equal(istRichtigeZahl('x', 22.5), false);
  assert.equal(istRichtigeZahl('', 22.5), false);
  assert.equal(istRichtigeZahl('33,33', 33.333333), true);
  assert.equal(istRichtigeZahl('33,3', 33.333333), false);
});
