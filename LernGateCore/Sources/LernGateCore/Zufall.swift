import Foundation

/// Zufallsquelle, die sich per Seed reproduzierbar machen lässt.
/// Kopien teilen sich den Zustand (der Generator steckt in einer Closure).
public struct Zufall: RandomNumberGenerator {
    private let naechsterWert: () -> UInt64

    public init(_ naechsterWert: @escaping () -> UInt64) {
        self.naechsterWert = naechsterWert
    }

    public static func system() -> Zufall {
        var generator = SystemRandomNumberGenerator()
        return Zufall { generator.next() }
    }

    /// SplitMix64 – deterministisch, für Tests.
    public static func seeded(_ seed: UInt64) -> Zufall {
        var zustand = seed
        return Zufall {
            zustand &+= 0x9E37_79B9_7F4A_7C15
            var z = zustand
            z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
            z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
            return z ^ (z >> 31)
        }
    }

    public mutating func next() -> UInt64 {
        naechsterWert()
    }
}
