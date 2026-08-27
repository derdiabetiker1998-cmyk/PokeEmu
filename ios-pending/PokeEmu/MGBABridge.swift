import Foundation
import mgba // the vendored C headers, imported via the module map / bridging header

final class MGBABridge {
  private var core: UnsafeMutablePointer<mCore>?
  private var running = false
  private let queue = DispatchQueue(label: "com.pokeemu.core.runloop")
  private var videoBuffer: UnsafeMutablePointer<UInt32>?

  func attachVideoBuffer(width: Int, height: Int) -> UnsafeMutablePointer<UInt32> {
    videoBuffer?.deallocate()
    let buffer = UnsafeMutablePointer<UInt32>.allocate(capacity: width * height)
    buffer.initialize(repeating: 0, count: width * height)
    core?.pointee.setVideoBuffer(core, buffer, width)
    videoBuffer = buffer
    return buffer
  }

  func load(path: String) -> (width: Int, height: Int)? {
    guard let vf = VFileOpen(path, O_RDONLY) else { return nil }
    guard let found = mCoreFindVF(vf) else { return nil }
    core = found
    guard core!.pointee.`init`(core) else { return nil }
    guard core!.pointee.loadROM(core, vf) else { return nil }
    core!.pointee.reset(core)
    var width: CUnsignedInt = 0
    var height: CUnsignedInt = 0
    core!.pointee.desiredVideoDimensions(core, &width, &height)
    return (Int(width), Int(height))
  }
  // Field names above (`init`, `loadROM`, `reset`, `desiredVideoDimensions`) match
  // vendor/mgba/include/mgba/core/core.h at tag 0.10.3 — re-check against
  // that file if the pinned tag changes.

  func play() {
    guard let core = core, !running else { return }
    running = true
    queue.async { [weak self] in
      while self?.running == true {
        core.pointee.runFrame(core)
      }
    }
  }

  func pause() {
    running = false
  }

  func setKey(_ mask: UInt32, pressed: Bool) {
    guard let core = core else { return }
    if pressed {
      core.pointee.addKeys(core, mask)
    } else {
      core.pointee.clearKeys(core, mask)
    }
  }

  func unload() {
    pause()
    core?.pointee.`deinit`(core)
    core = nil
    videoBuffer?.deallocate()
    videoBuffer = nil
  }
}
