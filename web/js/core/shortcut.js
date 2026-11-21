// Brücke zur Kurzbefehle-App: Der Knopf "App öffnen" ruft einen Kurzbefehl auf, der sich den
// Ablaufzeitpunkt der Freischaltung merkt und dann die Ziel-App öffnet. Die Automation prüft
// damit, ob sie das Quiz zeigen muss (sonst käme nach dem Öffnen sofort wieder das Quiz).

const zwei = (n) => String(n).padStart(2, '0');

/** Ortszeit als Zahl jjjjMMttHHmm (z. B. 202610192215) – lässt sich in Kurzbefehlen als Zahl vergleichen. */
export function zeitZahl(ms) {
  const d = new Date(ms);
  return Number(`${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}${zwei(d.getHours())}${zwei(d.getMinutes())}`);
}

/**
 * Link zum Öffnen der Ziel-App. Ohne Kurzbefehl-Name: direkt das URL-Scheme.
 * Mit Name: shortcuts://run-shortcut?… mit JSON {app, url, bis} als Eingabe.
 * `bis` wird auf die nächste volle Minute aufgerundet, damit die Freischaltung nicht früher endet.
 */
export function freischaltLink({ kurzbefehl, zielApp, bis }) {
  const name = String(kurzbefehl ?? '').trim();
  if (!name) return zielApp.urlScheme;
  const aufgerundet = Math.ceil(bis / 60_000) * 60_000;
  const eingabe = JSON.stringify({ app: zielApp.name, url: zielApp.urlScheme, bis: zeitZahl(aufgerundet) });
  return `shortcuts://run-shortcut?name=${encodeURIComponent(name)}&input=text&text=${encodeURIComponent(eingabe)}`;
}
