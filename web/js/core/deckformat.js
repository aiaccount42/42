// Deck-Format zum Importieren (Datei, Bibliothek oder eingefügter Text von Claude):
//
// {
//   "format": "lerngate-deck-v1",
//   "name": "Biologie: Zelle",
//   "beschreibung": "optional",
//   "kategorie": "optional, gruppiert die Bibliothek",
//   "karten": [
//     { "frage": "…", "richtig": "…", "falsch": ["…", "…", "…"], "erklaerung": "optional", "quelle": "optional" }
//   ]
// }
//
// Die richtige Antwort steht als Text im Feld "richtig" (kein Index – das verwechseln KI-Modelle oft).
//
// Weitere Kartentypen (Feld "typ", ohne Angabe = Auswahlfrage wie oben):
//   { "typ": "wahrfalsch", "frage": "Aussage …", "richtig": true, "erklaerung": "…" }
//   { "typ": "luecke", "frage": "Das Herz hat ___ Kammern.", "richtig": "zwei", "falsch": ["…", "…", "…"] }
//   { "typ": "reihenfolge", "frage": "Bringe in die richtige Reihenfolge: …", "reihenfolge": ["erster", "zweiter", "dritter"] }
//
// Optional "vorher": frühere Fassung(en) der Frage (Text oder Liste). Beim Aktualisieren wird die alte Karte
// darüber gefunden und umgeschrieben, statt eine zweite anzulegen. Box und Fälligkeit bleiben erhalten.
import { LUECKE, REIHENFOLGE_MAX, REIHENFOLGE_MIN, WAHR_FALSCH, neueKarte, neuesDeck } from './models.js';

export const DECK_FORMAT = 'lerngate-deck-v1';

export class DeckFormatFehler extends Error {
  constructor(nachricht) {
    super(nachricht);
    this.name = 'DeckFormatFehler';
  }
}

/** Vergleichsschlüssel für Fragen: Groß-/Kleinschreibung und Leerraum egal. */
export const normFrage = (text) => String(text).toLowerCase().replace(/\s+/g, ' ').trim();

const text = (wert) => (typeof wert === 'string' ? wert.trim() : '');

/** Schneidet das JSON aus einem Text, auch wenn drumherum Erklärtext oder ```json-Zäune stehen. */
function jsonAusText(eingabe) {
  const s = String(eingabe ?? '').replace(/^﻿/, '');
  const start = s.indexOf('{');
  const ende = s.lastIndexOf('}');
  if (start === -1 || ende <= start) throw new DeckFormatFehler('Ich finde kein JSON in diesem Text.');
  return s.slice(start, ende + 1);
}

const TYP_NAMEN = {
  auswahl: 'auswahl',
  'multiple-choice': 'auswahl',
  wahrfalsch: 'wahrfalsch',
  'wahr-falsch': 'wahrfalsch',
  wahr_falsch: 'wahrfalsch',
  luecke: 'luecke',
  lücke: 'luecke',
  lueckentext: 'luecke',
  lückentext: 'luecke',
  reihenfolge: 'reihenfolge',
};

/** true/false aus Wahrheitswert oder Text (wahr, falsch, ja, nein, true, false); sonst null. */
function wahrheitswert(wert) {
  if (typeof wert === 'boolean') return wert;
  const t = text(wert).toLowerCase();
  if (['wahr', 'true', 'ja', 'richtig', 'stimmt'].includes(t)) return true;
  if (['falsch', 'false', 'nein', 'stimmt nicht'].includes(t)) return false;
  return null;
}

function pruefeKarte(k, gesehen) {
  const frage = text(k?.frage);
  const typRoh = text(k?.typ).toLowerCase();
  const typ = typRoh === '' ? 'auswahl' : TYP_NAMEN[typRoh];
  let antworten = [];
  let indexRichtig = 0;
  let fehler = null;

  if (!typ) fehler = `Unbekannter Kartentyp „${typRoh}“.`;
  else if (!frage) fehler = 'Die Frage fehlt.';
  else if (typ === 'wahrfalsch') {
    const wahr = wahrheitswert(k?.richtig);
    if (wahr === null) fehler = 'Bei Wahr/Falsch muss „richtig“ true oder false sein.';
    else {
      antworten = [...WAHR_FALSCH];
      indexRichtig = wahr ? 0 : 1;
    }
  } else if (typ === 'reihenfolge') {
    antworten = Array.isArray(k?.reihenfolge) ? k.reihenfolge.map(text) : [];
    if (antworten.length < REIHENFOLGE_MIN || antworten.length > REIHENFOLGE_MAX || antworten.some((a) => !a)) {
      fehler = `Eine Reihenfolge braucht ${REIHENFOLGE_MIN} bis ${REIHENFOLGE_MAX} Schritte im Feld „reihenfolge“.`;
    } else if (new Set(antworten.map((a) => a.toLowerCase())).size !== antworten.length) fehler = 'Zwei Schritte sind gleich.';
  } else {
    const richtig = text(k?.richtig);
    const falsch = Array.isArray(k?.falsch) ? k.falsch.map(text) : [];
    antworten = [richtig, ...falsch];
    if (!richtig) fehler = 'Die richtige Antwort fehlt.';
    else if (falsch.length !== 3 || falsch.some((a) => !a)) fehler = 'Es müssen genau 3 falsche Antworten angegeben sein.';
    else if (new Set(antworten.map((a) => a.toLowerCase())).size !== 4) fehler = 'Zwei Antworten sind gleich.';
    else if (typ === 'luecke' && !frage.includes(LUECKE)) fehler = `Im Satz fehlt die Lücke ${LUECKE}.`;
  }

  if (!fehler && gesehen.has(normFrage(frage))) fehler = 'Diese Frage steht in der Datei doppelt.';
  if (!fehler) gesehen.add(normFrage(frage));

  return {
    frage,
    typ: typ ?? 'auswahl',
    antworten,
    indexRichtig,
    erklaerung: text(k?.erklaerung) || null,
    quelle: text(k?.quelle) || null,
    vorher: (Array.isArray(k?.vorher) ? k.vorher : [k?.vorher]).map(text).filter(Boolean),
    fehler,
  };
}

/**
 * Liest ein Deck aus Text. Wirft DeckFormatFehler, wenn gar nichts Brauchbares drinsteht.
 * Einzelne kaputte Karten werfen nicht, sie bekommen `fehler` und werden in der Vorschau markiert.
 */
export function parseDeck(eingabe) {
  let roh;
  try {
    roh = JSON.parse(jsonAusText(eingabe));
  } catch (e) {
    if (e instanceof DeckFormatFehler) throw e;
    throw new DeckFormatFehler(`Das JSON ist fehlerhaft (${e.message}).`);
  }
  if (roh === null || typeof roh !== 'object' || Array.isArray(roh)) throw new DeckFormatFehler('Das ist kein Deck.');
  if (roh.format !== undefined && roh.format !== DECK_FORMAT) {
    throw new DeckFormatFehler(`Unbekanntes Format „${roh.format}“ (erwartet: ${DECK_FORMAT}).`);
  }
  if (!Array.isArray(roh.karten) || roh.karten.length === 0) {
    throw new DeckFormatFehler('Im Feld „karten“ stehen keine Karten.');
  }

  const gesehen = new Set();
  return {
    name: text(roh.name) || 'Importiertes Deck',
    beschreibung: text(roh.beschreibung) || null,
    kategorie: text(roh.kategorie) || null,
    karten: roh.karten.map((k) => pruefeKarte(k, gesehen)),
  };
}

const gleicherInhalt = (a, b) =>
  a.frage === b.frage &&
  (a.typ ?? 'auswahl') === (b.typ ?? 'auswahl') &&
  a.indexRichtig === b.indexRichtig &&
  JSON.stringify(a.antworten) === JSON.stringify(b.antworten) &&
  (a.erklaerung ?? null) === (b.erklaerung ?? null) &&
  (a.quelle ?? null) === (b.quelle ?? null);

/**
 * Fügt geprüfte Karten in ein Deck ein (Deck wird per Name gefunden oder neu angelegt).
 * Gleiche Frage im selben Deck = dieselbe Karte: Inhalt wird aktualisiert, Box und
 * Fälligkeit bleiben erhalten. Dadurch erzeugt ein erneuter Import keine Dubletten.
 * Verändert `daten` nicht, sondern liefert eine neue Fassung.
 */
export function mergeImport(daten, deckName, karten, jetzt = Date.now()) {
  const name = text(deckName) || 'Importiertes Deck';
  let deck = daten.decks.find((d) => d.name.trim().toLowerCase() === name.toLowerCase());
  const decks = deck ? daten.decks : [...daten.decks, (deck = neuesDeck({ name, erstelltAm: jetzt }))];

  const vorhanden = new Map(daten.cards.filter((k) => k.deckId === deck.id).map((k) => [normFrage(k.frage), k]));
  const ersetzt = new Map();
  const neu = [];
  let aktualisiert = 0;
  let uebersprungen = 0;

  for (const k of karten) {
    const bestehend = [k.frage, ...(k.vorher ?? [])].map((f) => vorhanden.get(normFrage(f))).find((b) => b && !ersetzt.has(b.id));
    if (!bestehend) {
      neu.push(
        neueKarte({
          deckId: deck.id,
          typ: k.typ,
          frage: k.frage,
          antworten: k.antworten,
          indexRichtig: k.indexRichtig,
          erklaerung: k.erklaerung,
          quelle: k.quelle,
          faelligAm: jetzt,
        }),
      );
    } else if (gleicherInhalt(bestehend, k)) {
      uebersprungen += 1;
    } else {
      ersetzt.set(bestehend.id, {
        ...bestehend,
        typ: k.typ ?? 'auswahl',
        frage: k.frage,
        antworten: [...k.antworten],
        indexRichtig: k.indexRichtig,
        erklaerung: k.erklaerung,
        quelle: k.quelle,
      });
      aktualisiert += 1;
    }
  }

  return {
    daten: { ...daten, decks, cards: [...daten.cards.map((k) => ersetzt.get(k.id) ?? k), ...neu] },
    deck,
    hinzugefuegt: neu.length,
    aktualisiert,
    uebersprungen,
  };
}

/** Text, den man in Claude (oder eine andere KI) einfügt, um ein Deck im richtigen Format zu bekommen. */
export function promptVorlage() {
  return `Erstelle 15 Multiple-Choice-Karteikarten auf Deutsch zum Thema: [THEMA HIER EINTRAGEN]

Antworte ausschließlich mit JSON, ohne Text davor oder danach, in genau diesem Format:
{
  "format": "${DECK_FORMAT}",
  "name": "Kurzer Deck-Name",
  "karten": [
    {
      "frage": "…",
      "richtig": "die richtige Antwort",
      "falsch": ["falsche Antwort 1", "falsche Antwort 2", "falsche Antwort 3"],
      "erklaerung": "1–2 Sätze, warum das stimmt"
    }
  ]
}

Regeln:
- Genau 3 falsche Antworten pro Frage: plausibel, aber eindeutig falsch. Nimm typische Irrtümer und Verwechslungen aus demselben Themenfeld, keine Scherzantworten.
- Alle vier Antworten haben dieselbe Art, Form und ungefähr dieselbe Länge. Bei Zahlen liegen die falschen Werte in der Nähe des richtigen.
- Wörter wie „immer“, „nie“, „nur“ oder „garantiert“ dürfen nicht verraten, welche Antwort falsch ist. Ebenso wenig Weichmacher wie „meist“ oder „oft“, die nur in der richtigen stehen.
- Die Frage verrät die Antwort nicht, z. B. durch gleiche Wörter.
- Die richtige Antwort ist nicht systematisch die längste.
- Jede Frage ist eindeutig und hat genau eine richtige Antwort.
- Nur gesicherte Fakten, keine umstrittenen Behauptungen.

Optional kannst du auch andere Kartentypen mischen (Feld "typ"):
- Wahr/Falsch: { "typ": "wahrfalsch", "frage": "Aussage …", "richtig": true, "erklaerung": "…" }
- Lückentext: { "typ": "luecke", "frage": "Das Herz hat ___ Kammern.", "richtig": "…", "falsch": ["…", "…", "…"] }
- Reihenfolge: { "typ": "reihenfolge", "frage": "Bringe in die richtige Reihenfolge: …", "reihenfolge": ["1. Schritt", "2. Schritt", "3. Schritt"] } (3 bis 6 Schritte, in der richtigen Reihenfolge)`;
}
