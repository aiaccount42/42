// Seite „So lernst du am besten“ (#/lernen): Lernforschung in Kürze, mit Quellen und ehrlichen Grenzen.
// Die Aussagen stützen sich auf die unten genannten Arbeiten. Wo die Datenlage dünn ist, steht es dabei.

export const QUELLEN = [
  { kurz: 'Cepeda et al. 2008', text: 'Spacing effects in learning: a temporal ridgeline of optimal retention (Psychological Science)', url: 'https://pubmed.ncbi.nlm.nih.gov/19076480/' },
  { kurz: 'Dunlosky et al. 2013', text: 'Improving students’ learning with effective learning techniques (Psychological Science in the Public Interest)', url: 'https://doi.org/10.1177/1529100612453266' },
  { kurz: 'Roediger & Karpicke 2006', text: 'Test-enhanced learning: taking memory tests improves long-term retention (Psychological Science)', url: 'https://doi.org/10.1111/j.1467-9280.2006.01693.x' },
  { kurz: 'Brunmair & Richter 2019', text: 'Similarity matters: a meta-analysis of interleaved learning and its moderators (Psychological Bulletin)', url: 'https://doi.org/10.1037/bul0000209' },
  { kurz: 'Rohrer et al. 2020', text: 'A randomized controlled trial of interleaved mathematics practice (Journal of Educational Psychology)', url: 'https://doi.org/10.1037/edu0000367' },
  { kurz: 'Kornell et al. 2009', text: 'Unsuccessful retrieval attempts enhance subsequent learning (Journal of Experimental Psychology: Learning, Memory, and Cognition)', url: 'https://doi.org/10.1037/a0015729' },
  { kurz: 'Butterfield & Metcalfe 2001', text: 'Errors committed with high confidence are hypercorrected (Journal of Experimental Psychology: Learning, Memory, and Cognition)', url: 'https://doi.org/10.1037/0278-7393.27.6.1491' },
  { kurz: 'Simons et al. 2016', text: 'Do “brain-training” programs work? (Psychological Science in the Public Interest)', url: 'https://doi.org/10.1177/1529100616661983' },
  { kurz: 'Raichle 2006', text: 'The brain’s dark energy (Science)', url: 'https://doi.org/10.1126/science.1134405' },
  { kurz: 'ACTIVE-Studie 2026', text: 'Speed training and dementia incidence over 20 years (Alzheimer’s & Dementia: Translational Research & Clinical Interventions)', url: 'https://www.hopkinsmedicine.org/news/newsroom/news-releases/2026/02/cognitive-speed-training-linked-to-lower-dementia-incidence-up-to-20-years-later' },
];

const quellenListe = () =>
  QUELLEN.map((q) => `<li><strong>${q.kurz}:</strong> <a href="${q.url}" target="_blank" rel="noopener">${q.text}</a></li>`).join('');

export function lernenAnsicht() {
  return `
    <h1>So lernst du mit 42 am besten</h1>
    <p class="slogan">Das stützt sich auf Lernforschung. Wo die Datenlage dünn ist, steht es dabei.</p>

    <h2>Die fünf Regeln</h2>
    <ol class="schritte">
      <li><strong class="lead">Kurz und oft statt selten und lang.</strong> Wiederhole mit wachsenden Abständen, kurz bevor du etwas vergisst.</li>
      <li><strong class="lead">Abfragen statt Wiederlesen.</strong> Sich Wissen aus dem Kopf zu holen, bringt langfristig mehr als Nachlesen.</li>
      <li><strong class="lead">Themen mischen.</strong> Lass mehrere Decks gleichzeitig aktiv, statt ein Deck nach dem anderen durchzuziehen.</li>
      <li><strong class="lead">Fehler sind okay.</strong> Rate ruhig und lies danach die Erklärung.</li>
      <li><strong class="lead">Genug schlafen.</strong> Schlaf festigt Gelerntes, Schlafmangel schadet dem Behalten.</li>
    </ol>

    <h2>1. Kurz und oft</h2>
    <p>Verteiltes Wiederholen gehört zu den am besten belegten Lernmethoden (Dunlosky 2013). Der ideale Abstand hängt davon ab, wie lange du etwas behalten willst. Grob: Soll es eine Woche halten, wiederhole nach ein bis drei Tagen. Soll es ein Jahr halten, nach etwa drei bis fünf Wochen (Cepeda 2008). Zu kurze Abstände schaden mehr als etwas zu lange.</p>
    <p class="klein"><strong>In 42:</strong> Im Lernmodus „Intelligent“ (Einstellungen) kommt jede Karte nach 1, dann 3 Tagen und danach in wachsenden Abständen wieder. Das passiert automatisch.</p>

    <h2>2. Abfragen schlägt Wiederlesen</h2>
    <p>Wer sich Wissen aktiv abruft, behält es langfristig deutlich besser als durch erneutes Lesen oder Markieren (Roediger & Karpicke 2006, Dunlosky 2013). Kurzfristig fühlt sich Lesen besser an. Nach ein paar Tagen kippt das.</p>
    <p class="klein"><strong>In 42:</strong> Jedes Quiz ist ein Abruf. Probier zuerst selbst, bevor du Antworten anschaust.</p>

    <h2>3. Mischen oder Deck für Deck?</h2>
    <p>Gemischtes Üben („Interleaving“) bringt in Studien meist mehr für das Behalten nach Tagen und Wochen als Block-Lernen, auch wenn es sich schwerer anfühlt. Eine Meta-Analyse über 59 Studien fand einen mittleren Effekt (Brunmair & Richter 2019). In einem Schulversuch mit Mathe lagen die Gemischt-Übenden einen Monat später bei 61 % statt 38 % (Rohrer 2020).</p>
    <p>Am stärksten wirkt es, wenn man ähnliche Dinge auseinanderhalten muss. Bei reinen Fakten ist die Datenlage dünner, aber eher positiv. Dein Gefühl täuscht dich dabei: Block-Lernen fühlt sich erfolgreicher an.</p>
    <p class="klein"><strong>In 42:</strong> Jedes Quiz mischt automatisch alle aktiven Decks. Aktiviere lieber drei bis sechs Decks gleichzeitig. Ein neues Deck kannst du vorher im Probelauf kennenlernen. Decks, auf die du keine Lust mehr hast, pausierst du.</p>

    <h2>4. Fehler sind erwünscht</h2>
    <p>Wer rät und danach die richtige Antwort sieht, behält sie besser als jemand, der nur liest (Kornell et al. 2009). Fehler, bei denen man sich sehr sicher war, werden besonders gut korrigiert (Butterfield & Metcalfe 2001).</p>
    <p class="klein"><strong>In 42:</strong> Lies die Erklärung auch kurz, wenn du richtig lagst. Falsche Karten kommen schon am nächsten Tag wieder.</p>

    <h2>5. Schlaf</h2>
    <p>Schlaf nach dem Lernen festigt Gedächtnis, und Schlafentzug nach dem Lernen schadet dem Behalten. Die Effekte sind klein bis mittel und die Studienqualität schwankt. Wichtiger als der genaue Zeitpunkt ist, überhaupt genug zu schlafen.</p>
    <p class="klein"><strong>In 42:</strong> Mit der Nachtruhe (Einstellungen) bremst du Quiz und Scrollen spät abends.</p>

    <h2>Die richtige Dosis</h2>
    <p>Lieber mehrere kurze Runden am Tag als ein Marathon. Standard sind zwei neue Karten pro Quiz. Fühlst du dich überrannt, stelle „Neue Karten pro Quiz“ auf 1.</p>

    <h2>Was Gehirnjogging kann – und was nicht</h2>
    <ul class="punkte">
      <li><strong class="lead">Training wirkt auf die trainierte Aufgabe.</strong> Dass sich das breit auf Alltag oder Intelligenz überträgt, ist laut einer großen Übersichtsarbeit bisher begrenzt belegt (Simons 2016).</li>
      <li><strong class="lead">Eine Langzeitstudie macht Hoffnung:</strong> In der ACTIVE-Studie hatten Teilnehmende mit einem bestimmten Tempo-Training nach 20 Jahren etwa 25 % weniger Demenzdiagnosen (2026). Das gilt nur für diese eine von drei Trainingsarten und ist noch nicht wiederholt.</li>
      <li><strong class="lead">Kalorien:</strong> Das Gehirn verbraucht rund 20 % deiner Ruheenergie, aber Denkarbeit erhöht das nur um wenige Prozent (Raichle 2006). Quizzen ist kein Abnehm-Trick.</li>
      <li><strong class="lead">Wohlbefinden:</strong> Menschen, die regelmäßig Neues lernen, berichten in Studien von mehr Wohlbefinden. Das ist überwiegend ein Zusammenhang, kein Beweis für Ursache und Wirkung.</li>
    </ul>
    <p>42 ist also kein Wundermittel für das Gehirn. Es hilft dir, Wissen zu behalten und Scroll-Zeit zu bremsen.</p>

    <h2>Quellen</h2>
    <ul class="punkte klein">${quellenListe()}</ul>
    <a class="knopf sekundaer" href="#/">Zur Startseite</a>`;
}
