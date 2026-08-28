package com.impoxx.PokeEmu

import android.content.Context
import android.hardware.input.InputManager
import android.os.Build
import android.os.Bundle
import android.view.InputDevice
import android.view.KeyEvent

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactApplication
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import com.pokeemu.core.PokeEmuCoreModule
import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  private val inputManager: InputManager by lazy { getSystemService(Context.INPUT_SERVICE) as InputManager }

  private val inputDeviceListener = object : InputManager.InputDeviceListener {
    override fun onInputDeviceAdded(deviceId: Int) { notifyControllerStatus() }
    override fun onInputDeviceRemoved(deviceId: Int) { notifyControllerStatus() }
    override fun onInputDeviceChanged(deviceId: Int) {}
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    setTheme(R.style.AppTheme);
    super.onCreate(null)
    inputManager.registerInputDeviceListener(inputDeviceListener, null)
  }

  override fun onDestroy() {
    inputManager.unregisterInputDeviceListener(inputDeviceListener)
    super.onDestroy()
  }

  private fun notifyControllerStatus() {
    val connected = InputDevice.getDeviceIds().any { id ->
      val device = InputDevice.getDevice(id)
      device != null && (device.sources and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
    }
    // This app uses the New Architecture / Bridgeless ReactHost (see
    // MainApplication.kt) rather than the legacy ReactInstanceManager, so
    // events go through ReactContext.emitDeviceEvent(...) directly instead
    // of the older getJSModule(RCTDeviceEventEmitter::class.java).emit(...)
    // pattern.
    (application as ReactApplication).reactHost?.currentReactContext?.emitDeviceEvent("controllerStatusChanged", connected)
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    val name = when (event.keyCode) {
      KeyEvent.KEYCODE_BUTTON_A -> "A"
      KeyEvent.KEYCODE_BUTTON_B -> "B"
      KeyEvent.KEYCODE_BUTTON_L1 -> "L"
      KeyEvent.KEYCODE_BUTTON_R1 -> "R"
      KeyEvent.KEYCODE_BUTTON_START -> "Start"
      KeyEvent.KEYCODE_BUTTON_SELECT -> "Select"
      KeyEvent.KEYCODE_DPAD_UP -> "Up"
      KeyEvent.KEYCODE_DPAD_DOWN -> "Down"
      KeyEvent.KEYCODE_DPAD_LEFT -> "Left"
      KeyEvent.KEYCODE_DPAD_RIGHT -> "Right"
      else -> null
    }
    if (name != null && (event.source and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD) {
      val pressed = event.action == KeyEvent.ACTION_DOWN
      PokeEmuCoreModule.instance?.setButtonState(name, pressed)
      return true
    }
    return super.dispatchKeyEvent(event)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
