import UIKit

class PokeEmuRenderView: UIView {
  // PokeEmuCoreModule only learns the ROM's video buffer/dimensions after
  // MGBABridge.load(path:) returns, and it has no other handle to whichever
  // PokeEmuRenderView the JS side has mounted — this shared reference is
  // how it reaches the currently-attached view to set its frameProvider.
  static weak var current: PokeEmuRenderView?

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
    } else if PokeEmuRenderView.current === self {
      PokeEmuRenderView.current = nil
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
