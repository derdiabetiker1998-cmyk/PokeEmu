cmake_minimum_required(VERSION 3.22)
project(mgba_ios_wrapper)

# Mirrors android/app/src/main/cpp/CMakeLists.txt's approach exactly:
# EXCLUDE_FROM_ALL sets mGBA's own LIBMGBA_ONLY flag (it reads the
# directory's EXCLUDE_FROM_ALL property when LIBMGBA_ONLY isn't defined
# explicitly), which is mGBA's supported way to embed just the core
# library without its Qt/SDL desktop frontends.
set(MGBA_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../vendor/mgba)
add_subdirectory(${MGBA_DIR} mgba_build EXCLUDE_FROM_ALL)

# On Android, mGBA's own strtof_l detection (ANDROID_NDK_MAJOR-gated)
# failed to see the NDK's `static inline` shim and collided with mGBA's
# own fallback definition — forcing this macro directly onto the mgba
# target's compiler invocation fixed it (see the Android CMakeLists.txt
# for the full story). Apple's libc very likely exports a real,
# link-visible strtof_l (unlike Android's inline-only shim), so mGBA's
# own find_function(strtof_l) check should succeed here without any
# help — this define is kept only as a harmless safety net: formatting.c
# guards its own definition with `#ifndef HAVE_STRTOF_L`, so if mGBA's
# check already found a real strtof_l, this has no effect either way.
target_compile_definitions(mgba PRIVATE HAVE_STRTOF_L=1)
