// Lernstand eines Decks: wie viel ist neu, im Lernen oder sicher, wie hoch ist die Fehlerquote,
// und welche Karten sind Schwachstellen. Rechnet nur auf den vorhandenen Kartendaten (Box, Versuche, Treffer).
import { istGueltig } from './models.js';
import { mischen, system } from './zufall.js';

/** Ab Box 4 gilt eine Karte als sicher (Abstand von mindestens 8 Tagen, mehrfach richtig in Folge). */
export const SICHER_AB_BOX = 4;

const fehlerVon = (karte) => Math.max(0, (karte.versuche ?? 0) - (karte.treffer ?? 0));

/** 'neu' (noch nie beantwortet), 'sicher' (Box 4–5) oder 'lernend'. */
export function kartenStufe(karte) {
  if ((karte.versuche ?? 0) === 0) return 'neu';
  return karte.box >= SICHER_AB_BOX ? 'sicher' : 'lernend';
}

/** Schwachstelle: schon mal falsch beantwortet und noch nicht wieder sicher. */
export const istSchwachstelle = (karte) => fehlerVon(karte) > 0 && karte.box < SICHER_AB_BOX;

/**
 * Zahlen zu einer Kartenliste (ungültige Karten zählen nicht):
 * gesamt, neu, lernend, sicher, schwach, antworten, fehler, fehlerquote (null unter 5 Antworten),
 * anteilSicher und anteilGesehen (0–1), gemeistert (alle Karten sicher).
 */
export function deckFortschritt(karten) {
  const f = { gesamt: 0, neu: 0, lernend: 0, sicher: 0, schwach: 0, antworten: 0, fehler: 0 };
  for (const k of karten.filter(istGueltig)) {
    f.gesamt += 1;
    f[kartenStufe(k)] += 1;
    if (istSchwachstelle(k)) f.schwach += 1;
    f.antworten += k.versuche ?? 0;
    f.fehler += fehlerVon(k);
  }
  f.fehlerquote = f.antworten >= 5 ? f.fehler / f.antworten : null;
  f.anteilSicher = f.gesamt > 0 ? f.sicher / f.gesamt : 0;
  f.anteilGesehen = f.gesamt > 0 ? (f.gesamt - f.neu) / f.gesamt : 0;
  f.gemeistert = f.gesamt > 0 && f.sicher === f.gesamt;
  return f;
}

/** Die `anzahl` Schwachstellen mit den meisten Fehlern (bei Gleichstand die mit der schlechteren Quote), dann Zufall. */
export function schwachstellen(karten, anzahl, zufall = system) {
  const mitLos = karten
    .filter((k) => istGueltig(k) && istSchwachstelle(k))
    .map((karte) => ({ karte, los: zufall() }));
  mitLos.sort((a, b) => {
    const quote = (k) => fehlerVon(k) / Math.max(1, k.versuche ?? 0);
    return fehlerVon(b.karte) - fehlerVon(a.karte) || quote(b.karte) - quote(a.karte) || a.los - b.los;
  });
  return mischen(mitLos.slice(0, Math.max(0, Math.floor(anzahl))).map((e) => e.karte), zufall);
}

/**
 * Beim Üben der Schwachstellen (vorzeitig, wie „Lernen vor der Prüfung“ ohne Zeitplan): Eine richtig
 * beantwortete Karte, die laut Zeitplan noch nicht dran ist, behält ihren Stand. Sonst ließe sich der
 * Abstand durch mehrfaches Üben in Minuten künstlich hochtreiben. Fällige Karten und Fehler zählen voll.
 * `vorher`: Map Id → Karte vor der Runde.
 */
export function zeitplanSchonen(karten, vorher, jetzt) {
  return karten.map((k) => {
    const alt = vorher.get(k.id);
    if (!alt || alt.faelligAm <= jetzt) return k;
    const neuerFehler = (k.versuche ?? 0) > (alt.versuche ?? 0) && (k.treffer ?? 0) === (alt.treffer ?? 0);
    return neuerFehler ? k : alt;
  });
}
