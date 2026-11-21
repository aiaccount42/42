// Leitner-System: Boxen 1–5, Intervalle 1/2/4/8/16 Tage.

export const BOX_MIN = 1;
export const BOX_MAX = 5;
export const INTERVALLE_TAGE = [1, 2, 4, 8, 16];

export function begrenzt(box) {
  return Math.min(Math.max(Math.trunc(box) || BOX_MIN, BOX_MIN), BOX_MAX);
}

export function intervallInTagen(box) {
  return INTERVALLE_TAGE[begrenzt(box) - 1];
}

/** Richtig beantwortet: eine Box höher, in Box 5 bleibt die Karte. */
export function hoehereBox(box) {
  return begrenzt(begrenzt(box) + 1);
}

/** Fällig ab Tagesbeginn des Zieltages (Intervall der Box ab Antwortzeitpunkt). */
export function faelligAm(box, beantwortetAm) {
  const ziel = new Date(beantwortetAm);
  ziel.setDate(ziel.getDate() + intervallInTagen(box));
  ziel.setHours(0, 0, 0, 0);
  return ziel.getTime();
}

/** Liefert eine neue Karte (die übergebene bleibt unverändert). */
export function richtigBeantwortet(karte, jetzt) {
  const box = hoehereBox(karte.box);
  return { ...karte, box, faelligAm: faelligAm(box, jetzt), versuche: (karte.versuche ?? 0) + 1, treffer: (karte.treffer ?? 0) + 1 };
}

export function falschBeantwortet(karte, jetzt) {
  return { ...karte, box: BOX_MIN, faelligAm: faelligAm(BOX_MIN, jetzt), versuche: (karte.versuche ?? 0) + 1, treffer: karte.treffer ?? 0 };
}
