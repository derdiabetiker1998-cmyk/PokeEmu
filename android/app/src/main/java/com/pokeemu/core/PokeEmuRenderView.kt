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

    // On a slow cold start, loadROM() can resolve before this view's
    // onAttachedToWindow() has fired (native view creation/attachment is
    // async relative to the JS-side loadROM() promise) — `current` would
    // still be null, and setFrameSize() would be silently dropped with no
    // way to recover it, leaving the screen blank forever. Stash the size
    // here so it can be applied as soon as a view does attach.
    private var pendingWidth: Int? = null
    private var pendingHeight: Int? = null

    fun setPendingFrameSize(width: Int, height: Int) {
      val view = current
      if (view != null) {
        view.setFrameSize(width, height)
      } else {
        pendingWidth = width
        pendingHeight = height
      }
    }
  }

  private var bitmap: Bitmap? = null

  init { holder.addCallback(this) }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    current = this
    val width = pendingWidth
    val height = pendingHeight
    if (width != null && height != null) {
      setFrameSize(width, height)
      pendingWidth = null
      pendingHeight = null
    }
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
      // lockCanvas() is a nullable platform type (Canvas!) — it can still
      // return null if the surface is torn down between the isValid check
      // above and this call (e.g. backgrounding/rotation), and the
      // unguarded drawBitmap() below would NPE on this Choreographer
      // callback thread every frame until the surface recovers.
      val canvas = surfaceHolder.lockCanvas() ?: run {
        Choreographer.getInstance().postFrameCallback(this)
        return
      }
      canvas.drawBitmap(bmp, null, Rect(0, 0, width, height), null)
      surfaceHolder.unlockCanvasAndPost(canvas)
    }
    Choreographer.getInstance().postFrameCallback(this)
  }

  override fun surfaceCreated(holder: SurfaceHolder) { Choreographer.getInstance().postFrameCallback(this) }
  override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}
  override fun surfaceDestroyed(holder: SurfaceHolder) { Choreographer.getInstance().removeFrameCallback(this) }
}
