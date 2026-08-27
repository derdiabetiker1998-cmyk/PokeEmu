import UIKit

class PokeEmuRenderView: UIView {
  // PokeEmuCoreModule only learns the ROM's video buffer/dimensions after
  // MGBABridge.load(path:) returns, and it has no other handle to whichever
  // PokeEmuRenderView the JS side has mounted — this shared reference is
  // how it reaches the currently-attached view to set its frameProvider.
  static weak var current: PokeEmuRenderView?

  // On a slow cold start, loadROM() can resolve before this view's
  // didMoveToWindow() has fired (native view creation/attachment is async
  // relative to the JS-side loadROM() promise) — `current` would still be
  // nil, and setting frameProvider would be silently dropped with no way
  // to recover it, leaving the screen blank forever. Stash the provider so
  // it can be applied as soon as a view does attach.
  private static var pendingFrameProvider: (() -> (UnsafeMutablePointer<UInt32>, Int, Int)?)?

  static func setFrameProvider(_ provider: @escaping () -> (UnsafeMutablePointer<UInt32>, Int, Int)?) {
    if let current = current {
      current.frameProvider = provider
    } else {
      pendingFrameProvider = provider
    }
  }

  var frameProvider: (() -> (UnsafeMutablePointer<UInt32>, Int, Int)?)?
  private var displayLink: CADisplayLink?

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentMode = .scaleAspectFit
    displayLink = CADisplayLink(target: self, selector: #selector(tick))
    displayLink?.add(to: .main, forMode: .common)
  }
  required init?(coder: NSCoder) { fatalError("not supported") }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      PokeEmuRenderView.current = self
      if let pending = PokeEmuRenderView.pendingFrameProvider {
        frameProvider = pending
        PokeEmuRenderView.pendingFrameProvider = nil
      }
    } else {
      if PokeEmuRenderView.current === self {
        PokeEmuRenderView.current = nil
      }
      // CADisplayLink(target: self, ...) retains `self` strongly, so this
      // view would never reach deinit on its own — invalidating here, when
      // the view leaves the window, is the only place that actually stops
      // tick() from firing. Without this, the display link kept running
      // forever and kept calling the stale frameProvider closure (reading
      // a video buffer MGBABridge.unload() may have already deallocated)
      // every frame after the user left the Emulator screen.
      displayLink?.invalidate()
      displayLink = nil
      frameProvider = nil
    }
  }

  @objc private func tick() {
    guard let (buffer, width, height) = frameProvider?() else { return }
    guard let context = CGContext(
      data: buffer, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ), let cgImage = context.makeImage() else { return }
    layer.contents = cgImage
  }
}
