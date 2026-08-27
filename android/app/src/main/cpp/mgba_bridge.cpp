#include "mgba_bridge.h"
#include <mgba/core/core.h>
#include <mgba/gba/interface.h>
#include <android/bitmap.h>
#include <oboe/Oboe.h>
#include <atomic>
#include <cstring>
#include <string>
#include <thread>
#include <vector>

namespace {
mCore* gCore = nullptr;
std::atomic<bool> gRunning{false};
std::thread gRunThread;
std::vector<uint32_t> gVideoBuffer;

class PokeEmuAudioCallback : public oboe::AudioStreamDataCallback {
public:
  oboe::DataCallbackResult onAudioReady(oboe::AudioStream*, void* audioData, int32_t numFrames) override {
    if (!gCore) return oboe::DataCallbackResult::Continue;
    auto* out = static_cast<int16_t*>(audioData);
    std::vector<int16_t> left(numFrames);
    std::vector<int16_t> right(numFrames);
    blip_read_samples(gCore->getAudioChannel(gCore, 0), left.data(), numFrames, 0);
    blip_read_samples(gCore->getAudioChannel(gCore, 1), right.data(), numFrames, 0);
    for (int32_t i = 0; i < numFrames; i++) {
      out[i * 2] = left[i];
      out[i * 2 + 1] = right[i];
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
