// Auswertungen für das Statistik-Dashboard. Alles rechnet auf den Tageszählern aus statistik.js
// (kein Einzel-Protokoll): Antworten, Freischaltungen je App, Decks und – seit Update 12 – Uhrzeiten.
import { tagKey } from './statistik.js';

export const ZEITRAEUME = [7, 30, 90];
export const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const WOCHENTAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const tagZuvor = (ms, anzahl) => {
  const d = new Date(ms);
  d.setDate(d.getDate() - anzahl);
  return d.getTime();
};

/**
 * Die letzten `anzahl` Tage (älteste zuerst), beginnend `versatz` Tage vor heute. Jeder Tag hat Werte,
 * auch wenn nichts passiert ist (alles 0), damit Diagramme keine Lücken haben.
 */
export function tageListe(tage, jetzt, anzahl, versatz = 0) {
  const liste = [];
  for (let i = versatz + anzahl - 1; i >= versatz; i--) {
    const zeit = tagZuvor(jetzt, i);
    const key = tagKey(zeit);
    const t = tage[key];
    const antworten = t?.a ?? 0;
    const richtig = t?.r ?? 0;
    const proApp = { ...(t?.f ?? {}) };
    liste.push({
      key,
      zeit,
      wochentag: new Date(zeit).getDay(), // 0 = Sonntag
      antworten,
      richtig,
      falsch: antworten - richtig,
      quizze: t?.q ?? 0,
      skips: t?.s ?? 0,
      nichtGeoeffnet: t?.n ?? 0,
      freischaltungen: Object.values(proApp).reduce((summe, n) => summe + n, 0),
      proApp,
      proDeck: t?.d ?? {},
      proStunde: t?.u ?? {},
    });
  }
  return liste;
}

/** Summen einer Tagesliste. quote = Anteil richtig (null ohne Antworten). */
export function kennzahlen(liste) {
  const k = { antworten: 0, richtig: 0, falsch: 0, quizze: 0, skips: 0, nichtGeoeffnet: 0, freischaltungen: 0, aktiveTage: 0 };
  for (const t of liste) {
    k.antworten += t.antworten;
    k.richtig += t.richtig;
    k.falsch += t.falsch;
    k.quizze += t.quizze;
    k.skips += t.skips;
    k.nichtGeoeffnet += t.nichtGeoeffnet;
    k.freischaltungen += t.freischaltungen;
    if (t.antworten > 0 || t.freischaltungen > 0) k.aktiveTage += 1;
  }
  k.quote = k.antworten > 0 ? k.richtig / k.antworten : null;
  return k;
}

/** Freischaltungen je App, häufigste zuerst, mit Anteil (0–1) an allen Zugriffen. */
export function proApp(liste) {
  const summe = new Map();
  for (const t of liste) for (const [name, n] of Object.entries(t.proApp)) summe.set(name, (summe.get(name) ?? 0) + n);
  const gesamt = [...summe.values()].reduce((a, b) => a + b, 0);
  return [...summe]
    .map(([name, anzahl]) => ({ name, anzahl, anteil: gesamt > 0 ? anzahl / gesamt : 0 }))
    .sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, 'de'));
}

/** Antworten und Quote je Deck, meistgeübte zuerst. */
export function proDeck(liste) {
  const summe = new Map();
  for (const t of liste) {
    for (const [id, [a, r]] of Object.entries(t.proDeck)) {
      const d = summe.get(id) ?? { id, antworten: 0, richtig: 0 };
      d.antworten += a;
      d.richtig += r;
      summe.set(id, d);
    }
  }
  return [...summe.values()]
    .filter((d) => d.antworten > 0)
    .map((d) => ({ ...d, quote: d.richtig / d.antworten }))
    .sort((a, b) => b.antworten - a.antworten);
}

/** Montag bis Sonntag: wie viele Tage im Zeitraum, Summen und Schnitt pro Tag. */
export function proWochentag(liste) {
  const tage = WOCHENTAGE_KURZ.map((name, i) => ({ name, wochentag: (i + 1) % 7, tage: 0, freischaltungen: 0, antworten: 0, richtig: 0 }));
  for (const t of liste) {
    const w = tage.find((x) => x.wochentag === t.wochentag);
    w.tage += 1;
    w.freischaltungen += t.freischaltungen;
    w.antworten += t.antworten;
    w.richtig += t.richtig;
  }
  return tage.map((w) => ({
    ...w,
    schnitt: w.tage > 0 ? w.freischaltungen / w.tage : 0,
    quote: w.antworten > 0 ? w.richtig / w.antworten : null,
  }));
}

/** Freischaltungen je Uhrzeit (24 Werte, Index = Stunde). Leer, solange noch keine Uhrzeiten erfasst wurden. */
export function proStunde(liste) {
  const stunden = Array(24).fill(0);
  for (const t of liste) for (const [h, n] of Object.entries(t.proStunde)) if (h >= 0 && h < 24) stunden[h] += n;
  return stunden;
}

/** Längste Serie aller Zeiten: Tage in Folge mit mindestens einem bestandenen Quiz. */
export function laengsteSerie(tage) {
  const keys = Object.keys(tage).filter((k) => (tage[k].q ?? 0) > 0).sort();
  let beste = 0;
  let aktuell = 0;
  let vorher = null;
  for (const key of keys) {
    const [j, m, d] = key.split('-').map(Number);
    const gestern = tagKey(new Date(j, m - 1, d - 1).getTime());
    aktuell = vorher === gestern ? aktuell + 1 : 1;
    beste = Math.max(beste, aktuell);
    vorher = key;
  }
  return beste;
}

const komma = (zahl, stellen = 1) => zahl.toFixed(stellen).replace('.', ',');
const pro = (anteil) => `${Math.round(anteil * 100)} %`;
const datumKurz = (ms) => new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

/** Das 2-Stunden-Fenster mit den meisten Zugriffen: { von, anteil } oder null, solange es zu wenig Daten gibt (unter 8 Zugriffe). */
export function stosszeit(stunden) {
  const gesamt = stunden.reduce((a, b) => a + b, 0);
  if (gesamt < 8) return null;
  let beste = { von: 0, summe: -1 };
  for (let h = 0; h < 24; h++) {
    const summe = stunden[h] + stunden[(h + 1) % 24];
    if (summe > beste.summe) beste = { von: h, summe };
  }
  return { von: beste.von, bis: (beste.von + 2) % 24, anteil: beste.summe / gesamt };
}

/**
 * Auffälligkeiten als kurze Sätze (höchstens 6), nur wenn die Datenlage etwas hergibt.
 * `liste` = gewählter Zeitraum, `vorher` = Zeitraum davor. `deckName(id)` liefert Anzeigenamen.
 */
export function auffaelligkeiten({ liste, vorher, deckName = (id) => id }) {
  const s = [];
  const k = kennzahlen(liste);
  const v = kennzahlen(vorher);

  if (k.antworten >= 10 && v.antworten >= 10) {
    const diff = Math.round((k.quote - v.quote) * 100);
    if (Math.abs(diff) >= 3) s.push(`📈 Deine Richtig-Quote liegt bei ${pro(k.quote)}, das sind ${Math.abs(diff)} Punkte ${diff > 0 ? 'mehr' : 'weniger'} als davor.`);
    else s.push(`📈 Deine Richtig-Quote ist stabil bei ${pro(k.quote)}.`);
  } else if (k.antworten >= 10) {
    s.push(`📈 Deine Richtig-Quote liegt bei ${pro(k.quote)} (${k.antworten} Antworten).`);
  }

  const apps = proApp(liste);
  if (k.freischaltungen >= 5 && apps.length > 1) {
    s.push(`📱 Die meisten Zugriffe gingen an ${apps[0].name}: ${pro(apps[0].anteil)} (${apps[0].anzahl} von ${k.freischaltungen}).`);
  }

  const stoss = stosszeit(proStunde(liste));
  if (stoss) s.push(`🕗 Am häufigsten greifst du zwischen ${stoss.von} und ${stoss.bis} Uhr auf Apps zu (${pro(stoss.anteil)} der Zugriffe mit erfasster Uhrzeit).`);

  const tage = proWochentag(liste).filter((w) => w.tage >= 2 && w.freischaltungen > 0);
  if (k.freischaltungen >= 10 && tage.length >= 3) {
    const spitze = tage.reduce((a, b) => (b.schnitt > a.schnitt ? b : a));
    s.push(`📅 Am meisten Zugriffe hast du im Schnitt am ${WOCHENTAGE_LANG[spitze.wochentag]} (${komma(spitze.schnitt)} pro Tag).`);
  }

  if (k.nichtGeoeffnet > 0 && k.quizze > 0) {
    s.push(`✋ ${k.nichtGeoeffnet}× hat dich das Quiz vom Öffnen abgehalten (${pro(Math.min(1, k.nichtGeoeffnet / k.quizze))} deiner Quizze).`);
  }

  const decks = proDeck(liste).filter((d) => d.antworten >= 10);
  if (decks.length >= 2) {
    const nachQuote = [...decks].sort((a, b) => b.quote - a.quote);
    const best = nachQuote[0];
    const schwach = nachQuote[nachQuote.length - 1];
    if (best.quote - schwach.quote >= 0.1) s.push(`🧠 Stärkstes Deck: ${deckName(best.id)} (${pro(best.quote)}). Am meisten Luft nach oben: ${deckName(schwach.id)} (${pro(schwach.quote)}).`);
  }

  const spitzenTag = liste.reduce((a, b) => (b.antworten > a.antworten ? b : a), liste[0]);
  if (liste.length >= 7 && spitzenTag && spitzenTag.antworten >= 10) {
    s.push(`🏆 Dein aktivster Tag: ${WOCHENTAGE_LANG[spitzenTag.wochentag].slice(0, 2)}, ${datumKurz(spitzenTag.zeit)} mit ${spitzenTag.antworten} Antworten.`);
  }

  return s.slice(0, 6);
}
