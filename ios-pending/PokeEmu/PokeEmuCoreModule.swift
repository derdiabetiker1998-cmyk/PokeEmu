import Foundation

@objc(PokeEmuCoreModule)
class PokeEmuCoreModule: NSObject {
  private let bridge = MGBABridge()

  @objc(loadROM:withResolver:withRejecter:)
  func loadROM(path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let dims = bridge.load(path: path) else {
      reject("LOAD_FAILED", "Could not load ROM at \(path)", nil)
      return
    }
    let buffer = bridge.attachVideoBuffer(width: dims.width, height: dims.height)
    PokeEmuRenderView.current?.frameProvider = { (buffer, dims.width, dims.height) }
    resolve(["width": dims.width, "height": dims.height])
  }

  @objc(unloadROM:withRejecter:)
  func unloadROM(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    bridge.unload()
    resolve(nil)
  }

  @objc func play() { bridge.play() }
  @objc func pause() { bridge.pause() }

  @objc func setButtonState(_ button: String, pressed: Bool) {
    guard let mask = GBAKeyMask.forButtonName(button) else { return }
    bridge.setKey(mask, pressed: pressed)
  }

  @objc func setFastForward(_ enabled: Bool, speedMultiplier: Double) {}

  @objc(saveState:slotIndex:withResolver:withRejecter:)
  func saveState(romId: String, slotIndex: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc(loadState:slotIndex:withResolver:withRejecter:)
  func loadState(romId: String, slotIndex: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc(applyCheat:enabled:withResolver:withRejecter:)
  func applyCheat(code: String, enabled: Bool, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(true)
  }

  @objc func removeAllCheats() {}

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
