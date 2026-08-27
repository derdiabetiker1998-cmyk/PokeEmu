import Foundation

enum GBAKeyMask {
  // Matches the standard GBA key-bit ordering used by mGBA's GBAKey enum
  // in vendor/mgba/include/mgba/gba/interface.h.
  static func forButtonName(_ name: String) -> UInt32? {
    switch name {
    case "A": return 1 << 0
    case "B": return 1 << 1
    case "Select": return 1 << 2
    case "Start": return 1 << 3
    case "Right": return 1 << 4
    case "Left": return 1 << 5
    case "Up": return 1 << 6
    case "Down": return 1 << 7
    case "R": return 1 << 8
    case "L": return 1 << 9
    default: return nil
    }
  }
}
