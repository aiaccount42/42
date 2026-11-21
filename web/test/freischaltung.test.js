import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { Freischaltung, FreischaltungFehler } from '../js/core/freischaltung.js';
import { INSTAGRAM, REDDIT, standardSettings } from '../js/core/models.js';
import { GateSitzung } from '../js/core/sitzung.js';
import { festeUhr } from '../js/core/uhr.js';
import { seeded } from '../js/core/zufall.js';
import { datum, faelligeKarten, richtig } from '../testhilfen/helfer.js';

const start = datum(2026, 10, 19, 12, 0);
const MIN = 60_000;
const IG = INSTAGRAM.name;
const RD = REDDIT.name;
let uhr;
beforeEach(() => {
  uhr = festeUhr(start);
});

const freischaltung = (settings = standardSettings()) => new Freischaltung(settings, uhr);
const neueSitzung = (karten, zielApp = INSTAGRAM) =>
  new GateSitzung({ zielApp, gezogeneKarten: karten, uhr, zufall: seeded(1) });
function bestandenesGate(zielApp = INSTAGRAM) {
  const s = neueSitzung(faelligeKarten(5), zielApp);
  while (s.aktuelleFrage) s.beantworte(richtig(s));
  return s;
}

// --- Freischaltung ---

test('Standardwerte', () => {
  const s = standardSettings();
  assert.equal(s.freischaltdauerMinuten, 15);
  assert.equal(s.kartenProGate, 5);
  assert.deepEqual(s.freischaltungen, {});
  assert.equal(s.notfallSkipLetzterTag, null);
  assert.deepEqual(s.zielApps.map((a) => a.urlScheme), ['instagram://', 'reddit://']);
  assert.deepEqual(s.zielApps.map((a) => a.name), [IG, RD]);
});

test('anfangs gesperrt', () => {
  assert.equal(freischaltung().istFreigeschaltet(IG), false);
  assert.equal(freischaltung().verbleibendeSekunden(IG), 0);
  assert.equal(freischaltung().bisFuer(IG), null);
});

test('bestandenes Gate schaltet die App für 15 Minuten frei', () => {
  const f = freischaltung();
  f.gateAbschliessen(bestandenesGate());
  assert.equal(f.bisFuer(IG), start + 15 * MIN);
  assert.equal(f.istFreigeschaltet(IG), true);
  assert.equal(f.verbleibendeSekunden(IG), 900);
});

test('jede App hat ihre eigene Freischaltung', () => {
  const f = freischaltung();
  f.gateAbschliessen(bestandenesGate(INSTAGRAM));
  assert.equal(f.istFreigeschaltet(IG), true);
  assert.equal(f.istFreigeschaltet(RD), false);
  assert.equal(f.bisFuer(RD), null);

  uhr.weiterMinuten(10);
  f.gateAbschliessen(bestandenesGate(REDDIT));
  assert.equal(f.bisFuer(IG), start + 15 * MIN);
  assert.equal(f.bisFuer(RD), start + 25 * MIN);

  uhr.setze(start + 15 * MIN);
  assert.equal(f.istFreigeschaltet(IG), false);
  assert.equal(f.istFreigeschaltet(RD), true);
});

test('Freischaltung läuft nach 15 Minuten ab (genau zum Ablauf wieder gesperrt)', () => {
  const f = freischaltung();
  f.freischalten(IG);

  uhr.weiterMinuten(14.99);
  assert.equal(f.istFreigeschaltet(IG), true);

  uhr.setze(start + 15 * MIN - 1000);
  assert.equal(f.istFreigeschaltet(IG), true);

  uhr.setze(start + 15 * MIN);
  assert.equal(f.istFreigeschaltet(IG), false);
  assert.equal(f.verbleibendeSekunden(IG), 0);

  uhr.weiterSekunden(1);
  assert.equal(f.istFreigeschaltet(IG), false);
});

test('verbleibende Zeit sinkt', () => {
  const f = freischaltung();
  f.freischalten(IG);
  uhr.weiterMinuten(5);
  assert.equal(f.verbleibendeSekunden(IG), 600);
});

test('Freischaltdauer ist konfigurierbar', () => {
  const f = freischaltung(standardSettings({ freischaltdauerMinuten: 30 }));
  f.freischalten(IG);
  uhr.weiterMinuten(29);
  assert.equal(f.istFreigeschaltet(IG), true);
  uhr.weiterMinuten(1);
  assert.equal(f.istFreigeschaltet(IG), false);
});

test('Dauer 0 schaltet nicht frei', () => {
  const f = freischaltung(standardSettings({ freischaltdauerMinuten: 0 }));
  f.freischalten(IG);
  assert.equal(f.istFreigeschaltet(IG), false);
});

test('nicht bestandenes Gate schaltet nicht frei', () => {
  const f = freischaltung();
  assert.throws(
    () => f.gateAbschliessen(neueSitzung(faelligeKarten(5))),
    (e) => e instanceof FreischaltungFehler && e.code === 'gateNichtBestanden',
  );
  assert.equal(f.bisFuer(IG), null);
  assert.equal(f.istFreigeschaltet(IG), false);
});

test('Gate ohne Karten schaltet nicht frei', () => {
  const f = freischaltung();
  assert.throws(() => f.gateAbschliessen(neueSitzung([])), (e) => e.code === 'gateNichtBestanden');
  assert.equal(f.istFreigeschaltet(IG), false);
});

test('erneutes Freischalten setzt die Frist neu', () => {
  const f = freischaltung();
  f.freischalten(IG);
  uhr.weiterMinuten(10);
  f.freischalten(IG);
  assert.equal(f.bisFuer(IG), start + 25 * MIN);
});

test('nach Ablauf muss neu freigeschaltet werden', () => {
  const f = freischaltung();
  f.gateAbschliessen(bestandenesGate());
  uhr.weiterMinuten(20);
  assert.equal(f.istFreigeschaltet(IG), false);
  f.freischalten(IG);
  assert.equal(f.istFreigeschaltet(IG), true);
});

test('Einstellungen ohne Freischaltungs-Feld (alte Daten) werden ergänzt', () => {
  const alt = { freischaltdauerMinuten: 15, kartenProGate: 5, notfallSkipLetzterTag: null, zielApps: [] };
  const f = new Freischaltung(alt, uhr);
  assert.equal(f.istFreigeschaltet(IG), false);
  f.freischalten(IG);
  assert.equal(f.istFreigeschaltet(IG), true);
});

// --- Notfall-Skip ---

test('Skip anfangs verfügbar', () => {
  const f = freischaltung();
  assert.equal(f.notfallSkipVerfuegbar, true);
  assert.equal(f.notfallSkipStatus, 'heute noch 1 Skip');
});

test('Skip schaltet die App frei und verbraucht den Tag', () => {
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  assert.equal(f.istFreigeschaltet(IG), true);
  assert.equal(f.bisFuer(IG), start + 15 * MIN);
  assert.equal(f.settings.notfallSkipLetzterTag, start);
  assert.equal(f.notfallSkipVerfuegbar, false);
  assert.equal(f.notfallSkipStatus, 'heute verbraucht');
});

test('Skip schaltet nur die gewählte App frei, nicht die anderen', () => {
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  assert.equal(f.istFreigeschaltet(RD), false);
});

test('Der Skip zählt für alle Apps zusammen: eine App, dann ist er für alle verbraucht', () => {
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  assert.throws(() => f.notfallSkipNutzen(RD), (e) => e.code === 'skipBereitsVerbraucht');
  assert.equal(f.istFreigeschaltet(RD), false);
});

test('zweiter Skip am selben Tag wirft und ändert nichts', () => {
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  const vorher = structuredClone(f.settings);

  uhr.weiterMinuten(60);
  assert.throws(() => f.notfallSkipNutzen(IG), (e) => e instanceof FreischaltungFehler && e.code === 'skipBereitsVerbraucht');
  assert.deepEqual(f.settings, vorher);
  assert.equal(f.istFreigeschaltet(IG), false);
});

test('Skip am nächsten Tag wieder möglich', () => {
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  uhr.setze(datum(2026, 10, 20, 8, 0));
  assert.equal(f.notfallSkipVerfuegbar, true);
  assert.equal(f.notfallSkipStatus, 'heute noch 1 Skip');
  f.notfallSkipNutzen(RD);
  assert.equal(f.settings.notfallSkipLetzterTag, datum(2026, 10, 20, 8, 0));
});

test('Tageswechsel um Mitternacht zählt als neuer Tag', () => {
  uhr.setze(datum(2026, 10, 19, 23, 59, 59));
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  assert.equal(f.notfallSkipVerfuegbar, false);

  uhr.setze(datum(2026, 10, 20, 0, 0, 0));
  assert.equal(f.notfallSkipVerfuegbar, true);
});

test('Skip kurz vor und kurz nach Mitternacht (nur 4 Minuten Abstand) möglich', () => {
  uhr.setze(datum(2026, 10, 19, 23, 58));
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  uhr.setze(datum(2026, 10, 20, 0, 2));
  f.notfallSkipNutzen(IG);
  assert.equal(f.settings.notfallSkipLetzterTag, datum(2026, 10, 20, 0, 2));
});

test('früh morgens genutzt, spät abends am selben Tag: weiterhin verbraucht', () => {
  uhr.setze(datum(2026, 10, 19, 0, 0, 1));
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  uhr.setze(datum(2026, 10, 19, 23, 59, 59));
  assert.equal(f.notfallSkipVerfuegbar, false);
});

test('nach mehreren Tagen wieder verfügbar', () => {
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  uhr.setze(datum(2026, 11, 30, 12, 0));
  assert.equal(f.notfallSkipVerfuegbar, true);
});

test('gleiche Tageszahl in anderem Monat ist ein anderer Tag', () => {
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  uhr.setze(datum(2026, 11, 19, 12, 0));
  assert.equal(f.notfallSkipVerfuegbar, true);
});

test('bestandenes Gate verbraucht den Skip nicht', () => {
  const f = freischaltung();
  f.gateAbschliessen(bestandenesGate());
  assert.equal(f.notfallSkipVerfuegbar, true);
  assert.equal(f.settings.notfallSkipLetzterTag, null);
});

test('Skip bei 0 Karten erlaubt', () => {
  const f = freischaltung();
  assert.equal(neueSitzung([]).status, 'keineKarten');
  f.notfallSkipNutzen(IG);
  assert.equal(f.istFreigeschaltet(IG), true);
});

test('Skip funktioniert auch, wenn die App schon freigeschaltet ist (Frist wird neu gesetzt)', () => {
  const f = freischaltung();
  f.freischalten(IG);
  uhr.weiterMinuten(5);
  f.notfallSkipNutzen(IG);
  assert.equal(f.bisFuer(IG), start + 20 * MIN);
});

test('Skip-Tag richtet sich nach Ortszeit (Berlin), nicht nach UTC', () => {
  // 21:30 UTC am 19.10. = 23:30 in Berlin (MESZ); 22:30 UTC = 00:30 am 20.10.
  uhr.setze(Date.UTC(2026, 9, 19, 21, 30));
  const f = freischaltung();
  f.notfallSkipNutzen(IG);
  uhr.setze(Date.UTC(2026, 9, 19, 22, 30));
  assert.equal(f.notfallSkipVerfuegbar, true);
});
