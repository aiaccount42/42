// UI von 42: Hash-Router, Ansichten als HTML-Strings, Klicks per Event-Delegation.
// Die gesamte Logik (Leitner, Gate, Freischaltung, Statistik …) steckt in js/core/ und ist getestet.
import { BELIEBTE_APPS } from './core/apps.js';
import { DeckFormatFehler, mergeImport, parseDeck, promptVorlage } from './core/deckformat.js';
import { Freischaltung, FreischaltungFehler } from './core/freischaltung.js';
import { baueGateKarten, kartenAnzahl, nachtruheGesperrt } from './core/gateaufbau.js';
import { deckFortschritt, schwachstellen, zeitplanSchonen } from './core/fortschritt.js';
import { ZEITRAEUME, auffaelligkeiten, kennzahlen, laengsteSerie, proApp, proDeck, proStunde, proWochentag, tageListe } from './core/insights.js';
import { GENERATOREN, generatorFuerId } from './core/generator.js';
import { neuerWunsch, offeneWuensche, stundenBis, wunschAbschliessen, wunschHinzufuegen } from './core/kaufbremse.js';
import { istGemeldet, meldungEntfernen, meldungHinzu, meldungsText } from './core/meldungen.js';
import { LUECKE, istFaellig, istGueltig, neueKarte, neuesDeck } from './core/models.js';
import { ProbeSitzung } from './core/probe.js';
import { freischaltLink } from './core/shortcut.js';
import { GateSitzung } from './core/sitzung.js';
import { faelligkeitsVorschau } from './core/intervall.js';
import { PROZENT_TIPPS, TEILEN_TIPPS } from './core/kopfrechnen.js';
import { istProblemkarte, schwierigkeit, trefferquote } from './core/schwierigkeit.js';
import { erfasseAntwort, erfasseFreischaltung, erfasseNichtGeoeffnet, freischaltungenHeute, nichtGeoeffnetHeute, richtigHeute, serie, uebersicht, wochenUebersicht } from './core/statistik.js';
import { systemUhr } from './core/uhr.js';
import { lernenAnsicht } from './lernen.js';
import { datenschutzAnsicht, impressumAnsicht } from './rechtliches.js';
import { exportJson, importJson, laden, speichern } from './storage.js';

const uhr = systemUhr;
const app = document.getElementById('app');
const TAG_MS = 86_400_000;
const BREMSE_PAUSE_MS = 5000;

// --- Speicher (localStorage; falls gesperrt, nur im Arbeitsspeicher) ---

function holeSpeicher() {
  try {
    const test = '__lerngate_test__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return { speicher: window.localStorage, dauerhaft: true };
  } catch {
    const karte = new Map();
    return {
      speicher: { getItem: (k) => karte.get(k) ?? null, setItem: (k, v) => karte.set(k, String(v)) },
      dauerhaft: false,
    };
  }
}

const { speicher, dauerhaft } = holeSpeicher();
let daten = laden(speicher);
// Laufendes Quiz: { modus: 'app'|'ueben'|'probe', filter (nur Üben: null oder { deckId }), appName, sitzung, letzte, abgeschlossen, ueberSkip, phase, blockiert, bremseStart }
let quiz = null;
let ticker = false; // true, wenn die aktuelle Ansicht eine Uhrzeit/Restzeit zeigt
let entwurf = null; // ungespeicherter Stand der Einstellungen (beim Hinzufügen/Entfernen von Ziel-Apps)
let flash = null; // einmalige Meldung oben auf der nächsten Ansicht
let bibliothek = { status: 'idle', eintraege: [], meldung: null };
const leererImport = () => ({ text: '', vorschau: null, fehler: null });
let importZustand = leererImport();

function sichern() {
  try {
    speichern(speicher, daten);
  } catch {
    alert('Speichern hat nicht geklappt (Speicher voll oder gesperrt). Bitte exportiere ein Backup unter Einstellungen.');
  }
}

const freischaltung = () => new Freischaltung(daten.settings, uhr);
const zielAppNamens = (name) => daten.settings.zielApps.find((a) => a.name === name);

// --- Hilfsfunktionen ---

const esc = (text) =>
  String(text ?? '').replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[z]);

/** Nur echte App-URL-Schemes zulassen (z. B. instagram://), nie javascript: oder data:. */
function sichereUrl(url) {
  const u = String(url ?? '').trim();
  return /^[a-z][a-z0-9+.-]*:\/\/\S*$/i.test(u) && !/^(javascript|data|vbscript|file):/i.test(u) ? u : '#/';
}

const uhrzeit = (ms) => new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const restText = (sekunden) => `noch ${Math.max(1, Math.ceil(sekunden / 60))} Min.`;
const kuerzen = (text, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const prozent = (anteil) => (anteil === null ? '–' : `${Math.round(anteil * 100)} %`);
const zahl = (wert, min, max, standard) => {
  const n = Math.trunc(Number(wert));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : standard;
};

function kartenSpeichern(neueKarten) {
  const nachId = new Map(neueKarten.map((k) => [k.id, k]));
  daten.cards = daten.cards.map((k) => nachId.get(k.id) ?? k); // Zufallsaufgaben sind nicht gespeichert und fallen hier weg
  sichern();
}

/** Zählt die Antwort für die Statistik (Deck wird über die Karte der Sitzung gefunden). */
function zaehleAntwort(ergebnis) {
  const karte = quiz.sitzung.aktualisierteKarten.find((k) => k.id === ergebnis.kartenId);
  erfasseAntwort(daten.tage, { zeit: uhr.jetzt(), deckId: karte?.deckId ?? 'unbekannt', richtig: ergebnis.richtig });
}

/** Alle wählbaren Quellen für "Decks pro App": eigene Decks und Zufallsaufgaben. */
const deckAuswahl = () => [
  ...daten.decks.map((d) => ({ id: d.id, name: d.name })),
  ...GENERATOREN.map((g) => ({ id: g.id, name: g.name })),
];
const deckName = (id) => daten.decks.find((d) => d.id === id)?.name ?? generatorFuerId(id)?.name ?? 'Gelöschtes Deck';

// --- Lernstand (Fortschritt pro Deck) ---

/** Schmaler Doppelbalken: hell = schon gesehen, kräftig = sicher. */
const fortschrittsBalken = (f, gross = false) =>
  `<span class="mini${gross ? ' gross' : ''}" aria-hidden="true"><i class="gesehen" style="width:${Math.round(f.anteilGesehen * 100)}%"></i><i class="sicher" style="width:${Math.round(f.anteilSicher * 100)}%"></i></span>`;

/** Kurzer Stand für die Deck-Liste: "neu", "✓ gemeistert" oder "55 % sicher". */
const deckStandText = (f) => (f.gesamt === 0 ? '' : f.gemeistert ? '✓ gemeistert' : f.anteilGesehen === 0 ? 'neu' : `${prozent(f.anteilSicher)} sicher`);

// --- Ansichten: Start ---

/** Neu = noch nie Karten und keine Statistik; wer schon Daten hat, bekommt die Begrüßung nicht aufgedrängt. */
const istNeuerNutzer = () =>
  !daten.settings.willkommenGesehen && daten.cards.length === 0 && Object.keys(daten.tage).length === 0;

function willkommenAnsicht() {
  const min = daten.settings.freischaltdauerMinuten;
  return `
    <section class="hero">
      <h1>Mach aus Scrollzeit Lernzeit.</h1>
      <p>Bevor Instagram, Reddit &amp; Co. aufgehen, beantwortest du ein paar Alltagsfragen. Das dauert eine Minute und bleibt im Kopf.</p>
      <div class="chips-zeile"><span>🧠 Fit im Kopf</span><span>⏱️ Weniger Doomscrolling</span><span>😌 Zufriedener mit deiner Zeit</span></div>
    </section>
    <button type="button" data-aktion="willkommenWeiter" data-ziel="#/bibliothek">Los geht’s: Decks aussuchen</button>

    <h2>Warum das was bringt</h2>
    <div class="vorteile">
      <div class="vorteil"><span class="emoji">🧠</span><div><strong class="lead">Dein Gehirn lernt ein Leben lang.</strong> Es baut sich durch Üben um, auch im Alter.</div></div>
      <div class="vorteil"><span class="emoji">📈</span><div><strong class="lead">Abfragen schlägt Nachlesen.</strong> Wer Wissen aktiv abruft, behält es länger.</div></div>
      <div class="vorteil"><span class="emoji">🔁</span><div><strong class="lead">Wiederholen, kurz bevor du vergisst.</strong> 42 plant die Abstände für dich.</div></div>
      <div class="vorteil"><span class="emoji">🛡️</span><div><strong class="lead">Wissen, das dir im Alltag weiterhilft.</strong> Ernährung, Gesundheit, Geld, Psychologie: Nützliches, das in der Schule oft zu kurz kommt.</div></div>
    </div>
    <p class="klein">Ehrlich gesagt: 42 ist kein Wundermittel. <a href="#/lernen">Das sagt die Forschung, mit Quellen.</a></p>

    <h2>So läuft es</h2>
    <ol class="schritte">
      <li><strong class="lead">Du tippst auf eine Ziel-App.</strong> Zuerst öffnet sich 42.</li>
      <li><strong class="lead">Du beantwortest ein paar Fragen.</strong> Zum Beispiel: Was macht Schlaf mit deinem Gedächtnis? Wie wirkt Zinseszins? Warum ist Eiweiß wichtig?</li>
      <li><strong class="lead">Alles richtig?</strong> Dann ist die App ${min} Minuten frei.</li>
    </ol>

    <h2>Was drin ist</h2>
    <p>60 Decks mit über 2.500 Karten und endlos Kopfrechenaufgaben:</p>
    <div class="chips-zeile hell"><span>🥗 Ernährung</span><span>🏃 Sport</span><span>🧠 Psychologie</span><span>💶 Finanzen</span><span>❤️ Gesundheit</span><span>💻 Technik</span><span>🌍 Natur &amp; Welt</span><span>💡 Allgemeinwissen</span></div>

    <p class="klein">Alles bleibt auf deinem Gerät: kein Konto, keine Werbung, kein Tracking. 42 läuft im Browser, auf dem Handy wie am Computer.</p>

    <button type="button" data-aktion="willkommenWeiter" data-ziel="#/bibliothek">Los geht’s: Decks aussuchen</button>
    <button type="button" class="sekundaer" data-aktion="willkommenWeiter" data-ziel="#/">Erst mal umschauen</button>`;
}

function startAnsicht() {
  if (istNeuerNutzer()) return willkommenAnsicht();
  const f = freischaltung();
  const jetzt = uhr.jetzt();
  const s = daten.settings;
  const gueltig = daten.cards.filter(istGueltig);
  const faellig = gueltig.filter((k) => istFaellig(k, jetzt)).length;
  const proBox = [1, 2, 3, 4, 5].map((b) => daten.cards.filter((k) => k.box === b).length);
  const gesamtStand = deckFortschritt(daten.cards);
  const schwachGesamt = deckFortschritt(daten.cards.filter((k) => !pausierteDeckIds().includes(k.deckId))).schwach;
  const max = Math.max(1, ...proBox);
  const heuteGesamt = freischaltungenHeute(daten.tage, jetzt);
  const richtig = richtigHeute(daten.tage, jetzt);
  const serieTage = serie(daten.tage, jetzt);
  const nichtGeoeffnet = nichtGeoeffnetHeute(daten.tage, jetzt);

  const zielApps = s.zielApps
    .filter((a) => a.name)
    .map((a) => {
      const frei = f.istFreigeschaltet(a.name);
      if (frei) ticker = true;
      const infos = [];
      if (frei) infos.push(`frei bis ${uhrzeit(f.bisFuer(a.name))} Uhr (${restText(f.verbleibendeSekunden(a.name))})`);
      else if (nachtruheGesperrt(jetzt, s.nachtruhe)) infos.push('Nachtruhe: kein Quiz');
      if (a.tageslimit > 0) infos.push(`heute ${freischaltungenHeute(daten.tage, jetzt, a.name)} von ${a.tageslimit}`);
      if (a.bremse === 'kauf') infos.push('Kaufbremse');
      if (a.bremse === 'absicht') infos.push('Absicht');
      const zusatz = infos.length ? `<span class="knopf-status">${esc(infos.join(' · '))}</span>` : '';
      return `<a class="knopf${frei ? ' frei' : ''}" href="#/quiz/${encodeURIComponent(a.name)}">${esc(a.name)} öffnen${zusatz}</a>`;
    })
    .join('');

  const decks = daten.decks
    .map((d) => {
      const f = deckFortschritt(daten.cards.filter((k) => k.deckId === d.id));
      const stand = deckStandText(f);
      return `<a class="zeile deck-zeile${d.pausiert ? ' pausiert' : ''}" href="#/deck/${esc(d.id)}"><span class="deck-name">${esc(d.name)}${f.gesamt ? fortschrittsBalken(f) : ''}</span><span class="klein deck-info">${d.pausiert ? 'pausiert · ' : ''}${f.gesamt} Karten${stand ? `<br /><strong class="${f.gemeistert ? 'gemeistert' : ''}">${stand}</strong>` : ''}</span></a>`;
    })
    .join('');
  const generatoren = GENERATOREN.map((g) => {
    const pausiert = (s.pausierteGeneratoren ?? []).includes(g.id);
    return `<div class="zeile${pausiert ? ' pausiert' : ''}"><span>${esc(g.name)}<br /><span class="klein">${pausiert ? 'pausiert' : 'unendlich viele, mit Kopfrechen-Weg'}</span></span><button type="button" class="sekundaer zeilen-knopf" data-aktion="generatorPause" data-id="${esc(g.id)}">${pausiert ? 'Wieder an' : 'Pausieren'}</button></div>`;
  }).join('');

  const tageSeitBackup = s.letztesBackup == null ? null : Math.floor((jetzt - s.letztesBackup) / TAG_MS);
  const backupHinweis =
    daten.cards.length > 0 && (tageSeitBackup === null || tageSeitBackup > 21)
      ? `<p class="hinweis">${tageSeitBackup === null ? 'Du hast noch kein Backup gemacht.' : `Dein letztes Backup ist ${tageSeitBackup} Tage alt.`} <a href="#/einstellungen">Jetzt sichern</a></p>`
      : '';

  const offeneWunsch = offeneWuensche(daten.wuensche, jetzt);
  const wunschAnzahl = offeneWunsch.wartend.length + offeneWunsch.reif.length;
  const zeigeWunschliste = wunschAnzahl > 0 || s.zielApps.some((a) => a.bremse === 'kauf');

  return `
    <p class="slogan">Erst denken, dann scrollen.</p>
    ${dauerhaft ? '' : '<p class="hinweis">Der Browser erlaubt kein dauerhaftes Speichern (privater Modus?). Deine Daten gehen beim Schließen verloren.</p>'}
    ${backupHinweis}
    <div class="karte">
      <strong>Serie: ${serieTage} ${serieTage === 1 ? 'Tag' : 'Tage'}</strong>
      <span class="klein"> · heute ${richtig} von ${s.tagesziel} richtig</span>
      <div class="fortschritt"><div style="width:${Math.min(100, (richtig / s.tagesziel) * 100)}%"></div></div>
      ${nichtGeoeffnet ? `<p class="klein">✋ Heute ${nichtGeoeffnet}× doch nicht geöffnet.</p>` : ''}
      <a href="#/woche">Deine Woche</a> · <a href="#/statistik">Statistik &amp; Insights</a>
    </div>
    <p class="klein">Jede App hat ihre eigene Freischaltung (${s.freischaltdauerMinuten} Minuten nach dem Quiz). Nächstes Quiz: ${kartenAnzahl(s, jetzt, heuteGesamt)} Karten.</p>
    ${zielApps || '<p class="klein">Keine Ziel-Apps – lege welche unter Einstellungen an.</p>'}
    <a class="knopf sekundaer" href="#/ueben">Freies Üben (ohne Sperre)</a>
    ${schwachGesamt > 0 ? `<a class="knopf sekundaer" href="#/ueben/schwach">Schwachstellen üben (${schwachGesamt})</a>` : ''}
    ${daten.meldungen.length ? `<a class="knopf sekundaer" href="#/meldungen">Gemeldete Karten (${daten.meldungen.length})</a>` : ''}
    ${zeigeWunschliste ? `<a class="knopf sekundaer" href="#/wuensche">Wunschliste${wunschAnzahl ? ` (${wunschAnzahl})` : ''}</a>` : ''}

    <h2>Karten pro Box</h2>
    <div class="karte">
      <p class="klein">${gueltig.length} Karten, davon ${faellig} heute fällig${gesamtStand.gesamt ? ` · ${prozent(gesamtStand.anteilSicher)} sicher${gesamtStand.fehlerquote === null ? '' : ` · Fehlerquote ${prozent(gesamtStand.fehlerquote)}`}` : ''}</p>
      ${proBox
        .map(
          (n, i) =>
            `<div class="balken"><span>Box ${i + 1}</span><span class="spur"><span class="fuell" style="display:block;width:${(n / max) * 100}%"></span></span><span>${n}</span></div>`,
        )
        .join('')}
    </div>

    <h2>Decks</h2>
    ${decks || '<p class="klein">Noch keine Decks – hol dir welche aus der Bibliothek oder lege unten ein eigenes an.</p>'}
    ${generatoren}
    <a class="knopf sekundaer" href="#/kopfrechnen">Kopfrechnen: die wichtigsten Wege</a>
    <a class="knopf sekundaer" href="#/bibliothek">Bibliothek (fertige Decks)</a>
    <a class="knopf sekundaer" href="#/import">Deck importieren (Text einfügen)</a>
    <form class="inline-form" data-form="neuesDeck">
      <input type="text" name="name" placeholder="Name des neuen Decks" maxlength="80" required />
      <button type="submit">Anlegen</button>
    </form>`;
}

// --- Ansichten: Decks und Karten ---

const pausierteDeckIds = () => daten.decks.filter((d) => d.pausiert).map((d) => d.id);

const TYP_KURZ = { wahrfalsch: 'Wahr/Falsch', luecke: 'Lücke', reihenfolge: 'Reihenfolge' };

/** " · 67 % · knifflig" – nur wenn es schon genug Versuche gibt. */
function kartenStatus(karte) {
  const q = trefferquote(karte);
  if (q === null) return '';
  const art = istProblemkarte(karte) ? ' · Problemkarte' : { schwer: ' · knifflig', leicht: ' · leicht', normal: '' }[schwierigkeit(karte)];
  return ` · ${prozent(q)}${art}`;
}

/** Karte "Dein Stand" oben in der Deck-Ansicht: Fortschritt, Fehlerquote, Weg zu den Schwachstellen. */
function standKarte(f, deckId) {
  const teile = [`${f.sicher} sicher`, `${f.lernend} im Lernen`, `${f.neu} neu`];
  return `
    <div class="karte stand-karte">
      <div class="stand-kopf"><strong>${f.gemeistert ? '✓ Gemeistert' : `${prozent(f.anteilSicher)} sicher`}</strong><span class="klein">${prozent(f.anteilGesehen)} schon gesehen</span></div>
      ${fortschrittsBalken(f, true)}
      <p class="klein">${teile.join(' · ')}${f.fehlerquote === null ? '' : ` · Fehlerquote ${prozent(f.fehlerquote)} (bei ${f.antworten} Antworten)`}</p>
      ${f.gemeistert ? '<p class="gemeistert-text">🎉 Du kennst alle Karten. Sie kommen nur noch selten zur Wiederholung. Willst du gar keine Fragen mehr daraus, pausiere das Deck weiter unten.</p>' : ''}
      ${f.schwach > 0 ? `<a class="knopf" href="#/ueben/schwach/${esc(deckId)}">Schwachstellen üben (${f.schwach})</a>` : ''}
      <p class="klein">Sicher heißt: mehrfach richtig, die nächste Wiederholung ist erst in über einer Woche fällig.</p>
    </div>`;
}

function deckAnsicht(deckId) {
  const deck = daten.decks.find((d) => d.id === deckId);
  if (!deck) return nichtGefunden('Dieses Deck gibt es nicht (mehr).');
  const karten = daten.cards.filter((k) => k.deckId === deckId);
  const f = deckFortschritt(karten);

  return `
    <h1>${esc(deck.name)}</h1>
    ${f.gesamt ? standKarte(f, deck.id) : ''}
    <form class="inline-form" data-form="deckUmbenennen" data-id="${esc(deck.id)}">
      <input type="text" name="name" value="${esc(deck.name)}" maxlength="80" required />
      <button type="submit" class="sekundaer">Umbenennen</button>
    </form>

    <div class="karte pause-karte">
      <strong>${deck.pausiert ? 'Dieses Deck ist pausiert' : 'Deck wird im Quiz verwendet'}</strong>
      <p class="klein">${deck.pausiert ? 'Es kommt in keinem Quiz und nicht im freien Üben vor. Dein Lernstand bleibt erhalten.' : 'Pausieren heißt: keine Fragen aus diesem Deck mehr, ohne dass dein Lernstand verloren geht.'}</p>
      <button type="button" class="${deck.pausiert ? '' : 'sekundaer'}" data-aktion="deckPause" data-id="${esc(deck.id)}">${deck.pausiert ? 'Deck wieder verwenden' : 'Deck pausieren'}</button>
    </div>

    <h2>Karten (${karten.length})</h2>
    ${
      karten
        .map(
          (k) =>
            `<a class="zeile" href="#/karte/${esc(k.id)}"><span>${esc(kuerzen(k.frage))}</span><span class="klein">${TYP_KURZ[k.typ] ? `${TYP_KURZ[k.typ]} · ` : ''}Box ${k.box}${kartenStatus(k)}${istGueltig(k) ? '' : ' · unvollständig'}</span></a>`,
        )
        .join('') || '<p class="klein">Noch keine Karten in diesem Deck.</p>'
    }
    ${karten.some(istGueltig) ? `<button type="button" data-aktion="probeStart" data-deck="${esc(deck.id)}">Alle ${karten.filter(istGueltig).length} Karten üben (ohne Sperre)</button>` : ''}
    <a class="knopf sekundaer" href="#/karte/neu/${esc(deck.id)}">+ Neue Karte</a>
    <a class="knopf sekundaer" href="#/">Zurück</a>
    <button type="button" class="gefahr" data-aktion="deckLoeschen" data-id="${esc(deck.id)}">Deck löschen</button>`;
}

function karteAnsicht(kartenId, deckIdNeu) {
  const bestehend = deckIdNeu ? null : daten.cards.find((k) => k.id === kartenId);
  const deckId = deckIdNeu ?? bestehend?.deckId;
  if (!deckId || !daten.decks.some((d) => d.id === deckId)) return nichtGefunden('Diese Karte gibt es nicht (mehr).');

  if (bestehend && (bestehend.typ ?? 'auswahl') !== 'auswahl' && bestehend.typ !== 'luecke') {
    const wf = bestehend.typ === 'wahrfalsch';
    return `
      <h1>Karte (${TYP_KURZ[bestehend.typ]})</h1>
      <p class="frage">${esc(bestehend.frage)}</p>
      ${wf ? `<p>Richtig: <strong>${esc(bestehend.antworten[bestehend.indexRichtig])}</strong></p>` : `<ol class="schritte">${bestehend.antworten.map((a) => `<li>${esc(a)}</li>`).join('')}</ol>`}
      ${bestehend.erklaerung ? `<p class="erklaerung">${esc(bestehend.erklaerung)}</p>` : ''}
      <p class="klein">Box ${bestehend.box}${kartenStatus(bestehend)}. Diesen Kartentyp änderst du über den Deck-Import (erneut einspielen), hier kannst du ihn nur löschen.</p>
      <a class="knopf sekundaer" href="#/deck/${esc(deckId)}">Zurück</a>
      <button type="button" class="gefahr" data-aktion="karteLoeschen" data-id="${esc(bestehend.id)}">Karte löschen</button>`;
  }

  const antworten = bestehend?.antworten ?? ['', '', '', ''];
  const richtig = bestehend?.indexRichtig ?? 0;

  return `
    <h1>${bestehend ? 'Karte bearbeiten' : 'Neue Karte'}</h1>
    <form data-form="karteSpeichern" data-id="${esc(bestehend?.id ?? '')}" data-deck="${esc(deckId)}">
      <label for="frage">Frage</label>
      <textarea id="frage" name="frage" rows="3" required>${esc(bestehend?.frage ?? '')}</textarea>

      <fieldset>
        <legend>4 Antworten – die richtige links markieren</legend>
        ${[0, 1, 2, 3]
          .map(
            (i) =>
              `<div class="antwort-zeile"><input type="radio" name="richtig" value="${i}" ${i === richtig ? 'checked' : ''} aria-label="Antwort ${i + 1} ist richtig" /><input type="text" name="a${i}" value="${esc(antworten[i])}" placeholder="Antwort ${i + 1}" /></div>`,
          )
          .join('')}
      </fieldset>

      <label for="erklaerung">Erklärung (optional, erscheint nach der Antwort)</label>
      <textarea id="erklaerung" name="erklaerung" rows="2">${esc(bestehend?.erklaerung ?? '')}</textarea>

      <label for="quelle">Quelle (optional)</label>
      <input type="text" id="quelle" name="quelle" value="${esc(bestehend?.quelle ?? '')}" />

      <p class="fehler" id="fehler"></p>
      <button type="submit">Speichern</button>
      <a class="knopf sekundaer" href="#/deck/${esc(deckId)}">Abbrechen</a>
      ${bestehend ? `<button type="button" class="gefahr" data-aktion="karteLoeschen" data-id="${esc(bestehend.id)}">Karte löschen</button>` : ''}
    </form>`;
}

// --- Ansichten: Quiz ---

const TYP_HINWEIS = {
  wahrfalsch: 'Wahr oder falsch?',
  luecke: 'Lückentext: Welche Antwort passt in die Lücke?',
  reihenfolge: 'Reihenfolge: Tippe die Schritte der Reihe nach an (1, 2, 3 …).',
};

/** Frage mit Antwortknöpfen, Zahleneingabe oder Reihenfolge-Auswahl, Feedback und Fortschritt. */
function fragenBlock(sitzung, antwort, extra = '') {
  const frage = antwort ? antwort.frage : sitzung.aktuelleFrage;
  const ergebnis = antwort?.ergebnis;
  let eingabe;
  if (frage.eingabe) {
    eingabe = antwort
      ? `<p class="klein">Deine Antwort: <strong>${esc(ergebnis.eingabe || '–')}</strong></p>`
      : `<form data-form="zahlAntwort" class="inline-form">
           <input type="text" name="zahl" inputmode="decimal" autocomplete="off" autocapitalize="off" autocorrect="off" placeholder="Deine Antwort${frage.eingabe.einheit ? ` in ${esc(frage.eingabe.einheit)}` : ''}" required />
           <button type="submit">Prüfen</button>
         </form>
         <p class="klein">Tippe die Zahl ein (Komma oder Punkt, die Einheit kannst du weglassen).</p>`;
  } else if (frage.reihenfolgeRichtig) {
    if (antwort) {
      eingabe = ergebnis.gewaehlteReihenfolge
        .map((text, j) => {
          const richtigText = frage.antworten[frage.reihenfolgeRichtig[j]];
          return `<div class="antwort schritt ${text === richtigText ? 'richtig' : 'falsch'}"><span class="nr">${j + 1}</span>${esc(text)}</div>`;
        })
        .join('');
    } else {
      const wahl = quiz?.wahl ?? [];
      eingabe =
        frage.antworten
          .map((text, i) => {
            const pos = wahl.indexOf(i);
            return pos >= 0
              ? `<button type="button" class="antwort gewaehlt" disabled><span class="nr">${pos + 1}</span>${esc(text)}</button>`
              : `<button type="button" class="antwort" data-aktion="reihenfolgeWahl" data-index="${i}">${esc(text)}</button>`;
          })
          .join('') + (wahl.length ? '<button type="button" class="sekundaer" data-aktion="reihenfolgeZurueck">Letzten Schritt zurücknehmen</button>' : '');
    }
  } else {
    eingabe = frage.antworten
      .map((text, i) => {
        if (!antwort) return `<button type="button" class="antwort" data-aktion="antwort" data-index="${i}">${esc(text)}</button>`;
        // Nach der Antwort nur noch die richtige und die gewählte Antwort zeigen: Die Erklärung rückt nach oben und passt ohne Scrollen auf kleine Displays.
        if (i !== ergebnis.indexRichtig && i !== ergebnis.gewaehlterIndex) return '';
        const klasse = i === ergebnis.indexRichtig ? ' richtig' : i === ergebnis.gewaehlterIndex ? ' falsch' : '';
        return `<button type="button" class="antwort${klasse}" tabindex="-1">${esc(text)}</button>`;
      })
      .join('');
  }

  const loesung =
    antwort && (frage.eingabe || frage.reihenfolgeRichtig) && !ergebnis.richtig
      ? `<p class="klein">${frage.reihenfolgeRichtig ? 'Richtige Reihenfolge' : 'Richtig wäre'}: <strong>${esc(ergebnis.loesungText)}</strong></p>`
      : '';
  const nochmal = sitzung.wiederholt === false ? '' : ' Die Karte kommt später noch einmal.';
  const feedback = antwort
    ? `<p class="status kompakt ${ergebnis.richtig ? 'frei' : 'falsch'}">${
        ergebnis.richtig
          ? 'Richtig!'
          : frage.eingabe
            ? `Leider falsch.${nochmal ? ' Die Aufgabe kommt später noch einmal.' : ''}`
            : frage.reihenfolgeRichtig
              ? `Leider falsch – die richtige Reihenfolge steht darunter.${nochmal}`
              : `Leider falsch – die richtige Antwort ist grün markiert.${nochmal}`
      }</p>
      ${loesung}
      ${!ergebnis.richtig && frage.problemkarte ? '<p class="klein knifflig">Diese Karte bereitet dir oft Probleme. Lies die Erklärung in Ruhe, oder melde die Frage, wenn sie dir unklar vorkommt.</p>' : ''}
      ${antwort.frage.erklaerung ? `<p class="erklaerung">${esc(antwort.frage.erklaerung)}</p>` : ''}
      ${extra}
      <div class="weiter-leiste"><button type="button" data-aktion="weiter">${sitzung.istBestanden ? (sitzung.wiederholt === false ? 'Ergebnis ansehen' : 'Fertig') : 'Weiter'}</button></div>`
    : '';

  const knifflig =
    !antwort && frage.schwierigkeit === 'schwer' ? `<p class="klein knifflig">Knifflig: Bisher nur ${prozent(frage.trefferquote)} richtig. Nimm dir einen Moment.</p>` : '';
  const frageText = esc(frage.frage).replaceAll(LUECKE, '<span class="luecke"></span>');

  return `
    <div class="klein">${sitzung.fortschrittText ?? `${sitzung.richtigeAntworten} von ${sitzung.benoetigteRichtige} richtig`}</div>
    <div class="fortschritt"><div style="width:${(sitzung.fortschritt ?? sitzung.richtigeAntworten / sitzung.benoetigteRichtige) * 100}%"></div></div>
    ${TYP_HINWEIS[frage.typ] ? `<p class="typ-hinweis">${TYP_HINWEIS[frage.typ]}</p>` : ''}
    <p class="frage">${frageText}</p>
    ${knifflig}
    ${!antwort && frage.tipp ? `<details class="tipp"><summary>Tipp: So rechnest du im Kopf</summary><p>${esc(frage.tipp)}</p></details>` : ''}
    ${eingabe}
    ${feedback}`;
}

/** Karte der laufenden Sitzung samt Deckname (für „Melden“). Zufallsaufgaben haben kein Deck und können nicht gemeldet werden. */
function meldeInfo(kartenId) {
  if (!quiz?.sitzung) return null;
  const karten = quiz.modus === 'probe' ? quiz.karten : quiz.sitzung.aktualisierteKarten;
  const karte = karten.find((k) => k.id === kartenId);
  const deck = quiz.modus === 'probe' ? quiz.titel : daten.decks.find((d) => d.id === karte?.deckId)?.name;
  if (!karte || !deck) return null;
  const antwort = karte.typ === 'reihenfolge' ? karte.antworten.join(' → ') : karte.antworten[karte.indexRichtig];
  return { deck, frage: karte.frage, antwort };
}

function meldenKnopf(letzte) {
  const info = letzte && meldeInfo(letzte.ergebnis.kartenId);
  if (!info) return '';
  const gemeldet = istGemeldet(daten.meldungen, info.deck, info.frage);
  return `<button type="button" class="sekundaer melden" data-aktion="melden" data-id="${esc(letzte.ergebnis.kartenId)}">${gemeldet ? 'Gemeldet ✓ (zurücknehmen)' : 'Frage unklar oder falsch? Melden'}</button>`;
}

function quizAnsicht(appName) {
  const ziel = zielAppNamens(appName);
  if (!ziel) return nichtGefunden(`Die Ziel-App „${esc(appName)}“ gibt es nicht. Prüfe die Einstellungen.`);
  if (!quiz || quiz.modus !== 'app' || quiz.appName !== appName) return nichtGefunden('Quiz nicht bereit.');

  const f = freischaltung();
  const skip = `
    <div class="skip">
      <button type="button" class="sekundaer" data-aktion="skip" ${f.notfallSkipVerfuegbar ? '' : 'disabled'}>Notfall-Skip</button>
      <div class="klein">${f.notfallSkipStatus}</div>
    </div>`;

  if (quiz.abgeschlossen) return freiAnsicht(ziel, quiz.ueberSkip ? 'Notfall-Skip genutzt' : 'Bestanden!');

  if (quiz.blockiert === 'limit') {
    const n = freischaltungenHeute(daten.tage, uhr.jetzt(), appName);
    return `
      <h1>${esc(ziel.name)}</h1>
      <p class="hinweis"><strong>Tageslimit erreicht:</strong> ${n} von ${ziel.tageslimit} Freischaltungen für ${esc(ziel.name)} heute. Morgen geht es weiter.</p>
      <a class="knopf" href="#/">Zurück zu 42</a>
      ${skip}`;
  }
  if (quiz.blockiert === 'nacht') {
    const nr = daten.settings.nachtruhe;
    return `
      <h1>${esc(ziel.name)}</h1>
      <p class="hinweis"><strong>Nachtruhe (${esc(nr.von)}–${esc(nr.bis)}):</strong> In dieser Zeit gibt es kein Quiz und keine Freischaltung.</p>
      <a class="knopf" href="#/">Zurück zu 42</a>
      ${skip}`;
  }

  if (!quiz.sitzung) return freiAnsicht(ziel, 'Schon freigeschaltet');
  if (quiz.phase === 'bremse') return bremseAnsicht(ziel);

  const s = quiz.sitzung;
  if (s.status === 'keineKarten') {
    return `
      <h1>${esc(ziel.name)}</h1>
      <p class="hinweis"><strong>${esc(s.hinweis)}</strong> – lege zuerst Decks und Karten an oder erlaube der App Zufallsaufgaben.</p>
      <a class="knopf" href="#/">Zu den Decks</a>
      ${skip}`;
  }
  const nein = '<div class="nein"><button type="button" class="sekundaer" data-aktion="nichtOeffnen">Doch nicht öffnen</button></div>';
  return `<h1>${esc(ziel.name)}</h1>${fragenBlock(s, quiz.letzte, meldenKnopf(quiz.letzte))}${nein}${skip}`;
}

function bremseAnsicht(ziel) {
  const rest = Math.max(0, BREMSE_PAUSE_MS - (Date.now() - quiz.bremseStart));

  if (ziel.bremse === 'kauf') {
    const jetzt = uhr.jetzt();
    return `
      <h1>Kaufbremse</h1>
      <p>Brauchst du es wirklich? Neue Wünsche warten ${daten.settings.kaufbremseStunden} Stunden, bevor du sie kaufst.</p>
      ${wunschListeHtml(jetzt)}
      <form data-form="bremse">
        <label for="wunsch">Was willst du kaufen? (leer lassen, wenn du nur stöberst)</label>
        <input type="text" id="wunsch" name="text" maxlength="200" autocomplete="off" />
        <button type="submit">Weiter zu ${esc(ziel.name)}</button>
      </form>`;
  }

  return `
    <h1>Kurz innehalten</h1>
    <p>Wofür öffnest du ${esc(ziel.name)} gerade?</p>
    <form data-form="bremse">
      <textarea name="text" rows="2" placeholder="Zum Beispiel: kurz Nachrichten ansehen"></textarea>
      <button type="submit" id="bremse-weiter" ${rest > 0 ? 'disabled' : ''}>${rest > 0 ? 'Einen Moment …' : `Weiter zu ${esc(ziel.name)}`}</button>
    </form>`;
}

function freiAnsicht(ziel, ueberschrift) {
  const f = freischaltung();
  if (!f.istFreigeschaltet(ziel.name)) {
    return `
      <h1>${esc(ziel.name)}</h1>
      <div class="status gesperrt">Die Freischaltung ist abgelaufen.</div>
      <button type="button" data-aktion="quizNeu" data-app="${esc(ziel.name)}">Neues Quiz starten</button>
      <a class="knopf sekundaer" href="#/">Zurück zu 42</a>`;
  }
  ticker = true;
  return `
    <h1>${esc(ueberschrift)}</h1>
    <div class="status frei">${esc(ziel.name)} ist freigeschaltet bis ${uhrzeit(f.bisFuer(ziel.name))} Uhr (${restText(f.verbleibendeSekunden(ziel.name))})</div>
    <a class="knopf gross" href="${esc(sichereUrl(freischaltLink({ kurzbefehl: daten.settings.freischaltKurzbefehl, zielApp: ziel, bis: f.bisFuer(ziel.name) })))}">${esc(ziel.name)} öffnen</a>
    ${ueberschrift === 'Bestanden!' ? '<button type="button" class="sekundaer" data-aktion="nichtOeffnen">Doch nicht öffnen</button>' : ''}
    <a class="knopf sekundaer" href="#/">Zurück zu 42</a>`;
}

function uebenAnsicht() {
  if (!quiz || quiz.modus !== 'ueben') return nichtGefunden('Üben nicht bereit.');
  const s = quiz.sitzung;
  const filter = quiz.filter;
  const titel = filter ? 'Schwachstellen üben' : 'Freies Üben';
  const zurueck = filter?.deckId ? `#/deck/${filter.deckId}` : '#/';
  if (quiz.abgeschlossen) {
    return `
      <h1>Runde geschafft</h1>
      <p class="status frei">${s.benoetigteRichtige} Fragen richtig beantwortet.</p>
      ${filter ? '<p class="klein">Die Karten rücken im Zeitplan vor, sobald sie wieder dran sind. So bleibt „sicher“ ehrlich.</p>' : ''}
      <button type="button" data-aktion="uebenNochmal">Noch eine Runde</button>
      <a class="knopf sekundaer" href="${esc(zurueck)}">${filter?.deckId ? 'Zurück zum Deck' : 'Zurück zu 42'}</a>`;
  }
  if (s.status === 'keineKarten') {
    const text = filter ? 'Keine Schwachstellen: Alles, was du falsch hattest, sitzt gerade wieder.' : s.hinweis;
    return `<h1>${titel}</h1><p class="hinweis"><strong>${esc(text)}</strong></p><a class="knopf" href="${esc(zurueck)}">Zurück</a>`;
  }
  return `
    <h1>${titel}</h1>
    <p class="klein">${filter ? 'Nur Karten, die du schon mal falsch hattest. Falsche setzen sich sofort zurück, richtige rücken erst vor, wenn sie laut Zeitplan wieder dran sind.' : 'Ohne Sperre. Deine Antworten zählen für Box und Statistik.'}</p>
    ${fragenBlock(s, quiz.letzte, meldenKnopf(quiz.letzte))}
    <div class="skip"><a href="${esc(zurueck)}">Üben beenden</a></div>`;
}

function probeAnsicht() {
  if (!quiz || quiz.modus !== 'probe') return nichtGefunden('Der Probelauf ist nicht mehr da. Starte ihn noch einmal im Deck.');
  const s = quiz.sitzung;
  const zurueck = `<a class="knopf sekundaer" href="${esc(quiz.zurueck)}">Zurück</a>`;
  if (s.status === 'keineKarten') {
    return `<h1>Probelauf</h1><p class="hinweis"><strong>${esc(s.hinweis)}</strong></p>${zurueck}`;
  }
  if (quiz.abgeschlossen) {
    const e = s.ergebnisse;
    const falsche = e.filter((x) => !x.richtig);
    const gemeldet = e.filter((x) => quiz.gemeldet.has(x.kartenId));
    const prozent = Math.round((s.richtigeAntworten / e.length) * 100);
    const liste = (eintraege) =>
      eintraege.map((x) => `<div class="zeile"><span>${esc(kuerzen(x.frage))}<br /><span class="klein">Richtig: ${esc(x.richtigeAntwort)}</span></span></div>`).join('');
    const meldungstext = gemeldet.map((x) => `- ${x.frage} → ${x.richtigeAntwort}`).join('\n');
    return `
      <h1>Ergebnis: ${esc(quiz.titel)}</h1>
      <p class="status ${prozent >= 50 ? 'frei' : 'falsch'}">${s.richtigeAntworten} von ${e.length} richtig (${prozent} %)</p>
      <p class="klein">Der Probelauf hat deine Lernboxen und die Statistik nicht verändert.</p>
      <h2>Falsch beantwortet (${falsche.length})</h2>
      ${liste(falsche) || '<p class="klein">Keine – alles richtig!</p>'}
      <h2>Von dir gemeldet (${gemeldet.length})</h2>
      ${
        gemeldet.length
          ? `${liste(gemeldet)}
             <textarea id="meldungstext" class="mono" rows="5" readonly>${esc(`Deck: ${quiz.titel}\n${meldungstext}`)}</textarea>
             <button type="button" class="sekundaer" data-aktion="feldKopieren" data-feld="meldungstext">Liste kopieren</button>
             <p class="klein">Schick mir diese Liste, dann korrigiere ich die Karten.</p>`
          : '<p class="klein">Du hast keine Karte als unklar oder falsch gemeldet.</p>'
      }
      <button type="button" data-aktion="probeNochmal">Noch einmal (neu gemischt)</button>
      ${zurueck}`;
  }
  const letzte = quiz.letzte;
  const melden = meldenKnopf(letzte);
  return `
    <h1>Probelauf: ${esc(quiz.titel)}</h1>
    <p class="klein">Ohne Sperre – zählt nicht für Boxen und Statistik.</p>
    ${fragenBlock(s, letzte, melden)}
    <div class="skip"><a href="${esc(quiz.zurueck)}">Probelauf abbrechen</a></div>`;
}

// --- Ansichten: Kopfrechnen ---

function kopfrechnenAnsicht() {
  const prozente = Object.entries(PROZENT_TIPPS).filter(([p]) => Number(p) !== 1 || true);
  const teilen = Object.entries(TEILEN_TIPPS);
  return `
    <h1>Kopfrechnen: die wichtigsten Wege</h1>
    <p class="klein">Bei den Zufallsaufgaben kannst du vor der Antwort einen Tipp öffnen und bekommst danach den Rechenweg mit deinen Zahlen. Hier ist alles auf einen Blick.</p>

    <h2>Prozent aus 10 %, 5 % und 1 % bauen</h2>
    <div class="karte">
      <p>Alles beginnt bei <strong>10 %</strong> (durch 10) und <strong>1 %</strong> (durch 100). Beispiel für 240 €: 10 % = 24 €, 1 % = 2,40 €.</p>
      ${prozente.map(([p, t]) => `<div class="zeile-einfach"><strong>${esc(p)} %</strong><span>${esc(t.replace(/^\d+ % = /, ''))}</span></div>`).join('')}
    </div>

    <h2>Auf- und Abschlag</h2>
    <div class="karte">
      <p>Nicht mit 1,15 oder 0,85 multiplizieren, sondern den Anteil ausrechnen und <strong>addieren</strong> oder <strong>abziehen</strong>.</p>
      <p class="klein">Beispiel: 200 € plus 15 %: 10 % = 20 €, 5 % = 10 €, also 30 € mehr: 230 €.</p>
    </div>

    <h2>Mehrwertsteuer</h2>
    <div class="karte">
      <p><strong>Netto → Brutto (19 %):</strong> 20 % − 1 %. Beispiel 200 €: 20 % = 40 €, 1 % = 2 €, Steuer 38 €, Brutto 238 €.</p>
      <p><strong>Netto → Brutto (7 %):</strong> 10 % − 3 %. Beispiel 200 €: 20 € − 6 € = 14 € Steuer.</p>
      <p><strong>Brutto → Netto:</strong> Der Bruttopreis ist 119 % (bei 7 %: 107 %). Durch 119 teilen ergibt 1 %, dann mal 100. Nicht einfach 19 % abziehen.</p>
    </div>

    <h2>Zinsen</h2>
    <div class="karte">
      <p>1 % des Kapitals bestimmen, mit dem Zinssatz malnehmen. Halbe Prozent: die Hälfte von 1 % dazuzählen. Für Monate: 3 Monate = ein Viertel, 6 = die Hälfte, 9 = drei Viertel des Jahres.</p>
    </div>

    <h2>Geteilt im Kopf</h2>
    <div class="karte">
      ${teilen.map(([t, tipp]) => `<div class="zeile-einfach"><strong>: ${esc(t)}</strong><span>${esc(tipp.replace(/^Durch \d+: /, ''))}</span></div>`).join('')}
    </div>

    <h2>Mittelwert und Dreisatz</h2>
    <div class="karte">
      <p><strong>Mittelwert:</strong> Eine Zahl aus der Mitte als Anker wählen, nur die Abweichungen zusammenzählen, durch die Anzahl teilen und zum Anker addieren.</p>
      <p><strong>Dreisatz (mehr Arbeiter, weniger Tage):</strong> Arbeiter mal Tage = Arbeitertage. Dann durch die neue Zahl teilen.</p>
    </div>

    <h2>Wechselkurs</h2>
    <div class="karte">
      <p>1,1 = plus 10 %. 1,2 = plus 20 %. 1,25 = plus ein Viertel (zweimal halbieren). 1,5 = plus die Hälfte.</p>
    </div>

    <a class="knopf sekundaer" href="#/">Zurück</a>`;
}

// --- Ansichten: Woche und Meldungen ---

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const datumKurz = (ms) => new Date(ms).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

/** Satz zum Vergleich mit der Vorwoche – ohne Druck, nur Information. */
function vergleichsText(jetzt, vorher, einheit) {
  if (vorher === 0 && jetzt === 0) return '';
  if (vorher === 0) return `Letzte Woche waren es 0 ${einheit}.`;
  if (jetzt === vorher) return `Genauso viele ${einheit} wie in der Woche davor (${vorher}).`;
  return jetzt > vorher ? `Mehr als in der Woche davor (${vorher}).` : `Weniger als in der Woche davor (${vorher}).`;
}

function wochenAnsicht() {
  const jetzt = uhr.jetzt();
  const w = wochenUebersicht(daten.tage, jetzt);
  const max = Math.max(1, ...w.tage.map((t) => t.antworten));
  const gueltig = daten.cards.filter(istGueltig);
  const gelernt = gueltig.filter((k) => k.box >= 4).length;
  const schwer = gueltig.filter((k) => schwierigkeit(k) === 'schwer');
  const problem = gueltig.filter(istProblemkarte);
  const vorschau = faelligkeitsVorschau(gueltig, jetzt);
  const schwerNachDeck = new Map();
  for (const k of schwer) schwerNachDeck.set(k.deckId, (schwerNachDeck.get(k.deckId) ?? 0) + 1);
  const topDecks = Object.entries(w.woche.proDeck).sort((a, b) => b[1].antworten - a[1].antworten).slice(0, 3);

  const balken = w.tage
    .map((t) => {
      const heute = t.key === w.tage[6].key;
      const tag = `${WOCHENTAGE[new Date(t.zeit).getDay()]}${heute ? ' ·' : ''}`;
      return `<div class="balken wochen"><span>${tag}</span><span class="spur"><span class="fuell" style="display:block;width:${(t.antworten / max) * 100}%"></span></span><span>${t.antworten}</span></div>`;
    })
    .join('');

  return `
    <h1>Deine Woche</h1>
    <p class="klein">Die letzten 7 Tage im Überblick. Kein Druck, nur ein Spiegel.</p>

    <div class="karte gross-zahl">
      <div class="zahl">${w.woche.nichtGeoeffnet}×</div>
      <div><strong>Doch nicht geöffnet</strong><div class="klein">${esc(vergleichsText(w.woche.nichtGeoeffnet, w.vorwoche.nichtGeoeffnet, 'Siege') || 'Tippe im Quiz auf „Doch nicht öffnen“, dann zählt es hier.')}</div></div>
    </div>

    <div class="karte">
      <div class="zeile-einfach"><span>Beantwortete Karten</span><strong>${w.woche.antworten}</strong></div>
      <div class="zeile-einfach"><span>Richtig-Quote</span><strong>${prozent(w.woche.quote)}</strong></div>
      <div class="zeile-einfach"><span>Bestandene Quizze</span><strong>${w.woche.quizze}</strong></div>
      <div class="zeile-einfach"><span>Tage mit Quiz</span><strong>${w.woche.tageMitQuiz} von 7</strong></div>
      <p class="klein">${esc(vergleichsText(w.woche.antworten, w.vorwoche.antworten, 'Antworten'))}</p>
    </div>

    <h2>Antworten pro Tag</h2>
    <div class="karte">${balken}</div>

    <h2>Fällige Karten</h2>
    <div class="karte">
      <div class="zeile-einfach"><span>Heute (inkl. überfällig)</span><strong>${vorschau.heute}</strong></div>
      <div class="zeile-einfach"><span>Morgen</span><strong>${vorschau.morgen}</strong></div>
      <div class="zeile-einfach"><span>Übermorgen bis Tag 7</span><strong>${vorschau.danach}</strong></div>
      <p class="klein">Im Quiz kommen die fälligen Karten zuerst dran. Abstände: ${daten.settings.lernmodus === 'intelligent' ? 'Intelligent (eigener Abstand pro Karte)' : 'Einfach (feste Boxen)'}.</p>
    </div>

    <h2>Lernstand</h2>
    <div class="karte">
      <div class="zeile-einfach"><span>Gut gelernt (Box 4–5)</span><strong>${gelernt} von ${gueltig.length}</strong></div>
      <div class="zeile-einfach"><span>Knifflige Karten</span><strong>${schwer.length}</strong></div>
      <div class="zeile-einfach"><span>Problemkarten</span><strong>${problem.length}</strong></div>
      ${problem.length ? '<p class="klein">Problemkarten wurden oft falsch beantwortet. Schau sie dir im Deck an oder melde sie, wenn die Frage unklar ist.</p>' : ''}
      ${schwerNachDeck.size ? `<p class="klein">Meist in: ${esc([...schwerNachDeck].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => `${deckName(id)} (${n})`).join(', '))}</p>` : '<p class="klein">Knifflig heißt: unter 50 % richtig bei mindestens 3 Versuchen. Die App stellt sie bevorzugt, leichte Karten seltener.</p>'}
    </div>

    <h2>Am meisten geübt</h2>
    ${topDecks.map(([id, d]) => `<div class="zeile"><span>${esc(deckName(id))}</span><span class="klein">${d.antworten} Antworten · ${prozent(d.richtig / d.antworten)}</span></div>`).join('') || '<p class="klein">Noch keine Antworten in den letzten 7 Tagen.</p>'}

    <a class="knopf sekundaer" href="#/statistik">Mehr Statistik</a>
    <a class="knopf sekundaer" href="#/">Zurück</a>`;
}

function meldungenAnsicht() {
  const liste = daten.meldungen;
  if (liste.length === 0) {
    return `<h1>Gemeldete Karten</h1><p class="hinweis">Noch nichts gemeldet. Nach einer Antwort kannst du „Frage unklar oder falsch? Melden“ tippen.</p><a class="knopf sekundaer" href="#/">Zurück</a>`;
  }
  return `
    <h1>Gemeldete Karten (${liste.length})</h1>
    <p class="klein">Diese Fragen kamen dir unklar oder falsch vor. Kopiere die Liste und schick sie mir, dann korrigiere ich die Karten.</p>
    ${liste
      .map(
        (m) => `<div class="zeile"><span>${esc(kuerzen(m.frage, 90))}<br /><span class="klein">${esc(m.deck)} · Richtig: ${esc(kuerzen(m.antwort, 60))}</span></span><button type="button" class="sekundaer" data-aktion="meldungLoeschen" data-id="${esc(m.id)}" aria-label="Meldung entfernen">✕</button></div>`,
      )
      .join('')}
    <textarea id="meldungsliste" class="mono" rows="6" readonly>${esc(meldungsText(liste))}</textarea>
    <button type="button" data-aktion="feldKopieren" data-feld="meldungsliste">Liste kopieren</button>
    <button type="button" class="gefahr" data-aktion="meldungenLeeren">Liste leeren</button>
    <a class="knopf sekundaer" href="#/">Zurück</a>`;
}

// --- Ansichten: Statistik und Wunschliste ---

/** Auswahl im Dashboard: Zeitraum in Tagen und der angetippte Tag im Verlauf (null = heute). */
const statistikAuswahl = { tage: 30, tag: null };

const diffText = (jetzt, vorher, einheit = '') => {
  if (!(vorher > 0)) return 'neu';
  const d = jetzt - vorher;
  return `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}${einheit} zu davor`;
};

/** Säulen "richtig unten, falsch oben" je Tag; Tippen zeigt die Details des Tages. */
function verlaufDiagramm(liste, gewaehlt) {
  const max = Math.max(1, ...liste.map((t) => t.antworten));
  const saeulen = liste
    .map((t) => {
      const beschr = `${WOCHENTAGE[new Date(t.zeit).getDay()]} ${datumKurz(t.zeit)}: ${t.richtig} richtig, ${t.falsch} falsch`;
      return `<div class="saeule${t.key === gewaehlt ? ' gewaehlt' : ''}" role="button" tabindex="0" aria-label="${esc(beschr)}" data-aktion="statistikTag" data-tag="${t.key}"><span class="falsch" style="height:${(t.falsch / max) * 100}%"></span><span class="richtig" style="height:${(t.richtig / max) * 100}%"></span></div>`;
    })
    .join('');
  const achse =
    liste.length <= 7
      ? liste.map((t) => `<span>${WOCHENTAGE[new Date(t.zeit).getDay()]}</span>`).join('')
      : `<span>${datumKurz(liste[0].zeit)}</span><span>${datumKurz(liste[liste.length - 1].zeit)}</span>`;
  return `<div class="verlauf">${saeulen}</div><div class="achse${liste.length <= 7 ? ' woche' : ''}">${achse}</div>`;
}

/** Eine Zeile mit Balken: Name, Füllung (0–1), Wert rechts. */
const balkenZeile = (name, anteil, wert, klasse = '') =>
  `<div class="insight-balken"><span class="name">${esc(name)}</span><span class="spur"><span class="fuell ${klasse}" style="width:${Math.round(Math.min(1, Math.max(0, anteil)) * 100)}%"></span></span><span class="wert">${wert}</span></div>`;

function statistikAnsicht() {
  const jetzt = uhr.jetzt();
  const s = daten.settings;
  const n = ZEITRAEUME.includes(statistikAuswahl.tage) ? statistikAuswahl.tage : 30;
  const liste = tageListe(daten.tage, jetzt, n);
  const davor = tageListe(daten.tage, jetzt, n, n);
  const k = kennzahlen(liste);
  const kDavor = kennzahlen(davor);
  const richtigHeuteZahl = richtigHeute(daten.tage, jetzt);
  const serieTage = serie(daten.tage, jetzt);
  const gewaehlt = liste.some((t) => t.key === statistikAuswahl.tag) ? statistikAuswahl.tag : liste[liste.length - 1].key;
  const tagDaten = liste.find((t) => t.key === gewaehlt);

  const chips = ZEITRAEUME.map((z) => `<button type="button" class="chip${z === n ? ' aktiv' : ''}" data-aktion="statistikZeitraum" data-tage="${z}">${z} Tage</button>`).join('');

  const kachel = (zahl, titel, vergleich) => `<div class="kachel"><div class="zahl">${zahl}</div><div class="titel">${titel}</div><div class="vergleich">${vergleich}</div></div>`;
  const quotePunkte = k.quote !== null && kDavor.quote !== null ? Math.round((k.quote - kDavor.quote) * 100) : null;
  const kacheln = `<div class="kacheln">
      ${kachel(k.antworten, 'Karten beantwortet', esc(diffText(k.antworten, kDavor.antworten)))}
      ${kachel(prozent(k.quote), 'Richtig-Quote', quotePunkte === null ? '&nbsp;' : `${quotePunkte > 0 ? '+' : quotePunkte < 0 ? '−' : '±'}${Math.abs(quotePunkte)} Punkte zu davor`)}
      ${kachel(k.freischaltungen, 'App-Zugriffe', esc(diffText(k.freischaltungen, kDavor.freischaltungen)))}
      ${kachel(`${k.nichtGeoeffnet}×`, 'Doch nicht geöffnet', esc(diffText(k.nichtGeoeffnet, kDavor.nichtGeoeffnet)))}
    </div>`;

  const saetze = auffaelligkeiten({ liste, vorher: davor, deckName });
  const apps = proApp(liste);
  const appMax = Math.max(1, ...apps.map((a) => a.anzahl));
  const wochentage = proWochentag(liste);
  const wtMax = Math.max(0.0001, ...wochentage.map((w) => w.schnitt));
  const stunden = proStunde(liste);
  const stundenMax = Math.max(1, ...stunden);
  const stundenSumme = stunden.reduce((a, b) => a + b, 0);
  const decks = proDeck(liste);
  const gueltig = daten.cards.filter(istGueltig);
  const gesamtStand = deckFortschritt(gueltig);
  const knifflig = gueltig
    .filter((c) => trefferquote(c) !== null && trefferquote(c) < 0.6)
    .sort((a, b) => trefferquote(a) - trefferquote(b) || (b.versuche ?? 0) - (a.versuche ?? 0))
    .slice(0, 5);
  const schwachGesamt = deckFortschritt(gueltig.filter((c) => !pausierteDeckIds().includes(c.deckId))).schwach;
  const tagGesamt = tagDaten.antworten === 0 && tagDaten.freischaltungen === 0;
  const appsDesTages = Object.entries(tagDaten.proApp).map(([name, z]) => `${esc(name)} ${z}×`).join(', ');

  return `
    <h1>Statistik</h1>
    <p class="klein">Dein persönliches Dashboard. Alles wird nur auf deinem Gerät gezählt.</p>
    <div class="chips">${chips}</div>
    ${kacheln}

    <div class="karte serie-karte">
      <div><strong>Serie: ${serieTage} ${serieTage === 1 ? 'Tag' : 'Tage'}</strong><div class="klein">Längste Serie: ${laengsteSerie(daten.tage)} · Notfall-Skips im Zeitraum: ${k.skips}</div></div>
      <div class="klein rechts">heute ${richtigHeuteZahl} von ${s.tagesziel}<div class="fortschritt"><div style="width:${Math.min(100, (richtigHeuteZahl / s.tagesziel) * 100)}%"></div></div></div>
    </div>

    <h2>Auffälligkeiten</h2>
    <div class="karte">${saetze.length ? saetze.map((t) => `<p class="satz">${esc(t)}</p>`).join('') : '<p class="klein">Noch zu wenig Daten. Nach ein paar Tagen Nutzung erscheinen hier Auffälligkeiten, zum Beispiel deine Stoßzeiten und deine stärksten Decks.</p>'}</div>

    <h2>Verlauf: richtig und falsch</h2>
    <div class="karte">
      ${verlaufDiagramm(liste, gewaehlt)}
      <p class="legende"><span class="punkt richtig"></span>richtig <span class="punkt falsch"></span>falsch</p>
      <p class="tag-detail"><strong>${WOCHENTAGE[new Date(tagDaten.zeit).getDay()]}, ${datumKurz(tagDaten.zeit)}</strong>${
        tagGesamt
          ? ': nichts gelernt, keine App geöffnet.'
          : `: ${tagDaten.richtig} richtig, ${tagDaten.falsch} falsch${tagDaten.antworten ? ` (${prozent(tagDaten.richtig / tagDaten.antworten)})` : ''}${tagDaten.freischaltungen ? ` · ${tagDaten.freischaltungen} App-Zugriffe (${appsDesTages})` : ''}`
      }</p>
      <p class="klein">Tippe auf eine Säule für die Details des Tages.</p>
    </div>

    <h2>Zugriffe je App</h2>
    <div class="karte">
      ${apps.length ? apps.map((a) => balkenZeile(a.name, a.anzahl / appMax, `${a.anzahl}×`)).join('') + `<p class="klein">Im Schnitt ${(k.freischaltungen / n).toFixed(1).replace('.', ',')} Zugriffe pro Tag. Gezählt wird, wenn ein Quiz die App freigibt.</p>` : '<p class="klein">Noch keine Zugriffe im Zeitraum.</p>'}
    </div>

    <h2>Wochentage</h2>
    <div class="karte">
      ${wochentage.map((w) => balkenZeile(w.name, w.schnitt / wtMax, w.tage ? (w.schnitt >= 10 ? Math.round(w.schnitt) : w.schnitt.toFixed(1).replace('.', ',')) : '–')).join('')}
      <p class="klein">Zugriffe pro Tag im Schnitt.</p>
    </div>

    <h2>Uhrzeiten</h2>
    <div class="karte">
      ${
        stundenSumme === 0
          ? '<p class="klein">Die Uhrzeiten werden erst seit diesem Update mitgezählt. Nach den nächsten Zugriffen siehst du hier, wann du am häufigsten zu Apps greifst.</p>'
          : `<div class="verlauf stunden">${stunden.map((c, h) => `<div class="saeule" title="${h} Uhr: ${c}×"><span class="richtig" style="height:${(c / stundenMax) * 100}%"></span></div>`).join('')}</div>
             <div class="achse stunden-achse"><span>0</span><span>6</span><span>12</span><span>18</span><span>24 Uhr</span></div>
             <p class="klein">Zugriffe nach Uhrzeit (${stundenSumme} erfasst).</p>`
      }
    </div>

    <h2>Karteikarten nach Deck</h2>
    <div class="karte">
      ${decks.length ? decks.slice(0, 10).map((d) => balkenZeile(deckName(d.id), d.quote, `${prozent(d.quote)} <span class="klein">von ${d.antworten}</span>`, d.quote >= 0.8 ? 'gut' : d.quote < 0.5 ? 'schlecht' : '')).join('') + (decks.length > 10 ? `<p class="klein">… und ${decks.length - 10} weitere.</p>` : '') : '<p class="klein">Noch keine Antworten im Zeitraum.</p>'}
    </div>

    <h2>Lernstand gesamt</h2>
    <div class="karte stand-karte">
      ${
        gesamtStand.gesamt
          ? `<div class="stand-kopf"><strong>${prozent(gesamtStand.anteilSicher)} sicher</strong><span class="klein">${gesamtStand.gesamt} Karten</span></div>
             ${fortschrittsBalken(gesamtStand, true)}
             <p class="klein">${gesamtStand.sicher} sicher · ${gesamtStand.lernend} im Lernen · ${gesamtStand.neu} neu${gesamtStand.fehlerquote === null ? '' : ` · Fehlerquote insgesamt ${prozent(gesamtStand.fehlerquote)}`}</p>
             ${schwachGesamt > 0 ? `<a class="knopf" href="#/ueben/schwach">Schwachstellen üben (${schwachGesamt})</a>` : ''}`
          : '<p class="klein">Noch keine Karten.</p>'
      }
    </div>

    <h2>Knifflige Karten</h2>
    ${
      knifflig.length
        ? knifflig.map((c) => `<a class="zeile" href="#/karte/${esc(c.id)}"><span>${esc(kuerzen(c.frage, 70))}<br /><span class="klein">${esc(deckName(c.deckId))}</span></span><span class="klein">${prozent(trefferquote(c))}<br />${c.versuche}×</span></a>`).join('')
        : '<p class="klein">Keine Karte mit weniger als 60 % Treffern (ab 3 Versuchen). Gut so!</p>'
    }

    <a class="knopf sekundaer" href="#/woche">Deine Woche (Übersicht)</a>
    <a class="knopf sekundaer" href="#/">Zurück</a>`;
}

/** Offene Wünsche mit Entscheidungsknöpfen (in der Kaufbremse und auf der Wunschliste). */
function wunschListeHtml(jetzt) {
  const { wartend, reif } = offeneWuensche(daten.wuensche, jetzt);
  const reifHtml = reif
    .map(
      (w) => `
        <div class="karte">
          <strong>${esc(w.text)}</strong>
          <div class="klein">Wartezeit vorbei. Brauchst du es immer noch?</div>
          <div class="inline-form">
            <button type="button" data-aktion="wunschErledigt" data-id="${esc(w.id)}" data-status="gekauft">Gekauft</button>
            <button type="button" class="sekundaer" data-aktion="wunschErledigt" data-id="${esc(w.id)}" data-status="verworfen">Verworfen</button>
          </div>
        </div>`,
    )
    .join('');
  const wartendHtml = wartend
    .map(
      (w) => `
        <div class="zeile"><span>${esc(w.text)}</span><span class="klein">noch ${stundenBis(w, jetzt)} Std.</span></div>`,
    )
    .join('');
  if (!reifHtml && !wartendHtml) return '<p class="klein">Keine offenen Wünsche.</p>';
  return `${reif.length ? '<h2>Bereit zur Entscheidung</h2>' : ''}${reifHtml}${wartend.length ? '<h2>Wartet noch</h2>' : ''}${wartendHtml}`;
}

function wunschlisteAnsicht() {
  const jetzt = uhr.jetzt();
  const erledigt = daten.wuensche.filter((w) => w.status !== 'wartet').slice(0, 10);
  return `
    <h1>Wunschliste</h1>
    <p class="klein">Neue Wünsche warten ${daten.settings.kaufbremseStunden} Stunden. Danach entscheidest du: kaufen oder verwerfen.</p>
    <form class="inline-form" data-form="wunschNotieren">
      <input type="text" name="text" placeholder="Was willst du kaufen?" maxlength="200" autocomplete="off" required />
      <button type="submit">Notieren</button>
    </form>
    ${wunschListeHtml(jetzt)}
    ${
      erledigt.length
        ? `<h2>Zuletzt entschieden</h2>${erledigt
            .map((w) => `<div class="zeile"><span>${esc(w.text)}</span><span class="klein">${w.status === 'gekauft' ? 'gekauft' : 'verworfen'}</span></div>`)
            .join('')}`
        : ''
    }
    <a class="knopf sekundaer" href="#/">Zurück</a>`;
}

// --- Ansichten: Einstellungen ---

/** Formular-Zustand der Einstellungen (Texte, damit halb getippte Werte erhalten bleiben). */
function formAusSettings(s) {
  return {
    dauer: s.freischaltdauerMinuten,
    karten: s.kartenProGate,
    reibungAn: s.reibung.an,
    reibungStart: s.reibung.start,
    reibungSchritt: s.reibung.schritt,
    reibungMax: s.reibung.max,
    generatorFragen: s.generatorFragen,
    eingabeProzent: Math.round(s.eingabeAnteil * 100),
    tagesziel: s.tagesziel,
    nachtAn: s.nachtruhe.an,
    nachtVon: s.nachtruhe.von,
    nachtBis: s.nachtruhe.bis,
    nachtModus: s.nachtruhe.modus,
    kaufStunden: s.kaufbremseStunden,
    lernmodus: s.lernmodus,
    neueProQuiz: s.neueProQuiz,
    kurzbefehl: s.freischaltKurzbefehl ?? '',
    apps: s.zielApps.map((a) => ({
      name: a.name,
      urlScheme: a.urlScheme,
      bremse: a.bremse ?? 'keine',
      tageslimit: a.tageslimit ?? 0,
      decks: Array.isArray(s.appDecks?.[a.name]) ? [...s.appDecks[a.name]] : null,
    })),
  };
}

function formAusFormular(form) {
  const e = form.elements;
  const apps = [...form.querySelectorAll('.app-block')].map((b) => {
    const boxen = [...b.querySelectorAll('input[name="appDeck"]')];
    const gewaehlt = boxen.filter((c) => c.checked).map((c) => c.value);
    return {
      name: b.querySelector('[name="appName"]').value.trim(),
      urlScheme: b.querySelector('[name="appScheme"]').value.trim(),
      bremse: b.querySelector('[name="appBremse"]').value,
      tageslimit: b.querySelector('[name="appLimit"]').value,
      decks: gewaehlt.length === boxen.length ? null : gewaehlt,
    };
  });
  return {
    dauer: e.dauer.value,
    karten: e.karten.value,
    reibungAn: e.reibungAn.checked,
    reibungStart: e.reibungStart.value,
    reibungSchritt: e.reibungSchritt.value,
    reibungMax: e.reibungMax.value,
    generatorFragen: e.generatorFragen.value,
    eingabeProzent: e.eingabeProzent.value,
    tagesziel: e.tagesziel.value,
    nachtAn: e.nachtAn.checked,
    nachtVon: e.nachtVon.value,
    nachtBis: e.nachtBis.value,
    nachtModus: e.nachtModus.value,
    kaufStunden: e.kaufStunden.value,
    lernmodus: e.lernmodus.value,
    neueProQuiz: e.neueProQuiz.value,
    kurzbefehl: e.kurzbefehl.value,
    apps,
  };
}

/** Prüft den Formular-Zustand und übernimmt ihn in die Einstellungen. Gibt eine Fehlermeldung oder null zurück. */
function formUebernehmen(fm) {
  const apps = fm.apps.filter((a) => a.name || a.urlScheme);
  if (apps.some((a) => !a.name || sichereUrl(a.urlScheme) === '#/')) {
    return 'Jede Ziel-App braucht einen Namen und ein URL-Scheme wie instagram://';
  }
  if (new Set(apps.map((a) => a.name.toLowerCase())).size < apps.length) return 'Die Namen der Ziel-Apps müssen verschieden sein.';
  const leer = apps.find((a) => Array.isArray(a.decks) && a.decks.length === 0);
  if (leer) return `Wähle für ${leer.name} mindestens ein Deck oder eine Zufallsaufgabe aus.`;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(fm.nachtVon) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(fm.nachtBis)) {
    return 'Bitte die Zeiten der Nachtruhe als Uhrzeit angeben.';
  }

  const s = daten.settings;
  s.zielApps = apps.map((a) => {
    const ziel = { name: a.name, urlScheme: a.urlScheme };
    if (['absicht', 'kauf'].includes(a.bremse)) ziel.bremse = a.bremse;
    const limit = zahl(a.tageslimit, 0, 99, 0);
    if (limit > 0) ziel.tageslimit = limit;
    return ziel;
  });
  s.appDecks = Object.fromEntries(apps.filter((a) => Array.isArray(a.decks)).map((a) => [a.name, a.decks]));
  s.freischaltdauerMinuten = zahl(fm.dauer, 1, 240, 15);
  s.kartenProGate = zahl(fm.karten, 1, 50, 5);
  const start = zahl(fm.reibungStart, 1, 20, 3);
  s.reibung = { an: fm.reibungAn, start, schritt: zahl(fm.reibungSchritt, 0, 5, 1), max: Math.max(start, zahl(fm.reibungMax, 1, 30, 8)) };
  s.generatorFragen = zahl(fm.generatorFragen, 0, 20, 2);
  s.eingabeAnteil = zahl(fm.eingabeProzent, 0, 100, 50) / 100;
  s.tagesziel = zahl(fm.tagesziel, 1, 500, 20);
  s.nachtruhe = { an: fm.nachtAn, von: fm.nachtVon, bis: fm.nachtBis, modus: fm.nachtModus === 'gesperrt' ? 'gesperrt' : 'streng' };
  s.kaufbremseStunden = zahl(fm.kaufStunden, 1, 168, 24);
  s.lernmodus = fm.lernmodus === 'einfach' ? 'einfach' : 'intelligent';
  s.neueProQuiz = zahl(fm.neueProQuiz, 0, 10, 2);
  s.freischaltKurzbefehl = String(fm.kurzbefehl).trim();
  return null;
}

/** Vorschlagsliste: Apps, die noch nicht als Ziel-App angelegt sind, als antippbare Knöpfe. */
function beliebteApps(vorhandene) {
  const namen = new Set(vorhandene.map((a) => a.name.trim().toLowerCase()));
  const offen = BELIEBTE_APPS.filter((a) => !namen.has(a.name.toLowerCase()));
  if (offen.length === 0) return '<p class="klein">Alle vorgeschlagenen Apps sind schon angelegt.</p>';
  const gruppen = [...new Set(offen.map((a) => a.gruppe))];
  return `
    <h3>Beliebte Apps hinzufügen</h3>
    <p class="klein">Tippe auf eine App, um sie anzulegen. Danach unten auf „Speichern“ tippen. Die Adressen (URL-Schemes) stammen größtenteils aus dem Gedächtnis und sind nicht alle getestet. Ein ✓ bedeutet: auf deinem iPhone bestätigt.</p>
    <button type="button" class="sekundaer" data-aktion="appVorschlagAlle">Alle ${offen.length} hinzufügen</button>
    ${gruppen
      .map(
        (g) => `
      <div class="klein gruppe">${esc(g)}</div>
      <div class="chips">${offen
        .filter((a) => a.gruppe === g)
        .map((a) => `<button type="button" class="chip" data-aktion="appVorschlag" data-name="${esc(a.name)}">+ ${esc(a.name)}${a.bestaetigt ? ' ✓' : ''}</button>`)
        .join('')}</div>`,
      )
      .join('')}`;
}

function einstellungenAnsicht() {
  const fm = entwurf ?? formAusSettings(daten.settings);
  const wahl = deckAuswahl();
  const haken = (an) => (an ? 'checked' : '');
  const appBloecke = fm.apps
    .map(
      (a, i) => `
        <div class="app-block">
          <div class="app-zeile">
            <input type="text" name="appName" value="${esc(a.name)}" placeholder="Name" aria-label="Name" />
            <input type="text" name="appScheme" value="${esc(a.urlScheme)}" placeholder="instagram://" autocapitalize="none" autocorrect="off" aria-label="URL-Scheme" />
            <button type="button" class="sekundaer" data-aktion="appEntfernen" data-index="${i}" aria-label="Entfernen">✕</button>
          </div>
          <div class="app-optionen">
            <label>Bremse vor dem Öffnen
              <select name="appBremse">
                <option value="keine" ${a.bremse === 'keine' ? 'selected' : ''}>keine</option>
                <option value="absicht" ${a.bremse === 'absicht' ? 'selected' : ''}>Absicht abfragen (5 Sek. Pause)</option>
                <option value="kauf" ${a.bremse === 'kauf' ? 'selected' : ''}>Kaufbremse (Wunschliste)</option>
              </select>
            </label>
            <label>Freischaltungen pro Tag (0 = unbegrenzt)
              <input type="number" name="appLimit" min="0" max="99" value="${esc(a.tageslimit)}" />
            </label>
          </div>
          <details>
            <summary>Decks für diese App${a.decks ? ` (${a.decks.length} gewählt)` : ' (alle)'}</summary>
            ${wahl
              .map(
                (w) =>
                  `<label class="check"><input type="checkbox" name="appDeck" value="${esc(w.id)}" ${haken(a.decks === null || a.decks.includes(w.id))} /> ${esc(w.name)}</label>`,
              )
              .join('')}
            <p class="klein">Neue Decks musst du hier ankreuzen, wenn die App eingeschränkt ist.</p>
          </details>
        </div>`,
    )
    .join('');

  return `
    <h1>Einstellungen</h1>
    <form data-form="einstellungen">
      <h2>Quiz</h2>
      <label for="dauer">Freischaltdauer (Minuten)</label>
      <input type="number" id="dauer" name="dauer" min="1" max="240" value="${esc(fm.dauer)}" />

      <label for="lernmodus">Lernmodus</label>
      <select id="lernmodus" name="lernmodus">
        <option value="intelligent" ${fm.lernmodus === 'intelligent' ? 'selected' : ''}>Intelligent: eigener Abstand pro Karte</option>
        <option value="einfach" ${fm.lernmodus === 'einfach' ? 'selected' : ''}>Einfach: feste Abstände (1, 2, 4, 8, 16 Tage)</option>
      </select>
      <p class="klein">Intelligent: Karten, die du sicher und schnell kannst, kommen nach und nach seltener (bis 180 Tage). Vergessene Karten kommen morgen wieder. Leicht zu ratende Karten (Wahr/Falsch) wachsen langsamer. Der Modus ist jederzeit umschaltbar, deine Karten bleiben erhalten.</p>
      <label for="neueProQuiz">Neue Karten pro Quiz (höchstens, nur Modus „Intelligent“)</label>
      <input type="number" id="neueProQuiz" name="neueProQuiz" min="0" max="10" value="${esc(fm.neueProQuiz)}" />

      <label class="check"><input type="checkbox" name="reibungAn" ${haken(fm.reibungAn)} /> Kartenzahl steigt mit jedem Quiz am selben Tag</label>
      <div class="drei">
        <label>Start<input type="number" name="reibungStart" min="1" max="20" value="${esc(fm.reibungStart)}" /></label>
        <label>Plus je Quiz<input type="number" name="reibungSchritt" min="0" max="5" value="${esc(fm.reibungSchritt)}" /></label>
        <label>Höchstens<input type="number" name="reibungMax" min="1" max="30" value="${esc(fm.reibungMax)}" /></label>
      </div>

      <label for="karten">Karten pro Quiz (gilt, wenn die Steigerung aus ist)</label>
      <input type="number" id="karten" name="karten" min="1" max="50" value="${esc(fm.karten)}" />

      <label for="generatorFragen">Zufallsaufgaben pro Quiz (0 = keine)</label>
      <input type="number" id="generatorFragen" name="generatorFragen" min="0" max="20" value="${esc(fm.generatorFragen)}" />

      <label for="eingabeProzent">Davon mit Zahleneingabe (%)</label>
      <input type="number" id="eingabeProzent" name="eingabeProzent" min="0" max="100" value="${esc(fm.eingabeProzent)}" />

      <label for="tagesziel">Tagesziel (richtige Antworten)</label>
      <input type="number" id="tagesziel" name="tagesziel" min="1" max="500" value="${esc(fm.tagesziel)}" />

      <h2>Nachtruhe</h2>
      <label class="check"><input type="checkbox" name="nachtAn" ${haken(fm.nachtAn)} /> Nachtruhe aktivieren</label>
      <div class="drei">
        <label>Von<input type="time" name="nachtVon" value="${esc(fm.nachtVon)}" /></label>
        <label>Bis<input type="time" name="nachtBis" value="${esc(fm.nachtBis)}" /></label>
        <label>Wirkung
          <select name="nachtModus">
            <option value="streng" ${fm.nachtModus === 'streng' ? 'selected' : ''}>doppelt so viele Karten</option>
            <option value="gesperrt" ${fm.nachtModus === 'gesperrt' ? 'selected' : ''}>kein Quiz</option>
          </select>
        </label>
      </div>

      <h2>Kaufbremse</h2>
      <label for="kaufStunden">Wartezeit für neue Wünsche (Stunden)</label>
      <input type="number" id="kaufStunden" name="kaufStunden" min="1" max="168" value="${esc(fm.kaufStunden)}" />

      <h2>Ziel-Apps</h2>
      <p class="klein">Name und URL-Scheme, dazu Bremse, Tageslimit und die Decks, die für die App gelten.</p>
      ${appBloecke}
      <button type="button" class="sekundaer" data-aktion="appHinzu">+ Ziel-App (leer)</button>
      ${beliebteApps(fm.apps)}

      <h2>Erweitert</h2>
      <label for="kurzbefehl">Kurzbefehl zum Freischalten (optional)</label>
      <input type="text" id="kurzbefehl" name="kurzbefehl" value="${esc(fm.kurzbefehl)}" placeholder="42 Frei" autocapitalize="none" autocorrect="off" />
      <p class="klein">Leer lassen, solange die Automation nicht über einen Kurzbefehl läuft. Dann öffnet der Knopf die App direkt.</p>

      <p class="fehler" id="fehler"></p>
      <button type="submit">Speichern</button>
    </form>

    <h2>Datensicherung</h2>
    <p class="klein">Alle Karten liegen nur in diesem Browser. Mach hin und wieder ein Backup – Manche Browser löschen Websitedaten, wenn du die Seite lange nicht nutzt.${daten.settings.letztesBackup ? ` Letztes Backup: ${new Date(daten.settings.letztesBackup).toLocaleDateString('de-DE')}.` : ''}</p>
    <button type="button" class="sekundaer" data-aktion="export">Backup exportieren</button>
    <label for="import">Backup importieren (ersetzt alle aktuellen Daten)</label>
    <input type="file" id="import" accept="application/json,.json" />
    <p class="fehler" id="importfehler"></p>`;
}

/** Gewähltes System auf der Einrichtungsseite ('ios' | 'android' | null = noch nicht gewählt). */
let einrichtungSystem = /android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : null;

function einrichtungAnsicht() {
  const basis = location.origin + location.pathname;
  const lokal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  const zielApps = daten.settings.zielApps.filter((a) => a.name);
  const adressen = zielApps.length
    ? zielApps
        .map(
          (a, i) => `
      <div class="url-karte">
        <strong>${esc(a.name)}</strong>
        <input class="url" id="url-${i}" type="text" readonly value="${esc(`${basis}?quiz=${encodeURIComponent(a.name)}`)}" onclick="this.select()" />
        <button type="button" class="sekundaer" data-aktion="feldKopieren" data-feld="url-${i}">Adresse kopieren</button>
      </div>`,
        )
        .join('')
    : '<p class="klein">Du hast noch keine Ziel-Apps angelegt (Einstellungen).</p>';

  const wahl = (system, titel) =>
    `<button type="button" class="${einrichtungSystem === system ? '' : 'sekundaer'}" data-aktion="systemWahl" data-system="${system}">${titel}</button>`;

  const ios = `
    <h2>Automation auf dem iPhone</h2>
    <p class="hinweis"><strong>Immer Safari verwenden.</strong> Kurzbefehle öffnen Webseiten in Safari. Ein Home-Bildschirm-Symbol hat getrennte Daten und wäre leer. Nutze 42 deshalb nur in Safari.</p>
    <p>Lege für <strong>jede</strong> Ziel-App eine eigene Automation an:</p>
    <ol class="schritte">
      <li>Öffne die App <strong>Kurzbefehle</strong> und tippe unten auf <strong>Automation</strong>, dann oben rechts auf <strong>+</strong>.</li>
      <li>Wähle <strong>App</strong>, tippe auf <strong>Auswählen</strong>, setze einen Haken bei der Ziel-App und tippe auf <strong>Fertig</strong>.</li>
      <li>Es muss <strong>Ist geöffnet</strong> angehakt sein, dann <strong>Weiter</strong>.</li>
      <li>Wähle <strong>Neuer leerer Kurzbefehl</strong> und füge die Aktion <strong>URLs öffnen</strong> hinzu.</li>
      <li>Trage als URL die Adresse für diese App ein (siehe unten, „Adresse kopieren“ und dort einfügen).</li>
      <li>Wähle <strong>Sofort ausführen</strong> und schalte die Benachrichtigung aus. Dann <strong>Fertig</strong>.</li>
    </ol>`;

  const android = `
    <h2>Automation auf Android</h2>
    <p class="hinweis"><strong>Ehrlich vorweg:</strong> Android hat keine eingebauten Kurzbefehle, die beim Öffnen einer App etwas auslösen. Dafür braucht man eine Zusatz-App. Ich beschreibe <strong>MacroDroid</strong> (Play Store, die Gratis-Version erlaubt nur eine begrenzte Zahl an Makros). Das geht ähnlich auch mit <strong>Tasker</strong>. Ich konnte das nicht auf einem Android-Gerät testen. Die Menünamen können je nach Version leicht abweichen.</p>
    <p><strong>Vorbereitung:</strong> Öffne 42 in <strong>Chrome</strong>. Tippe oben rechts auf <strong>⋮</strong> und dann auf <strong>Zum Startbildschirm hinzufügen</strong>. So hast du 42 als Symbol parat.</p>
    <p>Lege für <strong>jede</strong> Ziel-App ein eigenes Makro an:</p>
    <ol class="schritte">
      <li>Installiere im <strong>Play Store</strong> die App <strong>MacroDroid</strong> und öffne sie. Gehe die Einführung durch.</li>
      <li>Tippe auf <strong>Makro hinzufügen</strong> (oder auf <strong>+</strong>).</li>
      <li>Tippe beim <strong>Auslöser</strong> auf <strong>+</strong>, wähle <strong>Anwendungen</strong> und dann <strong>Anwendung gestartet/geschlossen</strong>. Wähle <strong>Anwendung gestartet</strong>, dann die Ziel-App, dann <strong>OK</strong>.</li>
      <li>Tippe bei den <strong>Aktionen</strong> auf <strong>+</strong>, wähle <strong>Anwendungen</strong> und dann <strong>Webseite öffnen</strong> (heißt je nach Version auch <strong>URL starten</strong>).</li>
      <li>Füge die Adresse für diese App ein (siehe unten, „Adresse kopieren“ und dort einfügen). Bestätige mit <strong>OK</strong>.</li>
      <li>Gib dem Makro oben einen Namen, zum Beispiel „42 Instagram“, und speichere es mit dem Haken.</li>
      <li>MacroDroid fragt nach Berechtigungen, zum Beispiel <strong>Nutzungszugriff</strong> und <strong>Über anderen Apps einblenden</strong>. Erlaube sie. Stelle in den Android-Akkueinstellungen außerdem ein, dass MacroDroid <strong>nicht optimiert</strong> wird, sonst wird es im Hintergrund beendet.</li>
      <li><strong>Test:</strong> Öffne die Ziel-App. Chrome sollte sich öffnen und das Quiz zeigen.</li>
    </ol>
    <p class="hinweis"><strong>Mögliche Falle:</strong> Wenn du nach dem Quiz auf „öffnen“ tippst, startet die Ziel-App, und dein Makro kann 42 noch einmal davor schalten. Dann siehst du „freigeschaltet bis …“ und tippst noch einmal auf „öffnen“. Falls das bei dir endlos so weitergeht, sag mir Bescheid, dann bauen wir das für Android um.</p>`;

  const anleitung =
    einrichtungSystem === 'ios' ? ios : einrichtungSystem === 'android' ? android : '<p class="klein">Wähle oben dein Handy, dann erscheint die passende Anleitung.</p>';

  return `
    <h1>Einrichtung</h1>
    ${lokal ? '<p class="hinweis"><strong>Achtung:</strong> Du siehst eine „localhost“-Adresse. Die Einrichtung musst du mit der Internet-Adresse der App am Handy machen.</p>' : ''}

    <div class="intro">
      <h2>Warum 42?</h2>
      <p>Wie oft öffnest du Instagram, Reddit &amp; Co., ohne darüber nachzudenken? 42 stellt ein kurzes Quiz davor. Du beantwortest 5 Fragen richtig, dann ist die App ${daten.settings.freischaltdauerMinuten} Minuten offen. So lernst du nebenbei etwas, und der Daumen bekommt eine kleine Denkpause.</p>
      <h2>Was kann die App?</h2>
      <ul class="liste-kompakt">
        <li>Fertige Decks in der Bibliothek, von Körper und Geld bis Psychologie und Technik (je 42 Karten).</li>
        <li>Pro Ziel-App eigene Freischaltung, eigene Decks, eigenes Tageslimit und optional eine Bremse.</li>
        <li>Lernboxen: Was du kannst, kommt seltener, was nicht, öfter.</li>
        <li>Nachtruhe, Notfall-Skip, Statistik mit Serie und ein Probelauf pro Deck ohne Sperre.</li>
      </ul>
      <h2>So benutzt du sie</h2>
      <ol class="schritte">
        <li>Hole dir unter <a href="#/bibliothek">Bibliothek</a> ein paar Decks.</li>
        <li>Richte unten die Automation für deine Ziel-Apps ein.</li>
        <li>Öffne die Ziel-App: Das Quiz erscheint. Nach 5 richtigen Antworten tippst du auf „öffnen“.</li>
      </ol>
      <p class="klein">42 ist eine <strong>weiche Sperre</strong>: Es hält nichts technisch zurück, es stellt das Quiz nur in den Weg. Du kannst es jederzeit umgehen.</p>
    </div>

    <h2>Welches Handy hast du?</h2>
    <div class="wahl">${wahl('ios', 'iPhone (iOS)')}${wahl('android', 'Android')}</div>
    ${anleitung}

    <h2>Adressen für deine Ziel-Apps</h2>
    <p class="klein">Diese Adresse trägst du in der Automation ein. Eine Adresse pro App.</p>
    ${adressen}

    <h2>Wie es abläuft</h2>
    <ul>
      <li>Du öffnest die Ziel-App, und der Browser zeigt das Quiz.</li>
      <li>Nach dem Bestehen tippst du auf „öffnen“ und bist für <strong>diese App</strong> ${daten.settings.freischaltdauerMinuten} Minuten freigeschaltet. Jede App hat ihre eigene Freischaltung und braucht ein eigenes Quiz. Öffnest du dieselbe App in der Zeit erneut, siehst du die Restzeit und kommst mit einem Tipp hinein.</li>
      <li>Der Notfall-Skip schaltet einmal pro Tag (für alle Apps zusammen) eine App ohne Quiz frei.</li>
      <li>Unter Einstellungen legst du je App Bremse, Tageslimit und passende Decks fest.</li>
    </ul>

    <h2>Ohne Automation</h2>
    <p>Du kannst Instagram &amp; Co. auch immer über 42 öffnen: Ziel-App antippen, Quiz lösen, „öffnen“. Dafür brauchst du keine Automation.</p>
    <a class="knopf sekundaer" href="#/">Zurück</a>`;
}

// --- Ansichten: Bibliothek und Import ---

/** Bibliothek: Suche und Kategorie-Filter, damit bei 60 Decks nichts untergeht. */
let bibliothekFilter = { kategorie: null, suche: '' };

const bibliothekEintrag = (e) => {
  const vorhanden = daten.decks.some((d) => d.name.trim().toLowerCase() === e.name.toLowerCase());
  return `
    <div class="karte deck-eintrag">
      <div class="deck-kopf"><strong>${esc(e.name)}</strong>${vorhanden ? ' <span class="badge">✓ Drin</span>' : ''} <span class="klein">· ${e.anzahl} Karten</span></div>
      <div class="klein">${esc(e.beschreibung ?? '')}</div>
      <div class="deck-knoepfe">
        <button type="button" class="${vorhanden ? 'sekundaer' : ''}" data-aktion="bibliothekHinzu" data-datei="${esc(e.datei)}">${vorhanden ? 'Aktualisieren' : 'Hinzufügen'}</button>
        <button type="button" class="sekundaer" data-aktion="probeBibliothek" data-datei="${esc(e.datei)}">Ausprobieren</button>
      </div>
    </div>`;
};

function bibliothekListe() {
  const suche = bibliothekFilter.suche.trim().toLowerCase();
  const treffer = bibliothek.eintraege.filter(
    (e) =>
      (!bibliothekFilter.kategorie || (e.kategorie ?? 'Weitere') === bibliothekFilter.kategorie) &&
      (!suche || `${e.name} ${e.beschreibung ?? ''}`.toLowerCase().includes(suche)),
  );
  if (!treffer.length) return '<p class="klein">Keine Decks gefunden. Probier ein anderes Stichwort oder wähle „Alle“.</p>';
  let letzte = null;
  return treffer
    .map((e) => {
      const kat = e.kategorie ?? 'Weitere';
      const anzahl = treffer.filter((t) => (t.kategorie ?? 'Weitere') === kat).length;
      const kopf = kat !== letzte ? `<h2>${esc((letzte = kat))} <span class="klein">(${anzahl})</span></h2>` : '';
      return kopf + bibliothekEintrag(e);
    })
    .join('');
}

function bibliothekAnsicht() {
  const meldung = bibliothek.meldung ? `<p class="hinweis">${esc(bibliothek.meldung)}</p>` : '';
  let inhalt;
  if (bibliothek.status === 'fehler') {
    inhalt = '<p class="hinweis">Die Bibliothek konnte nicht geladen werden. Bist du online?</p>';
  } else if (bibliothek.status !== 'fertig') {
    inhalt = '<p class="klein">Lade Bibliothek …</p>';
  } else {
    const kategorien = [...new Set(bibliothek.eintraege.map((e) => e.kategorie ?? 'Weitere'))];
    const chip = (kat, titel) =>
      `<button type="button" class="chip${bibliothekFilter.kategorie === kat ? ' aktiv' : ''}" data-aktion="bibliothekKategorie" data-kategorie="${esc(kat ?? '')}">${esc(titel)}</button>`;
    inhalt = `
      <input type="search" id="bibliothekSuche" placeholder="Deck suchen (z. B. Miete, Schlaf, KI)" value="${esc(bibliothekFilter.suche)}" autocomplete="off" />
      <div class="chips">${chip(null, `Alle (${bibliothek.eintraege.length})`)}${kategorien
        .map((k) => chip(k, `${k} (${bibliothek.eintraege.filter((e) => (e.kategorie ?? 'Weitere') === k).length})`))
        .join('')}</div>
      <div id="bibliothekListe">${bibliothekListe()}</div>`;
  }
  return `
    <h1>Bibliothek</h1>
    <p class="klein">Fertige Decks zum Einspielen. Erneut einspielen (Aktualisieren) erzeugt keine Dubletten, dein Lernfortschritt bleibt erhalten.</p>
    ${meldung}
    ${inhalt}
    <a class="knopf sekundaer" href="#/">Zurück</a>`;
}

function importAnsicht() {
  const z = importZustand;
  if (!z.vorschau) {
    return `
      <h1>Deck importieren</h1>
      <p class="klein">Füge den Text eines Decks im 42-Format ein oder wähle eine Datei. Neue Decks kannst du dir mit Claude erstellen lassen.</p>
      <details>
        <summary>Prompt für Claude anzeigen</summary>
        <textarea id="prompttext" class="mono" rows="14" readonly>${esc(promptVorlage())}</textarea>
        <button type="button" class="sekundaer" data-aktion="promptKopieren">Prompt kopieren</button>
        <p class="klein">Ersetze „[THEMA HIER EINTRAGEN]“, schick den Prompt an Claude, kopiere die Antwort und füge sie unten ein.</p>
      </details>
      <form data-form="importPruefen">
        <label for="importtext">Deck-Text (JSON)</label>
        <textarea id="importtext" name="text" class="mono" rows="8" placeholder='{"format": "lerngate-deck-v1", …}'>${esc(z.text)}</textarea>
        <label for="deckdatei">… oder Datei wählen</label>
        <input type="file" id="deckdatei" accept="application/json,.json,.txt" />
        <p class="fehler">${esc(z.fehler ?? '')}</p>
        <button type="submit">Prüfen</button>
        <a class="knopf sekundaer" href="#/">Zurück</a>
      </form>`;
  }

  const v = z.vorschau;
  const gueltig = v.karten.filter((k) => !k.fehler).length;
  const zeilen = v.karten
    .map(
      (k, i) => `
        <label class="import-zeile${k.fehler ? ' fehlerhaft' : ''}">
          <input type="checkbox" name="karte" value="${i}" ${k.fehler ? 'disabled' : 'checked'} />
          <span>
            <strong>${esc(k.frage || '(ohne Frage)')}</strong><br />
            ${
              k.fehler
                ? `<span class="fehler">${esc(k.fehler)}</span>`
                : `<span class="klein">✓ ${esc(k.antworten[0])}<br />✗ ${k.antworten.slice(1).map((a) => esc(a)).join(' · ')}</span>`
            }
          </span>
        </label>`,
    )
    .join('');

  return `
    <h1>Vorschau</h1>
    <form data-form="importSpeichern">
      <label for="deckname">Deck-Name (gleicher Name = Karten kommen in das bestehende Deck)</label>
      <input type="text" id="deckname" name="deckname" value="${esc(v.name)}" maxlength="80" required />
      <p class="klein">${gueltig} von ${v.karten.length} Karten sind in Ordnung. Wähle ab, was du nicht willst. Lies die Karten durch – KI-Karten können Fehler enthalten. Bearbeiten kannst du sie nach dem Speichern im Deck.</p>
      ${zeilen}
      <button type="submit">Auswahl speichern</button>
      <button type="button" class="sekundaer" data-aktion="importAbbrechen">Zurück</button>
    </form>`;
}

function nichtGefunden(text = 'Diese Seite gibt es nicht.') {
  return `<h1>Nicht gefunden</h1><p>${text}</p><a class="knopf" href="#/">Zur Startseite</a>`;
}

// --- Router ---

function zeichne() {
  ticker = false;
  const hash = location.hash || '#/';
  let m;
  let html;
  if (hash === '#/' || hash === '#') html = startAnsicht();
  else if ((m = hash.match(/^#\/deck\/([^/]+)$/))) html = deckAnsicht(m[1]);
  else if ((m = hash.match(/^#\/karte\/neu\/([^/]+)$/))) html = karteAnsicht(null, m[1]);
  else if ((m = hash.match(/^#\/karte\/([^/]+)$/))) html = karteAnsicht(m[1], null);
  else if ((m = hash.match(/^#\/quiz\/([^/]+)$/))) html = quizAnsicht(decodeURIComponent(m[1]));
  else if (hash === '#/ueben' || hash.startsWith('#/ueben/schwach')) html = uebenAnsicht();
  else if (hash === '#/probe') html = probeAnsicht();
  else if (hash === '#/statistik') html = statistikAnsicht();
  else if (hash === '#/woche') html = wochenAnsicht();
  else if (hash === '#/kopfrechnen') html = kopfrechnenAnsicht();
  else if (hash === '#/meldungen') html = meldungenAnsicht();
  else if (hash === '#/wuensche') html = wunschlisteAnsicht();
  else if (hash === '#/bibliothek') html = bibliothekAnsicht();
  else if (hash === '#/import') html = importAnsicht();
  else if (hash === '#/einstellungen') html = einstellungenAnsicht();
  else if (hash === '#/einrichtung') html = einrichtungAnsicht();
  else if (hash === '#/willkommen') html = willkommenAnsicht();
  else if (hash === '#/lernen') html = lernenAnsicht();
  else if (hash === '#/impressum') html = impressumAnsicht();
  else if (hash === '#/datenschutz') html = datenschutzAnsicht();
  else html = nichtGefunden();
  app.innerHTML = (flash ? `<p class="hinweis">${esc(flash)}</p>` : '') + html;
  flash = null;
  app.querySelector('input[name="zahl"]')?.focus();
  erklaerungSichtbar();
}

/** Nach einer Antwort: Ragt die Erklärung unter die „Weiter“-Leiste, scrollt die Seite genau so weit, dass sie ganz lesbar ist. */
function erklaerungSichtbar() {
  const erklaerung = app.querySelector('.erklaerung');
  const leiste = app.querySelector('.weiter-leiste');
  if (!erklaerung || !leiste) return;
  const ueberstand = erklaerung.getBoundingClientRect().bottom - (leiste.getBoundingClientRect().top + 12);
  if (ueberstand > 0) window.scrollBy({ top: ueberstand + 4, behavior: 'smooth' });
}

/** Wird bei jedem Seitenwechsel aufgerufen; startet bei Bedarf ein neues Quiz. */
function route() {
  entwurf = null;
  if (location.hash === '#/import') importZustand = leererImport();
  if (location.hash === '#/bibliothek') {
    bibliothek = { ...bibliothek, meldung: null };
    bibliothekLaden();
  }
  if (location.hash === '#/ueben') uebenVorbereiten();
  const schwach = (location.hash || '').match(/^#\/ueben\/schwach(?:\/([^/]+))?$/);
  if (schwach) uebenVorbereiten({ deckId: schwach[1] ?? null });
  if (location.hash === '#/probe' && quiz?.modus !== 'probe') {
    location.hash = '#/';
    return;
  }
  const m = (location.hash || '').match(/^#\/quiz\/([^/]+)$/);
  if (m) quizVorbereiten(decodeURIComponent(m[1]));
  zeichne();
  window.scrollTo(0, 0);
}

function quizVorbereiten(appName) {
  const ziel = zielAppNamens(appName);
  if (!ziel) {
    quiz = null;
    return;
  }
  const f = freischaltung();
  const jetzt = uhr.jetzt();

  if (quiz?.modus === 'app' && quiz.appName === appName) {
    const laufendesGate = quiz.sitzung && !quiz.abgeschlossen;
    if (laufendesGate || f.istFreigeschaltet(appName)) return; // fortsetzen bzw. Freigabe-Ansicht behalten
  }

  const basis = { modus: 'app', appName, sitzung: null, letzte: null, abgeschlossen: false, phase: null, blockiert: null };
  if (f.istFreigeschaltet(appName)) {
    quiz = basis;
    return;
  }
  if (nachtruheGesperrt(jetzt, daten.settings.nachtruhe)) {
    quiz = { ...basis, blockiert: 'nacht' };
    return;
  }
  if (ziel.tageslimit > 0 && freischaltungenHeute(daten.tage, jetzt, appName) >= ziel.tageslimit) {
    quiz = { ...basis, blockiert: 'limit' };
    return;
  }
  const karten = baueGateKarten({
    settings: daten.settings,
    karten: daten.cards,
    appName,
    jetzt,
    freischaltungenHeute: freischaltungenHeute(daten.tage, jetzt),
    pausierteDecks: pausierteDeckIds(),
  });
  quiz = { ...basis, sitzung: new GateSitzung({ zielApp: ziel, gezogeneKarten: karten, uhr, lernmodus: daten.settings.lernmodus }), frageStart: Date.now() };
}

/** filter: null = freies Üben, { deckId } = nur Schwachstellen (eines Decks oder aller aktiven Decks). */
function neueUebenRunde(filter = null) {
  const pausiert = pausierteDeckIds();
  const karten = filter
    ? schwachstellen(daten.cards.filter((k) => (filter.deckId ? k.deckId === filter.deckId : !pausiert.includes(k.deckId))), 10)
    : baueGateKarten({ settings: daten.settings, karten: daten.cards, appName: null, jetzt: uhr.jetzt(), anzahl: 10, pausierteDecks: pausiert });
  quiz = {
    modus: 'ueben',
    filter,
    vorher: new Map(karten.map((k) => [k.id, k])), // Stand vor der Runde (nur Schwachstellen: der Zeitplan wird geschont)
    appName: 'Üben',
    sitzung: new GateSitzung({ zielApp: { name: 'Üben', urlScheme: 'ueben://' }, gezogeneKarten: karten, uhr, lernmodus: daten.settings.lernmodus }),
    frageStart: Date.now(),
    letzte: null,
    abgeschlossen: false,
  };
}

/** Probelauf durch alle Karten eines Decks – nur im Arbeitsspeicher, ohne Boxen und Statistik. */
function neuerProbelauf(titel, karten, zurueck) {
  quiz = {
    modus: 'probe',
    titel,
    zurueck,
    karten,
    sitzung: new ProbeSitzung({ karten }),
    letzte: null,
    abgeschlossen: false,
    gemeldet: new Set(),
  };
  if (location.hash === '#/probe') {
    zeichne();
    window.scrollTo(0, 0);
  } else location.hash = '#/probe';
}

function uebenVorbereiten(filter = null) {
  const art = (f) => (f ? `schwach:${f.deckId ?? ''}` : '');
  if (quiz?.modus === 'ueben' && quiz.sitzung && !quiz.abgeschlossen && art(quiz.filter) === art(filter)) return; // laufende Runde fortsetzen
  neueUebenRunde(filter);
}

/** Das Quiz ist bestanden: ggf. erst die Bremse, sonst direkt freischalten. */
function quizBestanden() {
  if (quiz.modus !== 'app') {
    quiz.abgeschlossen = true;
    return;
  }
  const ziel = zielAppNamens(quiz.appName);
  if (['absicht', 'kauf'].includes(ziel?.bremse)) {
    quiz.phase = 'bremse';
    quiz.bremseStart = Date.now();
    if (ziel.bremse === 'absicht') {
      // Nur den Knopf freigeben (kein Neuzeichnen, sonst ginge getippter Text verloren)
      setTimeout(() => {
        const knopf = document.getElementById('bremse-weiter');
        if (knopf && quiz?.phase === 'bremse') {
          knopf.disabled = false;
          knopf.textContent = `Weiter zu ${ziel.name}`;
        }
      }, BREMSE_PAUSE_MS + 50);
    }
    return;
  }
  quizAbschliessen();
}

function quizAbschliessen() {
  freischaltung().gateAbschliessen(quiz.sitzung);
  erfasseFreischaltung(daten.tage, { zeit: uhr.jetzt(), app: quiz.appName });
  sichern();
  quiz.abgeschlossen = true;
  quiz.phase = null;
}

// --- Aktionen (Klicks) ---

/** Sekunden, seit die aktuelle Frage angezeigt wird (Signal für den Lernmodus „intelligent“). */
function sekundenSeitFrage() {
  return quiz?.frageStart ? (Date.now() - quiz.frageStart) / 1000 : undefined;
}

/** Merkt sich die Antwort; Probelauf zählt nicht für Boxen und Statistik. */
function antwortVerbuchen(frage, ergebnis) {
  quiz.letzte = { frage, ergebnis };
  if (quiz.modus !== 'probe') {
    zaehleAntwort(ergebnis);
    const stand = quiz.sitzung.aktualisierteKarten;
    kartenSpeichern(quiz.filter ? zeitplanSchonen(stand, quiz.vorher, uhr.jetzt()) : stand);
  }
  zeichne();
}

/** Fügt Vorschläge dem Formular-Entwurf hinzu (ohne schon vorhandene Namen). */
function vorschlagHinzu(liste) {
  const form = app.querySelector('form[data-form="einstellungen"]');
  if (!form) return;
  entwurf = formAusFormular(form);
  const namen = new Set(entwurf.apps.map((a) => a.name.trim().toLowerCase()));
  for (const a of liste) {
    if (namen.has(a.name.toLowerCase())) continue;
    namen.add(a.name.toLowerCase());
    entwurf.apps.push({ name: a.name, urlScheme: a.urlScheme, bremse: 'keine', tageslimit: 0, decks: null });
  }
  zeichne();
}

const aktionen = {
  antwort({ index }) {
    const sitzung = quiz?.sitzung;
    if (!sitzung || quiz.letzte || !sitzung.aktuelleFrage || sitzung.aktuelleFrage.eingabe) return;
    const frage = sitzung.aktuelleFrage;
    antwortVerbuchen(frage, sitzung.beantworte(Number(index), { sekunden: sekundenSeitFrage() }));
  },

  reihenfolgeWahl({ index }) {
    const sitzung = quiz?.sitzung;
    if (!sitzung || quiz.letzte || !sitzung.aktuelleFrage?.reihenfolgeRichtig) return;
    const frage = sitzung.aktuelleFrage;
    const wahl = [...(quiz.wahl ?? [])];
    const i = Number(index);
    if (!Number.isInteger(i) || wahl.includes(i) || i < 0 || i >= frage.antworten.length) return;
    wahl.push(i);
    if (wahl.length < frage.antworten.length) {
      quiz.wahl = wahl;
      zeichne();
      return;
    }
    quiz.wahl = [];
    antwortVerbuchen(frage, sitzung.beantworteReihenfolge(wahl, { sekunden: sekundenSeitFrage() }));
  },

  reihenfolgeZurueck() {
    if (!quiz?.wahl?.length || quiz.letzte) return;
    quiz.wahl = quiz.wahl.slice(0, -1);
    zeichne();
  },

  nichtOeffnen() {
    if (!quiz || quiz.modus !== 'app') return;
    const name = quiz.appName;
    erfasseNichtGeoeffnet(daten.tage, { zeit: uhr.jetzt() });
    sichern();
    const heute = nichtGeoeffnetHeute(daten.tage, uhr.jetzt());
    const woche = uebersicht(daten.tage, uhr.jetzt(), 7).nichtGeoeffnet;
    quiz = null;
    flash = `Stark! ${name} bleibt zu. Heute ${heute}× nicht geöffnet, in den letzten 7 Tagen ${woche}×.`;
    if (location.hash === '#/') zeichne();
    else location.hash = '#/';
  },

  melden({ id }) {
    const info = meldeInfo(id);
    if (!info) return;
    if (istGemeldet(daten.meldungen, info.deck, info.frage)) {
      daten.meldungen = meldungEntfernen(daten.meldungen, info.deck, info.frage);
      quiz.gemeldet?.delete(id);
    } else {
      daten.meldungen = meldungHinzu(daten.meldungen, { ...info, zeit: uhr.jetzt() });
      quiz.gemeldet?.add(id);
    }
    sichern();
    zeichne();
  },

  meldungLoeschen({ id }) {
    daten.meldungen = daten.meldungen.filter((m) => m.id !== id);
    sichern();
    zeichne();
  },

  meldungenLeeren() {
    if (daten.meldungen.length === 0 || !confirm('Alle gemeldeten Karten aus der Liste entfernen?')) return;
    daten.meldungen = [];
    sichern();
    zeichne();
  },

  weiter() {
    if (!quiz?.sitzung) return;
    quiz.letzte = null;
    quiz.wahl = [];
    quiz.frageStart = Date.now();
    if (quiz.sitzung.istBestanden) quizBestanden();
    zeichne();
    window.scrollTo(0, 0);
  },

  probeStart({ deck }) {
    const d = daten.decks.find((x) => x.id === deck);
    if (!d) return;
    neuerProbelauf(d.name, daten.cards.filter((k) => k.deckId === d.id), `#/deck/${d.id}`);
  },

  bibliothekKategorie({ kategorie }) {
    bibliothekFilter.kategorie = kategorie || null;
    zeichne();
  },

  async probeBibliothek({ datei }, knopf) {
    if (!/^[\w.-]+\.json$/.test(datei)) return;
    knopf.disabled = true;
    try {
      const antwort = await fetch(`decks/${datei}`, { cache: 'no-store' });
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      const deck = parseDeck(await antwort.text());
      const karten = deck.karten
        .filter((k) => !k.fehler)
        .map((k) => neueKarte({ deckId: 'probe', typ: k.typ, frage: k.frage, antworten: k.antworten, indexRichtig: k.indexRichtig, erklaerung: k.erklaerung }));
      neuerProbelauf(deck.name, karten, '#/bibliothek');
    } catch {
      bibliothek.meldung = 'Das Deck konnte nicht geladen werden. Bist du online?';
      zeichne();
    }
  },

  willkommenWeiter({ ziel }) {
    daten.settings.willkommenGesehen = true;
    sichern();
    const erlaubt = ['#/bibliothek', '#/einrichtung', '#/'];
    const neu = erlaubt.includes(ziel) ? ziel : '#/';
    if (location.hash === neu) zeichne();
    else location.hash = neu;
  },

  systemWahl({ system }) {
    einrichtungSystem = system === 'android' ? 'android' : 'ios';
    zeichne();
  },

  probeNochmal() {
    if (quiz?.modus === 'probe') neuerProbelauf(quiz.titel, quiz.karten, quiz.zurueck);
  },

  skip() {
    if (!quiz || quiz.modus !== 'app') return;
    if (!confirm('Notfall-Skip jetzt nutzen? Das geht nur 1× pro Tag.')) return;
    try {
      freischaltung().notfallSkipNutzen(quiz.appName);
    } catch (fehler) {
      if (fehler instanceof FreischaltungFehler) return zeichne();
      throw fehler;
    }
    erfasseFreischaltung(daten.tage, { zeit: uhr.jetzt(), app: quiz.appName, skip: true });
    sichern();
    quiz = { modus: 'app', appName: quiz.appName, sitzung: quiz.sitzung, letzte: null, abgeschlossen: true, ueberSkip: true, phase: null, blockiert: null };
    zeichne();
  },

  quizNeu({ app: appName }) {
    quiz = null;
    quizVorbereiten(appName);
    zeichne();
  },

  statistikZeitraum({ tage }) {
    statistikAuswahl.tage = Number(tage);
    statistikAuswahl.tag = null;
    zeichne();
  },

  statistikTag({ tag }) {
    statistikAuswahl.tag = tag;
    zeichne();
  },

  uebenNochmal() {
    neueUebenRunde(quiz?.filter ?? null);
    zeichne();
  },

  wunschErledigt({ id, status }) {
    daten.wuensche = wunschAbschliessen(daten.wuensche, id, status, uhr.jetzt());
    sichern();
    zeichne();
  },

  generatorPause({ id }) {
    if (!GENERATOREN.some((g) => g.id === id)) return;
    const liste = daten.settings.pausierteGeneratoren ?? [];
    daten.settings.pausierteGeneratoren = liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];
    sichern();
    zeichne();
  },

  deckPause({ id }) {
    const deck = daten.decks.find((d) => d.id === id);
    if (!deck) return;
    daten.decks = daten.decks.map((d) => (d.id === id ? { ...d, pausiert: !d.pausiert } : d));
    sichern();
    zeichne();
  },

  deckLoeschen({ id }) {
    const deck = daten.decks.find((d) => d.id === id);
    if (!deck) return;
    const anzahl = daten.cards.filter((k) => k.deckId === id).length;
    if (!confirm(`Deck „${deck.name}“ mit ${anzahl} Karten wirklich löschen?`)) return;
    daten.decks = daten.decks.filter((d) => d.id !== id);
    daten.cards = daten.cards.filter((k) => k.deckId !== id);
    for (const [name, ids] of Object.entries(daten.settings.appDecks)) {
      const rest = ids.filter((x) => x !== id);
      if (rest.length > 0) daten.settings.appDecks[name] = rest;
      else delete daten.settings.appDecks[name];
    }
    sichern();
    location.hash = '#/';
  },

  karteLoeschen({ id }) {
    const karte = daten.cards.find((k) => k.id === id);
    if (!karte || !confirm('Karte wirklich löschen?')) return;
    daten.cards = daten.cards.filter((k) => k.id !== id);
    sichern();
    location.hash = `#/deck/${karte.deckId}`;
  },

  appHinzu() {
    const form = app.querySelector('form[data-form="einstellungen"]');
    if (!form) return;
    entwurf = formAusFormular(form);
    entwurf.apps.push({ name: '', urlScheme: '', bremse: 'keine', tageslimit: 0, decks: null });
    zeichne();
  },

  appVorschlag({ name }) {
    vorschlagHinzu(BELIEBTE_APPS.filter((a) => a.name === name));
  },

  appVorschlagAlle() {
    vorschlagHinzu(BELIEBTE_APPS);
  },

  appEntfernen({ index }) {
    const form = app.querySelector('form[data-form="einstellungen"]');
    if (!form) return;
    entwurf = formAusFormular(form);
    entwurf.apps.splice(Number(index), 1);
    zeichne();
  },

  async bibliothekHinzu({ datei }, knopf) {
    if (!/^[\w.-]+\.json$/.test(datei)) return;
    knopf.disabled = true;
    try {
      const antwort = await fetch(`decks/${datei}`, { cache: 'no-store' });
      if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
      const deck = parseDeck(await antwort.text());
      const r = mergeImport(daten, deck.name, deck.karten.filter((k) => !k.fehler), uhr.jetzt());
      daten = r.daten;
      sichern();
      bibliothek.meldung = `${deck.name}: ${importZusammenfassung(r)}`;
    } catch {
      bibliothek.meldung = 'Das Deck konnte nicht geladen werden. Bist du online?';
    }
    if (location.hash === '#/bibliothek') zeichne();
  },

  promptKopieren(_daten, knopf) {
    return this.feldKopieren({ feld: 'prompttext' }, knopf);
  },

  async feldKopieren({ feld: feldId }, knopf) {
    const feld = document.getElementById(feldId);
    try {
      await navigator.clipboard.writeText(feld.value);
    } catch {
      feld.focus();
      feld.select();
      document.execCommand?.('copy');
    }
    knopf.textContent = 'Kopiert ✓';
  },

  importAbbrechen() {
    importZustand = leererImport();
    zeichne();
  },

  export() {
    const blob = new Blob([exportJson(daten)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `lerngate-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    daten.settings.letztesBackup = uhr.jetzt();
    sichern();
  },
};

function importZusammenfassung(r) {
  const teile = [`${r.hinzugefuegt} neu`];
  if (r.aktualisiert) teile.push(`${r.aktualisiert} aktualisiert`);
  if (r.uebersprungen) teile.push(`${r.uebersprungen} schon vorhanden`);
  return teile.join(', ');
}

async function bibliothekLaden() {
  bibliothek = { ...bibliothek, status: 'laedt' };
  try {
    const antwort = await fetch('decks/index.json', { cache: 'no-store' });
    if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
    bibliothek = { ...bibliothek, status: 'fertig', eintraege: (await antwort.json()).decks ?? [] };
  } catch {
    bibliothek = { ...bibliothek, status: 'fehler' };
  }
  if (location.hash === '#/bibliothek') zeichne();
}

// --- Formulare ---

const formulare = {
  neuesDeck(form) {
    const name = form.elements.name.value.trim();
    if (!name) return;
    const deck = neuesDeck({ name });
    daten.decks.push(deck);
    sichern();
    location.hash = `#/deck/${deck.id}`;
  },

  zahlAntwort(form) {
    const sitzung = quiz?.sitzung;
    if (!sitzung || quiz.letzte || !sitzung.aktuelleFrage?.eingabe) return;
    const frage = sitzung.aktuelleFrage;
    antwortVerbuchen(frage, sitzung.beantworteZahl(form.elements.zahl.value, { sekunden: sekundenSeitFrage() }));
  },

  bremse(form) {
    if (quiz?.phase !== 'bremse') return;
    const ziel = zielAppNamens(quiz.appName);
    if (ziel?.bremse === 'kauf') {
      const wunsch = neuerWunsch(form.elements.text.value, uhr.jetzt(), daten.settings.kaufbremseStunden);
      if (wunsch) {
        daten.wuensche = wunschHinzufuegen(daten.wuensche, wunsch);
        flash = `Notiert. Frühestens in ${daten.settings.kaufbremseStunden} Stunden kaufen: ${wunsch.text}`;
      }
    } else if (Date.now() - quiz.bremseStart < BREMSE_PAUSE_MS) {
      return; // Pause noch nicht vorbei
    }
    quizAbschliessen();
    zeichne();
  },

  wunschNotieren(form) {
    const wunsch = neuerWunsch(form.elements.text.value, uhr.jetzt(), daten.settings.kaufbremseStunden);
    if (!wunsch) return;
    daten.wuensche = wunschHinzufuegen(daten.wuensche, wunsch);
    sichern();
    zeichne();
  },

  importPruefen(form) {
    importZustand.text = form.elements.text.value;
    try {
      importZustand.vorschau = parseDeck(importZustand.text);
      importZustand.fehler = null;
    } catch (fehler) {
      if (!(fehler instanceof DeckFormatFehler)) throw fehler;
      importZustand.vorschau = null;
      importZustand.fehler = fehler.message;
    }
    zeichne();
    window.scrollTo(0, 0);
  },

  importSpeichern(form) {
    const karten = [...form.querySelectorAll('input[name="karte"]:checked')].map((c) => importZustand.vorschau.karten[Number(c.value)]);
    if (karten.length === 0) {
      alert('Du hast keine Karte ausgewählt.');
      return;
    }
    const r = mergeImport(daten, form.elements.deckname.value, karten, uhr.jetzt());
    daten = r.daten;
    sichern();
    flash = `Gespeichert: ${importZusammenfassung(r)}.`;
    importZustand = leererImport();
    location.hash = `#/deck/${r.deck.id}`;
  },

  deckUmbenennen(form) {
    const deck = daten.decks.find((d) => d.id === form.dataset.id);
    const name = form.elements.name.value.trim();
    if (!deck || !name) return;
    deck.name = name;
    sichern();
    zeichne();
  },

  karteSpeichern(form) {
    const antworten = [0, 1, 2, 3].map((i) => form[`a${i}`].value.trim());
    const indexRichtig = Number(form.richtig.value);
    const frage = form.frage.value.trim();
    const quelle = form.quelle.value.trim() || null;
    const erklaerung = form.elements.erklaerung.value.trim() || null;
    const fehler = form.querySelector('#fehler');

    const bestehend = daten.cards.find((k) => k.id === form.dataset.id);
    const karte = bestehend
      ? { ...bestehend, frage, antworten, indexRichtig, quelle, erklaerung }
      : neueKarte({ deckId: form.dataset.deck, frage, antworten, indexRichtig, quelle, erklaerung });

    if (karte.typ === 'luecke' && !frage.includes(LUECKE)) {
      fehler.textContent = `In der Frage muss die Lücke ${LUECKE} vorkommen.`;
      return;
    }
    if (!istGueltig(karte)) {
      fehler.textContent = 'Bitte Frage und alle 4 Antworten ausfüllen und die richtige markieren.';
      return;
    }
    if (new Set(antworten.map((a) => a.toLowerCase())).size < 4) {
      fehler.textContent = 'Zwei Antworten sind gleich – jede Antwort muss sich unterscheiden.';
      return;
    }

    daten.cards = bestehend ? daten.cards.map((k) => (k.id === karte.id ? karte : k)) : [...daten.cards, karte];
    sichern();
    location.hash = `#/deck/${karte.deckId}`;
  },

  einstellungen(form) {
    const fehler = form.querySelector('#fehler');
    const meldung = formUebernehmen(formAusFormular(form));
    if (meldung) {
      fehler.textContent = meldung;
      return;
    }
    entwurf = null;
    sichern();
    location.hash = '#/';
  },
};

// --- Events ---

app.addEventListener('click', (e) => {
  const ziel = e.target.closest('[data-aktion]');
  if (ziel && aktionen[ziel.dataset.aktion]) aktionen[ziel.dataset.aktion](ziel.dataset, ziel);
});

app.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const ziel = e.target.closest('[role="button"][data-aktion]');
  if (!ziel || !aktionen[ziel.dataset.aktion]) return;
  e.preventDefault();
  aktionen[ziel.dataset.aktion](ziel.dataset, ziel);
});

app.addEventListener('input', (e) => {
  if (e.target.id !== 'bibliothekSuche') return;
  bibliothekFilter.suche = e.target.value;
  const liste = document.getElementById('bibliothekListe');
  if (liste) liste.innerHTML = bibliothekListe();
});

app.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  formulare[form.dataset.form]?.(form);
});

app.addEventListener('change', async (e) => {
  if (e.target.id === 'deckdatei') {
    const datei = e.target.files?.[0];
    if (datei) document.getElementById('importtext').value = await datei.text();
    return;
  }
  if (e.target.id !== 'import') return;
  const fehler = document.getElementById('importfehler');
  const datei = e.target.files?.[0];
  if (!datei) return;
  try {
    const neu = importJson(await datei.text());
    if (!confirm(`Backup einspielen? Das ersetzt alle aktuellen Daten durch ${neu.decks.length} Decks und ${neu.cards.length} Karten.`)) {
      e.target.value = '';
      return;
    }
    daten = neu;
    quiz = null;
    sichern();
    location.hash = '#/';
    zeichne();
  } catch {
    fehler.textContent = 'Das ist keine gültige 42-Sicherung.';
  }
});

window.addEventListener('hashchange', route);
setInterval(() => {
  if (ticker) zeichne();
}, 15000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && ticker) zeichne();
});

navigator.storage?.persist?.();

// Offline-Fähigkeit: Der Service Worker legt die App-Dateien zwischen (nur bei https oder localhost).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Direktlink für Kurzbefehle: https://…/?quiz=Reddit öffnet das Quiz für "Reddit". Anders als ein
// "#/quiz/…" am Ende lädt die Adresse mit Abfrage die Seite immer neu und geht nicht verloren,
// wenn Safari die Seite noch offen hat.
const direktQuiz = new URLSearchParams(location.search).get('quiz');
if (direktQuiz) history.replaceState(null, '', `${location.pathname}#/quiz/${encodeURIComponent(direktQuiz)}`);

route();
