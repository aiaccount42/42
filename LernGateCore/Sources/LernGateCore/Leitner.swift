import Foundation

/// Leitner-System: Boxen 1–5, Intervalle 1/2/4/8/16 Tage.
public enum Leitner {
    public static let boxen = 1...5
    public static let intervalleInTagen = [1, 2, 4, 8, 16]

    public static func begrenzt(_ box: Int) -> Int {
        min(max(box, boxen.lowerBound), boxen.upperBound)
    }

    public static func intervallInTagen(box: Int) -> Int {
        intervalleInTagen[begrenzt(box) - 1]
    }

    /// Richtig beantwortet: eine Box höher, in Box 5 bleibt die Karte.
    public static func hoehereBox(nach box: Int) -> Int {
        begrenzt(begrenzt(box) + 1)
    }

    /// Fällig ab Tagesbeginn des Zieltages (Intervall der neuen Box ab Antwortzeitpunkt).
    public static func faelligAm(box: Int, beantwortetAm jetzt: Date, calendar: Calendar = .current) -> Date {
        let tage = intervallInTagen(box: box)
        let ziel = calendar.date(byAdding: .day, value: tage, to: jetzt)
            ?? jetzt.addingTimeInterval(Double(tage) * 86_400)
        return calendar.startOfDay(for: ziel)
    }
}

extension Card {
    public mutating func richtigBeantwortet(am jetzt: Date, calendar: Calendar = .current) {
        box = Leitner.hoehereBox(nach: box)
        faelligAm = Leitner.faelligAm(box: box, beantwortetAm: jetzt, calendar: calendar)
    }

    public mutating func falschBeantwortet(am jetzt: Date, calendar: Calendar = .current) {
        box = Leitner.boxen.lowerBound
        faelligAm = Leitner.faelligAm(box: box, beantwortetAm: jetzt, calendar: calendar)
    }
}
