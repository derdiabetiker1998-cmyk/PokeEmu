import Foundation

@objc(PokeEmuRenderViewManager)
class PokeEmuRenderViewManager: RCTViewManager {
  override func view() -> UIView! { PokeEmuRenderView() }
  override static func requiresMainQueueSetup() -> Bool { true }
}
