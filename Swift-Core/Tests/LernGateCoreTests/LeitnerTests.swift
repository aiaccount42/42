import XCTest
@testable import LernGateCore

final class LeitnerTests: XCTestCase {
    private let kalender = TestHilfen.kalender
    private let jetzt = TestHilfen.datum(2026, 10, 19, 21, 30)

    func testIntervalleProBox() {
        XCTAssertEqual(Leitner.intervalleInTagen, [1, 2, 4, 8, 16])
        XCTAssertEqual((1...5).map { Leitner.intervallInTagen(box: $0) }, [1, 2, 4, 8, 16])
    }

    func testBoxWirdBegrenzt() {
        XCTAssertEqual(Leitner.begrenzt(0), 1)
        XCTAssertEqual(Leitner.begrenzt(-3), 1)
        XCTAssertEqual(Leitner.begrenzt(6), 5)
        XCTAssertEqual(Leitner.intervallInTagen(box: 99), 16)
        XCTAssertEqual(Leitner.intervallInTagen(box: 0), 1)
    }

    func testRichtigSteigtEineBoxAuf() {
        XCTAssertEqual((1...4).map { Leitner.hoehereBox(nach: $0) }, [2, 3, 4, 5])
    }

    func testBox5BleibtBox5() {
        XCTAssertEqual(Leitner.hoehereBox(nach: 5), 5)
    }

    func testKarteRichtigSteigtAufUndBekommtNeuesIntervall() {
        var karte = TestHilfen.karte(box: 1, faelligAm: jetzt)
        karte.richtigBeantwortet(am: jetzt, calendar: kalender)
        XCTAssertEqual(karte.box, 2)
        // Box 2 = 2 Tage, fällig ab Tagesbeginn
        XCTAssertEqual(karte.faelligAm, TestHilfen.datum(2026, 10, 21, 0, 0))
    }

    func testAlleBoxenDurchlaufen() {
        var karte = TestHilfen.karte(box: 1, faelligAm: jetzt)
        var tage: [Int] = []
        for _ in 1...4 {
            karte.richtigBeantwortet(am: jetzt, calendar: kalender)
            let heute = kalender.startOfDay(for: jetzt)
            tage.append(kalender.dateComponents([.day], from: heute, to: karte.faelligAm).day!)
        }
        XCTAssertEqual(karte.box, 5)
        XCTAssertEqual(tage, [2, 4, 8, 16])
    }

    func testKarteInBox5BleibtBeiRichtigInBox5MitSechzehnTagen() {
        var karte = TestHilfen.karte(box: 5, faelligAm: jetzt)
        karte.richtigBeantwortet(am: jetzt, calendar: kalender)
        XCTAssertEqual(karte.box, 5)
        XCTAssertEqual(karte.faelligAm, TestHilfen.datum(2026, 11, 4, 0, 0))
    }

    func testFalschSetztAufBox1UndMorgenFaellig() {
        var karte = TestHilfen.karte(box: 4, faelligAm: jetzt)
        karte.falschBeantwortet(am: jetzt, calendar: kalender)
        XCTAssertEqual(karte.box, 1)
        XCTAssertEqual(karte.faelligAm, TestHilfen.datum(2026, 10, 20, 0, 0))
    }

    func testFalschInBox1BleibtBox1() {
        var karte = TestHilfen.karte(box: 1, faelligAm: jetzt)
        karte.falschBeantwortet(am: jetzt, calendar: kalender)
        XCTAssertEqual(karte.box, 1)
    }

    func testNeueKarteIstInBox1UndSofortFaellig() {
        let karte = Card(deckId: UUID(), frage: "F", antworten: ["a", "b", "c", "d"], indexRichtig: 0, faelligAm: jetzt)
        XCTAssertEqual(karte.box, 1)
        XCTAssertTrue(karte.istFaellig(am: jetzt))
    }

    func testKarteWirdErstAbFaelligkeitszeitpunktFaellig() {
        let karte = TestHilfen.karte(faelligAm: jetzt)
        XCTAssertFalse(karte.istFaellig(am: jetzt.addingTimeInterval(-1)))
        XCTAssertTrue(karte.istFaellig(am: jetzt))
        XCTAssertTrue(karte.istFaellig(am: jetzt.addingTimeInterval(1)))
    }

    func testInitBegrenztUngueltigeBox() {
        XCTAssertEqual(TestHilfen.karte(box: 0, faelligAm: jetzt).box, 1)
        XCTAssertEqual(TestHilfen.karte(box: 9, faelligAm: jetzt).box, 5)
    }

    func testIntervallUeberSommerzeitumstellungLandetAmTagesbeginn() {
        // Zeitumstellung in Deutschland: 25.10.2026 (03:00 → 02:00)
        let abends = TestHilfen.datum(2026, 10, 24, 23, 30)
        var karte = TestHilfen.karte(box: 1, faelligAm: abends)
        karte.richtigBeantwortet(am: abends, calendar: kalender)
        XCTAssertEqual(karte.faelligAm, TestHilfen.datum(2026, 10, 26, 0, 0))
    }
}
