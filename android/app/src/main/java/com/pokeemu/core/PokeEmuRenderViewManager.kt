package com.pokeemu.core

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

class PokeEmuRenderViewManager : SimpleViewManager<PokeEmuRenderView>() {
  override fun getName() = "PokeEmuRenderView"
  override fun createViewInstance(reactContext: ThemedReactContext) = PokeEmuRenderView(reactContext)
}
