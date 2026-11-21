import XCTest
@testable import LernGateCore

final class ModelleTests: XCTestCase {
    private func roundtrip<T: Codable & Equatable>(_ wert: T) throws -> T {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: encoder.encode(wert))
    }

    func testDeckCodableRoundtrip() throws {
        let deck = Deck(name: "Biologie", erstelltAm: TestHilfen.datum(2026, 10, 19))
        XCTAssertEqual(try roundtrip(deck), deck)
    }

    func testCardCodableRoundtripMitQuelle() throws {
        let karte = Card(
            deckId: UUID(),
            frage: "Hauptstadt von Frankreich?",
            antworten: ["Lyon", "Paris", "Nizza", "Lille"],
            indexRichtig: 1,
            box: 3,
            faelligAm: TestHilfen.datum(2026, 10, 25),
            quelle: "https://example.com"
        )
        XCTAssertEqual(try roundtrip(karte), karte)
    }

    func testCardCodableRoundtripOhneQuelle() throws {
        let karte = TestHilfen.karte(faelligAm: TestHilfen.datum(2026, 10, 25))
        let zurueck = try roundtrip(karte)
        XCTAssertNil(zurueck.quelle)
        XCTAssertEqual(zurueck, karte)
    }

    func testSettingsCodableRoundtrip() throws {
        let settings = Settings(
            freischaltdauerMinuten: 20,
            kartenProGate: 7,
            freigeschaltetBis: TestHilfen.datum(2026, 10, 19, 12, 15),
            notfallSkipLetzterTag: TestHilfen.datum(2026, 10, 19, 8, 0),
            zielApps: [Zielapp(name: "Reddit", urlScheme: "reddit://")]
        )
        XCTAssertEqual(try roundtrip(settings), settings)
    }

    func testSettingsMitNilDatenRoundtrip() throws {
        XCTAssertEqual(try roundtrip(Settings()), Settings())
    }

    func testCardGueltigkeit() {
        let gut = TestHilfen.karte(faelligAm: Date())
        XCTAssertTrue(gut.istGueltig)

        var leereAntwort = gut
        leereAntwort.antworten[2] = "  "
        XCTAssertFalse(leereAntwort.istGueltig)

        var fuenfAntworten = gut
        fuenfAntworten.antworten.append("E")
        XCTAssertFalse(fuenfAntworten.istGueltig)

        var negativerIndex = gut
        negativerIndex.indexRichtig = -1
        XCTAssertFalse(negativerIndex.istGueltig)
    }
}
