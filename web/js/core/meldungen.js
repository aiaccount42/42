// Gemeldete Karten (unklar oder falsch): bleiben gespeichert, bis du die Liste leerst.
// Eintrag: { id, deck, frage, antwort, erstelltAm } – die Liste kannst du kopieren und weiterschicken.
import { normFrage } from './deckformat.js';

const schluessel = (deck, frage) => `${normFrage(deck)}|${normFrage(frage)}`;
export const meldungsId = (deck, frage) => schluessel(deck, frage);

export function istGemeldet(liste, deck, frage) {
  return liste.some((m) => m.id === schluessel(deck, frage));
}

/** Fügt eine Meldung hinzu (gleiche Karte nur einmal). Liefert eine neue Liste. */
export function meldungHinzu(liste, { deck, frage, antwort, zeit }) {
  if (istGemeldet(liste, deck, frage)) return liste;
  return [...liste, { id: schluessel(deck, frage), deck, frage, antwort, erstelltAm: zeit }];
}

export function meldungEntfernen(liste, deck, frage) {
  return liste.filter((m) => m.id !== schluessel(deck, frage));
}

/** Text zum Kopieren, gruppiert nach Deck. */
export function meldungsText(liste) {
  const nachDeck = new Map();
  for (const m of liste) nachDeck.set(m.deck, [...(nachDeck.get(m.deck) ?? []), m]);
  return [...nachDeck]
    .map(([deck, eintraege]) => `Deck: ${deck}\n${eintraege.map((m) => `- ${m.frage} → ${m.antwort}`).join('\n')}`)
    .join('\n\n');
}

export function meldungenNormalisieren(roh) {
  const text = (w) => typeof w === 'string' && w.trim() !== '';
  const ergebnis = [];
  for (const m of Array.isArray(roh) ? roh : []) {
    if (m === null || typeof m !== 'object' || !text(m.deck) || !text(m.frage)) continue;
    ergebnis.push(...meldungHinzu(ergebnis, { deck: m.deck, frage: m.frage, antwort: typeof m.antwort === 'string' ? m.antwort : '', zeit: Number.isFinite(m.erstelltAm) ? m.erstelltAm : Date.now() }).slice(ergebnis.length));
  }
  return ergebnis;
}
