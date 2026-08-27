package com.pokeemu.core

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Rect
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.Choreographer

class PokeEmuRenderView(context: Context) : SurfaceView(context), SurfaceHolder.Callback, Choreographer.FrameCallback {
  companion object {
    // PokeEmuCoreModule.loadROM only learns the ROM's width/height after
    // the JNI call returns, and it has no other handle to whichever
    // PokeEmuRenderView the JS side has mounted — this shared reference is
    // how it reaches the currently-attached view to size its bitmap.
    var current: PokeEmuRenderView? = null
  }

  private var bitmap: Bitmap? = null

  init { holder.addCallback(this) }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    current = this
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    if (current === this) current = null
  }

  fun setFrameSize(width: Int, height: Int) {
    bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
  }

  external fun nativeCopyFrameInto(bitmap: Bitmap)

  override fun doFrame(frameTimeNanos: Long) {
    val bmp = bitmap
    val surfaceHolder = holder
    if (bmp != null && surfaceHolder.surface.isValid) {
      nativeCopyFrameInto(bmp)
      val canvas = surfaceHolder.lockCanvas()
      canvas.drawBitmap(bmp, null, Rect(0, 0, width, height), null)
      surfaceHolder.unlockCanvasAndPost(canvas)
    }
    Choreographer.getInstance().postFrameCallback(this)
  }

  override fun surfaceCreated(holder: SurfaceHolder) { Choreographer.getInstance().postFrameCallback(this) }
  override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}
  override fun surfaceDestroyed(holder: SurfaceHolder) { Choreographer.getInstance().removeFrameCallback(this) }
}
