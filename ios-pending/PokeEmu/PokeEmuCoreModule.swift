import Foundation
import GameController

// NOTE: subclassing RCTEventEmitter (instead of NSObject) requires
// `#import <React/RCTEventEmitter.h>` in this target's Objective-C
// bridging header — add that once the real Xcode project exists
// (this file currently lives in ios-pending/, see the plan's Global
// Constraints "iOS project scaffold gap" note).
@objc(PokeEmuCoreModule)
class PokeEmuCoreModule: RCTEventEmitter {
  private let bridge = MGBABridge()
  private var hasListeners = false

  override init() {
    super.init()
    observeControllers()
  }

  override func supportedEvents() -> [String]! {
    return ["controllerStatusChanged"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

  // Correction (confirmed 2026-08-27): the original draft posted a custom
  // `.pokeEmuControllerStatusChanged` NotificationCenter notification and
  // left "bridge it to JS via a separate PokeEmuControllerEvents module"
  // as prose — but the JS hook (Step 3) actually constructs its
  // NativeEventEmitter around NativeModules.PokeEmuCore, meaning the
  // event must come from THIS module, not a separate one. Making
  // PokeEmuCoreModule itself an RCTEventEmitter and calling sendEvent
  // directly (no NotificationCenter indirection needed) resolves the
  // mismatch with less code.
  private func observeControllers() {
    NotificationCenter.default.addObserver(forName: .GCControllerDidConnect, object: nil, queue: .main) { [weak self] note in
      guard let self = self, let controller = note.object as? GCController, let gamepad = controller.extendedGamepad else { return }
      gamepad.buttonA.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 0, pressed: pressed) }
      gamepad.buttonB.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 1, pressed: pressed) }
      gamepad.buttonMenu.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 3, pressed: pressed) }
      gamepad.buttonOptions?.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 2, pressed: pressed) }
      gamepad.leftShoulder.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 9, pressed: pressed) }
      gamepad.rightShoulder.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 8, pressed: pressed) }
      gamepad.dpad.up.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 6, pressed: pressed) }
      gamepad.dpad.down.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 7, pressed: pressed) }
      gamepad.dpad.left.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 5, pressed: pressed) }
      gamepad.dpad.right.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 4, pressed: pressed) }
      if self.hasListeners { self.sendEvent(withName: "controllerStatusChanged", body: true) }
    }
    NotificationCenter.default.addObserver(forName: .GCControllerDidDisconnect, object: nil, queue: .main) { [weak self] _ in
      guard let self = self else { return }
      if self.hasListeners { self.sendEvent(withName: "controllerStatusChanged", body: false) }
    }
  }

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

  @objc func setFastForward(_ enabled: Bool, speedMultiplier: Double) {
    bridge.setFastForward(multiplier: enabled ? Int(speedMultiplier) : 1)
  }

  private func stateFilePath(romId: String, slot: Int) -> String {
    let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let dir = docs.appendingPathComponent("saves").appendingPathComponent(romId)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir.appendingPathComponent("state-slot-\(slot).state").path
  }

  @objc(saveState:slotIndex:withResolver:withRejecter:)
  func saveState(romId: String, slotIndex: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let path = stateFilePath(romId: romId, slot: slotIndex.intValue)
    if bridge.saveState(toPath: path) {
      resolve(nil)
    } else {
      reject("SAVE_STATE_FAILED", "Could not save state to slot \(slotIndex)", nil)
    }
  }

  @objc(loadState:slotIndex:withResolver:withRejecter:)
  func loadState(romId: String, slotIndex: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let path = stateFilePath(romId: romId, slot: slotIndex.intValue)
    if bridge.loadState(fromPath: path) {
      resolve(nil)
    } else {
      reject("LOAD_STATE_FAILED", "Could not load state from slot \(slotIndex)", nil)
    }
  }

  @objc(applyCheat:enabled:withResolver:withRejecter:)
  func applyCheat(code: String, enabled: Bool, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(bridge.applyCheat(code: code, enabled: enabled))
  }

  @objc func removeAllCheats() {
    bridge.removeAllCheats()
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
