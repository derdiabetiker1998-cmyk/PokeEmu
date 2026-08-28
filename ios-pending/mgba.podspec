# DRAFT — written without access to a Mac/Xcode to compile or verify it.
# See docs/superpowers/specs/ios-build-setup.md for the full status of what's
# verified vs. guessed here, and what to check first if `pod install` or the
# Xcode build fails on this pod.
#
# Builds the vendored mGBA core (vendor/mgba, via mgba-ios/CMakeLists.txt) as
# an iOS static library, exposed to Swift as the `mgba` module that
# MGBABridge.swift imports. Mirrors the Android approach (CMake +
# EXCLUDE_FROM_ALL to get just the core library, no Qt/SDL frontends) but
# targets iOS device + simulator via CMake's native `CMAKE_SYSTEM_NAME=iOS`
# cross-compiling support, combined afterward into one .xcframework so both
# slices install through a single CocoaPods vendored_frameworks entry.

Pod::Spec.new do |s|
  s.name         = 'mgba'
  s.version      = '0.10.3'
  s.summary      = 'Vendored mGBA core (GBA/GB), built via CMake for iOS'
  s.homepage     = 'https://mgba.io'
  s.license      = { :type => 'MPL-2.0', :file => '../vendor/mgba/LICENSE' }
  s.author       = 'endrift and mGBA contributors'
  s.ios.deployment_target = '15.1'
  s.source       = { :path => '.' }

  # Runs once, during `pod install` — NOT re-run automatically on every Xcode
  # build, so re-run `pod install` by hand after any vendor/mgba update.
  #
  # KNOWN RISK POINTS (check these first if this pod fails to build):
  # 1. `Release-iphoneos`/`Release-iphonesimulator` is the standard CMake+Xcode
  #    multi-config generator output subdirectory naming, but this hasn't
  #    been confirmed against a real build. If `xcodebuild -create-xcframework`
  #    fails with "file not found", `find build -name libmgba.a` to see the
  #    actual path CMake produced and fix the two `-library` paths below.
  # 2. CMake also GENERATES some mGBA headers (version.c/version.h) into the
  #    build directory, not just vendor/mgba/include. If Swift/ObjC fails to
  #    find a header (e.g. mgba/core/version.h), it's likely in
  #    build/<slice>/mgba_build/include instead — add that path too.
  # 3. This assumes an Apple Silicon (arm64) EAS build host for the simulator
  #    slice. If EAS builds on Intel, add an x86_64 simulator slice too, or
  #    build a "generic" simulator archive covering both.
  # 4. This has NEVER been run. Expect at least one or two rounds of fixing
  #    real cmake/xcodebuild error output, the same way the Android CMake
  #    integration took several iterations against real EAS build logs.
  s.prepare_command = <<-CMD
    set -e
    ROOT="#{__dir__}"
    BUILD="$ROOT/build"
    rm -rf "$BUILD"
    mkdir -p "$BUILD"

    build_slice() {
      SDK="$1"
      ARCH="$2"
      OUT="$BUILD/$SDK-$ARCH"
      cmake -S "$ROOT/mgba-ios" -B "$OUT" -G Xcode \\
        -DCMAKE_SYSTEM_NAME=iOS \\
        -DCMAKE_OSX_SYSROOT="$SDK" \\
        -DCMAKE_OSX_ARCHITECTURES="$ARCH" \\
        -DCMAKE_OSX_DEPLOYMENT_TARGET=15.1
      cmake --build "$OUT" --config Release --target mgba
    }

    build_slice iphoneos arm64
    build_slice iphonesimulator arm64

    xcodebuild -create-xcframework \\
      -library "$BUILD/iphoneos-arm64/Release-iphoneos/libmgba.a" -headers "$ROOT/../vendor/mgba/include" \\
      -library "$BUILD/iphonesimulator-arm64/Release-iphonesimulator/libmgba.a" -headers "$ROOT/../vendor/mgba/include" \\
      -output "$BUILD/mgba.xcframework"
  CMD

  s.vendored_frameworks = 'build/mgba.xcframework'
  s.module_name = 'mgba'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
