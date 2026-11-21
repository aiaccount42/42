import { ziehen } from './auswahl.js';
import { frageAusKarte, pruefeReihenfolge } from './frage.js';
import { istRichtigeZahl } from './generator.js';
import { intelligentFalsch, intelligentRichtig } from './intervall.js';
import { falschBeantwortet, richtigBeantwortet } from './leitner.js';
import { istGueltig } from './models.js';
import { systemUhr } from './uhr.js';
import { system } from './zufall.js';

export const KEINE_KARTEN_HINWEIS = 'Erst Karten anlegen';

export class GateFehler extends Error {
  /** code: 'keineAktuelleFrage' | 'ungueltigerAntwortIndex' | 'keineEingabeFrage' | 'ungueltigeEingabe' */
  constructor(code) {
    super(code);
    this.name = 'GateFehler';
    this.code = code;
  }
}

/**
 * Ein laufendes Gate: Karten werden nacheinander gestellt, falsch beantwortete Karten
 * kommen später im selben Gate erneut. Bestanden ist das Gate, sobald jede gezogene
 * Karte einmal richtig beantwortet wurde (bei 5 Karten = 5 richtige Antworten).
 *
 * Leitner-Regeln:
 * - richtig beim ersten Mal: Box +1
 * - falsch: Box 1 (jedes Mal)
 * - später im selben Gate richtig: zählt fürs Bestehen, die Karte bleibt in Box 1
 */
export class GateSitzung {
  #karten = new Map();
  #reihenfolge = [];
  #warteschlange = [];
  #falsch = new Set();
  #wiederholungsAbstand;
  #uhr;
  #zufall;
  #intelligent;

  richtigeAntworten = 0;
  aktuelleFrage = null;

  /**
   * @param gezogeneKarten bereits ausgewählte Karten (siehe ziehen()); ungültige Karten
   *   und doppelte IDs werden aussortiert.
   * @param wiederholungsAbstand wie viele andere Karten dazwischen liegen, bevor eine
   *   falsche Karte erneut kommt (kürzer, wenn die Schlange kürzer ist).
   */
  constructor({ zielApp, gezogeneKarten, wiederholungsAbstand = 2, uhr = systemUhr, zufall = system, lernmodus = 'einfach' }) {
    this.#intelligent = lernmodus === 'intelligent';
    this.zielApp = zielApp;
    for (const karte of gezogeneKarten) {
      if (istGueltig(karte) && !this.#karten.has(karte.id)) {
        this.#karten.set(karte.id, karte);
        this.#reihenfolge.push(karte.id);
      }
    }
    this.#warteschlange = [...this.#reihenfolge];
    this.#wiederholungsAbstand = Math.max(0, wiederholungsAbstand);
    this.#uhr = uhr;
    this.#zufall = zufall;
    this.aktuelleFrage = this.#naechsteFrage();
  }

  /** Zieht die Karten per ziehen() aus allen Karten und startet das Gate. */
  static ausAllenKarten({ zielApp, alleKarten, anzahl = 5, uhr = systemUhr, zufall = system, ...rest }) {
    const gezogen = ziehen(alleKarten, anzahl, uhr.jetzt(), zufall);
    return new GateSitzung({ zielApp, gezogeneKarten: gezogen, uhr, zufall, ...rest });
  }

  get benoetigteRichtige() {
    return this.#reihenfolge.length;
  }

  /** 'laeuft' | 'bestanden' | 'keineKarten' (nur der Notfall-Skip bleibt) */
  get status() {
    if (this.#reihenfolge.length === 0) return 'keineKarten';
    return this.#warteschlange.length === 0 ? 'bestanden' : 'laeuft';
  }

  get istBestanden() {
    return this.status === 'bestanden';
  }

  get hinweis() {
    return this.status === 'keineKarten' ? KEINE_KARTEN_HINWEIS : null;
  }

  /** Kartenstand nach den bisherigen Antworten (in Ziehungsreihenfolge) – zum Speichern. */
  get aktualisierteKarten() {
    return this.#reihenfolge.map((id) => this.#karten.get(id));
  }

  /** antwortIndex bezieht sich auf die angezeigte (gemischte) Reihenfolge von aktuelleFrage. */
  /** `meta.sekunden` (optional): Antwortzeit, im Lernmodus „intelligent“ ein Signal für die Leichtigkeit. */
  beantworte(antwortIndex, meta = {}) {
    const frage = this.aktuelleFrage;
    if (!frage) throw new GateFehler('keineAktuelleFrage');
    if (!Number.isInteger(antwortIndex) || antwortIndex < 0 || antwortIndex >= frage.antworten.length) {
      throw new GateFehler('ungueltigerAntwortIndex');
    }
    return this.#auswerten(antwortIndex === frage.indexRichtig, { gewaehlterIndex: antwortIndex }, meta);
  }

  /** Antwort auf eine Frage mit Zahleneingabe (aktuelleFrage.eingabe ist gesetzt). */
  beantworteZahl(eingabe, meta = {}) {
    const frage = this.aktuelleFrage;
    if (!frage) throw new GateFehler('keineAktuelleFrage');
    if (!frage.eingabe) throw new GateFehler('keineEingabeFrage');
    if (typeof eingabe !== 'string' && typeof eingabe !== 'number') throw new GateFehler('ungueltigeEingabe');
    const richtig = istRichtigeZahl(String(eingabe), frage.eingabe.wert);
    return this.#auswerten(richtig, { gewaehlterIndex: null, eingabe: String(eingabe).trim() }, meta);
  }

  /** Antwort auf eine Reihenfolge-Karte: Positionen der angezeigten Schritte in der gewählten Folge. */
  beantworteReihenfolge(indizes, meta = {}) {
    const frage = this.aktuelleFrage;
    if (!frage) throw new GateFehler('keineAktuelleFrage');
    if (!frage.reihenfolgeRichtig) throw new GateFehler('keineReihenfolgeFrage');
    let pruefung;
    try {
      pruefung = pruefeReihenfolge(frage, indizes);
    } catch {
      throw new GateFehler('ungueltigeReihenfolge');
    }
    return this.#auswerten(pruefung.richtig, { gewaehlterIndex: null, gewaehlteReihenfolge: pruefung.gewaehlteReihenfolge }, meta);
  }

  #auswerten(richtig, zusatz, meta = {}) {
    const frage = this.aktuelleFrage;
    const kartenId = this.#warteschlange.shift();
    const jetzt = this.#uhr.jetzt();
    const karte = this.#karten.get(kartenId);

    if (richtig) {
      this.richtigeAntworten += 1;
      if (!this.#falsch.has(kartenId)) {
        this.#karten.set(kartenId, this.#intelligent ? intelligentRichtig(karte, jetzt, { sekunden: meta?.sekunden }) : richtigBeantwortet(karte, jetzt));
      }
    } else {
      this.#karten.set(kartenId, this.#intelligent ? intelligentFalsch(karte, jetzt) : falschBeantwortet(karte, jetzt));
      this.#falsch.add(kartenId);
      this.#warteschlange.splice(Math.min(this.#wiederholungsAbstand, this.#warteschlange.length), 0, kartenId);
    }

    this.aktuelleFrage = this.#naechsteFrage();
    return {
      richtig,
      indexRichtig: frage.indexRichtig,
      loesungText: frage.loesungText,
      kartenId,
      ...zusatz,
    };
  }

  #naechsteFrage() {
    const id = this.#warteschlange[0];
    const karte = id === undefined ? undefined : this.#karten.get(id);
    return karte ? frageAusKarte(karte, this.#zufall) : null;
  }
}
