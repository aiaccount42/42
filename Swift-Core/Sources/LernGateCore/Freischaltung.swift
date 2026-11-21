import Foundation

/// Freischaltung der Ziel-Apps und Notfall-Skip (1× pro Kalendertag).
/// Hält die `Settings`; der Aufrufer speichert `settings` nach Änderungen.
public struct Freischaltung {
    public enum Fehler: Error, Equatable {
        case gateNichtBestanden
        case skipBereitsVerbraucht
    }

    public var settings: Settings
    private let uhr: any Uhr
    private let calendar: Calendar

    public init(settings: Settings = Settings(), uhr: any Uhr = SystemUhr(), calendar: Calendar = .current) {
        self.settings = settings
        self.uhr = uhr
        self.calendar = calendar
    }

    /// true, solange jetzt < freigeschaltetBis (genau zum Ablaufzeitpunkt ist es schon wieder gesperrt).
    public var istFreigeschaltet: Bool {
        guard let bis = settings.freigeschaltetBis else { return false }
        return uhr.jetzt < bis
    }

    public var verbleibendeSekunden: TimeInterval {
        guard let bis = settings.freigeschaltetBis else { return 0 }
        return max(0, bis.timeIntervalSince(uhr.jetzt))
    }

    /// Setzt freigeschaltetBis auf jetzt + Freischaltdauer (verlängert nicht, sondern setzt neu).
    public mutating func freischalten() {
        let dauer = TimeInterval(max(0, settings.freischaltdauerMinuten)) * 60
        settings.freigeschaltetBis = uhr.jetzt.addingTimeInterval(dauer)
    }

    /// Schaltet nur frei, wenn das Gate wirklich bestanden ist.
    public mutating func gateAbschliessen(_ sitzung: GateSitzung) throws {
        guard sitzung.istBestanden else { throw Fehler.gateNichtBestanden }
        freischalten()
    }

    public var notfallSkipVerfuegbar: Bool {
        guard let letzter = settings.notfallSkipLetzterTag else { return true }
        return !calendar.isDate(letzter, inSameDayAs: uhr.jetzt)
    }

    public var notfallSkipStatus: String {
        notfallSkipVerfuegbar ? "heute noch 1 Skip" : "heute verbraucht"
    }

    /// Verbraucht den Tages-Skip und schaltet wie bei einem bestandenen Gate frei.
    public mutating func notfallSkipNutzen() throws {
        guard notfallSkipVerfuegbar else { throw Fehler.skipBereitsVerbraucht }
        settings.notfallSkipLetzterTag = uhr.jetzt
        freischalten()
    }
}
