import { neueKarte } from '../js/core/models.js';

// Die Tests rechnen in deutscher Ortszeit (Tageswechsel, Sommerzeit). `npm test` setzt TZ entsprechend.
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (zone !== 'Europe/Berlin') {
  throw new Error(`Zeitzone ist ${zone}. Tests bitte mit "npm test" starten (setzt TZ=Europe/Berlin).`);
}

/** Ortszeit-Zeitpunkt in ms. */
export const datum = (jahr, monat, tag, stunde = 12, minute = 0, sekunde = 0) =>
  new Date(jahr, monat - 1, tag, stunde, minute, sekunde).getTime();

export const TAG = 86_400_000;
export const DECK_A = 'deck-a';
export const DECK_B = 'deck-b';

/** Gültige Karte; die richtige Antwort ist "R" an Index 1 (sofern nicht anders angegeben). */
export function karte(frage = 'Frage?', { deck = DECK_A, box = 1, faelligAm, indexRichtig = 1 } = {}) {
  const antworten = ['A', 'B', 'C', 'D'];
  antworten[indexRichtig] = 'R';
  return neueKarte({ deckId: deck, frage, antworten, indexRichtig, box, faelligAm });
}

/** n fällige Karten in Box 1 (fällig seit 1.1.2026). */
export const faelligeKarten = (n) =>
  Array.from({ length: n }, (_, i) => karte(`Frage ${i}`, { faelligAm: datum(2026, 1, 1) }));

export const richtig = (sitzung) => sitzung.aktuelleFrage.indexRichtig;
export const falsch = (sitzung) => (sitzung.aktuelleFrage.indexRichtig + 1) % 4;
