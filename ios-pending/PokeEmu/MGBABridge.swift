import Foundation
import AVFoundation
import mgba // the vendored C headers, imported via the module map / bridging header

final class MGBABridge {
  private var core: UnsafeMutablePointer<mCore>?
  private var running = false
  private let queue = DispatchQueue(label: "com.pokeemu.core.runloop")
  private var videoBuffer: UnsafeMutablePointer<UInt32>?
  private let audioEngine = AVAudioEngine()
  private var audioNodeAttached = false
  private var fastForwardMultiplier: Int = 1

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

    let savePath = (path as NSString).deletingPathExtension + ".sav"
    if let saveVf = VFileOpen(savePath, O_RDWR | O_CREAT) {
      _ = core!.pointee.loadSave(core, saveVf)
    }

    core!.pointee.reset(core)
    var width: CUnsignedInt = 0
    var height: CUnsignedInt = 0
    core!.pointee.desiredVideoDimensions(core, &width, &height)
    startAudio()
    return (Int(width), Int(height))
  }
  // Field names above (`init`, `loadROM`, `reset`, `desiredVideoDimensions`) match
  // vendor/mgba/include/mgba/core/core.h at tag 0.10.3 — re-check against
  // that file if the pinned tag changes.

  func startAudio() {
    // The source node is attached/connected once and reads `self?.core`
    // live on every callback (rather than capturing the `core` pointer by
    // value), so it keeps working correctly across multiple loadROM calls
    // even though this setup only runs the first time — otherwise, after
    // unload() deinits this core and a second ROM loads a new one, a
    // value-captured callback would keep reading the freed first core.
    if !audioNodeAttached {
      audioNodeAttached = true
      let format = AVAudioFormat(standardFormatWithSampleRate: 32768, channels: 2)!
      let sourceNode = AVAudioSourceNode { [weak self] _, _, frameCount, audioBufferList -> OSStatus in
        let ablPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
        guard let core = self?.core else {
          for buffer in ablPointer {
            buffer.mData?.assumingMemoryBound(to: Float.self).update(repeating: 0, count: Int(frameCount))
          }
          return noErr
        }
        let left = core.pointee.getAudioChannel(core, 0)
        let right = core.pointee.getAudioChannel(core, 1)
        var samplesLeft = [Int16](repeating: 0, count: Int(frameCount))
        var samplesRight = [Int16](repeating: 0, count: Int(frameCount))
        blip_read_samples(left, &samplesLeft, Int32(frameCount), 0)
        blip_read_samples(right, &samplesRight, Int32(frameCount), 0)
        for frame in 0..<Int(frameCount) {
          let l = Float(samplesLeft[frame]) / Float(Int16.max)
          let r = Float(samplesRight[frame]) / Float(Int16.max)
          ablPointer[0].mData?.assumingMemoryBound(to: Float.self)[frame] = l
          ablPointer[1].mData?.assumingMemoryBound(to: Float.self)[frame] = r
        }
        return noErr
      }
      audioEngine.attach(sourceNode)
      audioEngine.connect(sourceNode, to: audioEngine.mainMixerNode, format: format)
    }
    // Safe to call even if already running (AVAudioEngine.start() is a
    // no-op in that case) — this is what actually needs to re-run after
    // unload()'s audioEngine.stop(), since node attach/connect above only
    // happens once.
    try? audioEngine.start()
  }
  // `getAudioChannel` returning a blip_t* and `blip_read_samples` match
  // vendor/mgba/include/mgba/core/core.h and mGBA's vendored blip_buf.h —
  // confirmed against both at the pinned tag.

  func play() {
    guard let core = core, !running else { return }
    running = true
    queue.async { [weak self] in
      while self?.running == true {
        let steps = self?.fastForwardMultiplier ?? 1
        for _ in 0..<steps {
          core.pointee.runFrame(core)
        }
      }
    }
  }

  func pause() {
    running = false
  }

  func setFastForward(multiplier: Int) {
    fastForwardMultiplier = max(1, multiplier)
  }

  func saveState(toPath path: String) -> Bool {
    guard let core = core, let vf = VFileOpen(path, O_WRONLY | O_CREAT | O_TRUNC) else { return false }
    return mCoreSaveStateNamed(core, vf, Int32(SAVESTATE_ALL))
  }

  func loadState(fromPath path: String) -> Bool {
    guard let core = core, let vf = VFileOpen(path, O_RDONLY) else { return false }
    return mCoreLoadStateNamed(core, vf, Int32(SAVESTATE_ALL))
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
    audioEngine.stop()
    core?.pointee.`deinit`(core)
    core = nil
    videoBuffer?.deallocate()
    videoBuffer = nil
  }
}
