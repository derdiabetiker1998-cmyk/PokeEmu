cmake_minimum_required(VERSION 3.22)
project(pokeemu_bridge)

set(MGBA_DIR ${CMAKE_SOURCE_DIR}/../../../../../vendor/mgba)
add_subdirectory(${MGBA_DIR} mgba_build)

add_library(pokeemu_bridge SHARED mgba_bridge.cpp)
target_include_directories(pokeemu_bridge PRIVATE ${MGBA_DIR}/include)
target_link_libraries(pokeemu_bridge mgba log android)
