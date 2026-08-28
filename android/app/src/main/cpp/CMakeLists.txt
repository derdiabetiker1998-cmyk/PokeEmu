cmake_minimum_required(VERSION 3.22)
project(pokeemu_bridge)

set(MGBA_DIR ${CMAKE_SOURCE_DIR}/../../../../../vendor/mgba)
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
