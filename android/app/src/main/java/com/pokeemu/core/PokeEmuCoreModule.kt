package com.pokeemu.core

import com.facebook.react.bridge.*

class PokeEmuCoreModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    init { System.loadLibrary("pokeemu_bridge") }
  }

  private external fun nativeLoadROM(path: String): WritableMap?
  private external fun nativePlay()
  private external fun nativePause()
  private external fun nativeSetButtonState(button: String, pressed: Boolean)

  override fun getName() = "PokeEmuCore"

  @ReactMethod
  fun loadROM(path: String, promise: Promise) {
    val result = nativeLoadROM(path)
    if (result == null) {
      promise.reject("LOAD_FAILED", "Could not load ROM at $path")
    } else {
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
  fun setFastForward(enabled: Boolean, speedMultiplier: Double) {}

  @ReactMethod
  fun saveState(romId: String, slotIndex: Int, promise: Promise) { promise.resolve(null) }

  @ReactMethod
  fun loadState(romId: String, slotIndex: Int, promise: Promise) { promise.resolve(null) }

  @ReactMethod
  fun applyCheat(code: String, enabled: Boolean, promise: Promise) { promise.resolve(true) }

  @ReactMethod
  fun removeAllCheats() {}
}
