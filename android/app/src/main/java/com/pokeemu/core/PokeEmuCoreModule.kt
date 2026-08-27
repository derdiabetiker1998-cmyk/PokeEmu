package com.pokeemu.core

import com.facebook.react.bridge.*

class PokeEmuCoreModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    init { System.loadLibrary("pokeemu_bridge") }
    // MainActivity.dispatchKeyEvent needs to reach the already-registered
    // module instance to forward physical gamepad button presses — there's
    // no other handle to it from an Activity.
    var instance: PokeEmuCoreModule? = null
  }

  init {
    instance = this
  }

  private external fun nativeLoadROM(path: String): WritableMap?
  private external fun nativePlay()
  private external fun nativePause()
  private external fun nativeSetButtonState(button: String, pressed: Boolean)
  private external fun nativeSaveState(path: String): Boolean
  private external fun nativeLoadState(path: String): Boolean
  private external fun nativeSetFastForward(enabled: Boolean, speedMultiplier: Double)
  private external fun nativeApplyCheat(code: String, enabled: Boolean): Boolean
  private external fun nativeRemoveAllCheats()
  private external fun nativeSetSoundEnabled(enabled: Boolean)

  private fun stateFilePath(romId: String, slot: Int): String {
    val dir = java.io.File(reactApplicationContext.filesDir, "saves/$romId")
    dir.mkdirs()
    return java.io.File(dir, "state-slot-$slot.state").absolutePath
  }

  override fun getName() = "PokeEmuCore"

  @ReactMethod
  fun loadROM(path: String, promise: Promise) {
    val result = nativeLoadROM(path)
    if (result == null) {
      promise.reject("LOAD_FAILED", "Could not load ROM at $path")
    } else {
      PokeEmuRenderView.current?.setFrameSize(result.getInt("width"), result.getInt("height"))
      promise.resolve(result)
    }
  }

  @ReactMethod
  fun unloadROM(promise: Promise) { promise.resolve(null) }

  @ReactMethod
  fun play() { nativePlay() }

  @ReactMethod
  fun pause() { nativePause() }

  @ReactMethod
  fun setButtonState(button: String, pressed: Boolean) { nativeSetButtonState(button, pressed) }

  @ReactMethod
  fun setFastForward(enabled: Boolean, speedMultiplier: Double) { nativeSetFastForward(enabled, speedMultiplier) }

  @ReactMethod
  fun saveState(romId: String, slotIndex: Int, promise: Promise) {
    if (nativeSaveState(stateFilePath(romId, slotIndex))) promise.resolve(null)
    else promise.reject("SAVE_STATE_FAILED", "Could not save state to slot $slotIndex")
  }

  @ReactMethod
  fun loadState(romId: String, slotIndex: Int, promise: Promise) {
    if (nativeLoadState(stateFilePath(romId, slotIndex))) promise.resolve(null)
    else promise.reject("LOAD_STATE_FAILED", "Could not load state from slot $slotIndex")
  }

  @ReactMethod
  fun applyCheat(code: String, enabled: Boolean, promise: Promise) {
    promise.resolve(nativeApplyCheat(code, enabled))
  }

  @ReactMethod
  fun removeAllCheats() { nativeRemoveAllCheats() }

  @ReactMethod
  fun setSoundEnabled(enabled: Boolean) { nativeSetSoundEnabled(enabled) }
}
