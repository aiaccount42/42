// Kaufbremse: Wünsche aus mydealz & Co. werden notiert und erst nach einer Wartezeit "reif".
import { neueId } from './models.js';

const STUNDE = 3_600_000;
const MAX_WUENSCHE = 200;

export function neuerWunsch(text, jetzt, stunden = 24) {
  const t = String(text ?? '').trim();
  if (!t) return null;
  return { id: neueId(), text: t.slice(0, 200), erstelltAm: jetzt, reifAm: jetzt + stunden * STUNDE, status: 'wartet' };
}

/** Nimmt einen Wunsch neu auf (älteste erledigte fallen bei zu vielen Einträgen heraus). */
export function wunschHinzufuegen(wuensche, wunsch) {
  if (!wunsch) return wuensche;
  const liste = [wunsch, ...wuensche];
  if (liste.length <= MAX_WUENSCHE) return liste;
  const offen = liste.filter((w) => w.status === 'wartet');
  const erledigt = liste.filter((w) => w.status !== 'wartet').slice(0, Math.max(0, MAX_WUENSCHE - offen.length));
  return [...offen, ...erledigt].sort((a, b) => b.erstelltAm - a.erstelltAm);
}

/** Teilt die offenen Wünsche in "wartend" (Sperrfrist läuft) und "reif" (Frist vorbei, Entscheidung offen). */
export function offeneWuensche(wuensche, jetzt) {
  const offen = wuensche.filter((w) => w.status === 'wartet');
  return {
    wartend: offen.filter((w) => w.reifAm > jetzt).sort((a, b) => a.reifAm - b.reifAm),
    reif: offen.filter((w) => w.reifAm <= jetzt).sort((a, b) => a.reifAm - b.reifAm),
  };
}

/** Verbleibende Wartezeit in ganzen Stunden (aufgerundet, mindestens 1). */
export const stundenBis = (wunsch, jetzt) => Math.max(1, Math.ceil((wunsch.reifAm - jetzt) / STUNDE));

/** Schließt einen Wunsch ab: 'gekauft' oder 'verworfen'. Gibt eine neue Liste zurück. */
export function wunschAbschliessen(wuensche, id, status, jetzt = Date.now()) {
  if (status !== 'gekauft' && status !== 'verworfen') throw new Error(`Unbekannter Status: ${status}`);
  return wuensche.map((w) => (w.id === id && w.status === 'wartet' ? { ...w, status, erledigtAm: jetzt } : w));
}
