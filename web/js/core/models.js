import { begrenzt } from './leitner.js';

export const ANZAHL_ANTWORTEN = 4;
/** auswahl = 4 Antworten, wahrfalsch = Wahr/Falsch, luecke = Lückentext mit ___ und 4 Antworten, reihenfolge = 3–6 Schritte (richtige Folge in `antworten`). */
export const KARTENTYPEN = ['auswahl', 'wahrfalsch', 'luecke', 'reihenfolge'];
export const WAHR_FALSCH = ['Wahr', 'Falsch'];
export const REIHENFOLGE_MIN = 3;
export const REIHENFOLGE_MAX = 6;
export const LUECKE = '___';

export const INSTAGRAM = { name: 'Instagram', urlScheme: 'instagram://' };
export const REDDIT = { name: 'Reddit', urlScheme: 'reddit://' };

/** UUID v4. Bewusst ohne crypto.randomUUID(), das gibt es nur in sicheren Kontexten (https). */
export function neueId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** `pausiert`: das Deck kommt in keinem Quiz vor (Lernstand bleibt erhalten). */
export function neuesDeck({ id = neueId(), name, erstelltAm = Date.now(), pausiert = false }) {
  return { id, name, erstelltAm, pausiert: pausiert === true };
}

/** Neue Karten landen in Box 1 und sind sofort fällig. */
export function neueKarte({
  id = neueId(),
  deckId,
  frage,
  antworten,
  indexRichtig,
  box = 1,
  faelligAm = Date.now(),
  quelle = null,
  erklaerung = null,
  typ = 'auswahl',
  versuche = 0,
  treffer = 0,
  intervall = null,
  ease = 2.3,
}) {
  return {
    id,
    deckId,
    typ: KARTENTYPEN.includes(typ) ? typ : 'auswahl',
    frage,
    antworten: [...antworten],
    indexRichtig,
    box: begrenzt(box),
    faelligAm,
    quelle,
    erklaerung,
    versuche: Math.max(0, Math.trunc(versuche) || 0),
    treffer: Math.min(Math.max(0, Math.trunc(treffer) || 0), Math.max(0, Math.trunc(versuche) || 0)),
    intervall: Number.isFinite(intervall) && intervall >= 0 ? Math.min(intervall, 365) : null, // Abstand in Tagen (Lernmodus „intelligent“), null = aus der Box ableiten
    ease: Number.isFinite(ease) ? Math.min(Math.max(ease, 1.3), 3.0) : 2.3,
  };
}

/** Gültig je nach Kartentyp (fehlender Typ = Auswahlfrage mit 4 Antworten). */
export function istGueltig(karte) {
  const text = (wert) => typeof wert === 'string' && wert.trim() !== '';
  const typ = karte?.typ ?? 'auswahl';
  if (!KARTENTYPEN.includes(typ) || !text(karte?.frage) || !Array.isArray(karte.antworten) || !karte.antworten.every(text)) return false;
  const n = karte.antworten.length;
  const indexOk = (max) => Number.isInteger(karte.indexRichtig) && karte.indexRichtig >= 0 && karte.indexRichtig < max;
  if (typ === 'wahrfalsch') return n === 2 && indexOk(2);
  if (typ === 'reihenfolge') {
    return n >= REIHENFOLGE_MIN && n <= REIHENFOLGE_MAX && new Set(karte.antworten.map((a) => a.trim().toLowerCase())).size === n;
  }
  if (typ === 'luecke' && !karte.frage.includes(LUECKE)) return false;
  return n === ANZAHL_ANTWORTEN && indexOk(ANZAHL_ANTWORTEN);
}

export function istFaellig(karte, jetzt) {
  return karte.faelligAm <= jetzt;
}

export function standardSettings(ueberschreibe = {}) {
  return {
    freischaltdauerMinuten: 15,
    kartenProGate: 5,
    freischaltungen: {}, // Ablaufzeitpunkt (ms) je Ziel-App-Name
    notfallSkipLetzterTag: null,
    zielApps: [{ ...INSTAGRAM }, { ...REDDIT }],
    freischaltKurzbefehl: '', // Name des Kurzbefehls, der die Freischaltung speichert (leer = App direkt öffnen)
    appDecks: {}, // App-Name → erlaubte Deck-IDs (fehlt = alle Decks und alle Zufallsaufgaben)
    generatorFragen: 2, // Zufallsaufgaben je Quiz (sofern für die App erlaubt)
    eingabeAnteil: 0.5, // Anteil der Zufallsaufgaben mit Zahleneingabe statt Auswahl
    reibung: { an: true, start: 3, schritt: 1, max: 8 }, // Kartenzahl wächst mit jedem Quiz am selben Tag
    nachtruhe: { an: false, von: '22:00', bis: '06:00', modus: 'streng' }, // 'streng' = doppelt so viele Karten, 'gesperrt' = kein Quiz
    tagesziel: 20, // richtige Antworten pro Tag
    kaufbremseStunden: 24,
    pausierteGeneratoren: [], // Ids der pausierten Zufallsaufgaben (kommen in keinem Quiz vor)
    lernmodus: 'intelligent', // 'intelligent' = eigener Abstand pro Karte, 'einfach' = feste Leitner-Abstände
    neueProQuiz: 2, // höchstens so viele neue Karten je Quiz, solange genug Wiederholungen fällig sind (nur „intelligent“)
    willkommenGesehen: false, // Begrüßungsseite für neue Nutzer wurde schon gezeigt
    letztesBackup: null,
    ...ueberschreibe,
  };
}
