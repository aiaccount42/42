// Zeitquelle: alles, was "jetzt" braucht, fragt die Uhr – so lässt sich Zeit in Tests steuern.
// Zeitpunkte sind überall Millisekunden seit 1970 (Date.now()).

export const systemUhr = { jetzt: () => Date.now() };

/** Steuerbare Uhr für Tests. */
export function festeUhr(start) {
  let zeit = start;
  return {
    jetzt: () => zeit,
    setze(ms) {
      zeit = ms;
    },
    weiterSekunden(sekunden) {
      zeit += sekunden * 1000;
    },
    weiterMinuten(minuten) {
      zeit += minuten * 60_000;
    },
  };
}
