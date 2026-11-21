import Foundation

/// Ein laufendes Gate: Karten werden nacheinander gestellt, falsch beantwortete
/// Karten kommen später im selben Gate erneut. Bestanden ist das Gate, sobald jede
/// gezogene Karte einmal richtig beantwortet wurde (bei 5 Karten = 5 richtige Antworten).
///
/// Leitner-Regeln:
/// - richtig beim ersten Mal: Box +1
/// - falsch: Box 1 (jedes Mal)
/// - später im selben Gate richtig: zählt fürs Bestehen, die Karte bleibt in Box 1
public struct GateSitzung {
    public static let keineKartenHinweis = "Erst Karten anlegen"

    public enum Status: Equatable {
        case laeuft
        case bestanden
        /// Keine gültigen Karten vorhanden – nur der Notfall-Skip bleibt.
        case keineKarten
    }

    /// Eine Frage, wie sie angezeigt wird (Antworten bereits gemischt).
    public struct Frage: Equatable {
        public let kartenId: UUID
        public let frage: String
        public let antworten: [String]
        public let indexRichtig: Int
    }

    public struct Antwortergebnis: Equatable {
        public let richtig: Bool
        public let gewaehlterIndex: Int
        public let indexRichtig: Int
    }

    public enum Fehler: Error, Equatable {
        case keineAktuelleFrage
        case ungueltigerAntwortIndex
    }

    public let zielApp: Zielapp
    public private(set) var richtigeAntworten = 0
    public private(set) var aktuelleFrage: Frage?

    private var karten: [UUID: Card]
    private let reihenfolge: [UUID]
    private var warteschlange: [UUID]
    private var falschBeantwortet: Set<UUID> = []
    private let wiederholungsAbstand: Int
    private let uhr: any Uhr
    private let calendar: Calendar
    private var zufall: Zufall

    /// - Parameter gezogeneKarten: bereits ausgewählte Karten (siehe `GateAuswahl`).
    ///   Ungültige Karten und doppelte IDs werden aussortiert.
    /// - Parameter wiederholungsAbstand: Wie viele andere Karten dazwischen liegen, bevor eine
    ///   falsche Karte erneut kommt (kürzer, wenn die Schlange kürzer ist).
    public init(
        zielApp: Zielapp,
        gezogeneKarten: [Card],
        wiederholungsAbstand: Int = 2,
        uhr: any Uhr = SystemUhr(),
        calendar: Calendar = .current,
        zufall: Zufall = .system()
    ) {
        var karten: [UUID: Card] = [:]
        var reihenfolge: [UUID] = []
        for karte in gezogeneKarten where karte.istGueltig && karten[karte.id] == nil {
            karten[karte.id] = karte
            reihenfolge.append(karte.id)
        }

        self.zielApp = zielApp
        self.karten = karten
        self.reihenfolge = reihenfolge
        self.warteschlange = reihenfolge
        self.wiederholungsAbstand = max(0, wiederholungsAbstand)
        self.uhr = uhr
        self.calendar = calendar
        self.zufall = zufall
        self.aktuelleFrage = naechsteFrage()
    }

    /// Zieht die Karten per `GateAuswahl` aus allen Karten und startet das Gate.
    public init(
        zielApp: Zielapp,
        alleKarten: [Card],
        anzahl: Int = 5,
        wiederholungsAbstand: Int = 2,
        uhr: any Uhr = SystemUhr(),
        calendar: Calendar = .current,
        zufall: Zufall = .system()
    ) {
        var zufall = zufall
        let gezogen = GateAuswahl.ziehen(aus: alleKarten, anzahl: anzahl, jetzt: uhr.jetzt, using: &zufall)
        self.init(
            zielApp: zielApp,
            gezogeneKarten: gezogen,
            wiederholungsAbstand: wiederholungsAbstand,
            uhr: uhr,
            calendar: calendar,
            zufall: zufall
        )
    }

    public var benoetigteRichtige: Int { reihenfolge.count }

    public var status: Status {
        if reihenfolge.isEmpty { return .keineKarten }
        return warteschlange.isEmpty ? .bestanden : .laeuft
    }

    public var istBestanden: Bool { status == .bestanden }

    public var hinweis: String? {
        status == .keineKarten ? Self.keineKartenHinweis : nil
    }

    /// Kartenstand nach den bisherigen Antworten (in Ziehungsreihenfolge) – zum Speichern.
    public var aktualisierteKarten: [Card] {
        reihenfolge.compactMap { karten[$0] }
    }

    /// `antwortIndex` bezieht sich auf die angezeigte (gemischte) Reihenfolge von `aktuelleFrage`.
    @discardableResult
    public mutating func beantworte(antwortIndex: Int) throws -> Antwortergebnis {
        guard let frage = aktuelleFrage, let kartenId = warteschlange.first else {
            throw Fehler.keineAktuelleFrage
        }
        guard frage.antworten.indices.contains(antwortIndex) else {
            throw Fehler.ungueltigerAntwortIndex
        }

        warteschlange.removeFirst()
        let richtig = antwortIndex == frage.indexRichtig
        let jetzt = uhr.jetzt

        if var karte = karten[kartenId] {
            if richtig {
                if !falschBeantwortet.contains(kartenId) {
                    karte.richtigBeantwortet(am: jetzt, calendar: calendar)
                }
            } else {
                karte.falschBeantwortet(am: jetzt, calendar: calendar)
            }
            karten[kartenId] = karte
        }

        if richtig {
            richtigeAntworten += 1
        } else {
            falschBeantwortet.insert(kartenId)
            warteschlange.insert(kartenId, at: min(wiederholungsAbstand, warteschlange.count))
        }

        aktuelleFrage = naechsteFrage()
        return Antwortergebnis(richtig: richtig, gewaehlterIndex: antwortIndex, indexRichtig: frage.indexRichtig)
    }

    private mutating func naechsteFrage() -> Frage? {
        guard let id = warteschlange.first, let karte = karten[id] else { return nil }
        var reihenfolge = Array(karte.antworten.indices)
        reihenfolge.shuffle(using: &zufall)
        return Frage(
            kartenId: id,
            frage: karte.frage,
            antworten: reihenfolge.map { karte.antworten[$0] },
            indexRichtig: reihenfolge.firstIndex(of: karte.indexRichtig) ?? 0
        )
    }
}
