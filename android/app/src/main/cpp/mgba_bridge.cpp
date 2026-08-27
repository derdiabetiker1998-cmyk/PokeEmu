#include "mgba_bridge.h"
#include <mgba/core/core.h>
#include <mgba/gba/interface.h>
#include <atomic>
#include <string>
#include <thread>

namespace {
mCore* gCore = nullptr;
std::atomic<bool> gRunning{false};
std::thread gRunThread;

uint32_t keyMaskForName(const std::string& name) {
  if (name == "A") return 1u << 0;
  if (name == "B") return 1u << 1;
  if (name == "Select") return 1u << 2;
  if (name == "Start") return 1u << 3;
  if (name == "Right") return 1u << 4;
  if (name == "Left") return 1u << 5;
  if (name == "Up") return 1u << 6;
  if (name == "Down") return 1u << 7;
  if (name == "R") return 1u << 8;
  if (name == "L") return 1u << 9;
  return 0;
}
// Bit order matches vendor/mgba/include/mgba/gba/interface.h's GBAKey enum —
// confirm against that header if the pinned mGBA tag changes.
}

JNIEXPORT jobject JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeLoadROM(JNIEnv* env, jobject, jstring jpath) {
  const char* path = env->GetStringUTFChars(jpath, nullptr);
  struct VFile* vf = VFileOpen(path, O_RDONLY);
  env->ReleaseStringUTFChars(jpath, path);
  if (!vf) return nullptr;

  gCore = mCoreFindVF(vf);
  if (!gCore || !gCore->init(gCore) || !gCore->loadROM(gCore, vf)) {
    return nullptr;
  }
  gCore->reset(gCore);

  unsigned width = 0, height = 0;
  gCore->desiredVideoDimensions(gCore, &width, &height);

  // Must be a real WritableNativeMap (not java.util.HashMap) — the Kotlin
  // side declares this as WritableMap and hands it straight to
  // Promise.resolve(), which requires the actual bridge type or throws
  // ClassCastException at runtime.
  jclass mapClass = env->FindClass("com/facebook/react/bridge/WritableNativeMap");
  jmethodID init = env->GetMethodID(mapClass, "<init>", "()V");
  jmethodID putInt = env->GetMethodID(mapClass, "putInt", "(Ljava/lang/String;I)V");
  jobject map = env->NewObject(mapClass, init);
  env->CallVoidMethod(map, putInt, env->NewStringUTF("width"), (jint)width);
  env->CallVoidMethod(map, putInt, env->NewStringUTF("height"), (jint)height);
  return map;
}

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativePlay(JNIEnv*, jobject) {
  if (!gCore || gRunning) return;
  gRunning = true;
  gRunThread = std::thread([]() {
    while (gRunning) {
      gCore->runFrame(gCore);
    }
  });
}

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativePause(JNIEnv*, jobject) {
  gRunning = false;
  if (gRunThread.joinable()) gRunThread.join();
}

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeSetButtonState(JNIEnv* env, jobject, jstring jbutton, jboolean pressed) {
  if (!gCore) return;
  const char* name = env->GetStringUTFChars(jbutton, nullptr);
  uint32_t mask = keyMaskForName(name);
  env->ReleaseStringUTFChars(jbutton, name);
  if (pressed) gCore->addKeys(gCore, mask);
  else gCore->clearKeys(gCore, mask);
}
