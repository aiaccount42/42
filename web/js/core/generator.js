// Zufallsaufgaben: Rechenkarten, die sich nicht auswendig lernen lassen.
// Jede Aufgabe wird frisch erzeugt (nie gespeichert) und ist als Karte lesbar: richtige Antwort an
// Index 0, drei plausible falsche Antworten (typische Rechenfehler). Zusätzlich trägt die Karte
// `eingabe` (Lösung als Zahl) und `generiert` (Typ und Ausgangswerte, für Tests).
import { kopfrechenWeg } from './kopfrechnen.js';
import { neueId } from './models.js';
import { runde2, zahlText } from './zahlformat.js';
import { mischen, system } from './zufall.js';

export const GENERATOR_PREFIX = 'gen:';

export { zahlText };

/**
 * Liest eine eingetippte Zahl: "1.200,50", "1200,5", "12.5", "30 €" …
 * Ein Punkt ohne Komma gilt als Tausendertrenner, wenn danach genau 3 Ziffern folgen ("1.200" = 1200).
 */
export function parseZahl(eingabe) {
  const s0 = String(eingabe ?? '')
    .trim()
    .replace(/(€|\$|%|stück|stk\.?|tage?|us-dollar)/gi, '')
    .replace(/\s+/g, '');
  if (!/^[+-]?[\d.,]+$/.test(s0)) return NaN;
  let s = s0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Stimmt die eingetippte Zahl mit der Lösung überein (auf 2 Nachkommastellen genau)? */
export function istRichtigeZahl(eingabe, loesung) {
  const n = parseZahl(eingabe);
  return Number.isFinite(n) && Math.abs(n - runde2(loesung)) < 0.005 + 1e-9;
}

const wahl = (liste, z) => liste[Math.floor(z() * liste.length)];

/** Drei verschiedene, positive falsche Antworten (erst aus den typischen Fehlern, dann aufgefüllt). */
function falscheAntworten(richtig, kandidaten, z) {
  const belegt = new Set([zahlText(richtig)]);
  const gewaehlt = [];
  const fuelle = [richtig * 1.1, richtig * 0.9, richtig * 1.25, richtig * 0.8, richtig * 1.5, richtig * 2, richtig / 2, richtig + 10, richtig * 3];
  for (const c of [...mischen(kandidaten, z), ...mischen(fuelle, z)]) {
    if (gewaehlt.length === 3) break;
    if (!Number.isFinite(c) || c <= 0) continue;
    const schluessel = zahlText(c);
    if (belegt.has(schluessel) || Math.abs(runde2(c) - runde2(richtig)) < 0.005) continue;
    belegt.add(schluessel);
    gewaehlt.push(c);
  }
  return gewaehlt;
}

// Jede Vorlage liefert { frage, wert, einheit, falsch: [typische Fehler], erklaerung, werte }.
const VORLAGEN = {
  prozentwert(z) {
    const g = wahl([40, 50, 60, 80, 120, 150, 200, 240, 250, 300, 400, 500, 600, 800, 1000, 1200, 2000], z);
    const p = wahl([5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 60, 75], z);
    const w = (g * p) / 100;
    return {
      frage: `Wie viel sind ${p} % von ${zahlText(g, '€')}?`,
      wert: w, einheit: '€',
      falsch: [g - w, w * 10, w / 10, g + w, w * 2],
      erklaerung: `${zahlText(g, '€')} · ${zahlText(p / 100)} = ${zahlText(w, '€')}.`,
      werte: { g, p },
    };
  },

  aufschlag(z) {
    const g = wahl([40, 50, 60, 80, 120, 150, 200, 250, 300, 400, 500], z);
    const p = wahl([5, 8, 10, 12, 15, 20, 25, 30], z);
    const neu = g * (1 + p / 100);
    return {
      frage: `Ein Preis von ${zahlText(g, '€')} steigt um ${p} %. Wie hoch ist der neue Preis?`,
      wert: neu, einheit: '€',
      falsch: [g * (1 - p / 100), g + p, (g * p) / 100, g * (1 + p / 10)],
      erklaerung: `${zahlText(g, '€')} · ${zahlText(1 + p / 100)} = ${zahlText(neu, '€')}.`,
      werte: { g, p },
    };
  },

  abschlag(z) {
    const g = wahl([40, 50, 60, 80, 120, 150, 200, 250, 300, 400, 500], z);
    const p = wahl([5, 10, 15, 20, 25, 30, 40, 50], z);
    const neu = g * (1 - p / 100);
    return {
      frage: `Ein Artikel kostet ${zahlText(g, '€')} und wird um ${p} % reduziert. Was kostet er jetzt?`,
      wert: neu, einheit: '€',
      falsch: [g * (1 + p / 100), g - p, (g * p) / 100, g * (1 - p / 10)],
      erklaerung: `${zahlText(g, '€')} · ${zahlText(1 - p / 100)} = ${zahlText(neu, '€')}.`,
      werte: { g, p },
    };
  },

  prozentsatz(z) {
    const b = wahl([20, 40, 60, 80, 100, 120, 160, 200, 240, 300, 400, 500], z);
    const p = wahl([5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80], z);
    const a = (b * p) / 100;
    return {
      frage: `Wie viel Prozent sind ${zahlText(a)} von ${zahlText(b)}?`,
      wert: p, einheit: '%',
      falsch: [100 - p, p * 2, p / 2, b / a, a],
      erklaerung: `${zahlText(a)} : ${zahlText(b)} = ${zahlText(p / 100)} = ${zahlText(p, '%')}.`,
      werte: { a, b },
    };
  },

  grundwert(z) {
    const p = wahl([5, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75], z);
    const g = wahl([40, 60, 80, 100, 120, 150, 200, 240, 300, 400, 500, 800], z);
    const w = (g * p) / 100;
    return {
      frage: `${p} % einer Größe entsprechen ${zahlText(w, '€')}. Wie groß ist der Grundwert (100 %)?`,
      wert: g, einheit: '€',
      falsch: [(w * p) / 100, w / p, w * p, g + w, w * (100 - p) / 100],
      erklaerung: `Grundwert = Prozentwert : Prozentsatz = ${zahlText(w, '€')} : ${zahlText(p / 100)} = ${zahlText(g, '€')}.`,
      werte: { w, p },
    };
  },

  mwstBrutto(z) {
    const satz = wahl([19, 7], z);
    const n = wahl([50, 80, 100, 120, 150, 200, 250, 300, 400, 500], z);
    const brutto = n * (1 + satz / 100);
    return {
      frage: `Ein Nettopreis beträgt ${zahlText(n, '€')}, die Mehrwertsteuer ${satz} %. Wie hoch ist der Bruttopreis?`,
      wert: brutto, einheit: '€',
      falsch: [n * (1 - satz / 100), n + satz, n * (1 + satz / 10), (n * satz) / 100],
      erklaerung: `${zahlText(n, '€')} · ${zahlText(1 + satz / 100)} = ${zahlText(brutto, '€')}.`,
      werte: { n, satz },
    };
  },

  mwstNetto(z) {
    const satz = wahl([19, 7], z);
    const n = wahl([100, 200, 300, 400, 500, 600, 800, 1000], z);
    const brutto = n * (1 + satz / 100);
    return {
      frage: `Ein Bruttopreis beträgt ${zahlText(brutto, '€')} bei ${satz} % Mehrwertsteuer. Wie hoch ist der Nettopreis?`,
      wert: n, einheit: '€',
      falsch: [brutto * (1 - satz / 100), brutto - satz, (brutto * satz) / 100, brutto * (1 + satz / 100)],
      erklaerung: `Netto = Brutto : ${zahlText(1 + satz / 100)} = ${zahlText(n, '€')}. Wer ${satz} % vom Brutto abzieht, rechnet falsch.`,
      werte: { brutto, satz },
    };
  },

  prozentpunkte(z) {
    const [a, b] = wahl([[2, 3], [2, 4], [4, 5], [5, 6], [4, 6], [5, 8], [10, 12], [8, 10], [1, 2], [2, 5], [4, 7], [5, 7], [10, 15], [20, 25], [4, 10], [5, 10]], z);
    const rel = ((b - a) / a) * 100;
    return {
      frage: `Ein Zinssatz steigt von ${a} % auf ${b} %. Um wie viel Prozent ist er relativ gestiegen?`,
      wert: rel, einheit: '%',
      falsch: [b - a, ((b - a) / b) * 100, (b / a) * 100, a * b],
      erklaerung: `Die Änderung beträgt ${b - a} Prozentpunkte. Relativ: ${b - a} : ${a} = ${zahlText(rel, '%')}.`,
      werte: { a, b },
    };
  },

  zinsenJahr(z) {
    const k = wahl([500, 1000, 1500, 2000, 2500, 3000, 5000, 8000, 10000], z);
    const zins = wahl([1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6], z);
    const ertrag = (k * zins) / 100;
    return {
      frage: `Wie hoch sind die Jahreszinsen auf ${zahlText(k, '€')} bei ${zahlText(zins)} % Zinssatz?`,
      wert: ertrag, einheit: '€',
      falsch: [ertrag / 10, ertrag * 10, k + ertrag, ertrag * 2, (k * zins) / 1000],
      erklaerung: `${zahlText(k, '€')} · ${zahlText(zins / 100)} = ${zahlText(ertrag, '€')}.`,
      werte: { k, zins },
    };
  },

  zinsenMonate(z) {
    const k = wahl([1200, 2400, 3000, 4800, 6000, 9000], z);
    const zins = wahl([2, 3, 4, 5, 6], z);
    const m = wahl([3, 6, 9], z);
    const ertrag = ((k * zins) / 100) * (m / 12);
    return {
      frage: `Wie hoch sind die Zinsen auf ${zahlText(k, '€')} bei ${zins} % pro Jahr für ${m} Monate?`,
      wert: ertrag, einheit: '€',
      falsch: [(k * zins) / 100, ertrag * 2, ertrag / 2, ertrag * m, ((k * zins) / 100) * (m / 10)],
      erklaerung: `${zahlText(k, '€')} · ${zahlText(zins / 100)} · ${m}/12 = ${zahlText(ertrag, '€')}.`,
      werte: { k, zins, m },
    };
  },

  skonto(z) {
    const r = wahl([200, 250, 400, 500, 800, 1000, 1200, 2000, 2500], z);
    const s = wahl([1, 2, 3], z);
    const zahlung = r * (1 - s / 100);
    return {
      frage: `Eine Rechnung über ${zahlText(r, '€')} wird mit ${s} % Skonto bezahlt. Wie viel überweist du?`,
      wert: zahlung, einheit: '€',
      falsch: [(r * s) / 100, r * (1 + s / 100), r - s, r * (1 - s / 10)],
      erklaerung: `${s} % von ${zahlText(r, '€')} sind ${zahlText((r * s) / 100, '€')}; ${zahlText(r, '€')} − ${zahlText((r * s) / 100, '€')} = ${zahlText(zahlung, '€')}.`,
      werte: { r, s },
    };
  },

  umsatzrendite(z) {
    const p = wahl([4, 5, 8, 10, 12, 15, 20, 25], z);
    const u = wahl([20000, 40000, 50000, 80000, 100000, 200000], z);
    const g = (u * p) / 100;
    return {
      frage: `Gewinn: ${zahlText(g, '€')}, Umsatz: ${zahlText(u, '€')}. Wie hoch ist die Umsatzrendite?`,
      wert: p, einheit: '%',
      falsch: [u / g, p / 10, p * 10, 100 - p, p * 2],
      erklaerung: `Umsatzrendite = Gewinn : Umsatz = ${zahlText(g)} : ${zahlText(u)} = ${zahlText(p, '%')}.`,
      werte: { g, u },
    };
  },

  gewinnschwelle(z) {
    const db = wahl([2, 4, 5, 6, 8, 10], z);
    const stueck = wahl([100, 150, 200, 250, 400, 500, 800, 1200], z);
    const preis = wahl([12, 15, 20, 25, 30, 40], z);
    const v = preis - db;
    const f = db * stueck;
    return {
      frage: `Fixkosten: ${zahlText(f, '€')}. Verkaufspreis: ${zahlText(preis, '€')} je Stück, variable Kosten: ${zahlText(v, '€')} je Stück. Ab wie vielen Stück ist die Gewinnschwelle erreicht?`,
      wert: stueck, einheit: 'Stück',
      falsch: [f / preis, f / v, f / (preis + v), stueck * 2, stueck / 2],
      erklaerung: `Deckungsbeitrag = ${zahlText(preis, '€')} − ${zahlText(v, '€')} = ${zahlText(db, '€')}. Gewinnschwelle = ${zahlText(f, '€')} : ${zahlText(db, '€')} = ${zahlText(stueck)} Stück.`,
      werte: { f, preis, v },
    };
  },

  mittelwert(z) {
    let zahlen = [10, 20, 30, 40];
    for (let i = 0; i < 60; i++) {
      const kandidat = [0, 1, 2, 3].map(() => 10 + 5 * Math.floor(z() * 19));
      if (kandidat.reduce((a, b) => a + b, 0) % 4 === 0 && new Set(kandidat).size >= 3) {
        zahlen = kandidat;
        break;
      }
    }
    const summe = zahlen.reduce((a, b) => a + b, 0);
    const mittel = summe / 4;
    const sortiert = [...zahlen].sort((a, b) => a - b);
    return {
      frage: `Wie groß ist der Mittelwert (arithmetisches Mittel) von ${zahlen.join(', ')}?`,
      wert: mittel, einheit: '',
      falsch: [summe, summe / 3, (sortiert[1] + sortiert[2]) / 2 + 5, sortiert[3], mittel + 5],
      erklaerung: `(${zahlen.join(' + ')}) : 4 = ${zahlText(summe)} : 4 = ${zahlText(mittel)}.`,
      werte: { zahlen },
    };
  },

  dreisatz(z) {
    let a = 4;
    let t = 12;
    let b = 6;
    for (let i = 0; i < 80; i++) {
      a = wahl([4, 6, 8, 10, 12], z);
      t = wahl([6, 9, 12, 15, 18, 20, 24], z);
      b = wahl([2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 16, 20], z);
      if (b !== a && (a * t) % b === 0) break;
    }
    const neu = (a * t) / b;
    return {
      frage: `${a} Arbeiter brauchen für einen Auftrag ${t} Tage. Wie lange brauchen ${b} Arbeiter (gleiche Leistung)?`,
      wert: neu, einheit: 'Tage',
      falsch: [(t * b) / a, t + (b - a), t - (b - a), a * t, t],
      erklaerung: `Umgekehrt proportional: ${a} · ${t} = ${a * t} Arbeitertage, ${a * t} : ${b} = ${zahlText(neu)}.`,
      werte: { a, t, b },
    };
  },

  aufteilung(z) {
    const [x, y] = wahl([[3, 2], [2, 1], [3, 1], [4, 1], [5, 3], [3, 4], [2, 3]], z);
    const k = wahl([10, 20, 30, 50, 100, 200], z);
    const g = (x + y) * k;
    const gross = Math.max(x, y) * k;
    return {
      frage: `Ein Gewinn von ${zahlText(g, '€')} wird im Verhältnis ${x} : ${y} aufgeteilt. Wie hoch ist der größere Anteil?`,
      wert: gross, einheit: '€',
      falsch: [Math.min(x, y) * k, g / 2, g - k, gross + k, g / (x + y)],
      erklaerung: `${x + y} Teile: ${zahlText(g, '€')} : ${x + y} = ${zahlText(k, '€')} je Teil, der größere Anteil hat ${Math.max(x, y)} Teile = ${zahlText(gross, '€')}.`,
      werte: { x, y, g },
    };
  },

  wechselkurs(z) {
    const kurs = wahl([1.1, 1.2, 1.25, 1.5], z);
    const e = wahl([100, 200, 300, 400, 500, 800], z);
    const dollar = e * kurs;
    return {
      frage: `1 € entspricht ${zahlText(kurs)} US-Dollar. Wie viele US-Dollar sind ${zahlText(e, '€')}?`,
      wert: dollar, einheit: '$',
      falsch: [e / kurs, e + kurs, e * (kurs - 1), dollar * 10, e],
      erklaerung: `${zahlText(e)} · ${zahlText(kurs)} = ${zahlText(dollar)} $.`,
      werte: { kurs, e },
    };
  },

  abschreibung(z) {
    const j = wahl([4, 5, 6, 8, 10], z);
    const jahr = wahl([1000, 1500, 2000, 2500, 3000, 5000], z);
    const a = j * jahr;
    return {
      frage: `Eine Maschine kostet ${zahlText(a, '€')} und wird ${j} Jahre linear abgeschrieben. Wie hoch ist die Abschreibung pro Jahr?`,
      wert: jahr, einheit: '€',
      falsch: [a / (j + 1), a / (j - 1), a - j, a / (j * 2), a / 12],
      erklaerung: `Lineare Abschreibung = Anschaffungskosten : Nutzungsdauer = ${zahlText(a, '€')} : ${j} = ${zahlText(jahr, '€')}.`,
      werte: { a, j },
    };
  },
};

export const GENERATOREN = [
  {
    id: `${GENERATOR_PREFIX}prozentrechnen`,
    name: 'Zufallsaufgaben: Prozentrechnen',
    beschreibung: 'Prozentwert, Auf- und Abschlag, Prozentsatz, Grundwert, Mehrwertsteuer',
    typen: ['prozentwert', 'aufschlag', 'abschlag', 'prozentsatz', 'grundwert', 'mwstBrutto', 'mwstNetto', 'prozentpunkte'],
  },
  {
    id: `${GENERATOR_PREFIX}wirtschaftsmathe`,
    name: 'Zufallsaufgaben: Wirtschaftsmathe',
    beschreibung: 'Zinsen, Skonto, Rendite, Gewinnschwelle, Dreisatz, Abschreibung',
    typen: ['zinsenJahr', 'zinsenMonate', 'skonto', 'umsatzrendite', 'gewinnschwelle', 'mittelwert', 'dreisatz', 'aufteilung', 'wechselkurs', 'abschreibung'],
  },
];

export const generatorIds = () => GENERATOREN.map((g) => g.id);
export const generatorFuerId = (id) => GENERATOREN.find((g) => g.id === id) ?? null;
export const istGeneratorId = (id) => typeof id === 'string' && generatorFuerId(id) !== null;

/** Erzeugt eine Aufgabe als Karte. `alsEingabe`: Lösung wird eingetippt statt ausgewählt. */
export function erzeugeAufgabe(generatorId, typ, zufall = system, alsEingabe = false) {
  const generator = generatorFuerId(generatorId);
  if (!generator || !generator.typen.includes(typ)) throw new Error(`Unbekannte Aufgabe: ${generatorId}/${typ}`);
  const v = VORLAGEN[typ](zufall);
  const falsch = falscheAntworten(v.wert, v.falsch, zufall);
  const weg = kopfrechenWeg(typ, v.werte);
  return {
    id: `gen-${neueId()}`,
    deckId: generatorId,
    frage: v.frage,
    antworten: [zahlText(v.wert, v.einheit), ...falsch.map((f) => zahlText(f, v.einheit))],
    indexRichtig: 0,
    box: 1,
    faelligAm: 0,
    quelle: null,
    erklaerung: weg ? `So geht es im Kopf:\n${weg.weg}\n\nFormel: ${v.erklaerung}` : v.erklaerung,
    tipp: weg?.tipp ?? null,
    eingabe: { wert: v.wert, einheit: v.einheit },
    alsEingabe,
    generiert: { typ, werte: v.werte },
  };
}

/**
 * n verschiedene Aufgaben aus den erlaubten Generatoren (Typen werden reihum gemischt, damit in einem
 * Quiz möglichst keine Aufgabenart doppelt vorkommt). Ein Anteil `eingabeAnteil` (0–1) wird als Zahleneingabe gestellt.
 */
export function erzeugeAufgaben(erlaubteIds, n, zufall = system, eingabeAnteil = 0.5) {
  const paare = erlaubteIds.filter(istGeneratorId).flatMap((id) => generatorFuerId(id).typen.map((typ) => [id, typ]));
  if (paare.length === 0 || n <= 0) return [];
  const reihe = [];
  while (reihe.length < n) reihe.push(...mischen(paare, zufall));
  return reihe.slice(0, n).map(([id, typ]) => erzeugeAufgabe(id, typ, zufall, zufall() < eingabeAnteil));
}
