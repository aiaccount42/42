import Foundation

/// Zeitquelle. Alles, was "jetzt" braucht, fragt die Uhr – so lässt sich Zeit in Tests steuern.
public protocol Uhr {
    var jetzt: Date { get }
}

public struct SystemUhr: Uhr {
    public init() {}
    public var jetzt: Date { Date() }
}

/// Steuerbare Uhr für Tests (Klasse, damit mehrere Objekte dieselbe Uhr teilen).
public final class FesteUhr: Uhr {
    public var jetzt: Date

    public init(_ jetzt: Date) {
        self.jetzt = jetzt
    }

    public func weiter(umSekunden sekunden: TimeInterval) {
        jetzt = jetzt.addingTimeInterval(sekunden)
    }

    public func weiter(umMinuten minuten: Double) {
        weiter(umSekunden: minuten * 60)
    }
}
