import Foundation

/// Kartenauswahl für ein Gate.
/// Reihenfolge der Priorität:
/// 1. fällige Karten: niedrige Box zuerst, bei gleicher Box die am längsten überfällige
/// 2. nicht fällige Karten (nur als Auffüllung, damit das Gate nicht leer bleibt):
///    früher fällige zuerst, dann niedrigere Box
/// Gleichstände entscheidet der Zufall. Die gezogenen Karten werden am Ende gemischt.
/// Ungültige Karten (siehe `Card.istGueltig`) werden ignoriert.
public enum GateAuswahl {
    public static func ziehen<G: RandomNumberGenerator>(
        aus karten: [Card],
        anzahl: Int,
        jetzt: Date,
        using generator: inout G
    ) -> [Card] {
        guard anzahl > 0 else { return [] }

        let mitLos = karten
            .filter(\.istGueltig)
            .map { (karte: $0, los: generator.next()) }

        let sortiert = mitLos.sorted { a, b in
            let aFaellig = a.karte.istFaellig(am: jetzt)
            let bFaellig = b.karte.istFaellig(am: jetzt)
            if aFaellig != bFaellig { return aFaellig }

            if aFaellig {
                if a.karte.box != b.karte.box { return a.karte.box < b.karte.box }
                if a.karte.faelligAm != b.karte.faelligAm { return a.karte.faelligAm < b.karte.faelligAm }
            } else {
                if a.karte.faelligAm != b.karte.faelligAm { return a.karte.faelligAm < b.karte.faelligAm }
                if a.karte.box != b.karte.box { return a.karte.box < b.karte.box }
            }
            return a.los < b.los
        }

        var gezogen = sortiert.prefix(anzahl).map(\.karte)
        gezogen.shuffle(using: &generator)
        return gezogen
    }
}
