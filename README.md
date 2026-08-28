# PokeEmu (Phase 1: GBA)

Personal, offline GBA emulator built on mGBA. Sideload only — not distributed via any app store.

## Current status (as of this commit)

- **Android:** builds successfully end-to-end via EAS Build (Kotlin, JNI/C++, and the vendored mGBA core all compile and link) — the JS/TS layer is fully covered by Jest (41 tests) plus a clean `npx tsc --noEmit`. Getting the first real build green surfaced several native issues no amount of local type-checking could catch (a nullable `ReactHost` API, mGBA's CMake defaulting to its Qt/SDL desktop frontends, missing header includes, an NDK/mGBA `strtof_l` symbol collision) — all fixed and documented in the git history. **Not yet installed/run on a physical device** — the manual QA checklist below hasn't been walked through yet.
- **iOS:** the Swift/Objective-C source files, plus a first-attempt CMake/CocoaPods setup for building the vendored mGBA core as an iOS module (`ios-pending/mgba.podspec`, `ios-pending/mgba-ios/`), are staged under `ios-pending/` (not `ios/`), because `expo prebuild` refuses to run on Windows at all — confirmed by trying it, not just a CocoaPods gap. WSL was attempted as a workaround and hit a hardware wall (CPU virtualization disabled in BIOS/UEFI, `HCS_E_HYPERV_NOT_INSTALLED`), so this is still blocked on getting real Mac/Linux access. **See `docs/superpowers/specs/2026-08-28-ios-build-setup.md` for the exact, ordered steps to run once that access exists** — none of it has been run or verified yet, and the podspec in particular should be expected to need real debugging against actual `pod install`/Xcode error output, the same way the Android CMake build did.
- **Manual QA checklist has not been run yet.** An installable Android development build now exists — install it on a physical device and work through the checklist below.

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

Blocked until the real `ios/` Xcode project exists — see
`docs/superpowers/specs/2026-08-28-ios-build-setup.md` for the exact,
ordered steps (needs one-time Mac/Linux access to run `expo prebuild`; every
build after that can go through EAS from anywhere, no Mac required). Once
`ios/` exists and is committed:

1. `npm install`
2. Account-free verification build (no Apple Developer account needed):
   `npx eas build --profile development-simulator --platform ios` — produces
   an unsigned `.app` for the iOS Simulator.
3. Real device / TestFlight builds need an Apple Developer account (free
   tier: ad-hoc installs signed via Xcode; paid $99/year: any TestFlight
   distribution) — not set up yet.

## Adding ROMs

Use the "Import a ROM" button on the home screen to pick a `.gba` file from your device's storage. Only import ROMs you legally own. No ROMs are ever bundled with this app or committed to this repository.

## Project layout

See `docs/superpowers/specs/2026-08-27-gba-emulator-phase1-design.md` for the design spec and `docs/superpowers/plans/2026-08-27-gba-emulator-phase1.md` for the implementation plan (including corrections found while building, against real vendored mGBA headers and real dependency versions).
