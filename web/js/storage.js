// Persistenz in localStorage (oder jedem Objekt mit getItem/setItem – in Tests ein Fake).
import { neueKarte, neuesDeck, standardSettings } from './core/models.js';
import { istGeneratorId } from './core/generator.js';
import { meldungenNormalisieren } from './core/meldungen.js';
import { bereinige } from './core/statistik.js';

export const SCHLUESSEL = 'lerngate.v1';
export const VERSION = 1;

export function leereDaten() {
  return { version: VERSION, decks: [], cards: [], settings: standardSettings(), tage: {}, wuensche: [], meldungen: [] };
}

const istObjekt = (wert) => wert !== null && typeof wert === 'object' && !Array.isArray(wert);
const zahlOderNull = (wert) => (Number.isFinite(wert) ? wert : null);
const ganz = (wert, min, max, standard) => (Number.isFinite(wert) ? Math.min(Math.max(Math.round(wert), min), max) : standard);
const zahl = (wert, min, max, standard) => (Number.isFinite(wert) ? Math.min(Math.max(wert, min), max) : standard);
const uhrzeit = (wert, standard) => (typeof wert === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(wert) ? wert : standard);
const wahrheit = (wert, standard) => (typeof wert === 'boolean' ? wert : standard);
const zaehler = (wert) => (Number.isFinite(wert) && wert >= 0 ? Math.round(wert) : 0);

const BREMSEN = ['keine', 'absicht', 'kauf'];

function zielAppNormalisieren(a) {
  const app = { name: a.name, urlScheme: a.urlScheme };
  if (BREMSEN.includes(a.bremse)) app.bremse = a.bremse;
  if (Number.isFinite(a.tageslimit) && a.tageslimit >= 0) app.tageslimit = Math.min(99, Math.round(a.tageslimit));
  return app;
}

function einstellungenNormalisieren(s) {
  const standard = standardSettings();
  const zielApps = Array.isArray(s.zielApps)
    ? s.zielApps.filter((a) => istObjekt(a) && typeof a.name === 'string' && typeof a.urlScheme === 'string').map(zielAppNormalisieren)
    : standard.zielApps;

  const r = istObjekt(s.reibung) ? s.reibung : {};
  const start = ganz(r.start, 1, 20, standard.reibung.start);
  const reibung = {
    an: wahrheit(r.an, standard.reibung.an),
    start,
    schritt: ganz(r.schritt, 0, 5, standard.reibung.schritt),
    max: Math.max(start, ganz(r.max, 1, 30, standard.reibung.max)),
  };

  const n = istObjekt(s.nachtruhe) ? s.nachtruhe : {};
  const nachtruhe = {
    an: wahrheit(n.an, standard.nachtruhe.an),
    von: uhrzeit(n.von, standard.nachtruhe.von),
    bis: uhrzeit(n.bis, standard.nachtruhe.bis),
    modus: n.modus === 'gesperrt' ? 'gesperrt' : 'streng',
  };

  const appDecks = {};
  if (istObjekt(s.appDecks)) {
    for (const [app, ids] of Object.entries(s.appDecks)) {
      const liste = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
      if (liste.length > 0) appDecks[app] = liste;
    }
  }

  return {
    freischaltdauerMinuten: Number.isFinite(s.freischaltdauerMinuten) ? s.freischaltdauerMinuten : standard.freischaltdauerMinuten,
    kartenProGate: Number.isFinite(s.kartenProGate) ? s.kartenProGate : standard.kartenProGate,
    freischaltungen: Object.fromEntries(
      Object.entries(istObjekt(s.freischaltungen) ? s.freischaltungen : {}).filter(([, bis]) => Number.isFinite(bis)),
    ),
    notfallSkipLetzterTag: zahlOderNull(s.notfallSkipLetzterTag),
    zielApps,
    freischaltKurzbefehl: typeof s.freischaltKurzbefehl === 'string' ? s.freischaltKurzbefehl : standard.freischaltKurzbefehl,
    appDecks,
    generatorFragen: ganz(s.generatorFragen, 0, 20, standard.generatorFragen),
    eingabeAnteil: zahl(s.eingabeAnteil, 0, 1, standard.eingabeAnteil),
    reibung,
    nachtruhe,
    tagesziel: ganz(s.tagesziel, 1, 500, standard.tagesziel),
    kaufbremseStunden: ganz(s.kaufbremseStunden, 1, 168, standard.kaufbremseStunden),
    pausierteGeneratoren: Array.isArray(s.pausierteGeneratoren) ? [...new Set(s.pausierteGeneratoren.filter(istGeneratorId))] : [],
    lernmodus: s.lernmodus === 'einfach' ? 'einfach' : 'intelligent',
    neueProQuiz: ganz(s.neueProQuiz, 0, 10, standard.neueProQuiz),
    willkommenGesehen: s.willkommenGesehen === true,
    letztesBackup: zahlOderNull(s.letztesBackup),
  };
}

function tageNormalisieren(roh) {
  const tage = {};
  if (!istObjekt(roh)) return tage;
  for (const [key, t] of Object.entries(roh)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !istObjekt(t)) continue;
    const f = {};
    for (const [app, n] of Object.entries(istObjekt(t.f) ? t.f : {})) if (zaehler(n) > 0) f[app] = zaehler(n);
    const d = {};
    for (const [deck, paar] of Object.entries(istObjekt(t.d) ? t.d : {})) {
      if (Array.isArray(paar)) d[deck] = [zaehler(paar[0]), Math.min(zaehler(paar[0]), zaehler(paar[1]))];
    }
    tage[key] = { a: zaehler(t.a), r: Math.min(zaehler(t.a), zaehler(t.r)), q: zaehler(t.q), s: zaehler(t.s), n: zaehler(t.n), f, d };
    const u = {};
    for (const [stunde, n] of Object.entries(istObjekt(t.u) ? t.u : {})) if (/^([0-9]|1\d|2[0-3])$/.test(stunde) && zaehler(n) > 0) u[stunde] = zaehler(n);
    if (Object.keys(u).length > 0) tage[key].u = u;
  }
  return bereinige(tage, Date.now());
}

function wuenscheNormalisieren(roh) {
  return (Array.isArray(roh) ? roh : [])
    .filter((w) => istObjekt(w) && typeof w.id === 'string' && typeof w.text === 'string' && w.text.trim() && Number.isFinite(w.erstelltAm) && Number.isFinite(w.reifAm))
    .map((w) => {
      const wunsch = { id: w.id, text: w.text, erstelltAm: w.erstelltAm, reifAm: w.reifAm, status: ['gekauft', 'verworfen'].includes(w.status) ? w.status : 'wartet' };
      if (Number.isFinite(w.erledigtAm)) wunsch.erledigtAm = w.erledigtAm;
      return wunsch;
    });
}

/** Macht aus beliebigem JSON gültige Daten: fehlende Felder werden ergänzt, Kaputtes entfällt. */
export function normalisieren(roh) {
  if (!istObjekt(roh)) throw new Error('Keine gültigen LernGate-Daten');

  const decks = (Array.isArray(roh.decks) ? roh.decks : [])
    .filter((d) => istObjekt(d) && typeof d.id === 'string' && typeof d.name === 'string')
    .map((d) => neuesDeck({ id: d.id, name: d.name, erstelltAm: Number.isFinite(d.erstelltAm) ? d.erstelltAm : Date.now(), pausiert: d.pausiert === true }));
  const deckIds = new Set(decks.map((d) => d.id));

  const cards = (Array.isArray(roh.cards) ? roh.cards : [])
    .filter((k) => istObjekt(k) && typeof k.id === 'string' && deckIds.has(k.deckId) && Array.isArray(k.antworten))
    .map((k) =>
      neueKarte({
        id: k.id,
        deckId: k.deckId,
        typ: k.typ,
        versuche: k.versuche,
        treffer: k.treffer,
        intervall: k.intervall,
        ease: k.ease,
        frage: String(k.frage ?? ''),
        antworten: k.antworten.map(String),
        indexRichtig: k.indexRichtig,
        box: k.box,
        faelligAm: Number.isFinite(k.faelligAm) ? k.faelligAm : Date.now(),
        quelle: typeof k.quelle === 'string' ? k.quelle : null,
        erklaerung: typeof k.erklaerung === 'string' && k.erklaerung ? k.erklaerung : null,
      }),
    );

  return {
    version: VERSION,
    decks,
    cards,
    settings: einstellungenNormalisieren(istObjekt(roh.settings) ? roh.settings : {}),
    tage: tageNormalisieren(roh.tage),
    wuensche: wuenscheNormalisieren(roh.wuensche),
    meldungen: meldungenNormalisieren(roh.meldungen),
  };
}

/** Lädt die Daten. Ist der gespeicherte Text kaputt, wird er unter "<key>.defekt" aufgehoben statt überschrieben. */
export function laden(speicher) {
  const roh = speicher.getItem(SCHLUESSEL);
  if (roh == null) return leereDaten();
  try {
    return normalisieren(JSON.parse(roh));
  } catch {
    speicher.setItem(`${SCHLUESSEL}.defekt`, roh);
    return leereDaten();
  }
}

export function speichern(speicher, daten) {
  speicher.setItem(SCHLUESSEL, JSON.stringify(daten));
}

export function exportJson(daten) {
  return JSON.stringify(daten, null, 2);
}

/** Wirft einen Fehler bei ungültigem JSON oder fremdem Format. */
export function importJson(text) {
  return normalisieren(JSON.parse(text));
}
