import Foundation

@objc(PokeEmuCoreModule)
class PokeEmuCoreModule: NSObject {

  @objc(loadROM:withResolver:withRejecter:)
  func loadROM(path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // Task 10 replaces this stub with real mGBA loading via MGBABridge.
    resolve(["width": 240, "height": 160])
  }

  @objc(unloadROM:withRejecter:)
  func unloadROM(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc func play() {}
  @objc func pause() {}
  @objc func setButtonState(_ button: String, pressed: Bool) {}
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
