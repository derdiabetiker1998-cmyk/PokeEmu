#pragma once
#include <jni.h>

extern "C" {
JNIEXPORT jobject JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeLoadROM(JNIEnv*, jobject, jstring path);
JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativePlay(JNIEnv*, jobject);
JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativePause(JNIEnv*, jobject);
JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeSetButtonState(JNIEnv*, jobject, jstring button, jboolean pressed);
JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuRenderView_nativeCopyFrameInto(JNIEnv*, jobject, jobject bitmap);
}
