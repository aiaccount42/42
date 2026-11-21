// Schwierigkeit einer Karte aus ihren bisherigen Versuchen (ab 3 Versuchen aussagekräftig).

export const MIN_VERSUCHE = 3;
export const MIN_VERSUCHE_LEICHT = 5;

/** Trefferquote 0–1 oder null, solange es zu wenige Versuche gibt. */
export function trefferquote(karte) {
  const v = karte.versuche ?? 0;
  return v >= MIN_VERSUCHE ? (karte.treffer ?? 0) / v : null;
}

/** Problemkarte: mindestens 4-mal falsch und unter 40 % richtig (ab 5 Versuchen). Hier lohnt sich ein Blick auf die Frage selbst. */
export function istProblemkarte(karte) {
  const versuche = karte.versuche ?? 0;
  const fehler = versuche - (karte.treffer ?? 0);
  return versuche >= 5 && fehler >= 4 && (karte.treffer ?? 0) / versuche < 0.4;
}

/** 'schwer' (unter 50 % richtig), 'leicht' (ab 5 Versuchen mindestens 90 % richtig) oder 'normal'. */
export function schwierigkeit(karte) {
  const q = trefferquote(karte);
  if (q === null) return 'normal';
  if (q < 0.5) return 'schwer';
  if ((karte.versuche ?? 0) >= MIN_VERSUCHE_LEICHT && q >= 0.9) return 'leicht';
  return 'normal';
}
