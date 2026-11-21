import { istProblemkarte, schwierigkeit, trefferquote } from './schwierigkeit.js';
import { mischen, system } from './zufall.js';

/**
 * Macht aus einer Karte die Frage, wie sie angezeigt wird: Antworten gemischt (Wahr/Falsch bleibt
 * in fester Reihenfolge), bei Reihenfolge-Karten die Schritte durcheinander (nie schon richtig).
 */
export function frageAusKarte(karte, zufall = system) {
  const typ = karte.typ ?? 'auswahl';
  const basis = { kartenId: karte.id, typ, frage: karte.frage, erklaerung: karte.erklaerung ?? null, eingabe: null, reihenfolgeRichtig: null, tipp: karte.tipp ?? null, schwierigkeit: schwierigkeit(karte), trefferquote: trefferquote(karte), problemkarte: istProblemkarte(karte) };

  if (typ === 'wahrfalsch') {
    return Object.freeze({ ...basis, antworten: [...karte.antworten], indexRichtig: karte.indexRichtig, loesungText: karte.antworten[karte.indexRichtig] });
  }

  if (typ === 'reihenfolge') {
    const n = karte.antworten.length;
    let anzeige = mischen(karte.antworten.keys(), zufall); // anzeige[j] = Index des Schritts, der an Position j gezeigt wird
    for (let versuch = 0; versuch < 5 && anzeige.every((v, j) => v === j); versuch++) anzeige = mischen(karte.antworten.keys(), zufall);
    if (anzeige.every((v, j) => v === j)) anzeige = [...anzeige.slice(1), anzeige[0]]; // Notlösung: verschieben
    return Object.freeze({
      ...basis,
      antworten: anzeige.map((i) => karte.antworten[i]),
      indexRichtig: -1,
      reihenfolgeRichtig: Array.from({ length: n }, (_, schritt) => anzeige.indexOf(schritt)),
      loesungText: karte.antworten.join(' → '),
    });
  }

  const reihenfolge = mischen(karte.antworten.keys(), zufall);
  return Object.freeze({
    ...basis,
    antworten: reihenfolge.map((i) => karte.antworten[i]),
    indexRichtig: reihenfolge.indexOf(karte.indexRichtig),
    loesungText: karte.antworten[karte.indexRichtig],
    eingabe: karte.alsEingabe && karte.eingabe ? { einheit: karte.eingabe.einheit, wert: karte.eingabe.wert } : null,
  });
}

/**
 * Prüft die Antwort auf eine Reihenfolge-Frage. `indizes` sind die angetippten Positionen der
 * angezeigten Schritte in der gewünschten Reihenfolge. Wirft bei unpassender Eingabe.
 */
export function pruefeReihenfolge(frage, indizes) {
  const r = frage?.reihenfolgeRichtig;
  if (!r) throw new Error('keineReihenfolgeFrage');
  const gueltig =
    Array.isArray(indizes) &&
    indizes.length === r.length &&
    indizes.every((i) => Number.isInteger(i) && i >= 0 && i < r.length) &&
    new Set(indizes).size === r.length;
  if (!gueltig) throw new Error('ungueltigeReihenfolge');
  return { richtig: indizes.every((v, j) => v === r[j]), gewaehlteReihenfolge: indizes.map((i) => frage.antworten[i]) };
}
