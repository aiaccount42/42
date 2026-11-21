import { istFaellig, istGueltig } from './models.js';
import { schwierigkeit } from './schwierigkeit.js';
import { mischen, system } from './zufall.js';

/**
 * Kartenauswahl für ein Gate. Priorität:
 * 1. fällige Karten: schwere Karten (unter 50 % richtig) zuerst, leichte (ab 5 Versuchen
 *    mindestens 90 % richtig) zuletzt, sonst niedrige Box zuerst, bei gleicher Box die am
 *    längsten überfällige
 * 2. nicht fällige Karten (nur als Auffüllung, damit das Gate nicht leer bleibt):
 *    früher fällige zuerst, dann niedrigere Box
 * Gleichstände entscheidet der Zufall, die gezogenen Karten werden am Ende gemischt.
 * Ungültige Karten werden ignoriert.
 */
export function ziehen(karten, anzahl, jetzt, zufall = system, { neuMax = null } = {}) {
  const wieviele = Math.floor(anzahl);
  if (!(wieviele > 0)) return [];

  const mitLos = karten.filter(istGueltig).map((karte) => ({ karte, los: zufall() }));

  mitLos.sort((a, b) => {
    const aFaellig = istFaellig(a.karte, jetzt);
    const bFaellig = istFaellig(b.karte, jetzt);
    if (aFaellig !== bFaellig) return aFaellig ? -1 : 1;

    const boxUnterschied = a.karte.box - b.karte.box;
    const faelligUnterschied = a.karte.faelligAm - b.karte.faelligAm;
    if (aFaellig) {
      const rang = { schwer: 0, normal: 1, leicht: 2 };
      const schwierigkeitsUnterschied = rang[schwierigkeit(a.karte)] - rang[schwierigkeit(b.karte)];
      if (schwierigkeitsUnterschied !== 0) return schwierigkeitsUnterschied;
      if (boxUnterschied !== 0) return boxUnterschied;
      if (faelligUnterschied !== 0) return faelligUnterschied;
    } else {
      if (faelligUnterschied !== 0) return faelligUnterschied;
      if (boxUnterschied !== 0) return boxUnterschied;
    }
    return a.los - b.los;
  });

  let gewaehlt = mitLos.slice(0, wieviele).map((eintrag) => eintrag.karte);

  // Mit neuMax (Lernmodus „intelligent“): fällige Wiederholungen vor neuen Karten. Neue Karten
  // (noch nie beantwortet) bekommen höchstens neuMax Plätze, solange genug Wiederholungen fällig sind.
  if (Number.isInteger(neuMax) && neuMax >= 0) {
    const istNeu = (k) => (k.versuche ?? 0) === 0 && k.box === 1;
    const faellig = mitLos.filter((e) => istFaellig(e.karte, jetzt)).map((e) => e.karte);
    const neu = faellig.filter(istNeu);
    const wiederholung = faellig.filter((k) => !istNeu(k));
    const wdh = wiederholung.slice(0, wieviele - Math.min(neuMax, neu.length));
    const gewaehltFaellig = [...wdh, ...neu.slice(0, wieviele - wdh.length)];
    const ids = new Set(gewaehltFaellig.map((k) => k.id));
    const rest = mitLos.map((e) => e.karte).filter((k) => !ids.has(k.id));
    gewaehlt = [...gewaehltFaellig, ...rest].slice(0, wieviele);
  }

  return mischen(gewaehlt, zufall);
}
