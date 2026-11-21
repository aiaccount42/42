// Lernstatistik in Tageszählern (klein und ohne Einzel-Protokoll):
// tage["2026-10-20"] = { a: Antworten, r: richtig, q: bestandene Quizze, s: Notfall-Skips,
//                        n: "Doch nicht geöffnet", f: { App: Freischaltungen }, d: { Deck-Id: [Antworten, richtig] },
//                        u: { Uhrzeit (0–23): Freischaltungen } (optional, erst seit Update 12) }
const zwei = (n) => String(n).padStart(2, '0');

export const tagKey = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
};

const neuerTag = () => ({ a: 0, r: 0, q: 0, s: 0, n: 0, f: {}, d: {} });

function tagFuer(tage, zeit) {
  const key = tagKey(zeit);
  tage[key] ??= neuerTag();
  return tage[key];
}

/** Zählt eine beantwortete Frage (verändert `tage`). */
export function erfasseAntwort(tage, { zeit, deckId, richtig }) {
  const t = tagFuer(tage, zeit);
  t.a += 1;
  if (richtig) t.r += 1;
  const d = (t.d[deckId] ??= [0, 0]);
  d[0] += 1;
  if (richtig) d[1] += 1;
}

/** Zählt eine Freischaltung einer App: bestandenes Quiz oder Notfall-Skip (verändert `tage`). */
export function erfasseFreischaltung(tage, { zeit, app, skip = false }) {
  const t = tagFuer(tage, zeit);
  t.f[app] = (t.f[app] ?? 0) + 1;
  const stunde = new Date(zeit).getHours();
  t.u ??= {};
  t.u[stunde] = (t.u[stunde] ?? 0) + 1;
  if (skip) t.s += 1;
  else t.q += 1;
}

/** Zählt einen Sieg: Quiz gestartet, die App aber nicht geöffnet (verändert `tage`). */
export function erfasseNichtGeoeffnet(tage, { zeit }) {
  const t = tagFuer(tage, zeit);
  t.n = (t.n ?? 0) + 1;
}

/** Freischaltungen heute: einer App oder (ohne Namen) aller Apps zusammen. */
export function freischaltungenHeute(tage, jetzt, app = null) {
  const t = tage[tagKey(jetzt)];
  if (!t) return 0;
  return app === null ? Object.values(t.f).reduce((summe, n) => summe + n, 0) : (t.f[app] ?? 0);
}

export function nichtGeoeffnetHeute(tage, jetzt) {
  return tage[tagKey(jetzt)]?.n ?? 0;
}

export function richtigHeute(tage, jetzt) {
  return tage[tagKey(jetzt)]?.r ?? 0;
}

const tagZuvor = (ms, anzahl) => {
  const d = new Date(ms);
  d.setDate(d.getDate() - anzahl);
  return d.getTime();
};

/**
 * Serie: Tage in Folge mit mindestens einem bestandenen Quiz. Ist heute noch nichts geschafft,
 * läuft die Serie bis gestern weiter (sie reißt erst, wenn auch gestern fehlt).
 */
export function serie(tage, jetzt) {
  let anzahl = 0;
  const heuteOk = (tage[tagKey(jetzt)]?.q ?? 0) > 0;
  for (let i = heuteOk ? 0 : 1; i < 4000; i++) {
    if ((tage[tagKey(tagZuvor(jetzt, i))]?.q ?? 0) > 0) anzahl += 1;
    else break;
  }
  return anzahl;
}

/** Auswertung von `tageAnzahl` Tagen, beginnend `versatz` Tage vor heute (0 = einschließlich heute). */
export function uebersicht(tage, jetzt, tageAnzahl = 7, versatz = 0) {
  const summe = { antworten: 0, richtig: 0, quizze: 0, skips: 0, nichtGeoeffnet: 0, proApp: {}, proDeck: {}, tageMitQuiz: 0 };
  for (let i = versatz; i < versatz + tageAnzahl; i++) {
    const t = tage[tagKey(tagZuvor(jetzt, i))];
    if (!t) continue;
    summe.antworten += t.a;
    summe.nichtGeoeffnet += t.n ?? 0;
    summe.richtig += t.r;
    summe.quizze += t.q;
    summe.skips += t.s;
    if (t.q > 0) summe.tageMitQuiz += 1;
    for (const [app, n] of Object.entries(t.f)) summe.proApp[app] = (summe.proApp[app] ?? 0) + n;
    for (const [deck, [a, r]] of Object.entries(t.d)) {
      const d = (summe.proDeck[deck] ??= { antworten: 0, richtig: 0 });
      d.antworten += a;
      d.richtig += r;
    }
  }
  summe.quote = summe.antworten > 0 ? summe.richtig / summe.antworten : null;
  return summe;
}

/** Entfernt Tage, die länger als `behalten` Tage zurückliegen. */
export function bereinige(tage, jetzt, behalten = 400) {
  const grenze = tagKey(tagZuvor(jetzt, behalten));
  for (const key of Object.keys(tage)) if (key < grenze) delete tage[key];
  return tage;
}

/**
 * Wochenübersicht: die letzten 7 Tage (älteste zuerst) mit Einzelwerten, die Summe der Woche
 * und die Summe der Woche davor zum Vergleichen.
 */
export function wochenUebersicht(tage, jetzt) {
  const einzeln = [];
  for (let i = 6; i >= 0; i--) {
    const zeit = tagZuvor(jetzt, i);
    const t = tage[tagKey(zeit)];
    einzeln.push({ zeit, key: tagKey(zeit), antworten: t?.a ?? 0, richtig: t?.r ?? 0, quizze: t?.q ?? 0, nichtGeoeffnet: t?.n ?? 0 });
  }
  return { tage: einzeln, woche: uebersicht(tage, jetzt, 7, 0), vorwoche: uebersicht(tage, jetzt, 7, 7) };
}
