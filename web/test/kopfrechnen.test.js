import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GENERATOREN, erzeugeAufgabe } from '../js/core/generator.js';
import { KOPFRECHEN_TYPEN, kopfrechenWeg, prozentSchritte, teilenSchritte } from '../js/core/kopfrechnen.js';
import { seeded } from '../js/core/zufall.js';
import { zahlText } from '../js/core/zahlformat.js';

const alleTypen = GENERATOREN.flatMap((g) => g.typen.map((typ) => [g.id, typ]));

test('jede Aufgabenart hat einen Kopfrechen-Weg', () => {
  assert.deepEqual(new Set(KOPFRECHEN_TYPEN), new Set(alleTypen.map(([, typ]) => typ)));
});

test('Weg und Tipp: vorhanden, enden mit dem richtigen Ergebnis, Tipp verrät es nicht', () => {
  for (const [id, typ] of alleTypen) {
    for (let seed = 0; seed < 150; seed++) {
      const k = erzeugeAufgabe(id, typ, seeded(seed));
      const [kopf, rest] = k.erklaerung.split('\n\nFormel: ');
      assert.ok(kopf.startsWith('So geht es im Kopf:\n'), `${typ}: ${k.erklaerung}`);
      assert.ok(rest, `${typ}: Formel fehlt`);
      assert.ok(k.tipp && k.tipp.length > 10, `${typ}: Tipp fehlt`);
      const ergebnis = zahlText(k.eingabe.wert);
      // der letzte Rechenschritt (Probe-Zeilen ausgenommen) nennt das Ergebnis
      const zeilen = kopf.split('\n').slice(1).filter((z) => !z.startsWith('Probe:'));
      assert.ok(zeilen.length >= 1);
      assert.ok(zeilen[zeilen.length - 1].includes(ergebnis), `${typ} (Seed ${seed}): Ergebnis ${ergebnis} fehlt in „${zeilen[zeilen.length - 1]}“\n${k.erklaerung}`);
      // kurze Zahlen (10 %, 100 %, 19 %, 9 Monate …) kommen in Tipps als Beispiel vor und zählen nicht als Verrat
      assert.ok(ergebnis.length < 4 || !k.tipp.includes(ergebnis), `${typ}: Tipp verrät das Ergebnis ${ergebnis}: ${k.tipp}`);
    }
  }
});

test('Prozent im Kopf: alle Zerlegungen rechnen richtig', () => {
  for (const p of [1, 5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 17]) {
    for (const g of [40, 150, 240, 1200]) {
      const s = prozentSchritte(g, p);
      assert.ok(Math.abs(s.wert - (g * p) / 100) < 1e-9);
      assert.ok(s.zeilen[s.zeilen.length - 1].includes(zahlText((g * p) / 100)), `${p} % von ${g}: ${s.zeilen.join(' | ')}`);
    }
  }
});

test('Teilen im Kopf: Probe stimmt', () => {
  for (const t of [2, 4, 5, 8, 10, 20, 25, 50, 6]) {
    const s = teilenSchritte(t * 37, t);
    assert.equal(s.wert, 37);
    assert.ok(s.zeilen.at(-1).includes(zahlText(t * 37)));
  }
});

test('Beispiel: 15 % von 240 €', () => {
  const s = prozentSchritte(240, 15, (n) => zahlText(n, '€'));
  assert.deepEqual(s.zeilen, ['10 % von 240 € = 24 €', '5 % = die Hälfte davon = 12 €', '15 % = 24 € + 12 € = 36 €']);
});

test('unbekannte Aufgabenart: kein Weg', () => {
  assert.equal(kopfrechenWeg('gibtsnicht', {}), null);
});
