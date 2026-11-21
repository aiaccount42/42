// 1. prüft alle Decks in decks/ und erzeugt decks/index.json (für die Bibliothek)
// 2. kopiert nur die Dateien nach dist/, die online gehören (keine Tests, kein Server, keine package.json)
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDeck } from './js/core/deckformat.js';
import { ANBIETER, fehlendeAngaben } from './js/rechtliches.js';

const wurzel = fileURLToPath(new URL('.', import.meta.url));

const dateien = (await readdir(`${wurzel}decks`)).filter((d) => d.endsWith('.json') && d !== 'index.json').sort();
const eintraege = [];
const KATEGORIEN = ['Körper & Fitness', 'Finanzen & Recht', 'Wirtschaft & Mathe', 'Alltag & Haushalt', 'Technik & Digital', 'Kopf & Verhalten', 'Wissenschaft & Natur', 'Welt & Kultur', 'Tiere'];
let fehlerAnzahl = 0;

for (const datei of dateien) {
  const deck = parseDeck(await readFile(`${wurzel}decks/${datei}`, 'utf8'));
  for (const karte of deck.karten.filter((k) => k.fehler)) {
    console.error(`${datei}: „${karte.frage}“ – ${karte.fehler}`);
    fehlerAnzahl += 1;
  }
  eintraege.push({ datei, name: deck.name, beschreibung: deck.beschreibung, kategorie: deck.kategorie, anzahl: deck.karten.length });
}
const rang = (k) => (KATEGORIEN.includes(k) ? KATEGORIEN.indexOf(k) : KATEGORIEN.length);
eintraege.sort((a, b) => rang(a.kategorie) - rang(b.kategorie) || a.name.localeCompare(b.name, 'de'));
if (fehlerAnzahl > 0) {
  console.error(`Abbruch: ${fehlerAnzahl} fehlerhafte Karte(n).`);
  process.exit(1);
}
await writeFile(`${wurzel}decks/index.json`, `${JSON.stringify({ decks: eintraege }, null, 2)}\n`);
console.log(`Bibliothek: ${eintraege.length} Decks, ${eintraege.reduce((s, e) => s + e.anzahl, 0)} Karten`);

const fehlendeRechtliches = fehlendeAngaben(ANBIETER);
if (fehlendeRechtliches.length) {
  console.warn(`\nWARNUNG: Impressum/Datenschutz sind noch nicht ausgefüllt (es fehlen: ${fehlendeRechtliches.join(', ')}).\nTrage deine Angaben in js/rechtliches.js ein, bevor du die App öffentlich teilst.\n`);
}

const ziel = `${wurzel}dist`;
await rm(ziel, { recursive: true, force: true });
await mkdir(ziel);
for (const eintrag of ['index.html', 'manifest.webmanifest', 'css', 'js', 'decks', 'icons']) {
  await cp(`${wurzel}${eintrag}`, `${ziel}/${eintrag}`, { recursive: true });
}
console.log(`Fertig: ${ziel}`);

// Service Worker: Dateiliste und Version einsetzen (neue Version = alter Zwischenspeicher wird verworfen)
async function dateienIn(ordner) {
  const ergebnis = [];
  for (const eintrag of await readdir(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) ergebnis.push(...(await dateienIn(pfad)));
    else ergebnis.push(relative(ziel, pfad));
  }
  return ergebnis;
}
const dateiListe = ['./', ...(await dateienIn(ziel)).sort()];
const version = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
let sw = await readFile(`${wurzel}sw.js`, 'utf8');
sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`).replace(/const DATEIEN = \[\];/, `const DATEIEN = ${JSON.stringify(dateiListe)};`);
await writeFile(`${ziel}/sw.js`, sw);
console.log(`Service Worker: Version ${version}, ${dateiListe.length} Dateien im Zwischenspeicher`);
