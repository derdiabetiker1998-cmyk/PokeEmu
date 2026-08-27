package com.pokeemu.core

import com.facebook.react.bridge.*

class PokeEmuCoreModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "PokeEmuCore"

  @ReactMethod
  fun loadROM(path: String, promise: Promise) {
    // Task 10 replaces this stub with a real JNI call into libmgba.
    val result = Arguments.createMap()
    result.putInt("width", 240)
    result.putInt("height", 160)
    promise.resolve(result)
  }

  @ReactMethod
  fun unloadROM(promise: Promise) { promise.resolve(null) }

  @ReactMethod
  fun play() {}

  @ReactMethod
  fun pause() {}

  @ReactMethod
  fun setButtonState(button: String, pressed: Boolean) {}

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
