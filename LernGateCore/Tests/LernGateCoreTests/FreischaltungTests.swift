import XCTest
@testable import LernGateCore

final class FreischaltungTests: XCTestCase {
    private let start = TestHilfen.datum(2026, 10, 19, 12, 0)
    private var uhr: FesteUhr!

    override func setUp() {
        super.setUp()
        uhr = FesteUhr(start)
    }

    private func freischaltung(_ settings: Settings = Settings()) -> Freischaltung {
        Freischaltung(settings: settings, uhr: uhr, calendar: TestHilfen.kalender)
    }

    private func bestandenesGate() throws -> GateSitzung {
        var gate = GateSitzung(
            zielApp: .instagram,
            gezogeneKarten: TestHilfen.faelligeKarten(5),
            uhr: uhr,
            calendar: TestHilfen.kalender,
            zufall: .seeded(1)
        )
        while gate.aktuelleFrage != nil {
            try gate.beantworte(antwortIndex: TestHilfen.richtig(gate))
        }
        return gate
    }

    // MARK: Freischaltung

    func testStandardwerte() {
        let settings = Settings()
        XCTAssertEqual(settings.freischaltdauerMinuten, 15)
        XCTAssertEqual(settings.kartenProGate, 5)
        XCTAssertNil(settings.freigeschaltetBis)
        XCTAssertNil(settings.notfallSkipLetzterTag)
        XCTAssertEqual(settings.zielApps.map(\.urlScheme), ["instagram://", "reddit://"])
    }

    func testAnfangsGesperrt() {
        XCTAssertFalse(freischaltung().istFreigeschaltet)
        XCTAssertEqual(freischaltung().verbleibendeSekunden, 0)
    }

    func testBestandenesGateSchaltetFuer15MinutenFrei() throws {
        var f = freischaltung()
        try f.gateAbschliessen(try bestandenesGate())
        XCTAssertEqual(f.settings.freigeschaltetBis, start.addingTimeInterval(15 * 60))
        XCTAssertTrue(f.istFreigeschaltet)
        XCTAssertEqual(f.verbleibendeSekunden, 900)
    }

    func testFreischaltungLaeuftNachFuenfzehnMinutenAb() {
        var f = freischaltung()
        f.freischalten()

        uhr.weiter(umMinuten: 14.99)
        XCTAssertTrue(f.istFreigeschaltet)

        uhr.jetzt = start.addingTimeInterval(15 * 60 - 1)
        XCTAssertTrue(f.istFreigeschaltet)

        // genau zum Ablaufzeitpunkt: wieder gesperrt (jetzt < bis)
        uhr.jetzt = start.addingTimeInterval(15 * 60)
        XCTAssertFalse(f.istFreigeschaltet)
        XCTAssertEqual(f.verbleibendeSekunden, 0)

        uhr.weiter(umSekunden: 1)
        XCTAssertFalse(f.istFreigeschaltet)
    }

    func testVerbleibendeZeitSinkt() {
        var f = freischaltung()
        f.freischalten()
        uhr.weiter(umMinuten: 5)
        XCTAssertEqual(f.verbleibendeSekunden, 600, accuracy: 0.001)
    }

    func testFreischaltdauerIstKonfigurierbar() {
        var f = freischaltung(Settings(freischaltdauerMinuten: 30))
        f.freischalten()
        uhr.weiter(umMinuten: 29)
        XCTAssertTrue(f.istFreigeschaltet)
        uhr.weiter(umMinuten: 1)
        XCTAssertFalse(f.istFreigeschaltet)
    }

    func testDauerNullSchaltetNichtFrei() {
        var f = freischaltung(Settings(freischaltdauerMinuten: 0))
        f.freischalten()
        XCTAssertFalse(f.istFreigeschaltet)
    }

    func testNochNichtBestandenesGateSchaltetNichtFrei() throws {
        var f = freischaltung()
        let laufend = GateSitzung(
            zielApp: .instagram,
            gezogeneKarten: TestHilfen.faelligeKarten(5),
            uhr: uhr,
            calendar: TestHilfen.kalender,
            zufall: .seeded(1)
        )
        XCTAssertThrowsError(try f.gateAbschliessen(laufend)) {
            XCTAssertEqual($0 as? Freischaltung.Fehler, .gateNichtBestanden)
        }
        XCTAssertNil(f.settings.freigeschaltetBis)
        XCTAssertFalse(f.istFreigeschaltet)
    }

    func testGateOhneKartenSchaltetNichtFrei() {
        var f = freischaltung()
        let leer = GateSitzung(zielApp: .instagram, gezogeneKarten: [], uhr: uhr)
        XCTAssertThrowsError(try f.gateAbschliessen(leer))
        XCTAssertFalse(f.istFreigeschaltet)
    }

    func testErneutesFreischaltenSetztFristNeu() {
        var f = freischaltung()
        f.freischalten()
        uhr.weiter(umMinuten: 10)
        f.freischalten()
        XCTAssertEqual(f.settings.freigeschaltetBis, start.addingTimeInterval(25 * 60))
    }

    func testNachAblaufMussNeuFreigeschaltetWerden() throws {
        var f = freischaltung()
        try f.gateAbschliessen(try bestandenesGate())
        uhr.weiter(umMinuten: 20)
        XCTAssertFalse(f.istFreigeschaltet)
        f.freischalten()
        XCTAssertTrue(f.istFreigeschaltet)
    }

    // MARK: Notfall-Skip

    func testSkipAnfangsVerfuegbar() {
        let f = freischaltung()
        XCTAssertTrue(f.notfallSkipVerfuegbar)
        XCTAssertEqual(f.notfallSkipStatus, "heute noch 1 Skip")
    }

    func testSkipSchaltetFreiUndVerbrauchtDenTag() throws {
        var f = freischaltung()
        try f.notfallSkipNutzen()
        XCTAssertTrue(f.istFreigeschaltet)
        XCTAssertEqual(f.settings.freigeschaltetBis, start.addingTimeInterval(15 * 60))
        XCTAssertEqual(f.settings.notfallSkipLetzterTag, start)
        XCTAssertFalse(f.notfallSkipVerfuegbar)
        XCTAssertEqual(f.notfallSkipStatus, "heute verbraucht")
    }

    func testZweiterSkipAmSelbenTagWirftUndAendertNichts() throws {
        var f = freischaltung()
        try f.notfallSkipNutzen()
        let vorher = f.settings

        uhr.weiter(umMinuten: 60)
        XCTAssertThrowsError(try f.notfallSkipNutzen()) {
            XCTAssertEqual($0 as? Freischaltung.Fehler, .skipBereitsVerbraucht)
        }
        XCTAssertEqual(f.settings, vorher)
        XCTAssertFalse(f.istFreigeschaltet)
    }

    func testSkipAmNaechstenTagWiederMoeglich() throws {
        var f = freischaltung()
        try f.notfallSkipNutzen()
        uhr.jetzt = TestHilfen.datum(2026, 10, 20, 8, 0)
        XCTAssertTrue(f.notfallSkipVerfuegbar)
        XCTAssertEqual(f.notfallSkipStatus, "heute noch 1 Skip")
        XCTAssertNoThrow(try f.notfallSkipNutzen())
        XCTAssertEqual(f.settings.notfallSkipLetzterTag, TestHilfen.datum(2026, 10, 20, 8, 0))
    }

    func testTageswechselUmMitternachtZaehltAlsNeuerTag() throws {
        uhr.jetzt = TestHilfen.datum(2026, 10, 19, 23, 59, 59)
        var f = freischaltung()
        try f.notfallSkipNutzen()

        uhr.jetzt = TestHilfen.datum(2026, 10, 19, 23, 59, 59).addingTimeInterval(0)
        XCTAssertFalse(f.notfallSkipVerfuegbar)

        uhr.jetzt = TestHilfen.datum(2026, 10, 20, 0, 0, 0)
        XCTAssertTrue(f.notfallSkipVerfuegbar)
    }

    func testSkipUmMitternachtOhneVollerZwoelfStundenAbstandMoeglich() throws {
        uhr.jetzt = TestHilfen.datum(2026, 10, 19, 23, 58)
        var f = freischaltung()
        try f.notfallSkipNutzen()
        uhr.jetzt = TestHilfen.datum(2026, 10, 20, 0, 2)
        XCTAssertNoThrow(try f.notfallSkipNutzen())
    }

    func testSkipFrueherMorgensUndSpaeterAbendsGleicherTagNurEinmal() throws {
        uhr.jetzt = TestHilfen.datum(2026, 10, 19, 0, 0, 1)
        var f = freischaltung()
        try f.notfallSkipNutzen()
        uhr.jetzt = TestHilfen.datum(2026, 10, 19, 23, 59, 59)
        XCTAssertFalse(f.notfallSkipVerfuegbar)
    }

    func testNachMehrerenTagenWiederVerfuegbar() throws {
        var f = freischaltung()
        try f.notfallSkipNutzen()
        uhr.jetzt = TestHilfen.datum(2026, 11, 30, 12, 0)
        XCTAssertTrue(f.notfallSkipVerfuegbar)
    }

    func testSkipGleicherTagImSelbenMonatAberAndererMonat() throws {
        // 19.10. vs. 19.11.: gleiche Tageszahl, aber anderer Kalendertag
        var f = freischaltung()
        try f.notfallSkipNutzen()
        uhr.jetzt = TestHilfen.datum(2026, 11, 19, 12, 0)
        XCTAssertTrue(f.notfallSkipVerfuegbar)
    }

    func testBestandenesGateVerbrauchtDenSkipNicht() throws {
        var f = freischaltung()
        try f.gateAbschliessen(try bestandenesGate())
        XCTAssertTrue(f.notfallSkipVerfuegbar)
        XCTAssertNil(f.settings.notfallSkipLetzterTag)
    }

    func testSkipBeiNullKartenErlaubt() throws {
        var f = freischaltung()
        let leer = GateSitzung(zielApp: .reddit, gezogeneKarten: [], uhr: uhr)
        XCTAssertEqual(leer.status, .keineKarten)
        try f.notfallSkipNutzen()
        XCTAssertTrue(f.istFreigeschaltet)
    }

    func testSkipFunktioniertAuchWennBereitsFreigeschaltet() throws {
        var f = freischaltung()
        f.freischalten()
        uhr.weiter(umMinuten: 5)
        try f.notfallSkipNutzen()
        XCTAssertEqual(f.settings.freigeschaltetBis, start.addingTimeInterval(20 * 60))
    }

    func testSkipRespektiertZeitzone() throws {
        // 22:30 UTC am 19.10. ist in Berlin (MESZ/MEZ) bereits der 20.10.
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        uhr.jetzt = utc.date(from: DateComponents(year: 2026, month: 10, day: 19, hour: 21, minute: 30))!
        var f = freischaltung() // Berlin: 23:30 am 19.10.
        try f.notfallSkipNutzen()
        uhr.jetzt = utc.date(from: DateComponents(year: 2026, month: 10, day: 19, hour: 22, minute: 30))! // Berlin: 00:30 am 20.10.
        XCTAssertTrue(f.notfallSkipVerfuegbar)
    }
}
