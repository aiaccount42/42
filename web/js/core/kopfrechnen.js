// Kopfrechen-Wege für die Zufallsaufgaben: Zu jeder Aufgabe gibt es einen Tipp (vor der Antwort,
// ohne Ergebnis) und einen Rechenweg mit den echten Zahlen (nach der Antwort). Alle Zwischenwerte
// werden berechnet, nichts ist von Hand getippt. Ziel: Methode üben statt raten oder schätzen.
import { runde2, zahlText as z } from './zahlformat.js';

const ist = (a, b) => Math.abs(a - b) < 1e-9;

// ---------- Prozent im Kopf ----------

export const PROZENT_TIPPS = {
  1: '1 % = durch 100 teilen (Komma um 2 Stellen nach links).',
  5: '5 % = die Hälfte von 10 %. 10 % bekommst du, indem du das Komma um eine Stelle nach links schiebst.',
  8: '8 % = 10 % minus 2 × 1 %.',
  10: '10 % = durch 10 teilen (Komma um eine Stelle nach links).',
  12: '12 % = 10 % plus 2 × 1 %.',
  15: '15 % = 10 % plus 5 % (die Hälfte von 10 %).',
  20: '20 % = 2 × 10 %.',
  25: '25 % = ein Viertel: zweimal halbieren.',
  30: '30 % = 3 × 10 %.',
  35: '35 % = 3 × 10 % plus 5 %.',
  40: '40 % = 4 × 10 %.',
  45: '45 % = 50 % (Hälfte) minus 5 %.',
  50: '50 % = die Hälfte.',
  60: '60 % = 6 × 10 %.',
  75: '75 % = drei Viertel: Viertel bestimmen (zweimal halbieren), dann mal 3.',
};

export const prozentTipp = (p) => PROZENT_TIPPS[p] ?? '1 % bestimmen (durch 100 teilen) und mit der Prozentzahl multiplizieren.';

/**
 * p % von g in Kopfrechen-Schritten. Liefert { zeilen, wert }. `h` formatiert Zahlen (mit Einheit).
 */
export function prozentSchritte(g, p, h = (n) => z(n)) {
  const a = g / 10; // 10 %
  const b = g / 100; // 1 %
  const wert = (g * p) / 100;
  const zeilen = [];
  switch (p) {
    case 1:
      zeilen.push(`1 % von ${h(g)} = ${h(g)} : 100 = ${h(b)}`);
      break;
    case 5:
      zeilen.push(`10 % von ${h(g)} = ${h(a)}`, `5 % = die Hälfte davon = ${h(a / 2)}`);
      break;
    case 8:
      zeilen.push(`10 % von ${h(g)} = ${h(a)}`, `1 % = ${h(b)}, also 2 % = ${h(2 * b)}`, `8 % = 10 % − 2 % = ${h(a)} − ${h(2 * b)} = ${h(wert)}`);
      break;
    case 10:
      zeilen.push(`10 % von ${h(g)} = ${h(g)} : 10 = ${h(a)}`);
      break;
    case 12:
      zeilen.push(`10 % von ${h(g)} = ${h(a)}`, `1 % = ${h(b)}, also 2 % = ${h(2 * b)}`, `12 % = ${h(a)} + ${h(2 * b)} = ${h(wert)}`);
      break;
    case 15:
      zeilen.push(`10 % von ${h(g)} = ${h(a)}`, `5 % = die Hälfte davon = ${h(a / 2)}`, `15 % = ${h(a)} + ${h(a / 2)} = ${h(wert)}`);
      break;
    case 20:
    case 30:
    case 40:
    case 60:
      zeilen.push(`10 % von ${h(g)} = ${h(a)}`, `${p} % = ${p / 10} × ${h(a)} = ${h(wert)}`);
      break;
    case 25:
      zeilen.push(`25 % = ein Viertel von ${h(g)}`, `halbieren: ${h(g / 2)}, noch einmal halbieren: ${h(wert)}`);
      break;
    case 35:
      zeilen.push(`10 % von ${h(g)} = ${h(a)}, also 30 % = ${h(3 * a)}`, `5 % = ${h(a / 2)}`, `35 % = ${h(3 * a)} + ${h(a / 2)} = ${h(wert)}`);
      break;
    case 45:
      zeilen.push(`50 % von ${h(g)} = ${h(g / 2)}`, `5 % = ${h(a / 2)}`, `45 % = ${h(g / 2)} − ${h(a / 2)} = ${h(wert)}`);
      break;
    case 50:
      zeilen.push(`50 % = die Hälfte von ${h(g)} = ${h(wert)}`);
      break;
    case 75:
      zeilen.push(`25 % von ${h(g)}: halbieren (${h(g / 2)}), noch einmal halbieren (${h(g / 4)})`, `75 % = 3 × ${h(g / 4)} = ${h(wert)}`);
      break;
    default:
      zeilen.push(`1 % von ${h(g)} = ${h(b)}`, `${p} % = ${p} × ${h(b)} = ${h(wert)}`);
  }
  return { zeilen, wert };
}

// ---------- Teilen im Kopf ----------

export const TEILEN_TIPPS = {
  2: 'Durch 2: halbieren.',
  4: 'Durch 4: zweimal halbieren.',
  5: 'Durch 5: erst mal 2, dann durch 10.',
  8: 'Durch 8: dreimal halbieren.',
  10: 'Durch 10: Komma um eine Stelle nach links.',
  20: 'Durch 20: halbieren, dann durch 10.',
  25: 'Durch 25: erst mal 4, dann durch 100.',
  50: 'Durch 50: erst mal 2, dann durch 100.',
};

export const teilenTipp = (t) => TEILEN_TIPPS[t] ?? `Welche Zahl mal ${t} ergibt die gesuchte Zahl? Rechne zur Kontrolle rückwärts.`;

/** a : t in Schritten, mit Probe am Ende. Liefert { zeilen, wert }. */
export function teilenSchritte(a, t, h = (n) => z(n)) {
  const wert = a / t;
  const zeilen = [];
  switch (t) {
    case 2:
      zeilen.push(`${h(a)} halbieren = ${h(wert)}`);
      break;
    case 4:
      zeilen.push(`${h(a)} halbieren = ${h(a / 2)}, noch einmal halbieren = ${h(wert)}`);
      break;
    case 5:
      zeilen.push(`${h(a)} · 2 = ${h(a * 2)}, dann : 10 = ${h(wert)}`);
      break;
    case 8:
      zeilen.push(`${h(a)} halbieren = ${h(a / 2)}, = ${h(a / 4)}, = ${h(wert)}`);
      break;
    case 10:
      zeilen.push(`${h(a)} : 10 = ${h(wert)}`);
      break;
    case 20:
      zeilen.push(`${h(a)} halbieren = ${h(a / 2)}, dann : 10 = ${h(wert)}`);
      break;
    case 25:
      zeilen.push(`${h(a)} · 4 = ${h(a * 4)}, dann : 100 = ${h(wert)}`);
      break;
    case 50:
      zeilen.push(`${h(a)} · 2 = ${h(a * 2)}, dann : 100 = ${h(wert)}`);
      break;
    default:
      zeilen.push(`${h(a)} : ${t} = ${h(wert)}`);
  }
  zeilen.push(`Probe: ${h(wert)} · ${t} = ${h(wert * t)}`);
  return { zeilen, wert };
}

// ---------- Weg und Tipp je Aufgabenart ----------

const nl = (...zeilen) => zeilen.flat().join('\n');

const WEGE = {
  prozentwert({ g, p }, { h }) {
    const s = prozentSchritte(g, p, h);
    return { tipp: prozentTipp(p), weg: nl(s.zeilen) };
  },

  aufschlag({ g, p }, { h }) {
    const s = prozentSchritte(g, p, h);
    return {
      tipp: `Rechne erst den Aufschlag aus (${p} % vom Preis), dann addierst du ihn. ${prozentTipp(p)}`,
      weg: nl(s.zeilen, `Neuer Preis: ${h(g)} + ${h(s.wert)} = ${h(g + s.wert)}`),
    };
  },

  abschlag({ g, p }, { h }) {
    const s = prozentSchritte(g, p, h);
    return {
      tipp: `Rechne erst den Rabatt aus (${p} % vom Preis), dann ziehst du ihn ab. ${prozentTipp(p)}`,
      weg: nl(s.zeilen, `Neuer Preis: ${h(g)} − ${h(s.wert)} = ${h(g - s.wert)}`),
    };
  },

  prozentsatz({ a, b }) {
    const wert = (a / b) * 100;
    const eins = b / 100;
    const bruchEin = Math.round(b / a);
    const zeilen = [];
    if (ist(b / a, bruchEin) && [2, 4, 5, 10, 20].includes(bruchEin)) {
      const name = { 2: 'die Hälfte', 4: 'ein Viertel', 5: 'ein Fünftel', 10: 'ein Zehntel', 20: 'ein Zwanzigstel' }[bruchEin];
      zeilen.push(`${z(b)} : ${z(a)} = ${bruchEin}, also ist ${z(a)} ${name} von ${z(b)}`, `${name} = ${z(100 / bruchEin, '%')}`);
    } else {
      zeilen.push(`1 % von ${z(b)} = ${z(eins)}`, `Wie oft passt ${z(eins)} in ${z(a)}? ${z(a)} : ${z(eins)} = ${z(wert)}`, `Also ${z(wert, '%')}`);
    }
    return {
      tipp: 'Frage dich: Ist es ein einfacher Bruch (ein Halb, ein Viertel, ein Fünftel, ein Zehntel)? Sonst: 1 % des Ganzen bestimmen und zählen, wie oft es hineinpasst.',
      weg: nl(zeilen),
    };
  },

  grundwert({ w, p }, { h }) {
    const g = (w * 100) / p;
    const zeilen = [];
    const feste = { 10: 'mal 10', 20: 'mal 5', 25: 'mal 4', 50: 'mal 2', 5: 'mal 20' };
    if (feste[p]) {
      zeilen.push(`${p} % sind ${h(w)}. 100 % sind ${feste[p].replace('mal ', '')}-mal so viel: ${h(w)} · ${feste[p].replace('mal ', '')} = ${h(g)}`);
    } else {
      zeilen.push(`${p} % = ${h(w)}`, `1 % = ${h(w)} : ${p} = ${h(w / p)}`, `100 % = ${h(w / p)} · 100 = ${h(g)}`);
    }
    return {
      tipp: 'Rückwärts rechnen: Aus wie viel Prozent bekommst du 100 %? 50 % mal 2, 25 % mal 4, 20 % mal 5, 10 % mal 10. Sonst erst 1 % bestimmen.',
      weg: nl(zeilen),
    };
  },

  mwstBrutto({ n, satz }, { h }) {
    const zeilen =
      satz === 19
        ? [`10 % von ${h(n)} = ${h(n / 10)}, also 20 % = ${h(n / 5)}`, `1 % = ${h(n / 100)}`, `19 % = 20 % − 1 % = ${h(n / 5)} − ${h(n / 100)} = ${h((n * 19) / 100)}`]
        : [`10 % von ${h(n)} = ${h(n / 10)}`, `3 % = 3 · ${h(n / 100)} = ${h((n * 3) / 100)}`, `7 % = 10 % − 3 % = ${h(n / 10)} − ${h((n * 3) / 100)} = ${h((n * 7) / 100)}`];
    return {
      tipp: satz === 19 ? '19 % = 20 % − 1 %. Die Steuer rechnest du aus und addierst sie zum Nettopreis.' : '7 % = 10 % − 3 %. Die Steuer rechnest du aus und addierst sie zum Nettopreis.',
      weg: nl(zeilen, `Brutto = ${h(n)} + ${h((n * satz) / 100)} = ${h(n * (1 + satz / 100))}`),
    };
  },

  mwstNetto({ brutto, satz }, { h }) {
    const n = brutto / (1 + satz / 100);
    const faktor = 100 + satz;
    return {
      tipp: `Der Bruttopreis ist ${faktor} % (Netto = 100 % plus ${satz} %). Teile durch ${faktor}, dann hast du 1 %, und mal 100 den Nettopreis. Nicht einfach ${satz} % abziehen.`,
      weg: nl(`Brutto = ${faktor} % = ${h(brutto)}`, `1 % = ${h(brutto)} : ${faktor} = ${h(brutto / faktor)}`, `100 % = ${h(brutto / faktor)} · 100 = ${h(n)}`),
    };
  },

  prozentpunkte({ a, b }) {
    const rel = ((b - a) / a) * 100;
    return {
      tipp: 'Erst die Differenz bilden, dann durch den alten Wert teilen (nicht durch den neuen). Einfache Brüche helfen: 1/2 = 50 %, 1/4 = 25 %, 1/5 = 20 %.',
      weg: nl(`Differenz: ${b} − ${a} = ${b - a} Prozentpunkte`, `Relativ: ${b - a} : ${a} = ${z((b - a) / a)} = ${z(rel, '%')}`),
    };
  },

  zinsenJahr({ k, zins }, { h }) {
    const eins = k / 100;
    const ganz = Math.floor(zins);
    const halb = !ist(zins, ganz);
    const zeilen = [`1 % von ${h(k)} = ${h(eins)}`];
    if (halb) {
      zeilen.push(`${ganz} % = ${ganz} · ${h(eins)} = ${h(ganz * eins)}`, `0,5 % = die Hälfte von 1 % = ${h(eins / 2)}`, `${z(zins)} % = ${h(ganz * eins)} + ${h(eins / 2)} = ${h(eins * zins)}`);
    } else {
      zeilen.push(`${ganz} % = ${ganz} · ${h(eins)} = ${h(eins * zins)}`);
    }
    return { tipp: '1 % bestimmen (durch 100 teilen), mit der Zinszahl malnehmen. Bei halben Prozent: die Hälfte von 1 % dazuzählen.', weg: nl(zeilen) };
  },

  zinsenMonate({ k, zins, m }, { h }) {
    const jahr = (k * zins) / 100;
    const bruch = { 3: 'ein Viertel Jahr: durch 4', 6: 'ein halbes Jahr: durch 2', 9: 'drei Viertel Jahr: durch 4, mal 3' }[m];
    const ergebnis = jahr * (m / 12);
    const zeilen = [`1 % von ${h(k)} = ${h(k / 100)}, ${zins} % = ${h(jahr)} (Zinsen für ein ganzes Jahr)`, `${m} Monate = ${bruch}`];
    if (m === 9) zeilen.push(`${h(jahr)} : 4 = ${h(jahr / 4)}, mal 3 = ${h(ergebnis)}`);
    else zeilen.push(`${h(jahr)} : ${m === 3 ? 4 : 2} = ${h(ergebnis)}`);
    return { tipp: 'Erst die Zinsen für ein ganzes Jahr, dann den Bruchteil des Jahres: 3 Monate = ein Viertel, 6 Monate = die Hälfte, 9 Monate = drei Viertel.', weg: nl(zeilen) };
  },

  skonto({ r, s }, { h }) {
    const abzug = (r * s) / 100;
    return {
      tipp: 'Skonto ist ein kleiner Rabatt: 1 % bestimmen (durch 100 teilen), mit der Skonto-Zahl malnehmen und von der Rechnung abziehen.',
      weg: nl(`1 % von ${h(r)} = ${h(r / 100)}`, `${s} % = ${s} · ${h(r / 100)} = ${h(abzug)}`, `Du überweist: ${h(r)} − ${h(abzug)} = ${h(r - abzug)}`),
    };
  },

  umsatzrendite({ g, u }) {
    const p = (g / u) * 100;
    const eins = u / 100;
    return {
      tipp: 'Gewinn durch Umsatz. Rechne mit 1 % des Umsatzes (durch 100 teilen): Wie oft passt das in den Gewinn?',
      weg: nl(`1 % vom Umsatz = ${z(u)} : 100 = ${z(eins)}`, `Gewinn : 1 % = ${z(g)} : ${z(eins)} = ${z(p)}`, `Umsatzrendite = ${z(p, '%')}`),
    };
  },

  gewinnschwelle({ f, preis, v }) {
    const db = preis - v;
    const t = teilenSchritte(f, db, (n) => z(n));
    return {
      tipp: `Erst den Deckungsbeitrag: Preis minus variable Kosten. Dann Fixkosten durch Deckungsbeitrag. ${teilenTipp(db)}`,
      weg: nl(`Deckungsbeitrag = ${z(preis)} − ${z(v)} = ${z(db)} € je Stück`, `Gewinnschwelle = ${z(f)} : ${z(db)}`, t.zeilen),
    };
  },

  mittelwert({ zahlen }) {
    const anker = zahlen.slice().sort((x, y) => x - y)[1];
    const abw = zahlen.map((x) => x - anker);
    const summeAbw = abw.reduce((x, y) => x + y, 0);
    const vor = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
    return {
      tipp: 'Nimm eine Zahl aus der Mitte als Anker und rechne nur die Abweichungen zusammen. Die Summe geteilt durch die Anzahl kommt auf den Anker drauf.',
      weg: nl(`Anker: ${anker}`, `Abweichungen: ${abw.map(vor).join(', ')} (Summe ${vor(summeAbw)})`, `${vor(summeAbw)} : 4 = ${z(summeAbw / 4)}, Mittelwert = ${anker} ${summeAbw >= 0 ? '+' : '−'} ${z(Math.abs(summeAbw / 4))} = ${z(anker + summeAbw / 4)}`),
    };
  },

  dreisatz({ a, t, b }) {
    const gesamt = a * t;
    const neu = gesamt / b;
    const tz = teilenSchritte(gesamt, b, (n) => z(n));
    return {
      tipp: 'Mehr Arbeiter, weniger Tage: Rechne die gesamte Arbeit in Arbeitertagen (Arbeiter mal Tage), dann teilst du durch die neue Zahl der Arbeiter.',
      weg: nl(`Gesamtarbeit: ${a} · ${t} = ${z(gesamt)} Arbeitertage`, `${z(gesamt)} : ${b} = ${z(neu)} Tage`, tz.zeilen),
    };
  },

  aufteilung({ x, y, g }) {
    const k = g / (x + y);
    const gross = Math.max(x, y);
    return {
      tipp: 'Zähle die Teile zusammen, teile den Betrag durch die Teilezahl und nimm den Teil mal die Anzahl der Teile des gesuchten Anteils.',
      weg: nl(`Teile: ${x} + ${y} = ${x + y}`, `Ein Teil: ${z(g)} : ${x + y} = ${z(k)}`, `Größerer Anteil: ${gross} · ${z(k)} = ${z(gross * k)}`),
    };
  },

  wechselkurs({ kurs, e }) {
    const zusatz = { 1.1: ['10 %', e / 10], 1.2: ['20 %', e / 5], 1.25: ['ein Viertel', e / 4], 1.5: ['die Hälfte', e / 2] }[kurs];
    const hinweis = { 1.1: '1,1 = 100 % + 10 %: Komma um eine Stelle nach links, dazu addieren.', 1.2: '1,2 = 100 % + 20 %: 10 % bestimmen, verdoppeln, addieren.', 1.25: '1,25 = 100 % + ein Viertel: zweimal halbieren, addieren.', 1.5: '1,5 = 100 % + die Hälfte: halbieren, addieren.' }[kurs];
    return {
      tipp: `Zerlege den Kurs: ${hinweis}`,
      weg: nl(`${z(kurs)} = 1 + ${z(kurs - 1)}, also ${z(e)} + ${zusatz[0]} davon`, `${zusatz[0]} von ${z(e)} = ${z(zusatz[1])}`, `${z(e)} + ${z(zusatz[1])} = ${z(e * kurs)}`),
    };
  },

  abschreibung({ a, j }) {
    const t = teilenSchritte(a, j, (n) => z(n));
    return {
      tipp: `Anschaffungskosten durch die Jahre. ${teilenTipp(j)}`,
      weg: nl(`${z(a)} € : ${j} Jahre`, t.zeilen),
    };
  },
};

/** { tipp, weg } für eine Aufgabenart oder null, wenn es keinen Weg gibt. */
export function kopfrechenWeg(typ, werte) {
  const f = WEGE[typ];
  if (!f) return null;
  const h = (n) => z(n, einheitFuer(typ));
  return f(werte, { h });
}

const EURO_TYPEN = new Set(['prozentwert', 'aufschlag', 'abschlag', 'grundwert', 'mwstBrutto', 'mwstNetto', 'zinsenJahr', 'zinsenMonate', 'skonto']);
const einheitFuer = (typ) => (EURO_TYPEN.has(typ) ? '€' : '');

export const KOPFRECHEN_TYPEN = Object.keys(WEGE);
export { runde2 };
