// Service Worker: legt die App-Dateien zwischen, damit LernGate auch ohne Netz startet.
// Strategie "Netz zuerst": Online bekommst du immer die neueste Fassung, offline die zuletzt geladene.
// `npm run bauen` ersetzt VERSION und DATEIEN (beim lokalen Server bleibt es bei den Platzhaltern).
const VERSION = 'dev';
const DATEIEN = [];

const CACHE = `lerngate-${VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(DATEIEN))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('lerngate-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const anfrage = e.request;
  if (anfrage.method !== 'GET' || new URL(anfrage.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(anfrage)
      .then((antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone();
          caches.open(CACHE).then((cache) => cache.put(anfrage, kopie));
        }
        return antwort;
      })
      .catch(() =>
        caches
          .match(anfrage, { ignoreSearch: true })
          .then((treffer) => treffer || (anfrage.mode === 'navigate' ? caches.match('index.html') : Response.error())),
      ),
  );
});
