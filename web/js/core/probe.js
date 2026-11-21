import { frageAusKarte, pruefeReihenfolge } from './frage.js';
import { istGueltig } from './models.js';
import { mischen, system } from './zufall.js';

/**
 * Probelauf durch ein ganzes Deck: jede Karte genau einmal, gemischt, ohne Wiederholung.
 * Verändert weder Karten (Leitner-Boxen) noch Statistik – gedacht zum Einschätzen der Fragen.
 * Hat dieselbe Schnittstelle wie GateSitzung, soweit die Quiz-Ansicht sie braucht.
 */
export class ProbeSitzung {
  #karten;
  #position = 0;
  #zufall;
  #ergebnisse = [];

  richtigeAntworten = 0;
  aktuelleFrage = null;
  /** Falsche Karten kommen nicht erneut. */
  wiederholt = false;

  constructor({ karten, zufall = system }) {
    this.#zufall = zufall;
    const gesehen = new Set();
    this.#karten = mischen(
      karten.filter((k) => istGueltig(k) && !gesehen.has(k.id) && gesehen.add(k.id)),
      zufall,
    );
    this.aktuelleFrage = this.#naechsteFrage();
  }

  get benoetigteRichtige() {
    return this.#karten.length;
  }

  get beantwortet() {
    return this.#position;
  }

  get status() {
    if (this.#karten.length === 0) return 'keineKarten';
    return this.#position >= this.#karten.length ? 'bestanden' : 'laeuft';
  }

  get istBestanden() {
    return this.status === 'bestanden';
  }

  get hinweis() {
    return this.status === 'keineKarten' ? 'In diesem Deck gibt es noch keine Karten' : null;
  }

  get fortschrittText() {
    return `Karte ${Math.min(this.#position + 1, this.#karten.length)} von ${this.#karten.length} · ${this.richtigeAntworten} richtig`;
  }

  get fortschritt() {
    return this.#karten.length === 0 ? 0 : this.#position / this.#karten.length;
  }

  /** [{ kartenId, frage, richtigeAntwort, richtig }] in der Reihenfolge der Antworten. */
  get ergebnisse() {
    return this.#ergebnisse.map((e) => ({ ...e }));
  }

  beantworte(antwortIndex) {
    const frage = this.aktuelleFrage;
    if (!frage) throw new Error('keineAktuelleFrage');
    if (!Number.isInteger(antwortIndex) || antwortIndex < 0 || antwortIndex >= frage.antworten.length || frage.reihenfolgeRichtig) {
      throw new Error('ungueltigerAntwortIndex');
    }
    return this.#auswerten(antwortIndex === frage.indexRichtig, { gewaehlterIndex: antwortIndex });
  }

  /** Antwort auf eine Reihenfolge-Karte (Positionen der angezeigten Schritte in der gewählten Folge). */
  beantworteReihenfolge(indizes) {
    const frage = this.aktuelleFrage;
    if (!frage) throw new Error('keineAktuelleFrage');
    const pruefung = pruefeReihenfolge(frage, indizes);
    return this.#auswerten(pruefung.richtig, { gewaehlterIndex: null, gewaehlteReihenfolge: pruefung.gewaehlteReihenfolge });
  }

  #auswerten(richtig, zusatz) {
    const frage = this.aktuelleFrage;
    if (richtig) this.richtigeAntworten += 1;
    this.#ergebnisse.push({ kartenId: frage.kartenId, frage: frage.frage, richtigeAntwort: frage.loesungText, richtig });
    this.#position += 1;
    this.aktuelleFrage = this.#naechsteFrage();
    return { richtig, indexRichtig: frage.indexRichtig, loesungText: frage.loesungText, kartenId: frage.kartenId, ...zusatz };
  }

  #naechsteFrage() {
    const karte = this.#karten[this.#position];
    return karte ? frageAusKarte(karte, this.#zufall) : null;
  }
}
