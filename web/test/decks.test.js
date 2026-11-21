import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { normFrage, parseDeck } from '../js/core/deckformat.js';

const ordner = new URL('../decks/', import.meta.url);
const dateien = readdirSync(ordner).filter((d) => d.endsWith('.json') && d !== 'index.json');
const lade = (datei) => parseDeck(readFileSync(new URL(datei, ordner), 'utf8'));
const KATEGORIEN = ['Körper & Fitness', 'Finanzen & Recht', 'Wirtschaft & Mathe', 'Alltag & Haushalt', 'Technik & Digital', 'Kopf & Verhalten', 'Wissenschaft & Natur', 'Welt & Kultur', 'Tiere'];
const SOLL_KARTEN = 42;

test('die Bibliothek enthält Decks mit den neuen Kartentypen', () => {
  const typen = new Set(dateien.flatMap((d) => lade(d).karten.map((k) => k.typ)));
  for (const typ of ['auswahl', 'wahrfalsch', 'luecke', 'reihenfolge']) assert.ok(typen.has(typ), `kein Deck mit Typ ${typ}`);
});

test('es gibt mitgelieferte Decks', () => {
  assert.ok(dateien.length >= 12);
});

for (const datei of dateien) {
  test(`Deck ${datei}: Format, Eindeutigkeit, Umfang, Kategorie`, () => {
    const deck = lade(datei);
    assert.deepEqual(deck.karten.filter((k) => k.fehler).map((k) => `${k.frage}: ${k.fehler}`), []);
    assert.equal(deck.karten.length, SOLL_KARTEN, `${datei} hat ${deck.karten.length} statt ${SOLL_KARTEN} Karten`);
    assert.ok(KATEGORIEN.includes(deck.kategorie), `${datei}: Kategorie fehlt oder unbekannt (${deck.kategorie})`);
    assert.ok(deck.beschreibung, `${datei}: Beschreibung fehlt`);
    for (const k of deck.karten) {
      assert.ok(k.erklaerung, `Erklärung fehlt bei „${k.frage}“`);
      assert.ok(k.frage.endsWith('?') || k.frage.length > 10, `Frage unklar: ${k.frage}`);
      assert.ok(k.frage.length <= 300, `Frage zu lang: ${k.frage}`);
      assert.ok(k.antworten.every((a) => a.length <= 160), `Antwort zu lang bei „${k.frage}“`);
    }
  });

  test(`Deck ${datei}: die richtige Antwort verrät sich nicht durch ihre Länge`, () => {
    const deck = lade(datei);
    // "deutlich länger": mindestens 25 % und 12 Zeichen länger als die längste falsche Antwort
    // Nur Karten mit vier Antworten (Auswahl, Lücke), bei Wahr/Falsch und Reihenfolge gibt es keine Antwortlängen zu vergleichen
    const karten = deck.karten.filter((k) => ['auswahl', 'luecke'].includes(k.typ));
    if (karten.length === 0) return;
    const laengste = (k) => Math.max(...k.antworten.slice(1).map((a) => a.length));
    const deutlich = karten.filter((k) => k.antworten[0].length >= 1.25 * laengste(k) && k.antworten[0].length - laengste(k) >= 12).length;
    const knapp = karten.filter((k) => k.antworten.slice(1).every((a) => a.length < k.antworten[0].length)).length;
    assert.ok(deutlich / karten.length <= 0.2, `${datei}: bei ${deutlich} von ${karten.length} Karten ist die richtige Antwort deutlich länger (erlaubt: 20 %)`);
    assert.ok(knapp / karten.length <= 0.6, `${datei}: bei ${knapp} von ${karten.length} Karten ist die richtige Antwort die längste (erlaubt: 60 %)`);
  });

  test(`Deck ${datei}: die richtige Antwort verrät sich nicht durch Ja/Nein oder ein gemeinsames Anfangswort der falschen`, () => {
    const deck = lade(datei);
    const erstes = (text) => text.trim().split(/[\s,:]+/)[0].toLowerCase();
    // Nur Karten mit vier Antworten, die erste Antwort ist die richtige
    const karten = deck.karten.filter((k) => ['auswahl', 'luecke'].includes(k.typ));
    const jaNein = new Set(['ja', 'nein']);
    const jaNeinKarten = karten.filter((k) => {
      const [richtig, ...falsch] = k.antworten.map(erstes);
      return jaNein.has(richtig) && falsch.filter((w) => jaNein.has(w)).length >= 2 && !falsch.includes(richtig);
    });
    assert.deepEqual(jaNeinKarten.map((k) => k.frage), [], `${datei}: Ja/Nein-Antworten, bei denen die richtige als Einzige das Gegenteil sagt (besser als Wahr/Falsch-Karte)`);
    const ausreisser = karten.filter((k) => {
      const [richtig, ...falsch] = k.antworten.map(erstes);
      return new Set(falsch).size === 1 && falsch[0] !== richtig;
    });
    assert.deepEqual(ausreisser.map((k) => k.frage), [], `${datei}: die drei falschen Antworten beginnen gleich, die richtige anders`);
  });
}

test('Deck-Namen sind eindeutig', () => {
  const namen = dateien.map((d) => lade(d).name.toLowerCase());
  assert.equal(new Set(namen).size, namen.length);
});

test('keine Frage kommt in zwei Decks vor', () => {
  const gesehen = new Map();
  for (const datei of dateien) {
    for (const k of lade(datei).karten) {
      const schluessel = normFrage(k.frage);
      assert.ok(!gesehen.has(schluessel), `Doppelte Frage in ${gesehen.get(schluessel)} und ${datei}: ${k.frage}`);
      gesehen.set(schluessel, datei);
    }
  }
});

test('index.json passt zu den Deck-Dateien (npm run bauen aktualisiert sie)', () => {
  const index = JSON.parse(readFileSync(new URL('index.json', ordner), 'utf8'));
  assert.deepEqual(
    [...index.decks.map((e) => [e.datei, e.name, e.anzahl])].sort(),
    dateien.map((d) => [d, lade(d).name, lade(d).karten.length]).sort(),
  );
});
