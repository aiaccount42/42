import { standardSettings } from './models.js';
import { systemUhr } from './uhr.js';

export class FreischaltungFehler extends Error {
  /** code: 'gateNichtBestanden' | 'skipBereitsVerbraucht' */
  constructor(code) {
    super(code);
    this.name = 'FreischaltungFehler';
    this.code = code;
  }
}

const gleicherTag = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

/**
 * Freischaltung je Ziel-App und Notfall-Skip (1× pro Kalendertag, in der Ortszeit).
 * Jede App hat ihre eigene Frist (`settings.freischaltungen[appName]`).
 * Verändert das übergebene settings-Objekt direkt – der Aufrufer speichert danach.
 */
export class Freischaltung {
  constructor(settings = standardSettings(), uhr = systemUhr) {
    this.settings = settings;
    this.uhr = uhr;
    this.settings.freischaltungen ??= {};
  }

  /** Ablaufzeitpunkt (ms) der App oder null. */
  bisFuer(app) {
    return this.settings.freischaltungen[app] ?? null;
  }

  /** true, solange jetzt < Ablaufzeitpunkt (genau zum Ablauf ist die App wieder gesperrt). */
  istFreigeschaltet(app) {
    const bis = this.bisFuer(app);
    return bis != null && this.uhr.jetzt() < bis;
  }

  verbleibendeSekunden(app) {
    const bis = this.bisFuer(app);
    return bis == null ? 0 : Math.max(0, (bis - this.uhr.jetzt()) / 1000);
  }

  /** Setzt die Frist der App auf jetzt + Freischaltdauer (verlängert nicht, sondern setzt neu). */
  freischalten(app) {
    const minuten = Math.max(0, this.settings.freischaltdauerMinuten);
    this.settings.freischaltungen[app] = this.uhr.jetzt() + minuten * 60_000;
  }

  /** Schaltet die Ziel-App des Gates frei – nur, wenn das Gate wirklich bestanden ist. */
  gateAbschliessen(sitzung) {
    if (!sitzung.istBestanden) throw new FreischaltungFehler('gateNichtBestanden');
    this.freischalten(sitzung.zielApp.name);
  }

  get notfallSkipVerfuegbar() {
    const letzter = this.settings.notfallSkipLetzterTag;
    return letzter == null || !gleicherTag(letzter, this.uhr.jetzt());
  }

  get notfallSkipStatus() {
    return this.notfallSkipVerfuegbar ? 'heute noch 1 Skip' : 'heute verbraucht';
  }

  /** Verbraucht den Tages-Skip (für alle Apps zusammen) und schaltet diese eine App frei. */
  notfallSkipNutzen(app) {
    if (!this.notfallSkipVerfuegbar) throw new FreischaltungFehler('skipBereitsVerbraucht');
    this.settings.notfallSkipLetzterTag = this.uhr.jetzt();
    this.freischalten(app);
  }
}
