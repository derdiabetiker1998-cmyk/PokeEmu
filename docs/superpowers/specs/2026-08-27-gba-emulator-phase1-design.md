# PokeEmu — Phase 1: GBA Emulator (Design Spec)

Date: 2026-08-27
Status: Approved by user, pending implementation plan

## Purpose

A personal, offline-capable Game Boy Advance emulator app for iOS and Android,
styled with a classic Apple design language accented with Pokémon theming. The
user will supply their own ROMs after the app is built. This is Phase 1 of a
two-phase project; Phase 2 (Nintendo DS support) is a separate future spec
that will build on this phase's architecture.

## Scope

**In scope (Phase 1):**
- GBA emulation via the mGBA core, embedded natively (not via WebView/WASM).
- iOS and Android, React Native (Expo, bare workflow).
- Personal use / sideload distribution only (Xcode/TestFlight for iOS, direct
  APK for Android) — no App Store / Play Store submission, so no store-review
  constraints on entitlements or JIT.
- ROM import via file picker, simple list-based library (no boxart/metadata
  lookup).
- Touch controls and external Bluetooth/MFi/Android gamepad support, both
  from the start.
- Save states (multiple slots) in addition to native in-game `.sav` saves.
- Fast-forward / turbo.
- Cheats via GameShark codes.
- Apple-style visual design (system typography, blur/vibrancy, generous
  whitespace) with Pokémon-themed accents (color palette, iconography).

**Out of scope (Phase 1):**
- Nintendo DS emulation (Phase 2, own spec).
- App Store / Play Store distribution and its constraints.
- ROM/boxart metadata scraping or library artwork.
- Multiplayer / link-cable emulation.
- Cloud sync of saves/save-states.

## Architecture

- **App shell:** Expo bare workflow, TypeScript, Zustand for state — matching
  the stack already used in the user's other Pokémon-themed projects
  (TamaPoke, PokemonTrainerMission).
- **Emulator core:** `libmgba` embedded directly as a native library — an
  XCFramework on iOS, built via NDK/CMake into a `.so` on Android. Not routed
  through libretro; this is a direct binding to mGBA's own C API.
- **Rendering:** A dedicated native view (Metal/GLKit on iOS, SurfaceView or
  TextureView on Android) that mGBA's core writes its framebuffer to
  directly, exposed to React Native as a native component. Pixel data never
  crosses the JS bridge — required to sustain ~60fps.
- **Audio:** The core writes directly into platform audio APIs (AVAudioEngine
  on iOS, Oboe/AAudio on Android), also bypassing the JS bridge.
- **JS/RN layer:** Owns the UI shell, ROM list, on-screen touch controls,
  settings, cheat entry, and save-state triggers. Talks to the native module
  only for infrequent, low-bandwidth calls: load ROM, per-frame button
  state, save/load state, apply cheat.
- **Controllers:** Bluetooth/MFi (iOS) and standard Android gamepad APIs,
  surfaced through React Native's gamepad handling and merged into the same
  input path as the on-screen touch controls.

## Components (folder structure)

```
PokeEmu/
  native/ios/       Swift native module + mGBA XCFramework
  native/android/   Kotlin+JNI native module + mGBA built via NDK
  src/screens/      RomList, EmulatorScreen, Settings, CheatsEditor
  src/state/        Zustand stores: romLibrary, session, settings
  src/controls/     Touch controls (Apple-glass look, Pokémon accents)
                     + gamepad input handler
  src/theme/        Design tokens: system typography, blur/vibrancy,
                     Pokémon color palette
```

## Data Flow

1. **ROM import:** File picker → copy into `Documents/roms/` → entry added to
   the `romLibrary` Zustand store (persisted, e.g. via MMKV) → shown in the
   list screen.
2. **Launch game:** JS calls native `loadROM(path)` → core runs its execution
   loop on a background thread → frames pushed to the native render view,
   audio pushed to the native audio buffer.
3. **Input:** Touch or gamepad event captured in JS → bridge call
   `setButtonState(button, pressed)` → native module feeds it to the core
   each frame.
4. **Save state:** JS calls `saveState(slotIndex)` → native module serializes
   core state → written to `Documents/saves/<romId>/state-slot-N.state`.
5. **In-game save (`.sav`):** Persisted automatically by the core on pause /
   app backgrounding.
6. **Cheats:** GameShark codes stored per ROM; applied via mGBA's cheat API
   on load.

## Error Handling

- Invalid/corrupt ROM: header validated on import; on failure, show an alert
  and don't add it to the library.
- Core crash / unsupported ROM: native exceptions are caught at the module
  boundary; show a friendly error and return to the library screen instead
  of crashing the app.
- Save-state/core-version mismatch: warn the user, offer to discard the
  incompatible state.
- Controller disconnects mid-play: pause emulation, prompt to reconnect,
  no crash.

## Testing

- **JS/RN layer:** Jest tests for the Zustand stores' logic (ROM library
  management, cheat-code parsing, settings).
- **Native core:** mGBA itself is a mature, independently-tested C library —
  no value in re-testing its internals. Verification is manual, using the
  user's own legally-owned Pokémon GBA ROMs.
- **Manual QA checklist** before each build the user installs: import ROM →
  launch → save state → reload state → connect and use a Bluetooth
  controller → fast-forward → apply a cheat → verify in-game save survives
  a full app kill and relaunch.

## Open Questions / Follow-ups

- Exact minimum iOS/Android OS versions to target — not yet fixed; default to
  whatever Expo's current bare-workflow baseline requires unless the user
  specifies otherwise during implementation planning.
- Visual design details (exact color palette, control layout mockups) to be
  refined during implementation, optionally with the visual design canvas
  tool if a concrete mockup question comes up.

## Phase 2 Preview (not part of this spec)

Nintendo DS support (melonDS or DeSmuME core) as a separate project, reusing
this phase's native-module/rendering/audio architecture pattern but adding
dual-screen rendering and touch-screen input mapping. To be scoped in its own
spec once Phase 1 is working.
