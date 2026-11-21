import XCTest
@testable import LernGateCore

final class GateSitzungTests: XCTestCase {
    private let uhr = FesteUhr(TestHilfen.datum(2026, 10, 19, 12, 0))

    private func sitzung(_ karten: [Card], seed: UInt64 = 1, abstand: Int = 2) -> GateSitzung {
        GateSitzung(
            zielApp: .instagram,
            gezogeneKarten: karten,
            wiederholungsAbstand: abstand,
            uhr: uhr,
            calendar: TestHilfen.kalender,
            zufall: .seeded(seed)
        )
    }

    // MARK: Bestehen

    func testFuenfRichtigeAntwortenBestehenDasGate() throws {
        var gate = sitzung(TestHilfen.faelligeKarten(5))
        XCTAssertEqual(gate.status, .laeuft)
        XCTAssertEqual(gate.benoetigteRichtige, 5)

        for gestellt in 1...5 {
            XCTAssertFalse(gate.istBestanden)
            let ergebnis = try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))
            XCTAssertTrue(ergebnis.richtig)
            XCTAssertEqual(gate.richtigeAntworten, gestellt)
        }
        XCTAssertTrue(gate.istBestanden)
        XCTAssertEqual(gate.status, .bestanden)
        XCTAssertNil(gate.aktuelleFrage)
    }

    func testRichtigeKartenSteigenEineBoxAuf() throws {
        var gate = sitzung(TestHilfen.faelligeKarten(5))
        while gate.aktuelleFrage != nil {
            try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))
        }
        XCTAssertEqual(gate.aktualisierteKarten.map(\.box), [2, 2, 2, 2, 2])
        let erwartet = TestHilfen.datum(2026, 10, 21, 0, 0)
        XCTAssertTrue(gate.aktualisierteKarten.allSatisfy { $0.faelligAm == erwartet })
    }

    // MARK: Falsche Antworten

    func testFalscheAntwortKommtSpaeterErneutUndGateBrauchtFuenfRichtige() throws {
        var gate = sitzung(TestHilfen.faelligeKarten(5))
        let erste = gate.aktuelleFrage!.kartenId

        let ergebnis = try gate.beantworte(antwortIndex: TestHilfen.falsch(gate))
        XCTAssertFalse(ergebnis.richtig)
        XCTAssertEqual(gate.richtigeAntworten, 0)

        // Karte wird nach Abstand 2 wieder gestellt: Position 3 der Folgefragen
        var reihenfolge: [UUID] = []
        while gate.aktuelleFrage != nil {
            reihenfolge.append(gate.aktuelleFrage!.kartenId)
            try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))
        }
        XCTAssertEqual(reihenfolge.count, 5)
        XCTAssertEqual(reihenfolge[2], erste)
        XCTAssertTrue(gate.istBestanden)
        XCTAssertEqual(gate.richtigeAntworten, 5)
    }

    func testGateIstNichtBestandenSolangeEineFalscheKarteOffenIst() throws {
        var gate = sitzung(TestHilfen.faelligeKarten(5))
        try gate.beantworte(antwortIndex: TestHilfen.falsch(gate))
        for _ in 0..<4 {
            try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))
        }
        XCTAssertEqual(gate.richtigeAntworten, 4)
        XCTAssertFalse(gate.istBestanden)
        XCTAssertEqual(gate.status, .laeuft)

        try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))
        XCTAssertTrue(gate.istBestanden)
    }

    func testFalscheKarteRutschtInBox1() throws {
        var karte = TestHilfen.karte(box: 4, faelligAm: TestHilfen.datum(2026, 10, 1))
        karte.frage = "hoch"
        var gate = sitzung([karte])
        try gate.beantworte(antwortIndex: TestHilfen.falsch(gate))

        let stand = gate.aktualisierteKarten[0]
        XCTAssertEqual(stand.box, 1)
        XCTAssertEqual(stand.faelligAm, TestHilfen.datum(2026, 10, 20, 0, 0))
    }

    func testKarteBleibtNachSpaeteremRichtigInBox1() throws {
        var gate = sitzung([TestHilfen.karte(box: 3, faelligAm: TestHilfen.datum(2026, 10, 1))])
        try gate.beantworte(antwortIndex: TestHilfen.falsch(gate))
        try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))

        XCTAssertTrue(gate.istBestanden)
        XCTAssertEqual(gate.aktualisierteKarten[0].box, 1)
    }

    func testMehrfachFalschBisRichtig() throws {
        var gate = sitzung(TestHilfen.faelligeKarten(2))
        for _ in 0..<3 {
            try gate.beantworte(antwortIndex: TestHilfen.falsch(gate))
        }
        XCTAssertEqual(gate.richtigeAntworten, 0)
        XCTAssertFalse(gate.istBestanden)

        while gate.aktuelleFrage != nil {
            try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))
        }
        XCTAssertTrue(gate.istBestanden)
        XCTAssertEqual(gate.richtigeAntworten, 2)
        XCTAssertTrue(gate.aktualisierteKarten.allSatisfy { $0.box == 1 || $0.box == 2 })
    }

    func testLetzteKarteFalschKommtSofortWieder() throws {
        var gate = sitzung([TestHilfen.karte(faelligAm: TestHilfen.datum(2026, 10, 1))])
        let id = gate.aktuelleFrage!.kartenId
        try gate.beantworte(antwortIndex: TestHilfen.falsch(gate))
        XCTAssertEqual(gate.aktuelleFrage?.kartenId, id)
        XCTAssertEqual(gate.status, .laeuft)
    }

    func testWiederholungsAbstandNull() throws {
        var gate = sitzung(TestHilfen.faelligeKarten(3), abstand: 0)
        let id = gate.aktuelleFrage!.kartenId
        try gate.beantworte(antwortIndex: TestHilfen.falsch(gate))
        XCTAssertEqual(gate.aktuelleFrage?.kartenId, id)
    }

    // MARK: Randfälle Kartenanzahl

    func testWenigerAlsFuenfKartenWerdenMitVorhandenenGespielt() throws {
        var gate = sitzung(TestHilfen.faelligeKarten(3))
        XCTAssertEqual(gate.benoetigteRichtige, 3)
        for _ in 0..<3 {
            XCTAssertEqual(gate.status, .laeuft)
            try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))
        }
        XCTAssertTrue(gate.istBestanden)
    }

    func testEineKarteReichtZumBestehen() throws {
        var gate = sitzung(TestHilfen.faelligeKarten(1))
        try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))
        XCTAssertTrue(gate.istBestanden)
    }

    func testNullKartenErgebenHinweisUndKeineFrage() {
        let gate = sitzung([])
        XCTAssertEqual(gate.status, .keineKarten)
        XCTAssertEqual(gate.hinweis, "Erst Karten anlegen")
        XCTAssertNil(gate.aktuelleFrage)
        XCTAssertFalse(gate.istBestanden)
        XCTAssertEqual(gate.benoetigteRichtige, 0)
    }

    func testNurUngueltigeKartenZaehlenAlsNullKarten() {
        var kaputt = TestHilfen.karte(faelligAm: TestHilfen.datum(2026, 10, 1))
        kaputt.antworten = ["a"]
        XCTAssertEqual(sitzung([kaputt]).status, .keineKarten)
    }

    func testDoppelteKartenIdsWerdenNurEinmalGestellt() {
        let karte = TestHilfen.karte(faelligAm: TestHilfen.datum(2026, 10, 1))
        XCTAssertEqual(sitzung([karte, karte]).benoetigteRichtige, 1)
    }

    func testHinweisNurBeiKeinenKarten() {
        XCTAssertNil(sitzung(TestHilfen.faelligeKarten(2)).hinweis)
    }

    // MARK: Start über Auswahl

    func testStartAusAllenKartenZiehtFuenf() {
        let gate = GateSitzung(
            zielApp: .reddit,
            alleKarten: TestHilfen.faelligeKarten(12),
            uhr: uhr,
            calendar: TestHilfen.kalender,
            zufall: .seeded(3)
        )
        XCTAssertEqual(gate.benoetigteRichtige, 5)
        XCTAssertEqual(gate.zielApp, .reddit)
    }

    func testStartAusAllenKartenRespektiertAnzahl() {
        let gate = GateSitzung(
            zielApp: .instagram,
            alleKarten: TestHilfen.faelligeKarten(12),
            anzahl: 3,
            uhr: uhr,
            calendar: TestHilfen.kalender,
            zufall: .seeded(3)
        )
        XCTAssertEqual(gate.benoetigteRichtige, 3)
    }

    // MARK: Antworten

    func testAntwortenSindGemischtAberRichtigerIndexStimmt() {
        for seed in 0..<50 {
            let gate = sitzung([TestHilfen.karte(faelligAm: TestHilfen.datum(2026, 10, 1))], seed: UInt64(seed))
            let frage = gate.aktuelleFrage!
            XCTAssertEqual(Set(frage.antworten), ["A", "R", "C", "D"] as Set<String>)
            XCTAssertEqual(frage.antworten[frage.indexRichtig], "R")
        }
    }

    func testReihenfolgeDerAntwortenVariiert() {
        var positionen = Set<Int>()
        for seed in 0..<50 {
            let gate = sitzung([TestHilfen.karte(faelligAm: TestHilfen.datum(2026, 10, 1))], seed: UInt64(seed))
            positionen.insert(gate.aktuelleFrage!.indexRichtig)
        }
        XCTAssertEqual(positionen, [0, 1, 2, 3])
    }

    func testErgebnisEnthaeltRichtigeLoesungFuerFeedback() throws {
        var gate = sitzung(TestHilfen.faelligeKarten(2))
        let richtigerIndex = gate.aktuelleFrage!.indexRichtig
        let falscherIndex = TestHilfen.falsch(gate)
        let ergebnis = try gate.beantworte(antwortIndex: falscherIndex)
        XCTAssertEqual(ergebnis.indexRichtig, richtigerIndex)
        XCTAssertEqual(ergebnis.gewaehlterIndex, falscherIndex)
    }

    // MARK: Fehlerfälle

    func testUngueltigerAntwortIndexWirftUndAendertNichts() {
        var gate = sitzung(TestHilfen.faelligeKarten(2))
        let vorher = gate.aktuelleFrage
        XCTAssertThrowsError(try gate.beantworte(antwortIndex: 4)) {
            XCTAssertEqual($0 as? GateSitzung.Fehler, .ungueltigerAntwortIndex)
        }
        XCTAssertThrowsError(try gate.beantworte(antwortIndex: -1))
        XCTAssertEqual(gate.aktuelleFrage, vorher)
        XCTAssertEqual(gate.richtigeAntworten, 0)
    }

    func testAntwortenNachBestandenemGateWirft() throws {
        var gate = sitzung(TestHilfen.faelligeKarten(1))
        try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))
        XCTAssertThrowsError(try gate.beantworte(antwortIndex: 0)) {
            XCTAssertEqual($0 as? GateSitzung.Fehler, .keineAktuelleFrage)
        }
    }

    func testAntwortenOhneKartenWirft() {
        var gate = sitzung([])
        XCTAssertThrowsError(try gate.beantworte(antwortIndex: 0))
    }
}
