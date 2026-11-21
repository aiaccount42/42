import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INSTAGRAM, REDDIT } from '../js/core/models.js';
import { GateFehler, GateSitzung } from '../js/core/sitzung.js';
import { festeUhr } from '../js/core/uhr.js';
import { seeded } from '../js/core/zufall.js';
import { datum, faelligeKarten, falsch, karte, richtig } from '../testhilfen/helfer.js';

const uhr = festeUhr(datum(2026, 10, 19, 12, 0));
const sitzung = (karten, { seed = 1, abstand = 2 } = {}) =>
  new GateSitzung({ zielApp: INSTAGRAM, gezogeneKarten: karten, wiederholungsAbstand: abstand, uhr, zufall: seeded(seed) });
const alleRichtig = (s) => {
  while (s.aktuelleFrage) s.beantworte(richtig(s));
};
const alt = () => karte('F', { faelligAm: datum(2026, 10, 1) });

// --- Bestehen ---

test('5 richtige Antworten bestehen das Gate', () => {
  const s = sitzung(faelligeKarten(5));
  assert.equal(s.status, 'laeuft');
  assert.equal(s.benoetigteRichtige, 5);
  for (let gestellt = 1; gestellt <= 5; gestellt++) {
    assert.equal(s.istBestanden, false);
    assert.equal(s.beantworte(richtig(s)).richtig, true);
    assert.equal(s.richtigeAntworten, gestellt);
  }
  assert.equal(s.istBestanden, true);
  assert.equal(s.status, 'bestanden');
  assert.equal(s.aktuelleFrage, null);
});

test('richtige Karten steigen eine Box auf (Box 2 → übermorgen fällig)', () => {
  const s = sitzung(faelligeKarten(5));
  alleRichtig(s);
  assert.deepEqual(s.aktualisierteKarten.map((k) => k.box), [2, 2, 2, 2, 2]);
  assert.ok(s.aktualisierteKarten.every((k) => k.faelligAm === datum(2026, 10, 21, 0, 0)));
});

// --- Falsche Antworten ---

test('falsche Karte kommt später erneut; Gate braucht 5 richtige', () => {
  const s = sitzung(faelligeKarten(5));
  const erste = s.aktuelleFrage.kartenId;
  const ergebnis = s.beantworte(falsch(s));
  assert.equal(ergebnis.richtig, false);
  assert.equal(s.richtigeAntworten, 0);

  const reihenfolge = [];
  while (s.aktuelleFrage) {
    reihenfolge.push(s.aktuelleFrage.kartenId);
    s.beantworte(richtig(s));
  }
  assert.equal(reihenfolge.length, 5);
  assert.equal(reihenfolge[2], erste); // Abstand 2
  assert.equal(s.istBestanden, true);
  assert.equal(s.richtigeAntworten, 5);
});

test('nicht bestanden, solange eine falsche Karte offen ist', () => {
  const s = sitzung(faelligeKarten(5));
  s.beantworte(falsch(s));
  for (let i = 0; i < 4; i++) s.beantworte(richtig(s));
  assert.equal(s.richtigeAntworten, 4);
  assert.equal(s.istBestanden, false);
  assert.equal(s.status, 'laeuft');
  s.beantworte(richtig(s));
  assert.equal(s.istBestanden, true);
});

test('falsche Karte rutscht in Box 1, morgen fällig', () => {
  const s = sitzung([karte('hoch', { box: 4, faelligAm: datum(2026, 10, 1) })]);
  s.beantworte(falsch(s));
  const stand = s.aktualisierteKarten[0];
  assert.equal(stand.box, 1);
  assert.equal(stand.faelligAm, datum(2026, 10, 20, 0, 0));
});

test('später richtig im selben Gate: Karte bleibt in Box 1', () => {
  const s = sitzung([karte('F', { box: 3, faelligAm: datum(2026, 10, 1) })]);
  s.beantworte(falsch(s));
  s.beantworte(richtig(s));
  assert.equal(s.istBestanden, true);
  assert.equal(s.aktualisierteKarten[0].box, 1);
});

test('mehrfach falsch bis richtig', () => {
  const s = sitzung(faelligeKarten(2));
  for (let i = 0; i < 3; i++) s.beantworte(falsch(s));
  assert.equal(s.richtigeAntworten, 0);
  assert.equal(s.istBestanden, false);
  alleRichtig(s);
  assert.equal(s.istBestanden, true);
  assert.equal(s.richtigeAntworten, 2);
});

test('letzte Karte falsch → kommt sofort wieder', () => {
  const s = sitzung([alt()]);
  const id = s.aktuelleFrage.kartenId;
  s.beantworte(falsch(s));
  assert.equal(s.aktuelleFrage.kartenId, id);
  assert.equal(s.status, 'laeuft');
});

test('Wiederholungsabstand 0 → falsche Karte sofort wieder', () => {
  const s = sitzung(faelligeKarten(3), { abstand: 0 });
  const id = s.aktuelleFrage.kartenId;
  s.beantworte(falsch(s));
  assert.equal(s.aktuelleFrage.kartenId, id);
});

// --- Randfälle Kartenanzahl ---

test('weniger als 5 Karten: gespielt wird mit den vorhandenen', () => {
  const s = sitzung(faelligeKarten(3));
  assert.equal(s.benoetigteRichtige, 3);
  for (let i = 0; i < 3; i++) {
    assert.equal(s.status, 'laeuft');
    s.beantworte(richtig(s));
  }
  assert.equal(s.istBestanden, true);
});

test('eine Karte reicht zum Bestehen', () => {
  const s = sitzung(faelligeKarten(1));
  s.beantworte(richtig(s));
  assert.equal(s.istBestanden, true);
});

test('0 Karten: Hinweis "Erst Karten anlegen", keine Frage', () => {
  const s = sitzung([]);
  assert.equal(s.status, 'keineKarten');
  assert.equal(s.hinweis, 'Erst Karten anlegen');
  assert.equal(s.aktuelleFrage, null);
  assert.equal(s.istBestanden, false);
  assert.equal(s.benoetigteRichtige, 0);
});

test('nur ungültige Karten zählen als 0 Karten', () => {
  assert.equal(sitzung([{ ...alt(), antworten: ['a'] }]).status, 'keineKarten');
});

test('doppelte Karten-IDs werden nur einmal gestellt', () => {
  const k = alt();
  assert.equal(sitzung([k, k]).benoetigteRichtige, 1);
});

test('Hinweis nur bei 0 Karten', () => {
  assert.equal(sitzung(faelligeKarten(2)).hinweis, null);
});

// --- Start über Auswahl ---

test('Start aus allen Karten zieht 5', () => {
  const s = GateSitzung.ausAllenKarten({ zielApp: REDDIT, alleKarten: faelligeKarten(12), uhr, zufall: seeded(3) });
  assert.equal(s.benoetigteRichtige, 5);
  assert.equal(s.zielApp, REDDIT);
});

test('Start aus allen Karten respektiert die Anzahl', () => {
  const s = GateSitzung.ausAllenKarten({ zielApp: INSTAGRAM, alleKarten: faelligeKarten(12), anzahl: 3, uhr, zufall: seeded(3) });
  assert.equal(s.benoetigteRichtige, 3);
});

// --- Antworten ---

test('Antworten sind gemischt, richtiger Index stimmt immer', () => {
  for (let seed = 0; seed < 50; seed++) {
    const frage = sitzung([alt()], { seed }).aktuelleFrage;
    assert.deepEqual([...frage.antworten].sort(), ['A', 'C', 'D', 'R']);
    assert.equal(frage.antworten[frage.indexRichtig], 'R');
  }
});

test('Position der richtigen Antwort variiert', () => {
  const positionen = new Set();
  for (let seed = 0; seed < 50; seed++) positionen.add(sitzung([alt()], { seed }).aktuelleFrage.indexRichtig);
  assert.deepEqual(positionen, new Set([0, 1, 2, 3]));
});

test('Ergebnis enthält die richtige Lösung fürs Feedback', () => {
  const s = sitzung(faelligeKarten(2));
  const richtiger = s.aktuelleFrage.indexRichtig;
  const falscher = falsch(s);
  const ergebnis = s.beantworte(falscher);
  assert.equal(ergebnis.indexRichtig, richtiger);
  assert.equal(ergebnis.gewaehlterIndex, falscher);
});

// --- Fehlerfälle ---

test('ungültiger Antwortindex wirft und ändert nichts', () => {
  const s = sitzung(faelligeKarten(2));
  const vorher = s.aktuelleFrage;
  for (const index of [4, -1, 1.5, NaN, undefined]) {
    assert.throws(() => s.beantworte(index), (e) => e instanceof GateFehler && e.code === 'ungueltigerAntwortIndex');
  }
  assert.equal(s.aktuelleFrage, vorher);
  assert.equal(s.richtigeAntworten, 0);
});

test('Antworten nach bestandenem Gate wirft', () => {
  const s = sitzung(faelligeKarten(1));
  s.beantworte(richtig(s));
  assert.throws(() => s.beantworte(0), (e) => e.code === 'keineAktuelleFrage');
});

test('Antworten ohne Karten wirft', () => {
  assert.throws(() => sitzung([]).beantworte(0), (e) => e.code === 'keineAktuelleFrage');
});
