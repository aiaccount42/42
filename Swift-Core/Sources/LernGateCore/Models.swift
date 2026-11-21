import Foundation

public struct Deck: Codable, Identifiable, Hashable {
    public var id: UUID
    public var name: String
    public var erstelltAm: Date

    public init(id: UUID = UUID(), name: String, erstelltAm: Date = Date()) {
        self.id = id
        self.name = name
        self.erstelltAm = erstelltAm
    }
}

public struct Card: Codable, Identifiable, Hashable {
    public static let anzahlAntworten = 4

    public var id: UUID
    public var deckId: UUID
    public var frage: String
    public var antworten: [String]
    public var indexRichtig: Int
    public var box: Int
    public var faelligAm: Date
    public var quelle: String?

    /// Neue Karten landen in Box 1 und sind sofort fällig.
    public init(
        id: UUID = UUID(),
        deckId: UUID,
        frage: String,
        antworten: [String],
        indexRichtig: Int,
        box: Int = 1,
        faelligAm: Date = Date(),
        quelle: String? = nil
    ) {
        self.id = id
        self.deckId = deckId
        self.frage = frage
        self.antworten = antworten
        self.indexRichtig = indexRichtig
        self.box = Leitner.begrenzt(box)
        self.faelligAm = faelligAm
        self.quelle = quelle
    }

    /// Frage nicht leer, genau 4 nicht leere Antworten, richtiger Index im Bereich.
    public var istGueltig: Bool {
        func leer(_ text: String) -> Bool {
            text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        return !leer(frage)
            && antworten.count == Card.anzahlAntworten
            && !antworten.contains(where: leer)
            && antworten.indices.contains(indexRichtig)
    }

    public func istFaellig(am jetzt: Date) -> Bool {
        faelligAm <= jetzt
    }
}

/// Ziel-App, für die das Gate läuft, z. B. Instagram mit `instagram://`.
public struct Zielapp: Codable, Hashable {
    public var name: String
    public var urlScheme: String

    public init(name: String, urlScheme: String) {
        self.name = name
        self.urlScheme = urlScheme
    }

    public static let instagram = Zielapp(name: "Instagram", urlScheme: "instagram://")
    public static let reddit = Zielapp(name: "Reddit", urlScheme: "reddit://")
}

public struct Settings: Codable, Equatable {
    public var freischaltdauerMinuten: Int
    public var kartenProGate: Int
    public var freigeschaltetBis: Date?
    public var notfallSkipLetzterTag: Date?
    public var zielApps: [Zielapp]

    public init(
        freischaltdauerMinuten: Int = 15,
        kartenProGate: Int = 5,
        freigeschaltetBis: Date? = nil,
        notfallSkipLetzterTag: Date? = nil,
        zielApps: [Zielapp] = [.instagram, .reddit]
    ) {
        self.freischaltdauerMinuten = freischaltdauerMinuten
        self.kartenProGate = kartenProGate
        self.freigeschaltetBis = freigeschaltetBis
        self.notfallSkipLetzterTag = notfallSkipLetzterTag
        self.zielApps = zielApps
    }
}
