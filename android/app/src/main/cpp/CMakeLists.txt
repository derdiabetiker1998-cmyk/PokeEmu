cmake_minimum_required(VERSION 3.22)
project(pokeemu_bridge)

set(MGBA_DIR ${CMAKE_SOURCE_DIR}/../../../../../vendor/mgba)

# mGBA's own detection (CMakeLists.txt: `if(ANDROID AND ANDROID_NDK_MAJOR
# GREATER 13)`) relies on ANDROID_NDK_MAJOR, which this NDK's toolchain
# file/CMake's built-in Android cross-compiling support doesn't set, so it
# falls through to a find_function(strtof_l) link check. That check can't
# see strtof_l because the NDK only provides it as a `static inline` in
# legacy_stdlib_inlines.h (for apps targeting an API level below where it
# became a real libc symbol) — no exported symbol exists to link against,
# so the check reports it missing even though it's fully usable. mGBA then
# defines its own non-static strtof_l, which conflicts with that inline
# and fails to compile. Force the flag on: this NDK (r27) always ships it.
set(HAVE_STRTOF_L ON CACHE BOOL "" FORCE)

# EXCLUDE_FROM_ALL sets mGBA's own LIBMGBA_ONLY flag (it reads the
# directory's EXCLUDE_FROM_ALL property when LIBMGBA_ONLY isn't defined
# explicitly), which is mGBA's supported way to embed just the core
# library — without it, mGBA's CMakeLists defaults to also configuring
# its Qt and SDL desktop frontends, which fail to configure at all on
# this Android NDK toolchain (no Qt5/SDL present, nor needed).
add_subdirectory(${MGBA_DIR} mgba_build EXCLUDE_FROM_ALL)

# Resolves via the Prefab package shipped inside the com.google.oboe:oboe AAR
# (see android/app/build.gradle's buildFeatures.prefab + dependency).
find_package(oboe REQUIRED CONFIG)

add_library(pokeemu_bridge SHARED mgba_bridge.cpp)
target_include_directories(pokeemu_bridge PRIVATE ${MGBA_DIR}/include)
target_link_libraries(pokeemu_bridge mgba log android jnigraphics oboe::oboe)
