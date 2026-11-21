import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ziehen } from '../js/core/auswahl.js';
import { baueGateKarten } from '../js/core/gateaufbau.js';
import {
  INTERVALL_MAX,
  aktuellerIntervall,
  boxFuerIntervall,
  faelligkeitsVorschau,
  intelligentFalsch,
  intelligentRichtig,
  zeitqualitaet,
} from '../js/core/intervall.js';
import { INSTAGRAM, neueKarte, standardSettings } from '../js/core/models.js';
import { GateSitzung } from '../js/core/sitzung.js';
import { istProblemkarte } from '../js/core/schwierigkeit.js';
import { seeded } from '../js/core/zufall.js';
import { TAG, datum, faelligeKarten, karte, richtig } from '../testhilfen/helfer.js';

const jetzt = datum(2026, 10, 20, 12);
const k = (extra = {}) => ({ ...karte('F', { faelligAm: datum(2026, 1, 1) }), ...extra });
const tageSpaeter = (ms, n) => Math.round((ms - datum(2026, 10, 20, 0)) / TAG) === n;

test('Abstände wachsen: 1, 3, dann Abstand mal Faktor', () => {
  let c = k();
  const abstaende = [];
  for (let i = 0; i < 6; i++) {
    c = intelligentRichtig(c, jetzt, { sekunden: 10 });
    abstaende.push(c.intervall);
  }
  assert.deepEqual(abstaende.slice(0, 2), [1, 3]);
  for (let i = 1; i < abstaende.length; i++) assert.ok(abstaende[i] > abstaende[i - 1], abstaende.join());
  assert.ok(abstaende[5] > 20);
});

test('Abstand ist auf 180 Tage begrenzt', () => {
  let c = k({ intervall: 170, ease: 3 });
  c = intelligentRichtig(c, jetzt, { sekunden: 2 });
  assert.equal(c.intervall, INTERVALL_MAX);
});

test('Falsch: Abstand 0, Box 1, morgen fällig, Faktor sinkt, Fehlversuch zählt', () => {
  const c = intelligentFalsch(k({ intervall: 20, ease: 2.3, box: 4, versuche: 5, treffer: 5 }), jetzt);
  assert.equal(c.intervall, 0);
  assert.equal(c.box, 1);
  assert.equal(c.ease, 2.1);
  assert.equal(c.faelligAm, datum(2026, 10, 21, 0));
  assert.deepEqual([c.versuche, c.treffer], [6, 5]);
});

test('Nach einem Fehler beginnt der Aufbau wieder bei 1 Tag', () => {
  const c = intelligentRichtig(intelligentFalsch(k({ intervall: 40, box: 5 }), jetzt), jetzt, { sekunden: 10 });
  assert.equal(c.intervall, 1);
  assert.equal(c.box, 2);
});

test('Antwortzeit: schnell erhöht, langsam senkt den Faktor und bremst das Wachstum', () => {
  const basis = k({ intervall: 10, ease: 2.3, versuche: 3, treffer: 3 });
  const schnell = intelligentRichtig(basis, jetzt, { sekunden: 2 });
  const normal = intelligentRichtig(basis, jetzt, { sekunden: 10 });
  const langsam = intelligentRichtig(basis, jetzt, { sekunden: 30 });
  const ohne = intelligentRichtig(basis, jetzt, {});
  assert.ok(schnell.ease > normal.ease && normal.ease > langsam.ease);
  assert.ok(schnell.intervall > normal.intervall && normal.intervall > langsam.intervall);
  assert.equal(ohne.intervall, normal.intervall);
});

test('Zeitqualität je Kartentyp, unbrauchbare Zeiten zählen als normal', () => {
  assert.equal(zeitqualitaet({ typ: 'auswahl' }, 3), 'schnell');
  assert.equal(zeitqualitaet({ typ: 'auswahl' }, 10), 'normal');
  assert.equal(zeitqualitaet({ typ: 'auswahl' }, 25), 'langsam');
  assert.equal(zeitqualitaet({ typ: 'reihenfolge' }, 25), 'normal');
  assert.equal(zeitqualitaet({ typ: 'auswahl' }, 500), 'normal');
  assert.equal(zeitqualitaet({ typ: 'auswahl' }, undefined), 'normal');
  assert.equal(zeitqualitaet({ typ: 'auswahl' }, -1), 'normal');
});

test('Wahr/Falsch (leicht zu raten) wächst langsamer als Reihenfolge', () => {
  const basis = { intervall: 10, ease: 2.3 };
  const wf = intelligentRichtig(k({ ...basis, typ: 'wahrfalsch', antworten: ['Wahr', 'Falsch'], indexRichtig: 0 }), jetzt, { sekunden: 10 });
  const mc = intelligentRichtig(k(basis), jetzt, { sekunden: 10 });
  const rf = intelligentRichtig(k({ ...basis, typ: 'reihenfolge', antworten: ['a', 'b', 'c'] }), jetzt, { sekunden: 10 });
  assert.ok(wf.intervall < mc.intervall && mc.intervall < rf.intervall, [wf.intervall, mc.intervall, rf.intervall].join());
});

test('Alte Karten ohne Abstand: Abstand wird aus der Box abgeleitet', () => {
  assert.equal(aktuellerIntervall(k({ intervall: null, box: 1 })), 0);
  assert.equal(aktuellerIntervall(k({ intervall: null, box: 3 })), 4);
  assert.equal(aktuellerIntervall(k({ intervall: null, box: 1, versuche: 3 })), 1);
  assert.equal(aktuellerIntervall(k({ intervall: 7 })), 7);
  assert.deepEqual([0, 1, 2, 3, 7, 8, 29, 30, 100].map(boxFuerIntervall), [1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

test('Fälligkeit: Tagesbeginn des Zieltages', () => {
  const c = intelligentRichtig(k(), jetzt, { sekunden: 5 });
  assert.equal(c.faelligAm, datum(2026, 10, 21, 0));
  assert.ok(tageSpaeter(intelligentRichtig(k({ intervall: 1 }), jetzt).faelligAm, 3));
});

test('Gate im Modus intelligent: richtige Antwort setzt Abstand, Antwortzeit wird genutzt', () => {
  const s = new GateSitzung({ zielApp: INSTAGRAM, gezogeneKarten: [k()], uhr: { jetzt: () => jetzt }, zufall: seeded(1), lernmodus: 'intelligent' });
  s.beantworte(richtig(s), { sekunden: 2 });
  const [c] = s.aktualisierteKarten;
  assert.equal(c.intervall, 1);
  assert.equal(c.ease, 2.4);
});

test('Gate im Modus einfach bleibt bei Leitner (kein Abstand gesetzt)', () => {
  const s = new GateSitzung({ zielApp: INSTAGRAM, gezogeneKarten: [k()], uhr: { jetzt: () => jetzt }, zufall: seeded(1) });
  s.beantworte(richtig(s), { sekunden: 2 });
  const [c] = s.aktualisierteKarten;
  assert.equal(c.intervall, null);
  assert.equal(c.box, 2);
});

test('Auswahl mit neuMax: Wiederholungen vor neuen Karten, neue Karten begrenzt', () => {
  const neu = faelligeKarten(6);
  const wdh = Array.from({ length: 6 }, (_, i) => ({ ...karte(`W${i}`, { box: 3, faelligAm: datum(2026, 1, 1) }), versuche: 3, treffer: 3 }));
  const ids = (anzahl, neuMax) => ziehen([...neu, ...wdh], anzahl, jetzt, seeded(1), { neuMax });
  const gezogen = ids(5, 2);
  assert.equal(gezogen.filter((c) => c.versuche === 0).length, 2);
  assert.equal(gezogen.filter((c) => c.versuche > 0).length, 3);
  assert.equal(ids(5, 0).filter((c) => c.versuche === 0).length, 0);
  // ohne neuMax: altes Verhalten (niedrige Box zuerst = neue Karten)
  assert.equal(ziehen([...neu, ...wdh], 5, jetzt, seeded(1)).filter((c) => c.versuche === 0).length, 5);
});

test('Auswahl mit neuMax füllt mit neuen Karten auf, wenn zu wenige Wiederholungen fällig sind', () => {
  const neu = faelligeKarten(6);
  const wdh = [{ ...karte('W', { box: 3, faelligAm: datum(2026, 1, 1) }), versuche: 3, treffer: 3 }];
  const gezogen = ziehen([...neu, ...wdh], 5, jetzt, seeded(2), { neuMax: 1 });
  assert.equal(gezogen.length, 5);
  assert.equal(gezogen.filter((c) => c.versuche === 0).length, 4);
});

test('Quiz-Aufbau nutzt neueProQuiz nur im Modus intelligent', () => {
  const neu = faelligeKarten(8);
  const wdh = Array.from({ length: 8 }, (_, i) => ({ ...karte(`W${i}`, { box: 3, faelligAm: datum(2026, 1, 1) }), versuche: 3, treffer: 3 }));
  const gate = (lernmodus) =>
    baueGateKarten({ settings: standardSettings({ lernmodus, neueProQuiz: 1, generatorFragen: 0, reibung: { an: false, start: 5, schritt: 0, max: 5 }, kartenProGate: 5 }), karten: [...neu, ...wdh], appName: 'X', jetzt, zufall: seeded(4) });
  assert.equal(gate('intelligent').filter((c) => c.versuche === 0).length, 1);
  assert.equal(gate('einfach').filter((c) => c.versuche === 0).length, 5);
});

test('Fälligkeitsvorschau: heute (inkl. überfällig), morgen, danach bis Tag 7', () => {
  const tag = (n) => datum(2026, 10, 20 + n, 0);
  const karten = [tag(-5), tag(0), tag(1), tag(1), tag(3), tag(7), tag(8), tag(30)].map((faelligAm) => ({ ...karte('F'), faelligAm }));
  assert.deepEqual(faelligkeitsVorschau(karten, jetzt), { heute: 2, morgen: 2, danach: 2 });
});

test('Problemkarte: ab 5 Versuchen, mindestens 4 Fehler und unter 40 % richtig', () => {
  assert.equal(istProblemkarte(k({ versuche: 5, treffer: 1 })), true);
  assert.equal(istProblemkarte(k({ versuche: 4, treffer: 0 })), false);
  assert.equal(istProblemkarte(k({ versuche: 10, treffer: 5 })), false);
  assert.equal(istProblemkarte(k({ versuche: 9, treffer: 5 })), false);
});

test('neue Karten haben Standardwerte für Abstand und Faktor', () => {
  const c = neueKarte({ deckId: 'd', frage: 'F?', antworten: ['a', 'b', 'c', 'd'], indexRichtig: 0 });
  assert.equal(c.intervall, null);
  assert.equal(c.ease, 2.3);
});
