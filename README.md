# PokeEmu (Phase 1: GBA)

Personal, offline GBA emulator built on mGBA. Sideload only — not distributed via any app store.

## Current status (as of this commit)

- **Android:** all native code (Kotlin + JNI/C++) is written and type-checked, and the JS/TS layer is fully covered by Jest (38 tests) plus a clean `npx tsc --noEmit`. **The native code has not yet been compiled or run on a real device** — this development machine has no local Android SDK/NDK/Java, so building was deferred to EAS Build (see below).
- **iOS:** the Swift/Objective-C source files are written and staged under `ios-pending/PokeEmu/` (not `ios/PokeEmu/`), because `expo prebuild` cannot generate the real Xcode project on Windows at all. Once `ios/` exists (via WSL with a Linux distro, or a Mac/Linux machine running `npx expo prebuild --platform ios`), these files need to be moved into `ios/PokeEmu/` and added to the Xcode project, and the bridging header needs `#import <React/RCTEventEmitter.h>` added (see `PokeEmuCoreModule.swift`'s note).
- **Manual QA checklist has not been run.** Doing so requires an actual build installed on a physical device — the next real step is triggering an EAS development build (`eas build --profile development --platform android`, configured in `eas.json`) and installing it, then working through the checklist below.

## Manual QA checklist (to run once a real build exists)

Using your own legally-owned Pokémon GBA ROM:
1. Import it via "Import a ROM" on the home screen.
2. Launch it — confirm video renders and audio plays.
3. Save a state to slot 1, play further, load slot 1, confirm the game state reverts.
4. Connect a Bluetooth controller — confirm the "🎮 Connected" indicator appears and both touch and physical buttons move the game.
5. Hold the fast-forward button — confirm the game speeds up and returns to normal on release.
6. Add a known GameShark cheat code via the Cheats screen — confirm its in-game effect, then toggle it off and confirm the effect stops.
7. Force-quit the app and relaunch, reload the same ROM — confirm the in-game save persisted.
8. Toggle Sound off in Settings, launch a ROM — confirm no audio plays; toggle back on, launch another ROM — confirm audio plays.

## Running on Android (sideload via EAS Build)

This machine has no local Android SDK/NDK, so builds go through Expo's cloud build service instead of a local `./gradlew`:

1. `npm install`
2. `npx eas login` (already linked to the `impoxx` account for this project)
3. `npx eas build --profile development --platform android`
4. Install the resulting build on your device via the link EAS prints.

## Running on iOS

Blocked until the real `ios/` Xcode project exists (see "Current status" above). Once it does:

1. `npm install && npx pod-install`
2. `npx eas build --profile development --platform ios` (or open `ios/PokeEmu.xcworkspace` directly in Xcode on a Mac and run there)
3. Install the resulting build on your device.

## Adding ROMs

Use the "Import a ROM" button on the home screen to pick a `.gba` file from your device's storage. Only import ROMs you legally own. No ROMs are ever bundled with this app or committed to this repository.

## Project layout

See `docs/superpowers/specs/2026-08-27-gba-emulator-phase1-design.md` for the design spec and `docs/superpowers/plans/2026-08-27-gba-emulator-phase1.md` for the implementation plan (including corrections found while building, against real vendored mGBA headers and real dependency versions).
