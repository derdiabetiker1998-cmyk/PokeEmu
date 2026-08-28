#include "mgba_bridge.h"
#include <mgba/core/core.h>
#include <mgba/core/serialize.h>
#include <mgba/core/cheats.h>
#include <mgba/core/blip_buf.h>
#include <mgba/gba/interface.h>
#include <mgba-util/vfs.h>
#include <android/bitmap.h>
#include <oboe/Oboe.h>
#include <atomic>
#include <cstring>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace {
mCore* gCore = nullptr;
std::atomic<bool> gRunning{false};
std::thread gRunThread;
std::vector<uint32_t> gVideoBuffer;
std::atomic<int> gFastForwardMultiplier{1};
std::unordered_map<std::string, mCheatSet*> gCheatSetsByCode;
std::atomic<bool> gSoundEnabled{true};

class PokeEmuAudioCallback : public oboe::AudioStreamDataCallback {
public:
  oboe::DataCallbackResult onAudioReady(oboe::AudioStream*, void* audioData, int32_t numFrames) override {
    if (!gCore) return oboe::DataCallbackResult::Continue;
    auto* out = static_cast<int16_t*>(audioData);
    std::vector<int16_t> left(numFrames);
    std::vector<int16_t> right(numFrames);
    // Always drain the core's audio buffers even when muted, so they don't
    // back up while the game keeps running.
    blip_read_samples(gCore->getAudioChannel(gCore, 0), left.data(), numFrames, 0);
    blip_read_samples(gCore->getAudioChannel(gCore, 1), right.data(), numFrames, 0);
    bool soundEnabled = gSoundEnabled.load();
    for (int32_t i = 0; i < numFrames; i++) {
      out[i * 2] = soundEnabled ? left[i] : 0;
      out[i * 2 + 1] = soundEnabled ? right[i] : 0;
    }
    return oboe::DataCallbackResult::Continue;
  }
};
PokeEmuAudioCallback gAudioCallback;
std::shared_ptr<oboe::AudioStream> gAudioStream;

void startAudioStream() {
  if (gAudioStream) return; // already running — don't leak a second stream on ROM reload
  oboe::AudioStreamBuilder builder;
  builder.setDirection(oboe::Direction::Output)
      ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
      ->setSampleRate(32768)
      ->setChannelCount(2)
      ->setFormat(oboe::AudioFormat::I16)
      ->setDataCallback(&gAudioCallback)
      ->openStream(gAudioStream);
  if (gAudioStream) gAudioStream->requestStart();
}

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
  std::string pathStr(path);
  struct VFile* vf = VFileOpen(path, O_RDONLY);
  env->ReleaseStringUTFChars(jpath, path);
  if (!vf) return nullptr;

  gCore = mCoreFindVF(vf);
  if (!gCore || !gCore->init(gCore) || !gCore->loadROM(gCore, vf)) {
    return nullptr;
  }

  std::string savePath = pathStr.substr(0, pathStr.find_last_of('.')) + ".sav";
  struct VFile* saveVf = VFileOpen(savePath.c_str(), O_RDWR | O_CREAT);
  if (saveVf) {
    gCore->loadSave(gCore, saveVf);
  }

  gCore->reset(gCore);

  unsigned width = 0, height = 0;
  gCore->desiredVideoDimensions(gCore, &width, &height);

  gVideoBuffer.assign(static_cast<size_t>(width) * height, 0);
  gCore->setVideoBuffer(gCore, gVideoBuffer.data(), width);

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

  startAudioStream();

  return map;
}

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativePlay(JNIEnv*, jobject) {
  if (!gCore || gRunning) return;
  gRunning = true;
  gRunThread = std::thread([]() {
    while (gRunning) {
      for (int i = 0; i < gFastForwardMultiplier.load(); i++) {
        gCore->runFrame(gCore);
      }
    }
  });
}

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeSetFastForward(JNIEnv*, jobject, jboolean enabled, jdouble speedMultiplier) {
  gFastForwardMultiplier = enabled ? static_cast<int>(speedMultiplier) : 1;
}

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativePause(JNIEnv*, jobject) {
  gRunning = false;
  if (gRunThread.joinable()) gRunThread.join();
}

JNIEXPORT jboolean JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeApplyCheat(JNIEnv* env, jobject, jstring jcode, jboolean enabled) {
  if (!gCore) return JNI_FALSE;
  mCheatDevice* device = gCore->cheatDevice(gCore);
  if (!device) return JNI_FALSE;

  const char* codeChars = env->GetStringUTFChars(jcode, nullptr);
  std::string code(codeChars);
  env->ReleaseStringUTFChars(jcode, codeChars);

  if (!enabled) {
    auto it = gCheatSetsByCode.find(code);
    if (it == gCheatSetsByCode.end()) return JNI_TRUE;
    mCheatRemoveSet(device, it->second);
    gCheatSetsByCode.erase(it);
    return JNI_TRUE;
  }

  mCheatSet* set = device->createSet(device, "PokeEmu");
  bool added = mCheatAddLine(set, code.c_str(), 0);
  if (added) {
    mCheatAddSet(device, set);
    gCheatSetsByCode[code] = set;
  }
  return added ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeRemoveAllCheats(JNIEnv*, jobject) {
  if (!gCore) return;
  mCheatDevice* device = gCore->cheatDevice(gCore);
  if (!device) return;
  for (auto& entry : gCheatSetsByCode) {
    mCheatRemoveSet(device, entry.second);
  }
  gCheatSetsByCode.clear();
}

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeSetSoundEnabled(JNIEnv*, jobject, jboolean enabled) {
  gSoundEnabled = enabled;
}

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeSetButtonState(JNIEnv* env, jobject, jstring jbutton, jboolean pressed) {
  if (!gCore) return;
  const char* name = env->GetStringUTFChars(jbutton, nullptr);
  uint32_t mask = keyMaskForName(name);
  env->ReleaseStringUTFChars(jbutton, name);
  if (pressed) gCore->addKeys(gCore, mask);
  else gCore->clearKeys(gCore, mask);
}

JNIEXPORT jboolean JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeSaveState(JNIEnv* env, jobject, jstring jpath) {
  if (!gCore) return JNI_FALSE;
  const char* path = env->GetStringUTFChars(jpath, nullptr);
  struct VFile* vf = VFileOpen(path, O_WRONLY | O_CREAT | O_TRUNC);
  env->ReleaseStringUTFChars(jpath, path);
  if (!vf) return JNI_FALSE;
  return mCoreSaveStateNamed(gCore, vf, SAVESTATE_ALL) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jboolean JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeLoadState(JNIEnv* env, jobject, jstring jpath) {
  if (!gCore) return JNI_FALSE;
  const char* path = env->GetStringUTFChars(jpath, nullptr);
  struct VFile* vf = VFileOpen(path, O_RDONLY);
  env->ReleaseStringUTFChars(jpath, path);
  if (!vf) return JNI_FALSE;
  return mCoreLoadStateNamed(gCore, vf, SAVESTATE_ALL) ? JNI_TRUE : JNI_FALSE;
}

// mGBA's 32-bit color_t stores R,G,B,A one byte each (see
// vendor/mgba/include/mgba/core/interface.h's M_COLOR_* masks), which is
// the same in-memory byte order as Android's ANDROID_BITMAP_FORMAT_RGBA_8888
// (i.e. Bitmap.Config.ARGB_8888) — a straight memcpy is correct, no channel
// swizzling needed.
JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuRenderView_nativeCopyFrameInto(JNIEnv* env, jobject, jobject bitmap) {
  if (gVideoBuffer.empty()) return;
  void* pixels = nullptr;
  if (AndroidBitmap_lockPixels(env, bitmap, &pixels) != ANDROID_BITMAP_RESULT_SUCCESS) return;
  std::memcpy(pixels, gVideoBuffer.data(), gVideoBuffer.size() * sizeof(uint32_t));
  AndroidBitmap_unlockPixels(env, bitmap);
}
