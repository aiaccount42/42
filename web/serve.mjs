// Minimaler statischer Server für die Entwicklung: node serve.mjs  (Port per PORT=9000 änderbar)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT) || 8080;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// Nur diese Pfade werden ausgeliefert (kein package.json, keine Tests, kein serve.mjs).
const erlaubt = (pfad) =>
  ['index.html', 'manifest.webmanifest', 'sw.js'].includes(pfad) || ['js/', 'css/', 'decks/', 'icons/'].some((ordner) => pfad.startsWith(ordner));

const server = http.createServer(async (anfrage, antwort) => {
  try {
    let pfad = decodeURIComponent(new URL(anfrage.url, 'http://x').pathname).replace(/^\/+/, '');
    if (pfad === '') pfad = 'index.html';
    const datei = resolve(join(wurzel, normalize(pfad)));
    if (!datei.startsWith(wurzel + sep) || !erlaubt(pfad)) {
      antwort.writeHead(404).end('Nicht gefunden');
      return;
    }
    if (!(await stat(datei)).isFile()) throw new Error('keine Datei');
    antwort.writeHead(200, {
      'Content-Type': mime[extname(datei)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    antwort.end(await readFile(datei));
  } catch {
    antwort.writeHead(404).end('Nicht gefunden');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`42 läuft:\n  Dieser Rechner:  http://localhost:${port}`);
  for (const eintraege of Object.values(networkInterfaces())) {
    for (const e of eintraege ?? []) {
      if (e.family === 'IPv4' && !e.internal) console.log(`  Im selben WLAN:  http://${e.address}:${port}`);
    }
  }
});
