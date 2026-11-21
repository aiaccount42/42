import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeImport, parseDeck } from '../js/core/deckformat.js';
import { frageAusKarte } from '../js/core/frage.js';
import { istGueltig, neueKarte } from '../js/core/models.js';
import { ProbeSitzung } from '../js/core/probe.js';
import { GateFehler, GateSitzung } from '../js/core/sitzung.js';
import { seeded } from '../js/core/zufall.js';
import { INSTAGRAM } from '../js/core/models.js';
import { datum } from '../testhilfen/helfer.js';

const k = (feld) => neueKarte({ deckId: 'd', frage: 'F?', antworten: ['a', 'b', 'c', 'd'], indexRichtig: 0, ...feld });
const gate = (karten) => new GateSitzung({ zielApp: INSTAGRAM, gezogeneKarten: karten, uhr: { jetzt: () => datum(2026, 10, 20) }, zufall: seeded(3) });

test('Gültigkeit je Kartentyp', () => {
  assert.equal(istGueltig(k({})), true);
  assert.equal(istGueltig(k({ typ: 'wahrfalsch', antworten: ['Wahr', 'Falsch'], indexRichtig: 1 })), true);
  assert.equal(istGueltig(k({ typ: 'wahrfalsch', antworten: ['Wahr', 'Falsch'], indexRichtig: 2 })), false);
  assert.equal(istGueltig(k({ typ: 'luecke', frage: 'Das Herz hat ___ Kammern.' })), true);
  assert.equal(istGueltig(k({ typ: 'luecke', frage: 'Ohne Lücke' })), false);
  assert.equal(istGueltig(k({ typ: 'reihenfolge', antworten: ['1', '2', '3'] })), true);
  assert.equal(istGueltig(k({ typ: 'reihenfolge', antworten: ['1', '2'] })), false);
  assert.equal(istGueltig(k({ typ: 'reihenfolge', antworten: ['1', '1', '2'] })), false);
  assert.equal(istGueltig(k({ typ: 'reihenfolge', antworten: ['1', '2', '3', '4', '5', '6', '7'] })), false);
  assert.equal(istGueltig({ ...k({}), typ: 'unbekannt' }), false);
});

test('Wahr/Falsch: feste Reihenfolge, Auswertung wie bei Auswahl', () => {
  const s = gate([k({ typ: 'wahrfalsch', antworten: ['Wahr', 'Falsch'], indexRichtig: 1 })]);
  assert.deepEqual(s.aktuelleFrage.antworten, ['Wahr', 'Falsch']);
  assert.equal(s.aktuelleFrage.loesungText, 'Falsch');
  assert.equal(s.beantworte(1).richtig, true);
  assert.equal(s.istBestanden, true);
});

test('Reihenfolge: Schritte erscheinen nie schon richtig sortiert', () => {
  for (let seed = 0; seed < 60; seed++) {
    const f = frageAusKarte(k({ typ: 'reihenfolge', antworten: ['A', 'B', 'C'] }), seeded(seed));
    assert.notDeepEqual(f.antworten, ['A', 'B', 'C']);
    assert.deepEqual(f.reihenfolgeRichtig.map((i) => f.antworten[i]), ['A', 'B', 'C']);
    assert.equal(f.loesungText, 'A → B → C');
  }
});

test('Reihenfolge: richtige und falsche Antwort, falsche Karte kommt später wieder', () => {
  const s = gate([k({ typ: 'reihenfolge', antworten: ['Erst', 'Dann', 'Zuletzt'] })]);
  const f = s.aktuelleFrage;
  const falsch = [...f.reihenfolgeRichtig].reverse();
  const e = s.beantworteReihenfolge(falsch);
  assert.equal(e.richtig, false);
  assert.equal(e.loesungText, 'Erst → Dann → Zuletzt');
  assert.deepEqual(e.gewaehlteReihenfolge, falsch.map((i) => f.antworten[i]));
  assert.equal(s.istBestanden, false);
  const f2 = s.aktuelleFrage;
  assert.equal(s.beantworteReihenfolge(f2.reihenfolgeRichtig).richtig, true);
  assert.equal(s.istBestanden, true);
});

test('Reihenfolge: ungültige Eingaben und falscher Aufrufweg werden abgelehnt', () => {
  const s = gate([k({ typ: 'reihenfolge', antworten: ['1', '2', '3'] })]);
  assert.throws(() => s.beantworteReihenfolge([0, 1]), GateFehler);
  assert.throws(() => s.beantworteReihenfolge([0, 0, 1]), GateFehler);
  const m = gate([k({})]);
  assert.throws(() => m.beantworteReihenfolge([0, 1, 2]), GateFehler);
});

test('Probelauf versteht alle Kartentypen', () => {
  const karten = [
    k({ frage: 'A?' }),
    k({ typ: 'wahrfalsch', frage: 'B', antworten: ['Wahr', 'Falsch'], indexRichtig: 0 }),
    k({ typ: 'luecke', frage: 'C ___', antworten: ['x', 'y', 'z', 'w'] }),
    k({ typ: 'reihenfolge', frage: 'D', antworten: ['1', '2', '3'] }),
  ];
  const s = new ProbeSitzung({ karten, zufall: seeded(5) });
  while (s.aktuelleFrage) {
    const f = s.aktuelleFrage;
    if (f.reihenfolgeRichtig) assert.equal(s.beantworteReihenfolge(f.reihenfolgeRichtig).richtig, true);
    else assert.equal(s.beantworte(f.indexRichtig).richtig, true);
  }
  assert.equal(s.richtigeAntworten, 4);
  assert.ok(s.ergebnisse.some((e) => e.richtigeAntwort === '1 → 2 → 3'));
});

test('Deck-Format: Wahr/Falsch (true, false, „wahr“), Lücke, Reihenfolge', () => {
  const deck = parseDeck(
    JSON.stringify({
      name: 'Mix',
      karten: [
        { typ: 'wahrfalsch', frage: 'Die Erde ist rund.', richtig: true, erklaerung: 'Fast.' },
        { typ: 'wahrfalsch', frage: 'Wale sind Fische.', richtig: 'falsch' },
        { typ: 'luecke', frage: 'Das Herz hat ___ Kammern.', richtig: 'vier', falsch: ['zwei', 'drei', 'sechs'] },
        { typ: 'reihenfolge', frage: 'Ordne die Phasen.', reihenfolge: ['Planung', 'Bau', 'Betrieb'] },
        { frage: 'Normal?', richtig: 'ja', falsch: ['nein', 'vielleicht', 'nie'] },
      ],
    }),
  );
  assert.deepEqual(deck.karten.filter((x) => x.fehler).map((x) => x.fehler), []);
  assert.deepEqual(deck.karten.map((x) => x.typ), ['wahrfalsch', 'wahrfalsch', 'luecke', 'reihenfolge', 'auswahl']);
  assert.equal(deck.karten[0].indexRichtig, 0);
  assert.equal(deck.karten[1].indexRichtig, 1);
  assert.deepEqual(deck.karten[3].antworten, ['Planung', 'Bau', 'Betrieb']);
});

test('Deck-Format: Fehler bei den neuen Typen', () => {
  const fehler = (karte) => parseDeck(JSON.stringify({ karten: [karte] })).karten[0].fehler;
  assert.match(fehler({ typ: 'wahrfalsch', frage: 'F', richtig: 'vielleicht' }), /true oder false/);
  assert.match(fehler({ typ: 'luecke', frage: 'ohne Lücke', richtig: 'a', falsch: ['b', 'c', 'd'] }), /Lücke/);
  assert.match(fehler({ typ: 'reihenfolge', frage: 'F', reihenfolge: ['1', '2'] }), /3 bis 6/);
  assert.match(fehler({ typ: 'reihenfolge', frage: 'F', reihenfolge: ['1', '1', '2'] }), /gleich/);
  assert.match(fehler({ typ: 'quatsch', frage: 'F' }), /Unbekannter Kartentyp/);
});

test('Import speichert den Typ und aktualisiert ihn bei erneutem Import', () => {
  const leer = { decks: [], cards: [] };
  const v1 = parseDeck(JSON.stringify({ name: 'X', karten: [{ typ: 'wahrfalsch', frage: 'Aussage 1', richtig: true }] }));
  const r1 = mergeImport(leer, 'X', v1.karten, 1000);
  assert.equal(r1.daten.cards[0].typ, 'wahrfalsch');
  assert.deepEqual(r1.daten.cards[0].antworten, ['Wahr', 'Falsch']);
  const v2 = parseDeck(JSON.stringify({ name: 'X', karten: [{ typ: 'wahrfalsch', frage: 'Aussage 1', richtig: false }] }));
  const r2 = mergeImport(r1.daten, 'X', v2.karten, 2000);
  assert.equal(r2.aktualisiert, 1);
  assert.equal(r2.daten.cards[0].indexRichtig, 1);
});
