import XCTest
@testable import LernGateCore

final class GateAuswahlTests: XCTestCase {
    private let jetzt = TestHilfen.datum(2026, 10, 19, 12, 0)
    private var zufall = Zufall.seeded(42)

    private func ziehen(_ karten: [Card], anzahl: Int = 5) -> [Card] {
        GateAuswahl.ziehen(aus: karten, anzahl: anzahl, jetzt: jetzt, using: &zufall)
    }

    private func vergangen(_ tage: Int) -> Date {
        jetzt.addingTimeInterval(-Double(tage) * 86_400)
    }

    func testNullKartenErgebenLeereAuswahl() {
        XCTAssertTrue(ziehen([]).isEmpty)
    }

    func testWenigerAlsFuenfKartenWerdenAlleGezogen() {
        let karten = TestHilfen.faelligeKarten(3)
        let gezogen = ziehen(karten)
        XCTAssertEqual(Set(gezogen.map(\.id)), Set(karten.map(\.id)))
        XCTAssertEqual(gezogen.count, 3)
    }

    func testGenauFuenfKarten() {
        XCTAssertEqual(ziehen(TestHilfen.faelligeKarten(5)).count, 5)
    }

    func testMehrAlsFuenfKartenErgebenGenauFuenfOhneDuplikate() {
        let gezogen = ziehen(TestHilfen.faelligeKarten(20))
        XCTAssertEqual(gezogen.count, 5)
        XCTAssertEqual(Set(gezogen.map(\.id)).count, 5)
    }

    func testAnzahlNullOderNegativErgibtLeereAuswahl() {
        let karten = TestHilfen.faelligeKarten(5)
        XCTAssertTrue(ziehen(karten, anzahl: 0).isEmpty)
        XCTAssertTrue(ziehen(karten, anzahl: -2).isEmpty)
    }

    func testNiedrigeBoxZuerst() {
        var karten = (1...5).flatMap { box in
            (0..<2).map { _ in TestHilfen.karte(box: box, faelligAm: vergangen(1)) }
        }
        karten.shuffle()
        let gezogen = ziehen(karten, anzahl: 4)
        XCTAssertEqual(gezogen.map(\.box).sorted(), [1, 1, 2, 2])
    }

    func testUeberfaelligeKartenZuerstBeiGleicherBox() {
        let sehrAlt = TestHilfen.karte("alt", box: 2, faelligAm: vergangen(10))
        let alt = TestHilfen.karte("mittel", box: 2, faelligAm: vergangen(5))
        let neu = TestHilfen.karte("neu", box: 2, faelligAm: vergangen(1))
        let gezogen = ziehen([neu, alt, sehrAlt], anzahl: 2)
        XCTAssertEqual(Set(gezogen.map(\.frage)), ["alt", "mittel"])
    }

    func testBoxSchlaegtUeberfaelligkeit() {
        let box1 = TestHilfen.karte("box1", box: 1, faelligAm: vergangen(1))
        let box3Alt = TestHilfen.karte("box3", box: 3, faelligAm: vergangen(30))
        let gezogen = ziehen([box3Alt, box1], anzahl: 1)
        XCTAssertEqual(gezogen.map(\.frage), ["box1"])
    }

    func testKartenAusMehrerenDecksWerdenGemischt() {
        let a = (0..<3).map { TestHilfen.karte("A\($0)", deck: TestHilfen.deckA, faelligAm: vergangen(1)) }
        let b = (0..<3).map { TestHilfen.karte("B\($0)", deck: TestHilfen.deckB, faelligAm: vergangen(1)) }
        let gezogen = ziehen(a + b, anzahl: 5)
        XCTAssertEqual(gezogen.count, 5)
        XCTAssertEqual(Set(gezogen.map(\.deckId)), [TestHilfen.deckA, TestHilfen.deckB])
    }

    func testFaelligeKartenVorNichtFaelligen() {
        let faellig = TestHilfen.karte("faellig", box: 5, faelligAm: vergangen(1))
        let spaeter = TestHilfen.karte("spaeter", box: 1, faelligAm: jetzt.addingTimeInterval(86_400))
        let gezogen = ziehen([spaeter, faellig], anzahl: 1)
        XCTAssertEqual(gezogen.map(\.frage), ["faellig"])
    }

    func testNichtFaelligeKartenFuellenAufWennZuWenigFaellig() {
        let faellig = TestHilfen.karte("faellig", faelligAm: vergangen(1))
        let bald = TestHilfen.karte("bald", faelligAm: jetzt.addingTimeInterval(86_400))
        let weit = TestHilfen.karte("weit", faelligAm: jetzt.addingTimeInterval(10 * 86_400))
        let gezogen = ziehen([weit, bald, faellig], anzahl: 2)
        XCTAssertEqual(Set(gezogen.map(\.frage)), ["faellig", "bald"])
    }

    func testNurNichtFaelligeKartenErgebenTrotzdemEinGate() {
        let karten = (0..<3).map { _ in TestHilfen.karte(faelligAm: jetzt.addingTimeInterval(86_400)) }
        XCTAssertEqual(ziehen(karten).count, 3)
    }

    func testKarteGenauJetztFaelligGiltAlsFaellig() {
        let genau = TestHilfen.karte("genau", box: 5, faelligAm: jetzt)
        let spaeter = TestHilfen.karte("spaeter", box: 1, faelligAm: jetzt.addingTimeInterval(1))
        XCTAssertEqual(ziehen([spaeter, genau], anzahl: 1).map(\.frage), ["genau"])
    }

    func testUngueltigeKartenWerdenIgnoriert() {
        var zuWenigAntworten = TestHilfen.karte("kaputt", faelligAm: vergangen(1))
        zuWenigAntworten.antworten = ["a", "b", "c"]
        var indexAusserhalb = TestHilfen.karte("index", faelligAm: vergangen(1))
        indexAusserhalb.indexRichtig = 4
        var leereFrage = TestHilfen.karte("  ", faelligAm: vergangen(1))
        leereFrage.frage = "  "
        let gut = TestHilfen.karte("gut", faelligAm: vergangen(1))

        let gezogen = ziehen([zuWenigAntworten, indexAusserhalb, leereFrage, gut])
        XCTAssertEqual(gezogen.map(\.frage), ["gut"])
    }

    func testGleicherSeedGleichesErgebnis() {
        let karten = TestHilfen.faelligeKarten(30)
        var z1 = Zufall.seeded(7)
        var z2 = Zufall.seeded(7)
        let a = GateAuswahl.ziehen(aus: karten, anzahl: 5, jetzt: jetzt, using: &z1)
        let b = GateAuswahl.ziehen(aus: karten, anzahl: 5, jetzt: jetzt, using: &z2)
        XCTAssertEqual(a.map(\.id), b.map(\.id))
    }

    func testGleichstaendeWerdenZufaelligAufgeloest() {
        let karten = TestHilfen.faelligeKarten(30)
        var verschiedene = Set<Set<UUID>>()
        for seed in 0..<20 {
            var z = Zufall.seeded(UInt64(seed))
            let gezogen = GateAuswahl.ziehen(aus: karten, anzahl: 5, jetzt: jetzt, using: &z)
            verschiedene.insert(Set(gezogen.map(\.id)))
        }
        XCTAssertGreaterThan(verschiedene.count, 1)
    }
}
