// Stellt die Fragen für ein Quiz zusammen: erlaubte Decks der App, Zufallsaufgaben, Kartenzahl.
import { ziehen } from './auswahl.js';
import { generatorIds, istGeneratorId, erzeugeAufgaben } from './generator.js';
import { istGueltig } from './models.js';
import { mischen, system } from './zufall.js';

const minutenAmTag = (ms) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};
const uhrzeitInMinuten = (text) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** Liegt der Zeitpunkt in der Nachtruhe (auch über Mitternacht, z. B. 22:00–06:00)? */
export function inNachtruhe(jetzt, nachtruhe) {
  if (!nachtruhe?.an) return false;
  const von = uhrzeitInMinuten(nachtruhe.von);
  const bis = uhrzeitInMinuten(nachtruhe.bis);
  if (von === null || bis === null || von === bis) return false;
  const m = minutenAmTag(jetzt);
  return von < bis ? m >= von && m < bis : m >= von || m < bis;
}

/** Nachtruhe im Modus "gesperrt": es gibt kein Quiz, nur den Notfall-Skip. */
export const nachtruheGesperrt = (jetzt, nachtruhe) => inNachtruhe(jetzt, nachtruhe) && nachtruhe.modus === 'gesperrt';

/**
 * Wie viele richtige Antworten das Quiz verlangt.
 * Mit "Reibung" wächst die Zahl mit jeder Freischaltung des Tages (start + n · schritt, höchstens max);
 * ohne Reibung gilt "Karten pro Gate". In der Nachtruhe (Modus "streng") wird verdoppelt.
 */
export function kartenAnzahl(settings, jetzt, freischaltungenHeute) {
  const r = settings.reibung;
  let n = r?.an ? Math.min(r.max, r.start + freischaltungenHeute * r.schritt) : settings.kartenProGate;
  n = Math.max(1, Math.round(n));
  if (inNachtruhe(jetzt, settings.nachtruhe) && settings.nachtruhe.modus === 'streng') n = Math.min(20, n * 2);
  return n;
}

/** Welche Decks (Ids) und Zufallsaufgaben für die App gelten. appName leer = Freies Üben (alles). */
export function erlaubteQuellen(settings, appName) {
  const pausiert = new Set(settings.pausierteGeneratoren ?? []);
  const auswahl = appName ? settings.appDecks?.[appName] : null;
  if (!Array.isArray(auswahl) || auswahl.length === 0) return { deckIds: null, generatoren: generatorIds().filter((id) => !pausiert.has(id)) };
  return { deckIds: new Set(auswahl), generatoren: auswahl.filter((id) => istGeneratorId(id) && !pausiert.has(id)) };
}

/**
 * Karten für ein Quiz (ohne pausierte Decks): erst die gespeicherten Karten (Leitner-Auswahl), dazu `generatorFragen`
 * Zufallsaufgaben. Reichen die gespeicherten Karten nicht, füllen Zufallsaufgaben auf (sofern erlaubt).
 */
export function baueGateKarten({ settings, karten, appName = null, jetzt, freischaltungenHeute = 0, zufall = system, anzahl = null, pausierteDecks = [] }) {
  const n = anzahl ?? kartenAnzahl(settings, jetzt, freischaltungenHeute);
  const { deckIds, generatoren } = erlaubteQuellen(settings, appName);
  const pausiert = new Set(pausierteDecks);
  const gespeichert = karten.filter((k) => (deckIds === null || deckIds.has(k.deckId)) && !istGeneratorId(k.deckId) && !pausiert.has(k.deckId));
  const verfuegbar = gespeichert.filter(istGueltig).length;

  let nGen = generatoren.length > 0 ? Math.min(Math.max(0, Math.round(settings.generatorFragen ?? 2)), n) : 0;
  if (generatoren.length > 0) nGen = Math.max(nGen, n - verfuegbar);
  const nGespeichert = n - nGen;

  const neuMax = settings.lernmodus === 'intelligent' ? (settings.neueProQuiz ?? 2) : null;
  const gezogen = ziehen(gespeichert, nGespeichert, jetzt, zufall, { neuMax });
  const aufgaben = erzeugeAufgaben(generatoren, nGen, zufall, settings.eingabeAnteil ?? 0.5);
  return mischen([...gezogen, ...aufgaben], zufall);
}
