import Foundation
@testable import LernGateCore

enum TestHilfen {
    static var kalender: Calendar = {
        var kalender = Calendar(identifier: .gregorian)
        kalender.timeZone = TimeZone(identifier: "Europe/Berlin")!
        return kalender
    }()

    static func datum(_ jahr: Int, _ monat: Int, _ tag: Int, _ stunde: Int = 12, _ minute: Int = 0, _ sekunde: Int = 0) -> Date {
        let komponenten = DateComponents(
            year: jahr, month: monat, day: tag, hour: stunde, minute: minute, second: sekunde
        )
        return kalender.date(from: komponenten)!
    }

    static let deckA = UUID()
    static let deckB = UUID()

    /// Gültige Karte; richtige Antwort ist standardmäßig "R" an Index 1.
    static func karte(
        _ frage: String = "Frage?",
        deck: UUID = deckA,
        box: Int = 1,
        faelligAm: Date,
        indexRichtig: Int = 1
    ) -> Card {
        var antworten = ["A", "B", "C", "D"]
        antworten[indexRichtig] = "R"
        return Card(
            deckId: deck,
            frage: frage,
            antworten: antworten,
            indexRichtig: indexRichtig,
            box: box,
            faelligAm: faelligAm
        )
    }

    /// n fällige Karten in Box 1 (fällig seit 1.1.2026).
    static func faelligeKarten(_ n: Int) -> [Card] {
        (0..<n).map { karte("Frage \($0)", faelligAm: datum(2026, 1, 1)) }
    }

    /// Index der richtigen bzw. einer falschen Antwort der aktuellen Frage.
    static func richtig(_ sitzung: GateSitzung) -> Int { sitzung.aktuelleFrage!.indexRichtig }
    static func falsch(_ sitzung: GateSitzung) -> Int { (sitzung.aktuelleFrage!.indexRichtig + 1) % 4 }
}
