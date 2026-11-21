// Impressum und Datenschutz als eigene Seiten (#/impressum, #/datenschutz).
// WICHTIG: Trage unten deine echten Angaben ein, bevor du die Seite öffentlich teilst. Solange ein Feld leer ist,
// zeigen die Seiten einen Platzhalter und einen roten Hinweis, und `npm run bauen` warnt.
// Das ist eine Vorlage und keine Rechtsberatung.

export const ANBIETER = {
  name: '', // Vor- und Nachname (bei Privatpersonen)
  strasse: '', // Straße und Hausnummer (ladungsfähige Anschrift, ein Postfach genügt nicht)
  ort: '', // Postleitzahl und Ort
  email: '', // E-Mail-Adresse, die du auch wirklich liest
};

const FELDER = [
  ['name', 'Vor- und Nachname'],
  ['strasse', 'Straße und Hausnummer'],
  ['ort', 'PLZ und Ort'],
  ['email', 'E-Mail-Adresse'],
];

const esc = (text) =>
  String(text).replace(/[&<>"']/g, (z) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[z]);

const text = (anbieter, feld, platzhalter) => (anbieter[feld]?.trim() ? esc(anbieter[feld].trim()) : `<mark class="platzhalter">[${platzhalter}]</mark>`);

/** Namen der Felder, die noch leer sind. */
export function fehlendeAngaben(anbieter = ANBIETER) {
  return FELDER.filter(([feld]) => !anbieter[feld]?.trim()).map(([, titel]) => titel);
}

const warnung = (anbieter) => {
  const fehlt = fehlendeAngaben(anbieter);
  return fehlt.length
    ? `<p class="hinweis fehler">Noch nicht fertig: Es fehlen ${esc(fehlt.join(', '))}. Trage sie in <code>js/rechtliches.js</code> ein und baue die App neu, bevor du sie öffentlich teilst.</p>`
    : '';
};

const anschrift = (a) => `${text(a, 'name', 'Vor- und Nachname')}<br />${text(a, 'strasse', 'Straße und Hausnummer')}<br />${text(a, 'ort', 'PLZ und Ort')}`;
const mail = (a) => (a.email?.trim() ? `<a href="mailto:${esc(a.email.trim())}">${esc(a.email.trim())}</a>` : text(a, 'email', 'E-Mail-Adresse'));

export function impressumAnsicht(anbieter = ANBIETER) {
  return `
    <h1>Impressum</h1>
    ${warnung(anbieter)}
    <h2>Angaben nach § 5 DDG</h2>
    <p>${anschrift(anbieter)}</p>
    <h2>Kontakt</h2>
    <p>E-Mail: ${mail(anbieter)}</p>
    <h2>Hinweis zu den Inhalten</h2>
    <p>42 ist ein privates Lernprojekt. Die Karten dienen der Allgemeinbildung und ersetzen keine medizinische, rechtliche oder finanzielle Beratung. Ich prüfe die Inhalte sorgfältig, Fehler lassen sich trotzdem nicht ausschließen. Wenn dir eine Karte falsch vorkommt, nutze im Quiz „Karte melden“ oder schreib mir eine E-Mail.</p>
    <p class="klein"><a href="#/datenschutz">Datenschutz</a> · <a href="#/">Zur Startseite</a></p>`;
}

export function datenschutzAnsicht(anbieter = ANBIETER) {
  return `
    <h1>Datenschutz</h1>
    ${warnung(anbieter)}
    <h2>Kurz gesagt</h2>
    <p>42 läuft komplett in deinem Browser. Es gibt kein Konto, keine Cookies, keine Werbung und keine Statistik-Dienste. Was du in 42 machst, wird nicht an mich oder andere übertragen.</p>

    <h2>Verantwortlich</h2>
    <p>${anschrift(anbieter)}<br />E-Mail: ${mail(anbieter)}</p>

    <h2>Was auf deinem Gerät gespeichert wird</h2>
    <p>Karten, Lernstand, Statistik, Einstellungen, Wunschliste und gemeldete Karten speichert 42 im Speicher deines Browsers (localStorage). Diese Daten verlassen dein Gerät nicht. Sie dienen nur dazu, die App zu betreiben. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO, weil die App ohne diese Daten nicht funktioniert.</p>
    <p>Du kannst sie jederzeit selbst löschen: in den Einstellungen deines Browsers unter „Websitedaten“ bzw. „Cookies und Websitedaten“. Ein Backup (Einstellungen → Backup exportieren) liegt nur bei dir.</p>

    <h2>Hosting bei Netlify</h2>
    <p>Die Webseite wird bei Netlify, Inc. (USA) gehostet. Wenn du 42 aufrufst, verarbeitet Netlify technisch notwendige Verbindungsdaten in Server-Logs, zum Beispiel deine IP-Adresse, Datum und Uhrzeit, die aufgerufene Datei und Angaben zu deinem Browser. Das ist nötig, um die Seite auszuliefern und sicher zu betreiben (Art. 6 Abs. 1 lit. f DSGVO). Netlify speichert diese Logs nur kurz. Mehr dazu steht in der <a href="https://www.netlify.com/privacy/" target="_blank" rel="noopener">Datenschutzerklärung von Netlify</a>. Dabei können Daten in die USA übermittelt werden.</p>

    <h2>Keine weiteren Dienste</h2>
    <p>42 lädt keine Schriften, Skripte oder Bilder von Dritten nach und bindet keine Tracking- oder Werbedienste ein. Wenn du in der Einrichtung eine Ziel-App öffnest, übernimmt das dein Betriebssystem, nicht 42.</p>

    <h2>Deine Rechte</h2>
    <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Weil ich keine Daten von dir habe, laufen diese Rechte meist ins Leere, schreib mir aber gern per E-Mail. Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der Behörde deines Bundeslandes.</p>
    <p class="klein"><a href="#/impressum">Impressum</a> · <a href="#/">Zur Startseite</a></p>`;
}
