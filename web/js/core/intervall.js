// Lernmodus "intelligent": Jede Karte hat einen eigenen Abstand in Tagen und einen Leichtigkeitsfaktor
// (ähnlich SM-2 von Anki). Der Faktor reagiert auf Fehler und Antwortzeit; bei Karten, die man leicht
// erraten kann (Wahr/Falsch, Auswahl), wachsen die Abstände langsamer.
import { INTERVALLE_TAGE, begrenzt } from './leitner.js';

export const LERNMODI = ['intelligent', 'einfach'];
export const EASE_START = 2.3;
export const EASE_MIN = 1.3;
export const EASE_MAX = 3.0;
export const INTERVALL_MAX = 180;

/** Raten-Wahrscheinlichkeit je Kartentyp: je höher, desto vorsichtiger wachsen die Abstände. */
export function ratewahrscheinlichkeit(karte) {
  if (karte.alsEingabe) return 0;
  switch (karte.typ ?? 'auswahl') {
    case 'wahrfalsch':
      return 0.5;
    case 'reihenfolge':
      return 0.05;
    default:
      return 0.25;
  }
}

/** Aktueller Abstand in Tagen; ältere Karten ohne Abstand bekommen ihn aus der Leitner-Box. */
export function aktuellerIntervall(karte) {
  if (Number.isFinite(karte.intervall)) return karte.intervall;
  if ((karte.versuche ?? 0) === 0 && begrenzt(karte.box) === 1) return 0;
  return INTERVALLE_TAGE[begrenzt(karte.box) - 1];
}

/** Anzeige-Box (1–5) passend zum Abstand: 0 = neu oder gerade vergessen. */
export function boxFuerIntervall(tage) {
  if (tage < 1) return 1;
  if (tage < 3) return 2;
  if (tage < 8) return 3;
  if (tage < 30) return 4;
  return 5;
}

const GRENZEN = {
  // [schnell unter, langsam über] in Sekunden
  auswahl: [6, 20],
  luecke: [6, 20],
  wahrfalsch: [4, 12],
  reihenfolge: [12, 40],
  eingabe: [20, 60],
};

/** 'schnell' | 'normal' | 'langsam'. Ohne brauchbare Zeit (fehlt oder über 2 Minuten) gilt 'normal'. */
export function zeitqualitaet(karte, sekunden) {
  if (!Number.isFinite(sekunden) || sekunden < 0 || sekunden > 120) return 'normal';
  const [schnell, langsam] = GRENZEN[karte.alsEingabe ? 'eingabe' : (karte.typ ?? 'auswahl')] ?? GRENZEN.auswahl;
  return sekunden < schnell ? 'schnell' : sekunden > langsam ? 'langsam' : 'normal';
}

/** Fällig ab Tagesbeginn des Zieltages. */
export function faelligNachTagen(tage, beantwortetAm) {
  const ziel = new Date(beantwortetAm);
  ziel.setDate(ziel.getDate() + Math.max(1, Math.round(tage)));
  ziel.setHours(0, 0, 0, 0);
  return ziel.getTime();
}

const rund = (x) => Math.round(x * 100) / 100;

/** Richtig beantwortet: Abstand wächst (1, 3, dann Abstand mal Faktor), der Faktor folgt der Antwortzeit. */
export function intelligentRichtig(karte, jetzt, { sekunden } = {}) {
  const alt = aktuellerIntervall(karte);
  const qualitaet = zeitqualitaet(karte, sekunden);
  const ease = rund(Math.min(EASE_MAX, Math.max(EASE_MIN, (karte.ease ?? EASE_START) + { schnell: 0.1, normal: 0, langsam: -0.1 }[qualitaet])));
  const wachstum = 1 + (ease - 1) * (1 - ratewahrscheinlichkeit(karte));
  const zeitFaktor = { schnell: 1.15, normal: 1, langsam: 0.85 }[qualitaet];

  let neu;
  if (alt < 1) neu = 1;
  else if (alt < 3) neu = 3;
  else neu = Math.round(alt * wachstum * zeitFaktor);
  neu = Math.min(INTERVALL_MAX, Math.max(alt < 1 ? 1 : Math.max(2, Math.round(alt)), neu)); // nie kürzer als vorher

  return {
    ...karte,
    intervall: neu,
    ease,
    box: boxFuerIntervall(neu),
    faelligAm: faelligNachTagen(neu, jetzt),
    versuche: (karte.versuche ?? 0) + 1,
    treffer: (karte.treffer ?? 0) + 1,
  };
}

/** Falsch beantwortet: Abstand zurück auf 0 (morgen wieder), Faktor sinkt. */
export function intelligentFalsch(karte, jetzt) {
  return {
    ...karte,
    intervall: 0,
    ease: rund(Math.max(EASE_MIN, (karte.ease ?? EASE_START) - 0.2)),
    box: 1,
    faelligAm: faelligNachTagen(1, jetzt),
    versuche: (karte.versuche ?? 0) + 1,
    treffer: karte.treffer ?? 0,
  };
}

/**
 * Wie viele Karten sind heute, morgen und danach bis zum 7. Tag fällig?
 * Bereits überfällige Karten zählen zu „heute“. Nur gültige Karten zählen.
 */
export function faelligkeitsVorschau(karten, jetzt) {
  const tagesbeginn = (versatz) => {
    const d = new Date(jetzt);
    d.setDate(d.getDate() + versatz);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const [morgen, uebermorgen, tag8] = [tagesbeginn(1), tagesbeginn(2), tagesbeginn(8)];
  const v = { heute: 0, morgen: 0, danach: 0 };
  for (const k of karten) {
    if (k.faelligAm < morgen) v.heute += 1;
    else if (k.faelligAm < uebermorgen) v.morgen += 1;
    else if (k.faelligAm < tag8) v.danach += 1;
  }
  return v;
}
