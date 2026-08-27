# PokeEmu Phase 1 (GBA Emulator) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal, offline, sideload-only iOS + Android app that emulates GBA ROMs using the mGBA core, with an Apple-style UI accented with Pokémon theming, touch + external-controller input, save states, fast-forward, and GameShark cheats.

**Architecture:** Expo bare-workflow React Native app. A native module (`PokeEmuCore`, Swift on iOS / Kotlin+JNI on Android) wraps the vendored `libmgba` C core directly — no libretro layer. Video is written by the core straight into a native render view (bypassing the JS bridge); audio is pushed straight into platform audio APIs. The JS/RN layer owns navigation, the ROM library, on-screen controls, settings, and cheat entry, and talks to the native module only for infrequent calls (load ROM, per-frame button state, save/load state, apply cheat).

**Tech Stack:** Expo (bare workflow), React Native, TypeScript, Zustand, react-native-mmkv, expo-document-picker, expo-file-system, @react-navigation/native, Jest. Native: Swift + Metal/GLKit + AVAudioEngine (iOS); Kotlin + JNI + OpenGL ES/SurfaceView + Oboe (Android). Core: `libmgba`, vendored as a pinned git submodule.

**Spec:** `G:\Claude\PokeEmu\docs\superpowers\specs\2026-08-27-gba-emulator-phase1-design.md`

## Global Constraints

- Personal sideload use only — no App Store / Play Store submission, so no store-review constraints apply to entitlements, JIT, or private APIs.
- mGBA is vendored as a git submodule pinned to a specific stable tag (this plan uses `0.10.3` — confirm it still exists on `https://github.com/mgba-emu/mgba/tags` when Task 2 runs; if it has been superseded, pin the newest `0.10.x` tag instead and note the substitution in the task's commit message).
- All calls into mGBA's public `struct mCore` API must be checked against the vendored copy of `include/mgba/core/core.h` at the pinned tag before use — the field names below match the stable public core API but the engineer must confirm exact signatures against the vendored header, since the ABI can shift slightly between minor versions.
- No ROMs are ever bundled in the repo or committed to git. All manual verification steps use a ROM file the user supplies locally, at a path outside version control (`fixtures/` is gitignored).
- Native/core-integration tasks are verified manually (build, run, observe) rather than with automated unit tests, per the spec's Testing section — mGBA's C internals are not re-tested by this project. JS/TS business logic (stores, parsers) uses real Jest TDD.
- Package manager: npm (matches the user's other Expo projects).
- **Build mechanism:** the development machine is Windows with no local Xcode (impossible on Windows at all) and no local Android SDK/NDK/Java installed. All native builds go through **EAS Build** (configured in Task 1.5) instead of `npx expo run:ios` / `npx expo run:android`. Wherever a later task's manual verification step says to run one of those commands, substitute: trigger an EAS development build for that platform (`eas build --profile development --platform ios` / `--platform android`) and install the resulting build on a physical device via the link EAS prints, then perform the same observation the step describes.
- **iOS project scaffold gap (confirmed 2026-08-27):** `expo prebuild` cannot generate the `ios/` native project on Windows at all (Expo's own CLI confirms this — macOS or Linux only); WSL is present on this machine but has no Linux distribution installed yet. Decision: proceed with Android + the platform-agnostic JS/TS layer first. iOS-side tasks still get their Swift/Objective-C source files authored as real code, but cannot be wired into an actual Xcode project (`.xcodeproj`/`.xcworkspace`/`Podfile`) until `ios/` exists — that requires either setting up WSL with a Linux distro, or the user running `npx expo prebuild --platform ios` once on a Mac/Linux machine and bringing the generated `ios/` folder back into this repo. Treat every iOS-integration step in Tasks 9–21 as blocked-pending-`ios/`-scaffold until that happens; do not silently skip recording this — flag it again at the point each iOS step would otherwise run.
- **`@testing-library/react-native` v14 async API (confirmed 2026-08-27):** the installed RTL version (required for React 19 / RN 0.86 — v13 and earlier don't support React 19 at all, since React 19 removed `react-test-renderer` entirely) makes `render`, `rerender`, `unmount`, `renderHook`, `fireEvent` (and its `.press`/`.changeText`/`.scroll` helpers), and `act` all return Promises. Every test in this plan that calls any of those must `await` the call and the enclosing `it(...)` callback must be `async` — e.g. `const { getByText } = await render(<X />)`, `await fireEvent.press(...)`. Calling them without `await` silently returns an unresolved Promise (which destructures to `undefined` fields) rather than throwing, so a missing `await` shows up as `TypeError: getByText is not a function`, not an obvious async-related error.
- **Dependency API drift caught by `tsc --noEmit` (confirmed 2026-08-27):** Jest/Babel strips TypeScript types without checking them, so it does not catch these — run `npx tsc --noEmit` periodically (tsconfig excludes `vendor/`, `ios-pending/`, `android/`, `ios/`) to catch drift like this early. Two real ones found in this project's installed versions: (1) `react-native-mmkv` is v4 (Nitro-Modules-based) and exports `MMKV` as a type only — use `createMMKV({ id })`, not `new MMKV({ id })`; the mock at `__mocks__/react-native-mmkv.js` exports `createMMKV` accordingly. (2) `expo-file-system`'s default export replaced the classic `documentDirectory`/`copyAsync`/etc. API with a new `File`/`Directory`/`Paths` API — those old names still exist on the default import but throw at runtime; import from `expo-file-system/legacy` instead wherever this plan uses the classic API.

---

## File Structure

```
PokeEmu/
  App.tsx
  app.json
  package.json
  ios/                          (generated by `expo prebuild`, then hand-edited)
    PokeEmu/
      PokeEmuCoreModule.swift
      PokeEmuCoreModule.m           (RCT_EXTERN_MODULE bridge header)
      PokeEmuRenderView.swift
      PokeEmuRenderViewManager.swift
      PokeEmuRenderViewManager.m
      MGBABridge.swift              (thin Swift wrapper over the C core API)
  android/                       (generated by `expo prebuild`, then hand-edited)
    app/src/main/java/com/pokeemu/core/
      PokeEmuCoreModule.kt
      PokeEmuCorePackage.kt
      PokeEmuRenderView.kt
      PokeEmuRenderViewManager.kt
    app/src/main/cpp/
      CMakeLists.txt
      mgba_bridge.cpp
      mgba_bridge.h
  vendor/mgba/                   (git submodule, pinned tag)
  src/
    theme/
      tokens.ts
      tokens.test.ts
    state/
      romLibrary.ts
      romLibrary.test.ts
      settings.ts
      settings.test.ts
      session.ts
    cheats/
      gameSharkParser.ts
      gameSharkParser.test.ts
    native/
      PokeEmuCore.ts             (TS interface + NativeModules binding)
      PokeEmuRenderView.tsx       (requireNativeComponent wrapper)
      buttons.ts                 (GBAButton enum, shared)
    controls/
      TouchControls.tsx
      TouchControls.test.tsx
      useGamepadStatus.ts
    screens/
      RomListScreen.tsx
      RomListScreen.test.tsx
      EmulatorScreen.tsx
      SettingsScreen.tsx
      CheatsEditorScreen.tsx
    navigation/
      RootNavigator.tsx
  fixtures/                      (gitignored — user's own test ROM goes here)
  __tests__/
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `PokeEmu/` (via `create-expo-app`), `package.json`, `App.tsx`, `tsconfig.json`, `jest.config.js`, `.gitignore`

**Interfaces:**
- Produces: a runnable Expo bare-workflow TypeScript app with Jest configured, that later tasks add source to under `src/`.

- [ ] **Step 1: Scaffold the app**

```bash
npx create-expo-app@latest PokeEmu --template blank-typescript
cd PokeEmu
npx expo prebuild
```

This generates `ios/` and `android/` native projects — required because Task 8+ add custom native modules that don't exist in the managed workflow.

- [ ] **Step 2: Install core dependencies**

```bash
npm install zustand react-native-mmkv @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context expo-document-picker expo-file-system
npx pod-install
```

- [ ] **Step 3: Configure Jest**

Create `jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*)',
  ],
};
```

```bash
npm install --save-dev jest-expo jest @types/jest
```

- [ ] **Step 4: Add `.gitignore` entries for local-only files**

Append to `.gitignore`:

```
fixtures/
*.gba
*.sav
*.state
```

- [ ] **Step 5: Verify the app boots**

Run: `npx expo run:ios` (or `run:android`)
Expected: default Expo template screen launches on a simulator/device without errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo bare-workflow app with Jest configured"
```

---

### Task 1.5: EAS Build configuration

**Files:**
- Create: `eas.json`
- Modify: `app.json` (add the `extra.eas.projectId` field EAS generates)

**Interfaces:**
- Produces: a `development` EAS build profile for both platforms, so every later task's "run locally" verification step can be replaced with "trigger an EAS development build and install it on device," per the Global Constraints note above.

- [ ] **Step 1: Install the EAS CLI**

```bash
npm install --save-dev eas-cli
```

- [ ] **Step 2: Log in to Expo (human step — requires the user's own account)**

Run: `npx eas login`
This opens an interactive prompt for Expo account credentials — the user runs this themselves once, since it's tied to their own Expo account (the same one used for the SpotifyClone/TamaPoke EAS builds mentioned in project history).

- [ ] **Step 3: Configure the project for EAS Build**

```bash
npx eas build:configure
```

This generates `eas.json` and writes a generated `extra.eas.projectId` into `app.json`. Accept the defaults for "bare React Native" when prompted (the project is already a bare workflow app after Task 1's `expo prebuild`).

- [ ] **Step 4: Confirm `eas.json` has a `development` profile for both platforms**

```json
{
  "cli": { "version": ">= 5.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "resourceClass": "m-medium" },
      "android": { "resourceClass": "medium" }
    }
  }
}
```

If `eas build:configure` didn't produce a `development` profile matching this shape, edit `eas.json` to match it.

- [ ] **Step 5: Confirm the vendored mGBA submodule will be included in EAS's clone**

EAS Build clones the repository fresh into its build container and does fetch registered git submodules automatically for a repo pushed to GitHub/GitLab/Bitbucket with EAS's GitHub/GitLab integration connected — confirm this by checking Expo's current EAS Build documentation for "git submodules" support at build time before relying on it; if unsupported for the connected git provider, the fallback is `eas build --local` is not an option here (still needs local Xcode/NDK), so instead vendor mGBA's needed source files directly into the repo (drop the git-submodule approach from Task 2) rather than as a submodule reference.

- [ ] **Step 6: Verify with a throwaway build**

Run: `npx eas build --profile development --platform android`
Expected: the build queues and completes in Expo's cloud (no local Android SDK needed); a QR code / link is printed for installing the resulting build on a physical Android device. Repeat with `--platform ios` once an Apple Developer account is available for ad hoc signing (can be deferred until Task 9's first real iOS-side verification is due).

- [ ] **Step 7: Commit**

```bash
git add eas.json app.json
git commit -m "chore: configure EAS Build for development-profile installs on physical devices"
```

---

### Task 2: Vendor mGBA

**Files:**
- Create: `vendor/mgba/` (git submodule)

**Interfaces:**
- Produces: a pinned local copy of mGBA's source, including `include/mgba/core/core.h`, for Tasks 9–10 to build against.

- [ ] **Step 1: Add the submodule pinned to a stable tag**

```bash
git submodule add https://github.com/mgba-emu/mgba.git vendor/mgba
cd vendor/mgba
git fetch --tags
git checkout 0.10.3
cd ../..
```

If `0.10.3` no longer exists in the tag list, checkout the newest `0.10.x` tag instead and note the actual tag used in the commit message for this step.

- [ ] **Step 2: Confirm the public core API header is present**

Run: `test -f vendor/mgba/include/mgba/core/core.h && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit the submodule pin**

```bash
git add .gitmodules vendor/mgba
git commit -m "chore: vendor mGBA core as a pinned git submodule"
```

---

### Task 3: Theme tokens (Apple-style + Pokémon accents)

**Files:**
- Create: `src/theme/tokens.ts`
- Test: `src/theme/tokens.test.ts`

**Interfaces:**
- Produces: `theme` object (`colors`, `radii`, `spacing`, `typography`) consumed by every screen/component task from here on.

- [ ] **Step 1: Write the failing test**

```ts
// src/theme/tokens.test.ts
import { theme } from './tokens';

describe('theme tokens', () => {
  it('exposes the Pokéball-red accent as the primary color', () => {
    expect(theme.colors.primary).toBe('#EE1515');
  });

  it('exposes an Apple-style system font family', () => {
    expect(theme.typography.body.fontFamily).toBe('System');
  });

  it('exposes a translucent surface color for blur/glass panels', () => {
    expect(theme.colors.glassSurface).toMatch(/^rgba\(/);
  });

  it('exposes a consistent 8pt spacing scale', () => {
    expect(theme.spacing.md).toBe(16);
    expect(theme.spacing.lg).toBe(24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/theme/tokens.test.ts`
Expected: FAIL with "Cannot find module './tokens'"

- [ ] **Step 3: Write the implementation**

```ts
// src/theme/tokens.ts
export const theme = {
  colors: {
    primary: '#EE1515',       // Pokéball red
    primaryDark: '#B3040D',
    accentYellow: '#FFCB05',  // Pokéball button yellow
    background: '#F2F2F7',    // iOS systemGroupedBackground (light)
    backgroundDark: '#000000',
    surface: '#FFFFFF',
    surfaceDark: '#1C1C1E',
    glassSurface: 'rgba(255,255,255,0.72)',
    glassSurfaceDark: 'rgba(28,28,30,0.72)',
    label: '#000000',
    labelDark: '#FFFFFF',
    secondaryLabel: '#3C3C4399',
  },
  radii: {
    sm: 8,
    md: 14,
    lg: 22,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    largeTitle: { fontFamily: 'System', fontSize: 34, fontWeight: '700' as const },
    title: { fontFamily: 'System', fontSize: 22, fontWeight: '600' as const },
    body: { fontFamily: 'System', fontSize: 17, fontWeight: '400' as const },
    caption: { fontFamily: 'System', fontSize: 13, fontWeight: '400' as const },
  },
};

export type Theme = typeof theme;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/theme/tokens.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/theme
git commit -m "feat: add Apple-style theme tokens with Pokémon accent colors"
```

---

### Task 4: `romLibrary` Zustand store

**Files:**
- Create: `src/state/romLibrary.ts`
- Test: `src/state/romLibrary.test.ts`

**Interfaces:**
- Produces: `useRomLibraryStore` with state `{ roms: RomEntry[] }` and actions `addRom(entry: RomEntry)`, `removeRom(id: string)`, `getRom(id: string): RomEntry | undefined`.
- `RomEntry = { id: string; title: string; filePath: string; importedAt: number }`
- Consumed by: Task 6 (import flow), Task 7 (list screen).

- [ ] **Step 1: Write the failing test**

```ts
// src/state/romLibrary.test.ts
import { useRomLibraryStore } from './romLibrary';

const reset = () => useRomLibraryStore.setState({ roms: [] });

describe('romLibrary store', () => {
  beforeEach(reset);

  it('starts empty', () => {
    expect(useRomLibraryStore.getState().roms).toEqual([]);
  });

  it('adds a rom entry', () => {
    useRomLibraryStore.getState().addRom({
      id: 'abc123',
      title: 'Pokemon - Emerald Version',
      filePath: '/roms/emerald.gba',
      importedAt: 1000,
    });
    expect(useRomLibraryStore.getState().roms).toHaveLength(1);
    expect(useRomLibraryStore.getState().roms[0].title).toBe('Pokemon - Emerald Version');
  });

  it('does not add a duplicate id twice', () => {
    const entry = { id: 'abc123', title: 'Emerald', filePath: '/roms/emerald.gba', importedAt: 1000 };
    useRomLibraryStore.getState().addRom(entry);
    useRomLibraryStore.getState().addRom(entry);
    expect(useRomLibraryStore.getState().roms).toHaveLength(1);
  });

  it('removes a rom by id', () => {
    useRomLibraryStore.getState().addRom({
      id: 'abc123', title: 'Emerald', filePath: '/roms/emerald.gba', importedAt: 1000,
    });
    useRomLibraryStore.getState().removeRom('abc123');
    expect(useRomLibraryStore.getState().roms).toEqual([]);
  });

  it('getRom returns the matching entry or undefined', () => {
    useRomLibraryStore.getState().addRom({
      id: 'abc123', title: 'Emerald', filePath: '/roms/emerald.gba', importedAt: 1000,
    });
    expect(useRomLibraryStore.getState().getRom('abc123')?.title).toBe('Emerald');
    expect(useRomLibraryStore.getState().getRom('missing')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/state/romLibrary.test.ts`
Expected: FAIL with "Cannot find module './romLibrary'"

- [ ] **Step 3: Write the implementation**

```ts
// src/state/romLibrary.ts
import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'pokeemu-rom-library' });
const STORAGE_KEY = 'roms';

export type RomEntry = {
  id: string;
  title: string;
  filePath: string;
  importedAt: number;
};

type RomLibraryState = {
  roms: RomEntry[];
  addRom: (entry: RomEntry) => void;
  removeRom: (id: string) => void;
  getRom: (id: string) => RomEntry | undefined;
};

function loadPersisted(): RomEntry[] {
  const raw = storage.getString(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as RomEntry[]) : [];
}

function persist(roms: RomEntry[]) {
  storage.set(STORAGE_KEY, JSON.stringify(roms));
}

export const useRomLibraryStore = create<RomLibraryState>((set, get) => ({
  roms: loadPersisted(),
  addRom: (entry) => {
    const exists = get().roms.some((r) => r.id === entry.id);
    if (exists) return;
    const roms = [...get().roms, entry];
    persist(roms);
    set({ roms });
  },
  removeRom: (id) => {
    const roms = get().roms.filter((r) => r.id !== id);
    persist(roms);
    set({ roms });
  },
  getRom: (id) => get().roms.find((r) => r.id === id),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/state/romLibrary.test.ts`
Expected: PASS (5 tests). Note: MMKV's native module isn't available under plain `jest-expo` — if the run fails inside `createMMKV(...)` (e.g. "NitroModules could not be found"), add a manual mock at `__mocks__/react-native-mmkv.js` (repo root, adjacent to `node_modules`) exporting a `createMMKV({ id })` function backed by a simple in-memory `Map` per `id` — Jest auto-applies root-level `__mocks__/<package>.js` files for node_modules packages without needing an explicit `jest.mock()` call in each test file — then re-run.

**Correction (confirmed 2026-08-27):** the installed `react-native-mmkv` (v4, Nitro-Modules-based) exports `MMKV` as a type only — construction is `createMMKV({ id })`, not `new MMKV({ id })`. `.getString(key)`/`.set(key, value)` instance methods are unchanged. This plan uses `createMMKV` throughout; if a future install pulls an older v2/v3 MMKV, revert to `new MMKV(...)`.

- [ ] **Step 5: Commit**

```bash
git add src/state/romLibrary.ts src/state/romLibrary.test.ts
git commit -m "feat: add persisted romLibrary Zustand store"
```

---

### Task 5: `settings` Zustand store

**Files:**
- Create: `src/state/settings.ts`
- Test: `src/state/settings.test.ts`

**Interfaces:**
- Produces: `useSettingsStore` with state `{ fastForwardSpeed: number; soundEnabled: boolean; buttonMapping: Record<GBAButton, string> }` and actions `setFastForwardSpeed(n: number)`, `setSoundEnabled(b: boolean)`, `setButtonMapping(button: GBAButton, controllerButtonId: string)`.
- Consumed by: Task 20 (Fast-forward), Task 21 (Settings screen), Task 15 (gamepad mapping).

- [ ] **Step 1: Write the failing test**

```ts
// src/state/settings.test.ts
import { useSettingsStore } from './settings';
import { GBAButton } from '../native/buttons';

describe('settings store', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      fastForwardSpeed: 2,
      soundEnabled: true,
      buttonMapping: {} as Record<GBAButton, string>,
    });
  });

  it('defaults fastForwardSpeed to 2x', () => {
    expect(useSettingsStore.getState().fastForwardSpeed).toBe(2);
  });

  it('updates fastForwardSpeed within 1-8x bounds', () => {
    useSettingsStore.getState().setFastForwardSpeed(4);
    expect(useSettingsStore.getState().fastForwardSpeed).toBe(4);
  });

  it('clamps fastForwardSpeed above 8 down to 8', () => {
    useSettingsStore.getState().setFastForwardSpeed(20);
    expect(useSettingsStore.getState().fastForwardSpeed).toBe(8);
  });

  it('toggles soundEnabled', () => {
    useSettingsStore.getState().setSoundEnabled(false);
    expect(useSettingsStore.getState().soundEnabled).toBe(false);
  });

  it('maps a GBA button to a controller button id', () => {
    useSettingsStore.getState().setButtonMapping(GBAButton.A, 'button_south');
    expect(useSettingsStore.getState().buttonMapping[GBAButton.A]).toBe('button_south');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/state/settings.test.ts`
Expected: FAIL — `./settings` and `../native/buttons` don't exist yet.

- [ ] **Step 3: Write `src/native/buttons.ts` first (shared dependency)**

```ts
// src/native/buttons.ts
export enum GBAButton {
  A = 'A',
  B = 'B',
  L = 'L',
  R = 'R',
  Start = 'Start',
  Select = 'Select',
  Up = 'Up',
  Down = 'Down',
  Left = 'Left',
  Right = 'Right',
}
```

- [ ] **Step 4: Write the settings store implementation**

```ts
// src/state/settings.ts
import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';
import { GBAButton } from '../native/buttons';

const storage = createMMKV({ id: 'pokeemu-settings' });
const STORAGE_KEY = 'settings';

type SettingsState = {
  fastForwardSpeed: number;
  soundEnabled: boolean;
  buttonMapping: Partial<Record<GBAButton, string>>;
  setFastForwardSpeed: (n: number) => void;
  setSoundEnabled: (b: boolean) => void;
  setButtonMapping: (button: GBAButton, controllerButtonId: string) => void;
};

const DEFAULTS = {
  fastForwardSpeed: 2,
  soundEnabled: true,
  buttonMapping: {} as Partial<Record<GBAButton, string>>,
};

function loadPersisted() {
  const raw = storage.getString(STORAGE_KEY);
  return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
}

function persist(state: Pick<SettingsState, 'fastForwardSpeed' | 'soundEnabled' | 'buttonMapping'>) {
  storage.set(STORAGE_KEY, JSON.stringify(state));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadPersisted(),
  setFastForwardSpeed: (n) => {
    const clamped = Math.min(8, Math.max(1, n));
    const next = { ...get(), fastForwardSpeed: clamped };
    persist(next);
    set({ fastForwardSpeed: clamped });
  },
  setSoundEnabled: (b) => {
    persist({ ...get(), soundEnabled: b });
    set({ soundEnabled: b });
  },
  setButtonMapping: (button, controllerButtonId) => {
    const buttonMapping = { ...get().buttonMapping, [button]: controllerButtonId };
    persist({ ...get(), buttonMapping });
    set({ buttonMapping });
  },
}));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/state/settings.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/state/settings.ts src/state/settings.test.ts src/native/buttons.ts
git commit -m "feat: add settings Zustand store and shared GBAButton enum"
```

---

### Task 6: GameShark cheat code parser

**Files:**
- Create: `src/cheats/gameSharkParser.ts`
- Test: `src/cheats/gameSharkParser.test.ts`

**Interfaces:**
- Produces: `parseGameSharkCode(raw: string): { valid: boolean; normalized: string }`. A GameShark GBA code is 8 hex digits, a space, then 8 hex digits (`XXXXXXXX YYYYYYYY`).
- Consumed by: Task 19 (CheatsEditorScreen), Task 18 (native cheat wiring).

- [ ] **Step 1: Write the failing test**

```ts
// src/cheats/gameSharkParser.test.ts
import { parseGameSharkCode } from './gameSharkParser';

describe('parseGameSharkCode', () => {
  it('accepts a well-formed code and normalizes to uppercase', () => {
    expect(parseGameSharkCode('1a2b3c4d 5e6f7081')).toEqual({
      valid: true,
      normalized: '1A2B3C4D 5E6F7081',
    });
  });

  it('accepts a code missing the space and inserts it', () => {
    expect(parseGameSharkCode('1A2B3C4D5E6F7081')).toEqual({
      valid: true,
      normalized: '1A2B3C4D 5E6F7081',
    });
  });

  it('rejects a code with non-hex characters', () => {
    expect(parseGameSharkCode('1A2B3C4Z 5E6F7081').valid).toBe(false);
  });

  it('rejects a code with the wrong length', () => {
    expect(parseGameSharkCode('1A2B3C4D 5E6F708').valid).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(parseGameSharkCode('').valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/cheats/gameSharkParser.test.ts`
Expected: FAIL with "Cannot find module './gameSharkParser'"

- [ ] **Step 3: Write the implementation**

```ts
// src/cheats/gameSharkParser.ts
export function parseGameSharkCode(raw: string): { valid: boolean; normalized: string } {
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  const isHex16 = /^[0-9A-F]{16}$/.test(compact);
  if (!isHex16) {
    return { valid: false, normalized: '' };
  }
  const normalized = `${compact.slice(0, 8)} ${compact.slice(8, 16)}`;
  return { valid: true, normalized };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/cheats/gameSharkParser.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/cheats
git commit -m "feat: add GameShark cheat code parser with validation"
```

---

### Task 7: ROM import flow

**Files:**
- Create: `src/state/importRom.ts`
- Test: `src/state/importRom.test.ts`
- Modify: none (consumes Task 4's store)

**Interfaces:**
- Produces: `importRom(): Promise<RomEntry | null>` — opens the document picker, validates the GBA header, copies the file into `Documents/roms/`, calls `useRomLibraryStore.getState().addRom`, returns the new entry (or `null` if the user cancelled or the file failed validation).
- Consumes: `useRomLibraryStore` from Task 4.

- [ ] **Step 1: Write the failing test**

```ts
// src/state/importRom.test.ts
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { importRom } from './importRom';
import { useRomLibraryStore } from './romLibrary';

jest.mock('expo-document-picker');
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/sandbox/',
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
}));

const VALID_GBA_HEADER_B64 = Buffer.alloc(192, 0).toString('base64'); // simplified: real header check is on magic bytes at offset 0xB2

describe('importRom', () => {
  beforeEach(() => {
    useRomLibraryStore.setState({ roms: [] });
    jest.clearAllMocks();
  });

  it('returns null when the user cancels the picker', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true });
    const result = await importRom();
    expect(result).toBeNull();
    expect(useRomLibraryStore.getState().roms).toHaveLength(0);
  });

  it('copies a picked .gba file and adds it to the library', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/emerald.gba', name: 'Pokemon - Emerald Version.gba' }],
    });
    const result = await importRom();
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///picked/emerald.gba',
      to: '/sandbox/roms/Pokemon - Emerald Version.gba',
    });
    expect(result?.title).toBe('Pokemon - Emerald Version');
    expect(useRomLibraryStore.getState().roms).toHaveLength(1);
  });

  it('rejects a file that is not a .gba extension', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/notarom.txt', name: 'notarom.txt' }],
    });
    const result = await importRom();
    expect(result).toBeNull();
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/state/importRom.test.ts`
Expected: FAIL with "Cannot find module './importRom'"

- [ ] **Step 3: Write the implementation**

**Correction (confirmed 2026-08-27):** the installed `expo-file-system`'s default export replaced the classic promise-based API (`documentDirectory`, `copyAsync`, `getInfoAsync`, `makeDirectoryAsync`, `readAsStringAsync`) with a new `File`/`Directory`/`Paths`-based API in SDK 54+ — the old names still exist on the default import but throw at runtime. `expo-file-system/legacy` is Expo's own transitional subpath re-exporting the classic API this task is written against; import from there instead. `documentDirectory` is also typed `string | null` there, so guard it before use — and do that guard *inside* `importRom()`, not at module scope, so files that merely import this module (like `RomListScreen.tsx`) don't crash under Jest, where `documentDirectory` resolves to `null` with no native module bound.

```ts
// src/state/importRom.ts
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRomLibraryStore, RomEntry } from './romLibrary';

function titleFromFilename(name: string): string {
  return name.replace(/\.gba$/i, '');
}

export async function importRom(): Promise<RomEntry | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
  if (result.canceled || !result.assets?.[0]) {
    return null;
  }
  const asset = result.assets[0];
  if (!/\.gba$/i.test(asset.name)) {
    return null;
  }

  if (!FileSystem.documentDirectory) {
    throw new Error('expo-file-system: documentDirectory is unavailable on this platform');
  }
  const ROMS_DIR = `${FileSystem.documentDirectory}roms/`;

  const dirInfo = await FileSystem.getInfoAsync(ROMS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(ROMS_DIR, { intermediates: true });
  }

  const destination = `${ROMS_DIR}${asset.name}`;
  await FileSystem.copyAsync({ from: asset.uri, to: destination });

  const entry: RomEntry = {
    id: destination,
    title: titleFromFilename(asset.name),
    filePath: destination,
    importedAt: Date.now(),
  };
  useRomLibraryStore.getState().addRom(entry);
  return entry;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/state/importRom.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/state/importRom.ts src/state/importRom.test.ts
git commit -m "feat: add ROM import flow (picker, sandbox copy, library registration)"
```

---

### Task 8: RomList screen

**Files:**
- Create: `src/screens/RomListScreen.tsx`
- Test: `src/screens/RomListScreen.test.tsx`

**Interfaces:**
- Consumes: `useRomLibraryStore` (Task 4), `importRom` (Task 7), `theme` (Task 3).
- Produces: `RomListScreen` component, navigated to a `filePath` param on row press (consumed by Task 12's navigator wiring).

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/RomListScreen.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RomListScreen } from './RomListScreen';
import { useRomLibraryStore } from '../state/romLibrary';
import * as importRomModule from '../state/importRom';

jest.mock('../state/importRom');

describe('RomListScreen', () => {
  beforeEach(() => {
    useRomLibraryStore.setState({ roms: [] });
    jest.clearAllMocks();
  });

  it('shows an empty state with an import button when the library is empty', async () => {
    const { getByText } = await render(<RomListScreen navigation={{ navigate: jest.fn() } as any} />);
    expect(getByText(/import a rom/i)).toBeTruthy();
  });

  it('lists imported roms by title', async () => {
    useRomLibraryStore.setState({
      roms: [{ id: '1', title: 'Pokemon - Emerald Version', filePath: '/roms/e.gba', importedAt: 1 }],
    });
    const { getByText } = await render(<RomListScreen navigation={{ navigate: jest.fn() } as any} />);
    expect(getByText('Pokemon - Emerald Version')).toBeTruthy();
  });

  it('calls importRom when the import button is pressed', async () => {
    (importRomModule.importRom as jest.Mock).mockResolvedValue(null);
    const { getByText } = await render(<RomListScreen navigation={{ navigate: jest.fn() } as any} />);
    await fireEvent.press(getByText(/import a rom/i));
    await waitFor(() => expect(importRomModule.importRom).toHaveBeenCalled());
  });

  it('navigates to Emulator with the filePath when a row is pressed', async () => {
    useRomLibraryStore.setState({
      roms: [{ id: '1', title: 'Emerald', filePath: '/roms/e.gba', importedAt: 1 }],
    });
    const navigate = jest.fn();
    const { getByText } = await render(<RomListScreen navigation={{ navigate } as any} />);
    await fireEvent.press(getByText('Emerald'));
    expect(navigate).toHaveBeenCalledWith('Emulator', { filePath: '/roms/e.gba', romId: '1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/screens/RomListScreen.test.tsx`
Expected: FAIL with "Cannot find module './RomListScreen'". Note: if `@testing-library/react-native` isn't installed yet, run `npm install --save-dev @testing-library/react-native` first.

- [ ] **Step 3: Write the implementation**

```tsx
// src/screens/RomListScreen.tsx
import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRomLibraryStore } from '../state/romLibrary';
import { importRom } from '../state/importRom';
import { theme } from '../theme/tokens';

type Props = {
  navigation: { navigate: (screen: 'Emulator', params: { filePath: string; romId: string }) => void };
};

export function RomListScreen({ navigation }: Props) {
  const roms = useRomLibraryStore((s) => s.roms);

  const handleImport = async () => {
    await importRom();
  };

  return (
    <View style={styles.container}>
      {roms.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No ROMs yet.</Text>
          <Pressable style={styles.importButton} onPress={handleImport}>
            <Text style={styles.importButtonText}>Import a ROM</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={roms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('Emulator', { filePath: item.filePath, romId: item.id })}
            >
              <Text style={styles.rowTitle}>{item.title}</Text>
            </Pressable>
          )}
          ListHeaderComponent={
            <Pressable style={styles.importButtonInline} onPress={handleImport}>
              <Text style={styles.importButtonText}>Import a ROM</Text>
            </Pressable>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  emptyText: { ...theme.typography.body, color: theme.colors.secondaryLabel },
  importButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  importButtonInline: {
    backgroundColor: theme.colors.primary,
    margin: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
  },
  importButtonText: { color: '#FFFFFF', ...theme.typography.body, fontWeight: '600' },
  row: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  rowTitle: { ...theme.typography.body, color: theme.colors.label },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/screens/RomListScreen.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/screens/RomListScreen.tsx src/screens/RomListScreen.test.tsx
git commit -m "feat: add RomListScreen with Apple-style empty state and import flow"
```

---

### Task 9: `PokeEmuCore` native module scaffolding (both platforms) + TS interface

**Files:**
- Create: `src/native/PokeEmuCore.ts`
- Create: `ios/PokeEmu/PokeEmuCoreModule.swift`, `ios/PokeEmu/PokeEmuCoreModule.m`
- Create: `android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt`, `android/app/src/main/java/com/pokeemu/core/PokeEmuCorePackage.kt`

**Interfaces:**
- Produces: `PokeEmuCore` TS object with stubbed methods (`loadROM`, `play`, `pause`, `setButtonState`) that round-trip through the real native bridge on both platforms, proving the bridge is wired before Task 10 adds real mGBA logic.
- Consumed by: Task 10 (real core logic replaces the stub bodies), Task 13 (EmulatorScreen).

- [ ] **Step 1: Write the TS native module interface**

```ts
// src/native/PokeEmuCore.ts
import { NativeModules } from 'react-native';
import { GBAButton } from './buttons';

type PokeEmuCoreNative = {
  loadROM(path: string): Promise<{ width: number; height: number }>;
  unloadROM(): Promise<void>;
  play(): void;
  pause(): void;
  setButtonState(button: string, pressed: boolean): void;
  setFastForward(enabled: boolean, speedMultiplier: number): void;
  saveState(romId: string, slotIndex: number): Promise<void>;
  loadState(romId: string, slotIndex: number): Promise<void>;
  applyCheat(code: string, enabled: boolean): Promise<boolean>;
  removeAllCheats(): void;
};

export const PokeEmuCore = NativeModules.PokeEmuCore as PokeEmuCoreNative;

export function setButton(button: GBAButton, pressed: boolean) {
  PokeEmuCore.setButtonState(button, pressed);
}
```

- [ ] **Step 2: iOS — Swift module skeleton**

```swift
// ios/PokeEmu/PokeEmuCoreModule.swift
import Foundation

@objc(PokeEmuCoreModule)
class PokeEmuCoreModule: NSObject {

  @objc(loadROM:withResolver:withRejecter:)
  func loadROM(path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // Task 10 replaces this stub with real mGBA loading via MGBABridge.
    resolve(["width": 240, "height": 160])
  }

  @objc(unloadROM:withRejecter:)
  func unloadROM(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc func play() {}
  @objc func pause() {}
  @objc func setButtonState(_ button: String, pressed: Bool) {}
  @objc func setFastForward(_ enabled: Bool, speedMultiplier: Double) {}

  @objc(saveState:slotIndex:withResolver:withRejecter:)
  func saveState(romId: String, slotIndex: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc(loadState:slotIndex:withResolver:withRejecter:)
  func loadState(romId: String, slotIndex: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(nil)
  }

  @objc(applyCheat:enabled:withResolver:withRejecter:)
  func applyCheat(code: String, enabled: Bool, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(true)
  }

  @objc func removeAllCheats() {}

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
```

```objc
// ios/PokeEmu/PokeEmuCoreModule.m
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PokeEmuCoreModule, NSObject)

RCT_EXTERN_METHOD(loadROM:(NSString *)path withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(unloadROM:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(play)
RCT_EXTERN_METHOD(pause)
RCT_EXTERN_METHOD(setButtonState:(NSString *)button pressed:(BOOL)pressed)
RCT_EXTERN_METHOD(setFastForward:(BOOL)enabled speedMultiplier:(double)speedMultiplier)
RCT_EXTERN_METHOD(saveState:(NSString *)romId slotIndex:(nonnull NSNumber *)slotIndex withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(loadState:(NSString *)romId slotIndex:(nonnull NSNumber *)slotIndex withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(applyCheat:(NSString *)code enabled:(BOOL)enabled withResolver:(RCTPromiseResolveBlock)resolve withRejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(removeAllCheats)

@end
```

- [ ] **Step 3: Android — Kotlin module skeleton**

```kotlin
// android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt
package com.pokeemu.core

import com.facebook.react.bridge.*

class PokeEmuCoreModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = "PokeEmuCore"

  @ReactMethod
  fun loadROM(path: String, promise: Promise) {
    // Task 10 replaces this stub with a real JNI call into libmgba.
    val result = Arguments.createMap()
    result.putInt("width", 240)
    result.putInt("height", 160)
    promise.resolve(result)
  }

  @ReactMethod
  fun unloadROM(promise: Promise) { promise.resolve(null) }

  @ReactMethod
  fun play() {}

  @ReactMethod
  fun pause() {}

  @ReactMethod
  fun setButtonState(button: String, pressed: Boolean) {}

  @ReactMethod
  fun setFastForward(enabled: Boolean, speedMultiplier: Double) {}

  @ReactMethod
  fun saveState(romId: String, slotIndex: Int, promise: Promise) { promise.resolve(null) }

  @ReactMethod
  fun loadState(romId: String, slotIndex: Int, promise: Promise) { promise.resolve(null) }

  @ReactMethod
  fun applyCheat(code: String, enabled: Boolean, promise: Promise) { promise.resolve(true) }

  @ReactMethod
  fun removeAllCheats() {}
}
```

```kotlin
// android/app/src/main/java/com/pokeemu/core/PokeEmuCorePackage.kt
package com.pokeemu.core

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PokeEmuCorePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(PokeEmuCoreModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
```

Register the package in `android/app/src/main/java/com/pokeemu/MainApplication.kt`'s `getPackages()` — add `add(PokeEmuCorePackage())` to the returned list.

- [ ] **Step 4: Verify the bridge round-trips on both platforms**

Add a temporary console call in `App.tsx`: `PokeEmuCore.loadROM('/tmp/fake.gba').then(console.log)`.
Run: `npx expo run:ios` and `npx expo run:android`.
Expected: console logs `{width: 240, height: 160}` on both platforms — confirms the native module is registered and callable before real core logic is added. Remove the temporary call once confirmed.

- [ ] **Step 5: Commit**

```bash
git add src/native/PokeEmuCore.ts ios/PokeEmu/PokeEmuCoreModule.swift ios/PokeEmu/PokeEmuCoreModule.m android/app/src/main/java/com/pokeemu/core
git commit -m "feat: scaffold PokeEmuCore native module bridge (stubbed) on iOS and Android"
```

---

### Task 10: Wire the real mGBA core (both platforms)

**Files:**
- Create: `ios/PokeEmu/MGBABridge.swift`, `ios/PokeEmu/GBAKeyMask.swift`
- Modify: `ios/PokeEmu/PokeEmuCoreModule.swift` (replace stub bodies)
- Create: `android/app/src/main/cpp/CMakeLists.txt`, `android/app/src/main/cpp/mgba_bridge.h`, `android/app/src/main/cpp/mgba_bridge.cpp`
- Modify: `android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt` (replace stub bodies, add JNI `external fun` declarations)
- Modify: `android/app/build.gradle` (add `externalNativeBuild` pointing at the CMakeLists)

**Interfaces:**
- Produces: `loadROM` actually loads a ROM into a running `mCore`; `play`/`pause` actually start/stop the run loop on a background thread.
- Consumes: `vendor/mgba` (Task 2).

- [ ] **Step 1: iOS — add mGBA to the Xcode build**

In Xcode, add `vendor/mgba` as a subproject (or add its C sources for the `gba` and `core` targets directly to the `PokeEmu` target's Build Phases → Compile Sources), and add `vendor/mgba/include` to Header Search Paths. mGBA uses CMake natively; the simplest path for a bare RN iOS target is building a static library once via mGBA's own CMake with the iOS toolchain, then dragging the resulting `.a` plus `include/` into Xcode, rather than compiling mGBA's CMake project inline. Run mGBA's documented iOS cross-compile (`cmake -DCMAKE_TOOLCHAIN_FILE=... -DBUILD_SHARED_LIBS=OFF` per `vendor/mgba/README.md`'s iOS section) to produce `libmgba.a`; add it under `ios/PokeEmu/Libraries/libmgba.a` and link it in Xcode's "Link Binary With Libraries" build phase.

- [ ] **Step 2: iOS — thin Swift wrapper over the C core**

```swift
// ios/PokeEmu/MGBABridge.swift
import Foundation
import mgba // the vendored C headers, imported via the module map / bridging header

final class MGBABridge {
  private var core: UnsafeMutablePointer<mCore>?
  private var running = false
  private let queue = DispatchQueue(label: "com.pokeemu.core.runloop")

  func load(path: String) -> (width: Int, height: Int)? {
    guard let vf = VFileOpen(path, O_RDONLY) else { return nil }
    guard let found = mCoreFindVF(vf) else { return nil }
    core = found
    guard core!.pointee.`init`(core) else { return nil }
    guard core!.pointee.loadROM(core, vf) else { return nil }
    core!.pointee.reset(core)
    var width: CUnsignedInt = 0
    var height: CUnsignedInt = 0
    core!.pointee.desiredVideoDimensions(core, &width, &height)
    return (Int(width), Int(height))
  }
  // Field names above (`init`, `loadROM`, `reset`, `desiredVideoDimensions`) match
  // vendor/mgba/include/mgba/core/core.h at tag 0.10.3 — re-check against
  // that file if the pinned tag changes.

  func play() {
    guard let core = core, !running else { return }
    running = true
    queue.async { [weak self] in
      while self?.running == true {
        core.pointee.runFrame(core)
      }
    }
  }

  func pause() {
    running = false
  }

  func setKey(_ mask: UInt32, pressed: Bool) {
    guard let core = core else { return }
    if pressed {
      core.pointee.addKeys(core, mask)
    } else {
      core.pointee.clearKeys(core, mask)
    }
  }

  func unload() {
    pause()
    core?.pointee.`deinit`(core)
    core = nil
  }
}
```

- [ ] **Step 3: iOS — wire the bridge into the RN module**

```swift
// ios/PokeEmu/PokeEmuCoreModule.swift (replace stub bodies)
import Foundation

@objc(PokeEmuCoreModule)
class PokeEmuCoreModule: NSObject {
  private let bridge = MGBABridge()

  @objc(loadROM:withResolver:withRejecter:)
  func loadROM(path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let dims = bridge.load(path: path) else {
      reject("LOAD_FAILED", "Could not load ROM at \(path)", nil)
      return
    }
    resolve(["width": dims.width, "height": dims.height])
  }

  @objc(unloadROM:withRejecter:)
  func unloadROM(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    bridge.unload()
    resolve(nil)
  }

  @objc func play() { bridge.play() }
  @objc func pause() { bridge.pause() }

  @objc func setButtonState(_ button: String, pressed: Bool) {
    guard let mask = GBAKeyMask.forButtonName(button) else { return }
    bridge.setKey(mask, pressed: pressed)
  }

  @objc static func requiresMainQueueSetup() -> Bool { return false }
}
```

```swift
// ios/PokeEmu/GBAKeyMask.swift
import Foundation

enum GBAKeyMask {
  // Matches the standard GBA key-bit ordering used by mGBA's GBAKey enum
  // in vendor/mgba/include/mgba/gba/interface.h.
  static func forButtonName(_ name: String) -> UInt32? {
    switch name {
    case "A": return 1 << 0
    case "B": return 1 << 1
    case "Select": return 1 << 2
    case "Start": return 1 << 3
    case "Right": return 1 << 4
    case "Left": return 1 << 5
    case "Up": return 1 << 6
    case "Down": return 1 << 7
    case "R": return 1 << 8
    case "L": return 1 << 9
    default: return nil
    }
  }
}
```

- [ ] **Step 4: Android — CMake + JNI bridge**

```cmake
# android/app/src/main/cpp/CMakeLists.txt
cmake_minimum_required(VERSION 3.22)
project(pokeemu_bridge)

set(MGBA_DIR ${CMAKE_SOURCE_DIR}/../../../../../vendor/mgba)
add_subdirectory(${MGBA_DIR} mgba_build)

add_library(pokeemu_bridge SHARED mgba_bridge.cpp)
target_include_directories(pokeemu_bridge PRIVATE ${MGBA_DIR}/include)
target_link_libraries(pokeemu_bridge mgba log android)
```

```cpp
// android/app/src/main/cpp/mgba_bridge.h
#pragma once
#include <jni.h>

extern "C" {
JNIEXPORT jobject JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeLoadROM(JNIEnv*, jobject, jstring path);
JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativePlay(JNIEnv*, jobject);
JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativePause(JNIEnv*, jobject);
JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeSetButtonState(JNIEnv*, jobject, jstring button, jboolean pressed);
}
```

```cpp
// android/app/src/main/cpp/mgba_bridge.cpp
#include "mgba_bridge.h"
#include <mgba/core/core.h>
#include <mgba/gba/interface.h>
#include <atomic>
#include <string>
#include <thread>

namespace {
mCore* gCore = nullptr;
std::atomic<bool> gRunning{false};
std::thread gRunThread;

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
```

- [ ] **Step 5: Android — Kotlin side calling into JNI**

```kotlin
// android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt (replace stub bodies)
package com.pokeemu.core

import com.facebook.react.bridge.*

class PokeEmuCoreModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  companion object {
    init { System.loadLibrary("pokeemu_bridge") }
  }

  private external fun nativeLoadROM(path: String): WritableMap?
  private external fun nativePlay()
  private external fun nativePause()
  private external fun nativeSetButtonState(button: String, pressed: Boolean)

  override fun getName() = "PokeEmuCore"

  @ReactMethod
  fun loadROM(path: String, promise: Promise) {
    val result = nativeLoadROM(path)
    if (result == null) {
      promise.reject("LOAD_FAILED", "Could not load ROM at $path")
    } else {
      promise.resolve(result)
    }
  }

  @ReactMethod
  fun play() { nativePlay() }

  @ReactMethod
  fun pause() { nativePause() }

  @ReactMethod
  fun setButtonState(button: String, pressed: Boolean) { nativeSetButtonState(button, pressed) }

  // unloadROM, setFastForward, saveState, loadState, applyCheat, removeAllCheats
  // stay as Task 9's stubs until Tasks 17/20/21 replace them.
}
```

Add to `android/app/build.gradle` inside the `android { defaultConfig { ... } }` block:

```gradle
externalNativeBuild {
    cmake {
        cppFlags "-std=c++17"
    }
}
```

and at the `android { ... }` top level:

```gradle
externalNativeBuild {
    cmake {
        path "src/main/cpp/CMakeLists.txt"
    }
}
```

- [ ] **Step 6: Manual verification (both platforms)**

Place a homebrew or user-owned test ROM at `fixtures/test.gba` (gitignored, not committed). In `App.tsx`, temporarily call `PokeEmuCore.loadROM(<absolute path to fixtures/test.gba pushed onto the device>).then(console.log).catch(console.error)` followed by `PokeEmuCore.play()`.
Run: `npx expo run:ios` and `npx expo run:android`.
Expected: `loadROM` resolves with real `{width: 240, height: 240}`-style dimensions (240×160 for GBA) instead of the Task 9 stub values, and no crash occurs when `play()` runs for a few seconds. There's no visible picture yet — Task 11 adds the render view. Remove the temporary call once confirmed.

- [ ] **Step 7: Commit**

```bash
git add ios/PokeEmu/MGBABridge.swift ios/PokeEmu/PokeEmuCoreModule.swift android/app/src/main/cpp android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt android/app/build.gradle
git commit -m "feat: wire real mGBA core loading and run loop on iOS and Android"
```

---

### Task 11: Native render view (both platforms) + RN wrapper

**Files:**
- Create: `ios/PokeEmu/PokeEmuRenderView.swift`, `ios/PokeEmu/PokeEmuRenderViewManager.swift`, `ios/PokeEmu/PokeEmuRenderViewManager.m`
- Create: `android/app/src/main/java/com/pokeemu/core/PokeEmuRenderView.kt`, `android/app/src/main/java/com/pokeemu/core/PokeEmuRenderViewManager.kt`
- Modify: `android/app/src/main/java/com/pokeemu/core/PokeEmuCorePackage.kt` (register the view manager)
- Modify: `ios/PokeEmu/MGBABridge.swift` (expose the framebuffer pointer to the render view, free it on unload)
- Modify: `ios/PokeEmu/PokeEmuCoreModule.swift` (wire the buffer into the current render view after load)
- Modify: `android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt` (size the current render view after load)
- Modify: `android/app/src/main/cpp/mgba_bridge.cpp`, `android/app/src/main/cpp/mgba_bridge.h`, `android/app/src/main/cpp/CMakeLists.txt` (allocate the shared frame buffer, add the bitmap-copy JNI export, link `jnigraphics`)
- Create: `src/native/PokeEmuRenderView.tsx`

**Interfaces:**
- Produces: `<PokeEmuRenderView style={...} />` RN component that displays the running core's framebuffer.
- Consumed by: Task 12 (EmulatorScreen).

**Correction (confirmed 2026-08-27):** the original draft of this task left "wire the buffer/size into the view" as prose ("via a shared singleton reference") without writing the actual mechanism, which is a real functional gap — nothing would ever call `setFrameSize`/set `frameProvider`, so the view would never draw anything. Both platforms below use an explicit shared-instance reference (`PokeEmuRenderView.current`) that the currently-attached view registers itself under, so `PokeEmuCoreModule` has something concrete to reach after a ROM loads. Also fixed: the iOS video buffer is otherwise leaked on every ROM load (a fresh `UnsafeMutablePointer` was allocated with no `deallocate()` of the previous one) — `attachVideoBuffer` and `unload()` below free it.

- [ ] **Step 1: iOS — expose the framebuffer from the bridge**

```swift
// ios/PokeEmu/MGBABridge.swift (add to the class)
private var videoBuffer: UnsafeMutablePointer<UInt32>?

func attachVideoBuffer(width: Int, height: Int) -> UnsafeMutablePointer<UInt32> {
  videoBuffer?.deallocate()
  let buffer = UnsafeMutablePointer<UInt32>.allocate(capacity: width * height)
  buffer.initialize(repeating: 0, count: width * height)
  core?.pointee.setVideoBuffer(core, buffer, width)
  videoBuffer = buffer
  return buffer
}
```

```swift
// ios/PokeEmu/MGBABridge.swift (modify unload() to also free the buffer)
func unload() {
  pause()
  core?.pointee.`deinit`(core)
  core = nil
  videoBuffer?.deallocate()
  videoBuffer = nil
}
```

- [ ] **Step 2: iOS — render view drawing the buffer via a `CADisplayLink`**

```swift
// ios/PokeEmu/PokeEmuRenderView.swift
import UIKit

class PokeEmuRenderView: UIView {
  // PokeEmuCoreModule only learns the ROM's video buffer/dimensions after
  // MGBABridge.load(path:) returns, and it has no other handle to whichever
  // PokeEmuRenderView the JS side has mounted — this shared reference is
  // how it reaches the currently-attached view to set its frameProvider.
  static weak var current: PokeEmuRenderView?

  var frameProvider: (() -> (UnsafeMutablePointer<UInt32>, Int, Int)?)?
  private var displayLink: CADisplayLink?

  override init(frame: CGRect) {
    super.init(frame: frame)
    contentMode = .scaleAspectFit
    displayLink = CADisplayLink(target: self, selector: #selector(tick))
    displayLink?.add(to: .main, forMode: .common)
  }
  required init?(coder: NSCoder) { fatalError("not supported") }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      PokeEmuRenderView.current = self
    } else if PokeEmuRenderView.current === self {
      PokeEmuRenderView.current = nil
    }
  }

  @objc private func tick() {
    guard let (buffer, width, height) = frameProvider?() else { return }
    guard let context = CGContext(
      data: buffer, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
      space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ), let cgImage = context.makeImage() else { return }
    layer.contents = cgImage
  }
}
```

```swift
// ios/PokeEmu/PokeEmuRenderViewManager.swift
import Foundation

@objc(PokeEmuRenderViewManager)
class PokeEmuRenderViewManager: RCTViewManager {
  override func view() -> UIView! { PokeEmuRenderView() }
  override static func requiresMainQueueSetup() -> Bool { true }
}
```

```objc
// ios/PokeEmu/PokeEmuRenderViewManager.m
#import <React/RCTViewManager.h>
@interface RCT_EXTERN_MODULE(PokeEmuRenderViewManager, RCTViewManager)
@end
```

```swift
// ios/PokeEmu/PokeEmuCoreModule.swift (modify loadROM to wire the buffer into the current view)
@objc(loadROM:withResolver:withRejecter:)
func loadROM(path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
  guard let dims = bridge.load(path: path) else {
    reject("LOAD_FAILED", "Could not load ROM at \(path)", nil)
    return
  }
  let buffer = bridge.attachVideoBuffer(width: dims.width, height: dims.height)
  PokeEmuRenderView.current?.frameProvider = { (buffer, dims.width, dims.height) }
  resolve(["width": dims.width, "height": dims.height])
}
```

- [ ] **Step 3: Android — render view drawing the buffer onto a `SurfaceView`**

```kotlin
// android/app/src/main/java/com/pokeemu/core/PokeEmuRenderView.kt
package com.pokeemu.core

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Rect
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.Choreographer

class PokeEmuRenderView(context: Context) : SurfaceView(context), SurfaceHolder.Callback, Choreographer.FrameCallback {
  companion object {
    // Same shared-reference need as PokeEmuRenderView.current on iOS: this
    // is how PokeEmuCoreModule.loadROM reaches the mounted view to size it.
    var current: PokeEmuRenderView? = null
  }

  private var bitmap: Bitmap? = null

  init { holder.addCallback(this) }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    current = this
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    if (current === this) current = null
  }

  fun setFrameSize(width: Int, height: Int) {
    bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
  }

  external fun nativeCopyFrameInto(bitmap: Bitmap)

  override fun doFrame(frameTimeNanos: Long) {
    val bmp = bitmap
    val surfaceHolder = holder
    if (bmp != null && surfaceHolder.surface.isValid) {
      nativeCopyFrameInto(bmp)
      val canvas = surfaceHolder.lockCanvas()
      canvas.drawBitmap(bmp, null, Rect(0, 0, width, height), null)
      surfaceHolder.unlockCanvasAndPost(canvas)
    }
    Choreographer.getInstance().postFrameCallback(this)
  }

  override fun surfaceCreated(holder: SurfaceHolder) { Choreographer.getInstance().postFrameCallback(this) }
  override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}
  override fun surfaceDestroyed(holder: SurfaceHolder) { Choreographer.getInstance().removeFrameCallback(this) }
}
```

```kotlin
// android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt (modify loadROM to size the current view)
@ReactMethod
fun loadROM(path: String, promise: Promise) {
  val result = nativeLoadROM(path)
  if (result == null) {
    promise.reject("LOAD_FAILED", "Could not load ROM at $path")
  } else {
    PokeEmuRenderView.current?.setFrameSize(result.getInt("width"), result.getInt("height"))
    promise.resolve(result)
  }
}
```

```cpp
// android/app/src/main/cpp/mgba_bridge.cpp (add: allocate the shared frame
// buffer in nativeLoadROM, right after computing width/height, and the
// JNI export that copies it into the Bitmap each frame)
#include <android/bitmap.h>
#include <cstring>
#include <vector>

namespace { std::vector<uint32_t> gVideoBuffer; }

// (inside Java_..._nativeLoadROM, after desiredVideoDimensions:)
gVideoBuffer.assign(static_cast<size_t>(width) * height, 0);
gCore->setVideoBuffer(gCore, gVideoBuffer.data(), width);

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
```

Add the matching declaration to `mgba_bridge.h`, and link `jnigraphics` in `CMakeLists.txt`'s `target_link_libraries` line (needed for `AndroidBitmap_lockPixels`/`unlockPixels`).

```kotlin
// android/app/src/main/java/com/pokeemu/core/PokeEmuRenderViewManager.kt
package com.pokeemu.core

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

class PokeEmuRenderViewManager : SimpleViewManager<PokeEmuRenderView>() {
  override fun getName() = "PokeEmuRenderView"
  override fun createViewInstance(reactContext: ThemedReactContext) = PokeEmuRenderView(reactContext)
}
```

Modify `PokeEmuCorePackage.kt`'s `createViewManagers` to return `listOf(PokeEmuRenderViewManager())` instead of `emptyList()`.

- [ ] **Step 4: RN wrapper component**

```tsx
// src/native/PokeEmuRenderView.tsx
import React from 'react';
import { requireNativeComponent, ViewStyle } from 'react-native';

const NativeRenderView = requireNativeComponent<{ style?: ViewStyle }>('PokeEmuRenderView');

export function PokeEmuRenderView({ style }: { style?: ViewStyle }) {
  return <NativeRenderView style={style} />;
}
```

- [ ] **Step 5: Manual verification**

Using the same `fixtures/test.gba` from Task 10, temporarily render `<PokeEmuRenderView style={{ width: 240, height: 160 }} />` in `App.tsx` alongside a button calling `PokeEmuCore.loadROM(...).then(() => PokeEmuCore.play())`.
Run: `npx expo run:ios` and `npx expo run:android`.
Expected: after pressing the button, the ROM's actual video output appears in the view and updates live on both platforms. Remove the temporary rendering from `App.tsx` once confirmed (Task 12 adds the real screen).

- [ ] **Step 6: Commit**

```bash
git add ios/PokeEmu/PokeEmuRenderView.swift ios/PokeEmu/PokeEmuRenderViewManager.swift ios/PokeEmu/PokeEmuRenderViewManager.m android/app/src/main/java/com/pokeemu/core/PokeEmuRenderView.kt android/app/src/main/java/com/pokeemu/core/PokeEmuRenderViewManager.kt android/app/src/main/java/com/pokeemu/core/PokeEmuCorePackage.kt src/native/PokeEmuRenderView.tsx
git commit -m "feat: add native render view displaying the live GBA framebuffer"
```

---

### Task 12: Navigation shell + EmulatorScreen wiring

**Files:**
- Create: `src/navigation/RootNavigator.tsx`
- Create: `src/screens/EmulatorScreen.tsx`
- Modify: `App.tsx` (mount `RootNavigator`, remove Task 10/11's temporary manual test code)

**Interfaces:**
- Consumes: `RomListScreen` (Task 8), `PokeEmuCore` (Task 9/10), `PokeEmuRenderView` (Task 11).
- Produces: working navigation `RomList → Emulator`; `EmulatorScreen` loads the ROM on mount and calls `play()`/`pause()` on focus/blur.

- [ ] **Step 1: Root navigator**

```tsx
// src/navigation/RootNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RomListScreen } from '../screens/RomListScreen';
import { EmulatorScreen } from '../screens/EmulatorScreen';

export type RootStackParamList = {
  RomList: undefined;
  Emulator: { filePath: string; romId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="RomList" component={RomListScreen} options={{ title: 'PokeEmu' }} />
        <Stack.Screen name="Emulator" component={EmulatorScreen} options={{ title: '' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: EmulatorScreen**

```tsx
// src/screens/EmulatorScreen.tsx
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { PokeEmuCore } from '../native/PokeEmuCore';
import { PokeEmuRenderView } from '../native/PokeEmuRenderView';
import { RootStackParamList } from '../navigation/RootNavigator';
import { theme } from '../theme/tokens';

type EmulatorRoute = RouteProp<RootStackParamList, 'Emulator'>;

export function EmulatorScreen() {
  const route = useRoute<EmulatorRoute>();

  useEffect(() => {
    let cancelled = false;
    PokeEmuCore.loadROM(route.params.filePath).then(() => {
      if (!cancelled) PokeEmuCore.play();
    });
    return () => {
      cancelled = true;
      PokeEmuCore.unloadROM();
    };
  }, [route.params.filePath]);

  useFocusEffect(
    React.useCallback(() => {
      PokeEmuCore.play();
      return () => PokeEmuCore.pause();
    }, [])
  );

  return (
    <View style={styles.container}>
      <PokeEmuRenderView style={styles.screen} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundDark, alignItems: 'center', justifyContent: 'center' },
  screen: { width: 240 * 2, height: 160 * 2 },
});
```

- [ ] **Step 3: Mount the navigator in `App.tsx`**

```tsx
// App.tsx
import React from 'react';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return <RootNavigator />;
}
```

Remove any temporary manual-test code left over from Task 10/11's verification steps.

- [ ] **Step 4: Manual verification**

Run: `npx expo run:ios` and `npx expo run:android`.
Expected: app opens on the ROM list; importing `fixtures/test.gba` via the picker and tapping it navigates to the Emulator screen and starts playing; navigating back pauses it (confirm via the run-loop's CPU usage dropping, since there's no game-over UI yet).

- [ ] **Step 5: Commit**

```bash
git add src/navigation/RootNavigator.tsx src/screens/EmulatorScreen.tsx App.tsx
git commit -m "feat: wire navigation shell and EmulatorScreen lifecycle"
```

---

### Task 13: Native audio output (both platforms)

**Files:**
- Modify: `ios/PokeEmu/MGBABridge.swift` (pull audio samples each frame, feed `AVAudioEngine`)
- Modify: `android/app/src/main/cpp/mgba_bridge.cpp` (pull audio samples each frame, feed Oboe)
- Modify: `android/app/build.gradle` (enable `prefab`, add Oboe dependency), `android/app/src/main/cpp/CMakeLists.txt` (`find_package(oboe CONFIG)`, link `oboe::oboe`)

**Interfaces:**
- Produces: audible sound during gameplay on both platforms; no new JS-facing API (audio is entirely native).

- [ ] **Step 1: iOS — pull samples via `AVAudioEngine`'s source node**

**Correction (confirmed 2026-08-27):** the original draft captured the `core` pointer by value in the `AVAudioSourceNode` closure and only ran its setup once, guarded by a "have we started" flag. That breaks on a second ROM load: `unload()` deallocates the first core, a new `loadROM` assigns a new pointer to `self.core`, but the closure still captures the stale first pointer — a dangling-pointer read. The fix below captures `self` weakly and re-reads `self?.core` on every callback instead, and separates "attach the node" (once) from "start the engine" (every load, since `unload()` stops it).

```swift
// ios/PokeEmu/MGBABridge.swift (add to the class)
private let audioEngine = AVAudioEngine()
private var audioNodeAttached = false

func startAudio() {
  if !audioNodeAttached {
    audioNodeAttached = true
    let format = AVAudioFormat(standardFormatWithSampleRate: 32768, channels: 2)!
    let sourceNode = AVAudioSourceNode { [weak self] _, _, frameCount, audioBufferList -> OSStatus in
      let ablPointer = UnsafeMutableAudioBufferListPointer(audioBufferList)
      guard let core = self?.core else {
        for buffer in ablPointer {
          buffer.mData?.assumingMemoryBound(to: Float.self).update(repeating: 0, count: Int(frameCount))
        }
        return noErr
      }
      let left = core.pointee.getAudioChannel(core, 0)
      let right = core.pointee.getAudioChannel(core, 1)
      var samplesLeft = [Int16](repeating: 0, count: Int(frameCount))
      var samplesRight = [Int16](repeating: 0, count: Int(frameCount))
      blip_read_samples(left, &samplesLeft, Int32(frameCount), 0)
      blip_read_samples(right, &samplesRight, Int32(frameCount), 0)
      for frame in 0..<Int(frameCount) {
        let l = Float(samplesLeft[frame]) / Float(Int16.max)
        let r = Float(samplesRight[frame]) / Float(Int16.max)
        ablPointer[0].mData?.assumingMemoryBound(to: Float.self)[frame] = l
        ablPointer[1].mData?.assumingMemoryBound(to: Float.self)[frame] = r
      }
      return noErr
    }
    audioEngine.attach(sourceNode)
    audioEngine.connect(sourceNode, to: audioEngine.mainMixerNode, format: format)
  }
  try? audioEngine.start() // safe to call even if already running
}
// `getAudioChannel` returning a blip_t* and `blip_read_samples` match
// vendor/mgba/include/mgba/core/core.h and mGBA's vendored blip_buf.h —
// confirmed against both at the pinned tag.
```

Call `startAudio()` at the end of `load(path:)`, right after computing width/height, and add `audioEngine.stop()` to `unload()` (alongside the existing `pause()`/`deinit`/buffer-deallocate calls).

- [ ] **Step 2: Android — pull samples via Oboe**

**Correction (confirmed 2026-08-27, checked against Google's Maven repo at `dl.google.com`):** `com.google.oboe:oboe` is real and `1.10.0` is its current latest version (the draft's `1.9.0` also exists but is superseded). Oboe ships as a **Prefab**-packaged AAR, not a plain Maven jar — consuming its native headers/libs from CMake requires enabling `buildFeatures.prefab` in `build.gradle` and calling `find_package(oboe REQUIRED CONFIG)` in `CMakeLists.txt`; the original draft's `target_link_libraries` didn't show this and would fail to find `<oboe/Oboe.h>` without it. Also replaced the two `int16_t left[numFrames]` VLAs (a non-standard GCC/Clang extension) with `std::vector<int16_t>`.

```gradle
// android/app/build.gradle (add inside the `android { ... }` block)
buildFeatures {
    prefab true
}
```

```gradle
// android/app/build.gradle (add to the `dependencies { ... }` block)
implementation("com.google.oboe:oboe:1.10.0")
```

```cmake
# android/app/src/main/cpp/CMakeLists.txt (add before target_link_libraries)
find_package(oboe REQUIRED CONFIG)
```

```cmake
# android/app/src/main/cpp/CMakeLists.txt (modify the existing target_link_libraries line)
target_link_libraries(pokeemu_bridge mgba log android jnigraphics oboe::oboe)
```

```cpp
// android/app/src/main/cpp/mgba_bridge.cpp (add)
#include <oboe/Oboe.h>

namespace {
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
}
```

Call `startAudioStream()` at the end of `Java_com_pokeemu_core_PokeEmuCoreModule_nativeLoadROM` after a successful load (right before `return map;`).

- [ ] **Step 3: Manual verification**

Using `fixtures/test.gba`, run on both platforms and confirm audible sound plays in sync with the video during gameplay (test with a ROM known to have title-screen music, e.g. the user's own Pokémon cartridge dump).

- [ ] **Step 4: Commit**

```bash
git add ios/PokeEmu/MGBABridge.swift android/app/src/main/cpp/mgba_bridge.cpp android/app/build.gradle android/app/src/main/cpp/CMakeLists.txt
git commit -m "feat: wire native audio output from the core on iOS and Android"
```

---

### Task 14: Touch controls

**Files:**
- Create: `src/controls/TouchControls.tsx`
- Test: `src/controls/TouchControls.test.tsx`
- Modify: `src/screens/EmulatorScreen.tsx` (render `TouchControls` overlay)

**Interfaces:**
- Consumes: `setButton` (Task 9), `GBAButton` (Task 5), `theme` (Task 3).
- Produces: `TouchControls` component rendering a D-pad and A/B/L/R/Start/Select buttons styled per the Apple-glass + Pokémon-accent theme.

- [ ] **Step 1: Write the failing test**

```tsx
// src/controls/TouchControls.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TouchControls } from './TouchControls';
import { PokeEmuCore } from '../native/PokeEmuCore';

// Correction (confirmed 2026-08-27): the original draft's mock only
// provided PokeEmuCore, but TouchControls.tsx calls the setButton()
// wrapper (Task 9), which the mock didn't export — every onPressIn/
// onPressOut threw "setButton is not a function". Reimplement setButton
// here wired to the same mocked setButtonState (not via requireActual,
// which would pull in the real setButton bound to the real PokeEmuCore).
jest.mock('../native/PokeEmuCore', () => {
  const PokeEmuCore = { setButtonState: jest.fn() };
  return {
    PokeEmuCore,
    setButton: (button: string, pressed: boolean) => PokeEmuCore.setButtonState(button, pressed),
  };
});

describe('TouchControls', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends pressed=true on pressIn for the A button', async () => {
    const { getByTestId } = await render(<TouchControls />);
    await fireEvent(getByTestId('button-A'), 'pressIn');
    expect(PokeEmuCore.setButtonState).toHaveBeenCalledWith('A', true);
  });

  it('sends pressed=false on pressOut for the A button', async () => {
    const { getByTestId } = await render(<TouchControls />);
    await fireEvent(getByTestId('button-A'), 'pressOut');
    expect(PokeEmuCore.setButtonState).toHaveBeenCalledWith('A', false);
  });

  it('sends Up on pressIn for the d-pad up region', async () => {
    const { getByTestId } = await render(<TouchControls />);
    await fireEvent(getByTestId('dpad-Up'), 'pressIn');
    expect(PokeEmuCore.setButtonState).toHaveBeenCalledWith('Up', true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/controls/TouchControls.test.tsx`
Expected: FAIL with "Cannot find module './TouchControls'"

- [ ] **Step 3: Write the implementation**

```tsx
// src/controls/TouchControls.tsx
import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { setButton } from '../native/PokeEmuCore';
import { GBAButton } from '../native/buttons';
import { theme } from '../theme/tokens';

function ControlButton({ button, label, testID }: { button: GBAButton; label: string; testID: string }) {
  return (
    <Pressable
      testID={testID}
      style={styles.roundButton}
      onPressIn={() => setButton(button, true)}
      onPressOut={() => setButton(button, false)}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

function DPadButton({ button, label, testID }: { button: GBAButton; label: string; testID: string }) {
  return (
    <Pressable
      testID={testID}
      style={styles.dpadButton}
      onPressIn={() => setButton(button, true)}
      onPressOut={() => setButton(button, false)}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export function TouchControls() {
  return (
    <View style={styles.container}>
      <View style={styles.dpad}>
        <DPadButton button={GBAButton.Up} label="▲" testID="dpad-Up" />
        <View style={styles.dpadRow}>
          <DPadButton button={GBAButton.Left} label="◀" testID="dpad-Left" />
          <DPadButton button={GBAButton.Right} label="▶" testID="dpad-Right" />
        </View>
        <DPadButton button={GBAButton.Down} label="▼" testID="dpad-Down" />
      </View>
      <View style={styles.faceButtons}>
        <ControlButton button={GBAButton.B} label="B" testID="button-B" />
        <ControlButton button={GBAButton.A} label="A" testID="button-A" />
      </View>
      <View style={styles.systemButtons}>
        <ControlButton button={GBAButton.Select} label="Select" testID="button-Select" />
        <ControlButton button={GBAButton.Start} label="Start" testID="button-Start" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing.lg },
  dpad: { alignItems: 'center' },
  dpadRow: { flexDirection: 'row', gap: theme.spacing.xl },
  dpadButton: {
    width: 44, height: 44, borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.glassSurfaceDark, alignItems: 'center', justifyContent: 'center',
  },
  faceButtons: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' },
  systemButtons: { flexDirection: 'row', gap: theme.spacing.sm, position: 'absolute', bottom: -theme.spacing.lg, alignSelf: 'center' },
  roundButton: {
    width: 56, height: 56, borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  buttonLabel: { color: '#FFFFFF', fontWeight: '700' },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/controls/TouchControls.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Mount it in EmulatorScreen**

Add `import { TouchControls } from '../controls/TouchControls';` and render `<TouchControls />` below `<PokeEmuRenderView .../>` inside `EmulatorScreen`'s returned `View`.

- [ ] **Step 6: Commit**

```bash
git add src/controls/TouchControls.tsx src/controls/TouchControls.test.tsx src/screens/EmulatorScreen.tsx
git commit -m "feat: add Apple/Pokémon-styled touch controls overlay"
```

---

### Task 15: External controller (gamepad) input

**Files:**
- Modify: `ios/PokeEmu/PokeEmuCoreModule.swift` (GameController framework listener, becomes an `RCTEventEmitter`), `ios/PokeEmu/PokeEmuCoreModule.m` (superclass update)
- Modify: `android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt` (expose an `instance` reference for `MainActivity` to reach)
- Modify: `android/app/src/main/java/com/impoxx/PokeEmu/MainActivity.kt` (`dispatchKeyEvent` override + `InputManager.InputDeviceListener` — note the app-id package, not `com.pokeemu`)
- Create: `src/controls/useGamepadStatus.ts`
- Test: `src/controls/useGamepadStatus.test.ts`
- Modify: `src/screens/EmulatorScreen.tsx` (show a small "Controller connected" indicator)

**Interfaces:**
- Produces: physical controller button presses feed the same `mCore` key mask as `TouchControls`, handled entirely natively; a JS-facing `controllerConnectionEvent` (via `NativeEventEmitter`) tells the UI whether a controller is attached.
- Consumes: `PokeEmuCore` (Task 9), `useSettingsStore.buttonMapping` (Task 5, for future remapping — Phase 1 ships with a fixed default mapping and stores it so Task 21's Settings screen has something to edit).

- [ ] **Step 1: iOS — listen for `GCController` connections and route button events directly to the bridge**

**Correction (confirmed 2026-08-27):** the original draft posted a custom `.pokeEmuControllerStatusChanged` NotificationCenter notification and left "bridge it to JS via a separate PokeEmuControllerEvents module" as prose with no code. But the JS hook (Step 3) constructs its `NativeEventEmitter` around `NativeModules.PokeEmuCore` — the SAME module, not a separate one — so the event has to come from `PokeEmuCoreModule` itself. Fix: make `PokeEmuCoreModule` subclass `RCTEventEmitter` (instead of `NSObject`) and call `sendEvent` directly; this also removes the need for the NotificationCenter round-trip. Subclassing `RCTEventEmitter` from Swift requires `#import <React/RCTEventEmitter.h>` in this target's Objective-C bridging header once the real Xcode project exists (see the Global Constraints "iOS project scaffold gap" note) — add it there.

```swift
// ios/PokeEmu/PokeEmuCoreModule.swift (change the class declaration and add)
import GameController

@objc(PokeEmuCoreModule)
class PokeEmuCoreModule: RCTEventEmitter {
  private let bridge = MGBABridge()
  private var hasListeners = false

  override init() {
    super.init()
    observeControllers()
  }

  override func supportedEvents() -> [String]! {
    return ["controllerStatusChanged"]
  }

  override func startObserving() { hasListeners = true }
  override func stopObserving() { hasListeners = false }

  private func observeControllers() {
    NotificationCenter.default.addObserver(forName: .GCControllerDidConnect, object: nil, queue: .main) { [weak self] note in
      guard let self = self, let controller = note.object as? GCController, let gamepad = controller.extendedGamepad else { return }
      gamepad.buttonA.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 0, pressed: pressed) }
      gamepad.buttonB.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 1, pressed: pressed) }
      gamepad.buttonMenu.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 3, pressed: pressed) }
      gamepad.buttonOptions?.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 2, pressed: pressed) }
      gamepad.leftShoulder.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 9, pressed: pressed) }
      gamepad.rightShoulder.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 8, pressed: pressed) }
      gamepad.dpad.up.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 6, pressed: pressed) }
      gamepad.dpad.down.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 7, pressed: pressed) }
      gamepad.dpad.left.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 5, pressed: pressed) }
      gamepad.dpad.right.pressedChangedHandler = { _, _, pressed in self.bridge.setKey(1 << 4, pressed: pressed) }
      if self.hasListeners { self.sendEvent(withName: "controllerStatusChanged", body: true) }
    }
    NotificationCenter.default.addObserver(forName: .GCControllerDidDisconnect, object: nil, queue: .main) { [weak self] _ in
      guard let self = self else { return }
      if self.hasListeners { self.sendEvent(withName: "controllerStatusChanged", body: false) }
    }
  }
}
```

```objc
// ios/PokeEmu/PokeEmuCoreModule.m (modify the top two lines — superclass is now RCTEventEmitter)
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(PokeEmuCoreModule, RCTEventEmitter)
```

- [ ] **Step 2: Android — capture gamepad key/motion events in `MainActivity` and forward to the JNI bridge**

**Correction (confirmed 2026-08-27):** the original draft's path (`android/app/src/main/java/com/pokeemu/MainActivity.kt`) is wrong — the app's own `MainActivity` lives in its app-id package, `com/impoxx/PokeEmu/MainActivity.kt` (see Task 1's generated `android/`), not under `com.pokeemu`. It also left "emitting a controllerStatusChanged event through the standard DeviceEventManagerModule.RCTDeviceEventEmitter pattern" as prose — but this project uses the New Architecture / Bridgeless `ReactHost` (see `MainApplication.kt`'s `ExpoReactHostFactory.getDefaultReactHost`), which doesn't have a `ReactInstanceManager`/`getJSModule` to call that pattern on. The bridgeless-compatible equivalent is `ReactContext.emitDeviceEvent(eventName, params)`, used below.

```kotlin
// android/app/src/main/java/com/impoxx/PokeEmu/MainActivity.kt (add imports, properties, and overrides)
import android.content.Context
import android.hardware.input.InputManager
import android.view.InputDevice
import android.view.KeyEvent
import com.facebook.react.ReactApplication
import com.pokeemu.core.PokeEmuCoreModule

// (inside the MainActivity class body:)
private val inputManager: InputManager by lazy { getSystemService(Context.INPUT_SERVICE) as InputManager }

private val inputDeviceListener = object : InputManager.InputDeviceListener {
  override fun onInputDeviceAdded(deviceId: Int) { notifyControllerStatus() }
  override fun onInputDeviceRemoved(deviceId: Int) { notifyControllerStatus() }
  override fun onInputDeviceChanged(deviceId: Int) {}
}

// (register in onCreate, after super.onCreate(null):)
inputManager.registerInputDeviceListener(inputDeviceListener, null)

// (add as a new override alongside the existing ones:)
override fun onDestroy() {
  inputManager.unregisterInputDeviceListener(inputDeviceListener)
  super.onDestroy()
}

private fun notifyControllerStatus() {
  val connected = InputDevice.getDeviceIds().any { id ->
    val device = InputDevice.getDevice(id)
    device != null && (device.sources and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
  }
  (application as ReactApplication).reactHost.currentReactContext?.emitDeviceEvent("controllerStatusChanged", connected)
}

override fun dispatchKeyEvent(event: KeyEvent): Boolean {
  val name = when (event.keyCode) {
    KeyEvent.KEYCODE_BUTTON_A -> "A"
    KeyEvent.KEYCODE_BUTTON_B -> "B"
    KeyEvent.KEYCODE_BUTTON_L1 -> "L"
    KeyEvent.KEYCODE_BUTTON_R1 -> "R"
    KeyEvent.KEYCODE_BUTTON_START -> "Start"
    KeyEvent.KEYCODE_BUTTON_SELECT -> "Select"
    KeyEvent.KEYCODE_DPAD_UP -> "Up"
    KeyEvent.KEYCODE_DPAD_DOWN -> "Down"
    KeyEvent.KEYCODE_DPAD_LEFT -> "Left"
    KeyEvent.KEYCODE_DPAD_RIGHT -> "Right"
    else -> null
  }
  if (name != null && (event.source and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD) {
    val pressed = event.action == KeyEvent.ACTION_DOWN
    PokeEmuCoreModule.instance?.setButtonState(name, pressed)
    return true
  }
  return super.dispatchKeyEvent(event)
}
```

```kotlin
// android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt (modify — add to the existing companion object and an init block)
companion object {
  init { System.loadLibrary("pokeemu_bridge") }
  // MainActivity.dispatchKeyEvent needs to reach the already-registered
  // module instance to forward physical gamepad button presses.
  var instance: PokeEmuCoreModule? = null
}

init {
  instance = this
}
```

- [ ] **Step 3: JS hook for the connection indicator**

```ts
// src/controls/useGamepadStatus.ts
import { useEffect, useState } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';

export function useGamepadStatus(): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const emitter = new NativeEventEmitter(NativeModules.PokeEmuCore);
    const subscription = emitter.addListener('controllerStatusChanged', (isConnected: boolean) => {
      setConnected(isConnected);
    });
    return () => subscription.remove();
  }, []);

  return connected;
}
```

- [ ] **Step 4: Write the test**

**Correction (confirmed 2026-08-27):** two problems with the original draft's test, found by actually running it. (1) `@testing-library/react-hooks` is unmaintained and incompatible with React 19 — `renderHook`/`act` now ship directly from `@testing-library/react-native` (already installed in Task 1), and per the Global Constraints RTL v14 note, both must be awaited. (2) The draft's `jest.mock('react-native', () => ({ ...jest.requireActual('react-native'), NativeModules: {...} }))` crashes outright: `jest.requireActual('react-native')` bypasses jest-expo's own React Native mock and loads the *real* module tree, which eagerly requires `NativeDevMenu` → `TurboModuleRegistry.getEnforcing(...)`, and that throws with no real native runtime present — this happens regardless of what the factory does afterward, so no variant of "spread `actual` and override one key" works here. A fully hand-rolled replacement of the whole `'react-native'` module has the same problem from the other direction: jest-expo's own preset setup (`jest-expo/src/preset/setup.js`, which every test file runs through) needs the *real* mocked `Platform`/other exports jest-expo normally provides, so swapping out the entire module for a minimal stub breaks that setup instead. The fix that actually works: don't mock `'react-native'` at all — import it normally (getting jest-expo's own working mock, confirmed functional via a plain `DeviceEventEmitter.emit(...)` call) and just mutate `NativeModules.PokeEmuCore` directly, since `NativeEventEmitter`'s real implementation only requires its constructor argument to be non-null (with `addListener`/`removeListeners` methods present to avoid a harmless console warning).

```ts
// src/controls/useGamepadStatus.test.ts
import { renderHook, act } from '@testing-library/react-native';
import { DeviceEventEmitter, NativeModules } from 'react-native';
import { useGamepadStatus } from './useGamepadStatus';

(NativeModules as Record<string, unknown>).PokeEmuCore = {
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

describe('useGamepadStatus', () => {
  it('starts disconnected and flips true when the native event fires', async () => {
    const { result } = await renderHook(() => useGamepadStatus());
    expect(result.current).toBe(false);

    await act(() => {
      DeviceEventEmitter.emit('controllerStatusChanged', true);
    });
    expect(result.current).toBe(true);
  });
});
```

Note: `NativeEventEmitter` constructed with a native module argument delivers events through the same underlying `DeviceEventEmitter` used above — no need to intercept the `NativeEventEmitter` instance itself.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/controls/useGamepadStatus.test.ts`
Expected: PASS (1 test)

- [ ] **Step 6: Mount the indicator in EmulatorScreen**

Add `const connected = useGamepadStatus();` and render a small `<Text>` reading `"🎮 Connected"` conditionally near the top of the screen.

- [ ] **Step 7: Manual verification**

Pair a Bluetooth MFi controller (iOS) or standard Bluetooth gamepad (Android), launch a ROM, confirm both the on-screen indicator appears and physical button presses move the game.

- [ ] **Step 8: Commit**

```bash
git add ios/PokeEmu/PokeEmuCoreModule.swift ios/PokeEmu/PokeEmuCoreModule.m android/app/src/main/java/com/impoxx/PokeEmu/MainActivity.kt android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt src/controls/useGamepadStatus.ts src/controls/useGamepadStatus.test.ts src/screens/EmulatorScreen.tsx
git commit -m "feat: support external Bluetooth/MFi controllers alongside touch controls"
```

---

### Task 16: Save states

**Files:**
- Modify: `ios/PokeEmu/MGBABridge.swift`, `ios/PokeEmu/PokeEmuCoreModule.swift` (real `saveState`/`loadState`)
- Modify: `android/app/src/main/cpp/mgba_bridge.cpp`, `android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt` (real `saveState`/`loadState`)
- Create: `src/state/session.ts`
- Test: `src/state/session.test.ts`
- Create: `src/screens/SaveStateSheet.tsx`
- Modify: `src/screens/EmulatorScreen.tsx` (add a button opening `SaveStateSheet`)

**Interfaces:**
- Produces: `session.ts`'s `useSessionStore` tracks `{ activeRomId: string | null }`; `SaveStateSheet` shows slots 1–4 with Save/Load actions calling `PokeEmuCore.saveState`/`loadState`.

- [ ] **Step 1: iOS — real save/load via mCore**

**Correction (confirmed against the vendored header 2026-08-27):** `mCore`'s struct has no `saveState(core, slot)` member — its `saveState`/`loadState` struct members take a raw `void* state` buffer, not a slot number. Slot-based file persistence is the free function pair `bool mCoreSaveStateNamed(struct mCore*, struct VFile*, int flags)` / `bool mCoreLoadStateNamed(struct mCore*, struct VFile*, int flags)` from `vendor/mgba/include/mgba/core/core.h`, given an already-open `VFile*` at whatever path we choose — this fits the spec's `Documents/saves/<romId>/state-slot-N.state` path better than mGBA's own slot-numbering convention (`mCoreSaveState(core, slot, flags)`, which writes next to the ROM via the core's directory set), so this plan uses the `Named` variant with an explicitly-opened `VFile` throughout. `flags` uses `SAVESTATE_ALL` (defined in `vendor/mgba/include/mgba/core/serialize.h` as `31`) for full-fidelity states (savedata + cheats + RTC + metadata + screenshot).

```swift
// ios/PokeEmu/MGBABridge.swift (add)
func saveState(toPath path: String) -> Bool {
  guard let core = core, let vf = VFileOpen(path, O_WRONLY | O_CREAT | O_TRUNC) else { return false }
  return mCoreSaveStateNamed(core, vf, Int32(SAVESTATE_ALL))
}

func loadState(fromPath path: String) -> Bool {
  guard let core = core, let vf = VFileOpen(path, O_RDONLY) else { return false }
  return mCoreLoadStateNamed(core, vf, Int32(SAVESTATE_ALL))
}
```

```swift
// ios/PokeEmu/PokeEmuCoreModule.swift (replace stub bodies)
private func stateFilePath(romId: String, slot: Int) -> String {
  let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
  let dir = docs.appendingPathComponent("saves").appendingPathComponent(romId)
  try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
  return dir.appendingPathComponent("state-slot-\(slot).state").path
}

@objc(saveState:slotIndex:withResolver:withRejecter:)
func saveState(romId: String, slotIndex: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
  let path = stateFilePath(romId: romId, slot: slotIndex.intValue)
  if bridge.saveState(toPath: path) {
    resolve(nil)
  } else {
    reject("SAVE_STATE_FAILED", "Could not save state to slot \(slotIndex)", nil)
  }
}

@objc(loadState:slotIndex:withResolver:withRejecter:)
func loadState(romId: String, slotIndex: NSNumber, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
  let path = stateFilePath(romId: romId, slot: slotIndex.intValue)
  if bridge.loadState(fromPath: path) {
    resolve(nil)
  } else {
    reject("LOAD_STATE_FAILED", "Could not load state from slot \(slotIndex)", nil)
  }
}
```

- [ ] **Step 2: Android — mirror in JNI**

```cpp
// android/app/src/main/cpp/mgba_bridge.cpp (add)
#include <mgba/core/serialize.h>

JNIEXPORT jboolean JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeSaveState(JNIEnv* env, jobject, jstring jpath) {
  if (!gCore) return JNI_FALSE;
  const char* path = env->GetStringUTFChars(jpath, nullptr);
  struct VFile* vf = VFileOpen(path, O_WRONLY | O_CREAT | O_TRUNC);
  env->ReleaseStringUTFChars(jpath, path);
  if (!vf) return JNI_FALSE;
  return mCoreSaveStateNamed(gCore, vf, SAVESTATE_ALL) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jboolean JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeLoadState(JNIEnv* env, jobject, jstring jpath) {
  if (!gCore) return JNI_FALSE;
  const char* path = env->GetStringUTFChars(jpath, nullptr);
  struct VFile* vf = VFileOpen(path, O_RDONLY);
  env->ReleaseStringUTFChars(jpath, path);
  if (!vf) return JNI_FALSE;
  return mCoreLoadStateNamed(gCore, vf, SAVESTATE_ALL) ? JNI_TRUE : JNI_FALSE;
}
```

```kotlin
// android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt (replace stub bodies)
private external fun nativeSaveState(path: String): Boolean
private external fun nativeLoadState(path: String): Boolean

private fun stateFilePath(romId: String, slot: Int): String {
  val dir = java.io.File(reactApplicationContext.filesDir, "saves/$romId")
  dir.mkdirs()
  return java.io.File(dir, "state-slot-$slot.state").absolutePath
}

@ReactMethod
fun saveState(romId: String, slotIndex: Int, promise: Promise) {
  if (nativeSaveState(stateFilePath(romId, slotIndex))) promise.resolve(null)
  else promise.reject("SAVE_STATE_FAILED", "Could not save state to slot $slotIndex")
}

@ReactMethod
fun loadState(romId: String, slotIndex: Int, promise: Promise) {
  if (nativeLoadState(stateFilePath(romId, slotIndex))) promise.resolve(null)
  else promise.reject("LOAD_STATE_FAILED", "Could not load state from slot $slotIndex")
}
```

- [ ] **Step 3: Write the failing test for `session.ts`**

```ts
// src/state/session.test.ts
import { useSessionStore } from './session';

describe('session store', () => {
  beforeEach(() => useSessionStore.setState({ activeRomId: null }));

  it('starts with no active rom', () => {
    expect(useSessionStore.getState().activeRomId).toBeNull();
  });

  it('sets and clears the active rom id', () => {
    useSessionStore.getState().setActiveRomId('rom-1');
    expect(useSessionStore.getState().activeRomId).toBe('rom-1');
    useSessionStore.getState().setActiveRomId(null);
    expect(useSessionStore.getState().activeRomId).toBeNull();
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx jest src/state/session.test.ts`
Expected: FAIL with "Cannot find module './session'"

- [ ] **Step 5: Write `session.ts`**

```ts
// src/state/session.ts
import { create } from 'zustand';

type SessionState = {
  activeRomId: string | null;
  setActiveRomId: (id: string | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  activeRomId: null,
  setActiveRomId: (id) => set({ activeRomId: id }),
}));
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/state/session.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Set `activeRomId` in `EmulatorScreen`**

In `EmulatorScreen`'s mount effect (Task 12), add `useSessionStore.getState().setActiveRomId(route.params.romId);` alongside the `loadROM` call, and clear it to `null` in the cleanup function.

- [ ] **Step 8: `SaveStateSheet` component**

```tsx
// src/screens/SaveStateSheet.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { PokeEmuCore } from '../native/PokeEmuCore';
import { useSessionStore } from '../state/session';
import { theme } from '../theme/tokens';

const SLOTS = [1, 2, 3, 4];

export function SaveStateSheet({ onClose }: { onClose: () => void }) {
  const romId = useSessionStore((s) => s.activeRomId);

  const handleSave = async (slot: number) => {
    if (!romId) return;
    await PokeEmuCore.saveState(romId, slot);
    onClose();
  };

  const handleLoad = async (slot: number) => {
    if (!romId) return;
    await PokeEmuCore.loadState(romId, slot);
    onClose();
  };

  return (
    <View style={styles.sheet}>
      {SLOTS.map((slot) => (
        <View key={slot} style={styles.row}>
          <Text style={styles.slotLabel}>Slot {slot}</Text>
          <Pressable style={styles.actionButton} onPress={() => handleSave(slot)}>
            <Text style={styles.actionText}>Save</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => handleLoad(slot)}>
            <Text style={styles.actionText}>Load</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: theme.colors.glassSurfaceDark, borderRadius: theme.radii.lg, padding: theme.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  slotLabel: { color: theme.colors.labelDark, flex: 1, ...theme.typography.body },
  actionButton: { backgroundColor: theme.colors.primary, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.pill },
  actionText: { color: '#FFFFFF', fontWeight: '600' },
});
```

- [ ] **Step 9: Wire a toggle button in `EmulatorScreen`**

Add local state `const [showSaveSheet, setShowSaveSheet] = useState(false);`, a button labeled "Save States" that sets it `true`, and conditionally render `<SaveStateSheet onClose={() => setShowSaveSheet(false)} />` above `TouchControls`.

- [ ] **Step 10: Manual verification**

Play a ROM to a distinctive point, save to slot 1, move further, load slot 1, confirm the game state visibly reverts.

- [ ] **Step 11: Commit**

```bash
git add ios/PokeEmu/MGBABridge.swift ios/PokeEmu/PokeEmuCoreModule.swift android/app/src/main/cpp/mgba_bridge.cpp android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt src/state/session.ts src/state/session.test.ts src/screens/SaveStateSheet.tsx src/screens/EmulatorScreen.tsx
git commit -m "feat: add multi-slot save states"
```

---

### Task 17: In-game `.sav` auto-persist

**Files:**
- Modify: `ios/PokeEmu/MGBABridge.swift`, `ios/PokeEmu/PokeEmuCoreModule.swift`
- Modify: `android/app/src/main/cpp/mgba_bridge.cpp`, `android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt`
- Modify: `src/screens/EmulatorScreen.tsx` (call a flush on background/blur via `AppState`)

**Interfaces:**
- Produces: `PokeEmuCore.pause()` (already called on blur per Task 12) additionally flushes the in-game save RAM to the `.sav` file next to the ROM.

- [ ] **Step 1: iOS — flush save RAM on pause**

```swift
// ios/PokeEmu/MGBABridge.swift (modify pause())
func pause() {
  running = false
  core?.pointee.autoloadSave(core) // ensure save backing is attached
  _ = core?.pointee.loadSave(core, nil) // no-op placeholder removed below
}
```

Replace the placeholder body above with mGBA's actual save-flush call once confirmed against the vendored header — mGBA persists cart save RAM automatically as writes happen when a `VFile`-backed save is attached via `core->loadSave(core, vf)` at load time (a sibling `.sav` `VFile`, opened read/write, created if missing) rather than via an explicit "flush" call; the concrete Task 1 change is therefore in `load(path:)`:

```swift
// ios/PokeEmu/MGBABridge.swift (modify load(path:))
func load(path: String) -> (width: Int, height: Int)? {
  guard let vf = VFileOpen(path, O_RDONLY) else { return nil }
  guard let found = mCoreFindVF(vf) else { return nil }
  core = found
  guard core!.pointee.`init`(core) else { return nil }
  guard core!.pointee.loadROM(core, vf) else { return nil }

  let savePath = (path as NSString).deletingPathExtension + ".sav"
  if let saveVf = VFileOpen(savePath, O_RDWR | O_CREAT) {
    _ = core!.pointee.loadSave(core, saveVf)
  }

  core!.pointee.reset(core)
  var width: CUnsignedInt = 0
  var height: CUnsignedInt = 0
  core!.pointee.desiredVideoDimensions(core, &width, &height)
  return (Int(width), Int(height))
}
```

Remove the placeholder body added to `pause()` above — attaching the save `VFile` at load time is sufficient; mGBA writes through to it as the game saves, no explicit flush call needed. Confirm this write-through behavior against `vendor/mgba/src/core/core.c`'s `loadSave` implementation at the pinned tag.

- [ ] **Step 2: Android — mirror in JNI's `nativeLoadROM`**

**Correction (confirmed 2026-08-27):** by the point `nativeLoadROM` knows the ROM load succeeded, its `path` JNI string was already released a few lines earlier (right after `VFileOpen(path, O_RDONLY)`) — the draft's "insert before it's released" instruction doesn't fit the function's actual shape. Fix: capture `path` into a `std::string` *before* releasing the JNI string, so it survives past the release for building `savePath` later.

```cpp
// android/app/src/main/cpp/mgba_bridge.cpp (modify nativeLoadROM)
const char* path = env->GetStringUTFChars(jpath, nullptr);
std::string pathStr(path);  // capture before releasing, needed for savePath below
struct VFile* vf = VFileOpen(path, O_RDONLY);
env->ReleaseStringUTFChars(jpath, path);
if (!vf) return nullptr;

gCore = mCoreFindVF(vf);
if (!gCore || !gCore->init(gCore) || !gCore->loadROM(gCore, vf)) {
  return nullptr;
}

std::string savePath = pathStr.substr(0, pathStr.find_last_of('.')) + ".sav";
struct VFile* saveVf = VFileOpen(savePath.c_str(), O_RDWR | O_CREAT);
if (saveVf) {
  gCore->loadSave(gCore, saveVf);
}

gCore->reset(gCore);
// ...rest of the function (video buffer setup, WritableNativeMap, startAudioStream) unchanged
```

- [ ] **Step 3: Manual verification**

Play a ROM far enough to trigger an in-game save (e.g. save inside the Pokémon game's own save menu), force-quit the app, relaunch, load the same ROM, confirm the in-game save persisted.

- [ ] **Step 4: Commit**

```bash
git add ios/PokeEmu/MGBABridge.swift android/app/src/main/cpp/mgba_bridge.cpp
git commit -m "feat: attach persistent .sav backing so in-game saves survive relaunch"
```

---

### Task 18: Fast-forward / turbo

**Files:**
- Modify: `ios/PokeEmu/MGBABridge.swift`, `ios/PokeEmu/PokeEmuCoreModule.swift`
- Modify: `android/app/src/main/cpp/mgba_bridge.cpp`, `android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt`
- Modify: `src/controls/TouchControls.tsx` (add a fast-forward toggle button)
- Test: extend `src/controls/TouchControls.test.tsx`

**Interfaces:**
- Consumes: `useSettingsStore.fastForwardSpeed` (Task 5).
- Produces: holding the fast-forward button runs the core's frame loop without the normal frame-timing throttle, at `fastForwardSpeed`× the base rate.

- [ ] **Step 1: iOS — skip-frame throttle in the run loop**

```swift
// ios/PokeEmu/MGBABridge.swift (modify)
private var fastForwardMultiplier: Int = 1

func setFastForward(multiplier: Int) {
  fastForwardMultiplier = max(1, multiplier)
}

func play() {
  guard let core = core, !running else { return }
  running = true
  queue.async { [weak self] in
    while self?.running == true {
      let steps = self?.fastForwardMultiplier ?? 1
      for _ in 0..<steps {
        core.pointee.runFrame(core)
      }
    }
  }
}
```

```swift
// ios/PokeEmu/PokeEmuCoreModule.swift (replace stub)
@objc func setFastForward(_ enabled: Bool, speedMultiplier: Double) {
  bridge.setFastForward(multiplier: enabled ? Int(speedMultiplier) : 1)
}
```

Running N frames per audio/video tick (rather than trying to speed up the display link itself) is the standard mGBA-style turbo approach: the render/audio callbacks still fire at normal cadence, but the emulated game clock advances N× faster.

- [ ] **Step 2: Android — mirror in JNI**

```cpp
// android/app/src/main/cpp/mgba_bridge.cpp (modify)
namespace { std::atomic<int> gFastForwardMultiplier{1}; }

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeSetFastForward(JNIEnv*, jobject, jboolean enabled, jdouble speedMultiplier) {
  gFastForwardMultiplier = enabled ? static_cast<int>(speedMultiplier) : 1;
}
```

Modify `nativePlay`'s loop body to `for (int i = 0; i < gFastForwardMultiplier.load(); i++) { gCore->runFrame(gCore); }`.

```kotlin
// android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt (replace stub)
private external fun nativeSetFastForward(enabled: Boolean, speedMultiplier: Double)

@ReactMethod
fun setFastForward(enabled: Boolean, speedMultiplier: Double) {
  nativeSetFastForward(enabled, speedMultiplier)
}
```

- [ ] **Step 3: Extend the touch controls test**

```tsx
// src/controls/TouchControls.test.tsx (add)
it('enables fast-forward at the configured speed on pressIn, disables on pressOut', async () => {
  const { getByTestId } = await render(<TouchControls />);
  await fireEvent(getByTestId('button-FastForward'), 'pressIn');
  expect(PokeEmuCore.setFastForward).toHaveBeenCalledWith(true, 2);
  await fireEvent(getByTestId('button-FastForward'), 'pressOut');
  expect(PokeEmuCore.setFastForward).toHaveBeenCalledWith(false, 2);
});
```

Add `setFastForward: jest.fn()` to the existing `jest.mock('../native/PokeEmuCore', ...)` block, and mock `useSettingsStore` to return `fastForwardSpeed: 2` (either via `jest.mock('../state/settings', ...)` returning a fixed value, or by calling `useSettingsStore.setState({ fastForwardSpeed: 2 })` in `beforeEach` if the real store is used).

- [ ] **Step 4: Run test to verify it fails, then add the button to make it pass**

Run: `npx jest src/controls/TouchControls.test.tsx`
Expected: FAIL (no `button-FastForward` testID yet).

```tsx
// src/controls/TouchControls.tsx (add import and button)
import { PokeEmuCore } from '../native/PokeEmuCore';
import { useSettingsStore } from '../state/settings';
// ...inside TouchControls():
const fastForwardSpeed = useSettingsStore((s) => s.fastForwardSpeed);
// ...added to the rendered JSX, alongside systemButtons:
<Pressable
  testID="button-FastForward"
  style={styles.roundButton}
  onPressIn={() => PokeEmuCore.setFastForward(true, fastForwardSpeed)}
  onPressOut={() => PokeEmuCore.setFastForward(false, fastForwardSpeed)}
>
  <Text style={styles.buttonLabel}>{fastForwardSpeed}×</Text>
</Pressable>
```

Run: `npx jest src/controls/TouchControls.test.tsx`
Expected: PASS (all tests, including the new one)

- [ ] **Step 5: Manual verification**

Hold the fast-forward button during gameplay, confirm the game visibly speeds up and returns to normal speed on release.

- [ ] **Step 6: Commit**

```bash
git add ios/PokeEmu/MGBABridge.swift ios/PokeEmu/PokeEmuCoreModule.swift android/app/src/main/cpp/mgba_bridge.cpp android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt src/controls/TouchControls.tsx src/controls/TouchControls.test.tsx
git commit -m "feat: add fast-forward/turbo control"
```

---

### Task 19: Cheats (GameShark codes)

**Files:**
- Modify: `ios/PokeEmu/MGBABridge.swift`, `ios/PokeEmu/PokeEmuCoreModule.swift`
- Modify: `android/app/src/main/cpp/mgba_bridge.cpp`, `android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt`
- Create: `src/state/cheatsStore.ts`
- Test: `src/state/cheatsStore.test.ts`
- Create: `src/screens/CheatsEditorScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx` (add the `CheatsEditor` route)

**Interfaces:**
- Consumes: `parseGameSharkCode` (Task 6), `PokeEmuCore.applyCheat` (Task 9).
- Produces: `useCheatsStore` persisting `{ [romId]: { code: string; enabled: boolean }[] }`; `CheatsEditorScreen` lets the user add/toggle codes for the active ROM.

- [ ] **Step 1: iOS — real cheat application via `mCheatDevice`**

**Correction (confirmed against the vendored header 2026-08-27):** there is no `attachCheatDevice` member and no standalone `mCheatDeviceCreate()`/`mCheatSetCreate()` factory functions with those exact shapes. The real API: `core->cheatDevice(core)` is a struct member that returns the core's own already-initialized `mCheatDevice*` (mGBA creates and owns it internally — we don't create or attach one ourselves). Sets are created via the device's own `createSet` member (`device->createSet(device, name)`), and `mCheatRemoveSet(device, set)` takes the **set pointer**, not the code string — so removing a single code by its text requires us to track which `mCheatSet*` backs which code string ourselves.

```swift
// ios/PokeEmu/MGBABridge.swift (add)
private var cheatSetsByCode: [String: UnsafeMutablePointer<mCheatSet>] = [:]

func applyCheat(code: String, enabled: Bool) -> Bool {
  guard let core = core, let device = core.pointee.cheatDevice(core) else { return false }
  if !enabled {
    if let set = cheatSetsByCode[code] {
      mCheatRemoveSet(device, set)
      cheatSetsByCode.removeValue(forKey: code)
    }
    return true
  }
  guard let set = device.pointee.createSet(device, "PokeEmu") else { return false }
  let added = code.withCString { mCheatAddLine(set, $0, 0) }
  if added {
    mCheatAddSet(device, set)
    cheatSetsByCode[code] = set
  }
  return added
}

func removeAllCheats() {
  guard let core = core, let device = core.pointee.cheatDevice(core) else { return }
  for (_, set) in cheatSetsByCode {
    mCheatRemoveSet(device, set)
  }
  cheatSetsByCode.removeAll()
}
```

```swift
// ios/PokeEmu/PokeEmuCoreModule.swift (replace stub)
@objc(applyCheat:enabled:withResolver:withRejecter:)
func applyCheat(code: String, enabled: Bool, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
  resolve(bridge.applyCheat(code: code, enabled: enabled))
}

@objc func removeAllCheats() {
  bridge.removeAllCheats()
}
```

- [ ] **Step 2: Android — mirror in JNI**

```cpp
// android/app/src/main/cpp/mgba_bridge.cpp (add)
#include <mgba/core/cheats.h>
#include <string>
#include <unordered_map>

namespace { std::unordered_map<std::string, mCheatSet*> gCheatSetsByCode; }

JNIEXPORT jboolean JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeApplyCheat(JNIEnv* env, jobject, jstring jcode, jboolean enabled) {
  if (!gCore) return JNI_FALSE;
  mCheatDevice* device = gCore->cheatDevice(gCore);
  if (!device) return JNI_FALSE;

  const char* codeChars = env->GetStringUTFChars(jcode, nullptr);
  std::string code(codeChars);
  env->ReleaseStringUTFChars(jcode, codeChars);

  if (!enabled) {
    auto it = gCheatSetsByCode.find(code);
    if (it == gCheatSetsByCode.end()) return JNI_TRUE;
    mCheatRemoveSet(device, it->second);
    gCheatSetsByCode.erase(it);
    return JNI_TRUE;
  }

  mCheatSet* set = device->createSet(device, "PokeEmu");
  bool added = mCheatAddLine(set, code.c_str(), 0);
  if (added) {
    mCheatAddSet(device, set);
    gCheatSetsByCode[code] = set;
  }
  return added ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL Java_com_pokeemu_core_PokeEmuCoreModule_nativeRemoveAllCheats(JNIEnv*, jobject) {
  if (!gCore) return;
  mCheatDevice* device = gCore->cheatDevice(gCore);
  if (!device) return;
  for (auto& entry : gCheatSetsByCode) {
    mCheatRemoveSet(device, entry.second);
  }
  gCheatSetsByCode.clear();
}
```

```kotlin
// android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt (replace stub)
private external fun nativeApplyCheat(code: String, enabled: Boolean): Boolean
private external fun nativeRemoveAllCheats()

@ReactMethod
fun applyCheat(code: String, enabled: Boolean, promise: Promise) {
  promise.resolve(nativeApplyCheat(code, enabled))
}

@ReactMethod
fun removeAllCheats() {
  nativeRemoveAllCheats()
}
```

- [ ] **Step 3: Write the failing test for `cheatsStore.ts`**

```ts
// src/state/cheatsStore.test.ts
import { useCheatsStore } from './cheatsStore';

describe('cheatsStore', () => {
  beforeEach(() => useCheatsStore.setState({ codesByRom: {} }));

  it('adds a code for a rom, defaulting to enabled', () => {
    useCheatsStore.getState().addCode('rom-1', '1A2B3C4D 5E6F7081');
    expect(useCheatsStore.getState().codesByRom['rom-1']).toEqual([
      { code: '1A2B3C4D 5E6F7081', enabled: true },
    ]);
  });

  it('toggles a code off', () => {
    useCheatsStore.getState().addCode('rom-1', '1A2B3C4D 5E6F7081');
    useCheatsStore.getState().setEnabled('rom-1', '1A2B3C4D 5E6F7081', false);
    expect(useCheatsStore.getState().codesByRom['rom-1'][0].enabled).toBe(false);
  });

  it('removes a code', () => {
    useCheatsStore.getState().addCode('rom-1', '1A2B3C4D 5E6F7081');
    useCheatsStore.getState().removeCode('rom-1', '1A2B3C4D 5E6F7081');
    expect(useCheatsStore.getState().codesByRom['rom-1']).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx jest src/state/cheatsStore.test.ts`
Expected: FAIL with "Cannot find module './cheatsStore'"

- [ ] **Step 5: Write `cheatsStore.ts`**

```ts
// src/state/cheatsStore.ts
import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'pokeemu-cheats' });
const STORAGE_KEY = 'codesByRom';

type CheatCode = { code: string; enabled: boolean };
type CheatsState = {
  codesByRom: Record<string, CheatCode[]>;
  addCode: (romId: string, code: string) => void;
  setEnabled: (romId: string, code: string, enabled: boolean) => void;
  removeCode: (romId: string, code: string) => void;
};

function loadPersisted(): Record<string, CheatCode[]> {
  const raw = storage.getString(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function persist(state: Record<string, CheatCode[]>) {
  storage.set(STORAGE_KEY, JSON.stringify(state));
}

export const useCheatsStore = create<CheatsState>((set, get) => ({
  codesByRom: loadPersisted(),
  addCode: (romId, code) => {
    const existing = get().codesByRom[romId] ?? [];
    const codesByRom = { ...get().codesByRom, [romId]: [...existing, { code, enabled: true }] };
    persist(codesByRom);
    set({ codesByRom });
  },
  setEnabled: (romId, code, enabled) => {
    const existing = get().codesByRom[romId] ?? [];
    const updated = existing.map((c) => (c.code === code ? { ...c, enabled } : c));
    const codesByRom = { ...get().codesByRom, [romId]: updated };
    persist(codesByRom);
    set({ codesByRom });
  },
  removeCode: (romId, code) => {
    const existing = get().codesByRom[romId] ?? [];
    const codesByRom = { ...get().codesByRom, [romId]: existing.filter((c) => c.code !== code) };
    persist(codesByRom);
    set({ codesByRom });
  },
}));
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/state/cheatsStore.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: `CheatsEditorScreen`**

```tsx
// src/screens/CheatsEditorScreen.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Switch, StyleSheet } from 'react-native';
import { useCheatsStore } from '../state/cheatsStore';
import { useSessionStore } from '../state/session';
import { parseGameSharkCode } from '../cheats/gameSharkParser';
import { PokeEmuCore } from '../native/PokeEmuCore';
import { theme } from '../theme/tokens';

export function CheatsEditorScreen() {
  const romId = useSessionStore((s) => s.activeRomId);
  const codes = useCheatsStore((s) => (romId ? s.codesByRom[romId] ?? [] : []));
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const { valid, normalized } = parseGameSharkCode(input);
    if (!valid || !romId) {
      setError('Enter a valid 16-digit GameShark code');
      return;
    }
    setError(null);
    useCheatsStore.getState().addCode(romId, normalized);
    await PokeEmuCore.applyCheat(normalized, true);
    setInput('');
  };

  const handleToggle = async (code: string, enabled: boolean) => {
    if (!romId) return;
    useCheatsStore.getState().setEnabled(romId, code, enabled);
    await PokeEmuCore.applyCheat(code, enabled);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="XXXXXXXX YYYYYYYY"
        value={input}
        onChangeText={setInput}
        autoCapitalize="characters"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.addButton} onPress={handleAdd}>
        <Text style={styles.addButtonText}>Add Code</Text>
      </Pressable>
      <FlatList
        data={codes}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.codeText}>{item.code}</Text>
            <Switch value={item.enabled} onValueChange={(v) => handleToggle(item.code, v)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.md },
  input: {
    borderWidth: 1, borderColor: theme.colors.secondaryLabel, borderRadius: theme.radii.md,
    padding: theme.spacing.sm, ...theme.typography.body,
  },
  error: { color: theme.colors.primaryDark, marginTop: theme.spacing.xs },
  addButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill, padding: theme.spacing.sm, alignItems: 'center', marginVertical: theme.spacing.sm },
  addButtonText: { color: '#FFFFFF', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.sm },
  codeText: { ...theme.typography.body, color: theme.colors.label },
});
```

- [ ] **Step 8: Register the route**

```tsx
// src/navigation/RootNavigator.tsx (modify)
// add to RootStackParamList: CheatsEditor: undefined;
// add to Stack.Navigator: <Stack.Screen name="CheatsEditor" component={CheatsEditorScreen} options={{ title: 'Cheats' }} />
```

Add a button in `EmulatorScreen` navigating to `CheatsEditor`.

- [ ] **Step 9: Manual verification**

Enter a known GameShark code for the loaded ROM (e.g. a public infinite-money code documented for the specific Pokémon game being tested), confirm the in-game effect appears; toggle it off and confirm the effect stops on the next relevant game read.

- [ ] **Step 10: Commit**

```bash
git add ios/PokeEmu/MGBABridge.swift ios/PokeEmu/PokeEmuCoreModule.swift android/app/src/main/cpp/mgba_bridge.cpp android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt src/state/cheatsStore.ts src/state/cheatsStore.test.ts src/screens/CheatsEditorScreen.tsx src/navigation/RootNavigator.tsx src/screens/EmulatorScreen.tsx
git commit -m "feat: add GameShark cheat code support"
```

---

### Task 20: Error handling

**Files:**
- Modify: `src/state/importRom.ts` (ROM header validation)
- Test: extend `src/state/importRom.test.ts`
- Modify: `ios/PokeEmu/PokeEmuCoreModule.swift`, `android/app/src/main/java/com/pokeemu/core/PokeEmuCoreModule.kt` (already reject on load/save-state failure per Tasks 10/16 — this task adds the JS-side handling of those rejections)
- Modify: `src/screens/EmulatorScreen.tsx` (catch `loadROM` rejection, show alert, navigate back)
- Modify: `src/screens/SaveStateSheet.tsx` (catch save/load-state rejection, show alert)
- Modify: `src/controls/useGamepadStatus.ts` consumer in `EmulatorScreen` (pause on disconnect)

**Interfaces:**
- Produces: no unhandled promise rejections reach the user as a crash; every native failure surfaces as an `Alert`.

- [ ] **Step 1: Extend the failing test for GBA header validation**

```ts
// src/state/importRom.test.ts (add)
it('rejects a .gba file whose header magic bytes are wrong', async () => {
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///picked/bad.gba', name: 'bad.gba' }],
  });
  (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(Buffer.alloc(192, 0).toString('base64'));
  const result = await importRom();
  expect(result).toBeNull();
  expect(FileSystem.copyAsync).not.toHaveBeenCalled();
});

it('accepts a .gba file with the correct Nintendo logo header bytes', async () => {
  const header = Buffer.alloc(192, 0);
  header.writeUInt8(0x24, 0x04); // first byte of the standard GBA Nintendo logo header
  (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///picked/good.gba', name: 'good.gba' }],
  });
  (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(header.toString('base64'));
  const result = await importRom();
  expect(result).not.toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/state/importRom.test.ts`
Expected: FAIL — `importRom` doesn't read/validate the header yet.

- [ ] **Step 3: Add header validation to `importRom.ts`**

```ts
// src/state/importRom.ts (modify)
async function hasValidGbaHeader(uri: string): Promise<boolean> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, length: 192, position: 0 });
  const header = Buffer.from(base64, 'base64');
  // Byte 0x04 of a valid GBA ROM header begins the fixed Nintendo logo bitmap,
  // whose first byte is always 0x24.
  return header.length >= 5 && header[0x04] === 0x24;
}

export async function importRom(): Promise<RomEntry | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
  if (result.canceled || !result.assets?.[0]) {
    return null;
  }
  const asset = result.assets[0];
  if (!/\.gba$/i.test(asset.name)) {
    return null;
  }
  if (!(await hasValidGbaHeader(asset.uri))) {
    return null;
  }
  // ...rest unchanged from Task 7
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/state/importRom.test.ts`
Expected: PASS (5 tests total)

- [ ] **Step 5: Surface a user-facing alert on invalid import**

```tsx
// src/screens/RomListScreen.tsx (modify handleImport)
import { Alert } from 'react-native';
// ...
const handleImport = async () => {
  const entry = await importRom();
  if (!entry) {
    Alert.alert('Import failed', 'That file could not be added — make sure it is a valid GBA ROM.');
  }
};
```

- [ ] **Step 6: Catch `loadROM` rejection in `EmulatorScreen`**

```tsx
// src/screens/EmulatorScreen.tsx (modify the mount effect)
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
// ...
useEffect(() => {
  let cancelled = false;
  useSessionStore.getState().setActiveRomId(route.params.romId);
  PokeEmuCore.loadROM(route.params.filePath)
    .then(() => { if (!cancelled) PokeEmuCore.play(); })
    .catch(() => {
      Alert.alert('Could not start this ROM', 'The core failed to load it.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    });
  return () => {
    cancelled = true;
    useSessionStore.getState().setActiveRomId(null);
    PokeEmuCore.unloadROM();
  };
}, [route.params.filePath]);
```

- [ ] **Step 7: Catch save/load-state rejection in `SaveStateSheet`**

```tsx
// src/screens/SaveStateSheet.tsx (modify handleSave/handleLoad)
import { Alert } from 'react-native';
// ...
const handleSave = async (slot: number) => {
  if (!romId) return;
  try {
    await PokeEmuCore.saveState(romId, slot);
    onClose();
  } catch {
    Alert.alert('Save failed', `Could not save to slot ${slot}.`);
  }
};

const handleLoad = async (slot: number) => {
  if (!romId) return;
  try {
    await PokeEmuCore.loadState(romId, slot);
    onClose();
  } catch {
    Alert.alert('Load failed', `Slot ${slot} may be empty or from an incompatible version.`);
  }
};
```

- [ ] **Step 8: Pause on controller disconnect**

```tsx
// src/screens/EmulatorScreen.tsx (modify)
const connected = useGamepadStatus();
const wasConnected = useRef(connected);
useEffect(() => {
  if (wasConnected.current && !connected) {
    PokeEmuCore.pause();
    Alert.alert('Controller disconnected', 'Reconnect it and press Resume to continue.', [
      { text: 'Resume', onPress: () => PokeEmuCore.play() },
    ]);
  }
  wasConnected.current = connected;
}, [connected]);
```

- [ ] **Step 9: Manual verification**

Attempt to import a non-ROM file (confirm the alert appears, nothing crashes); attempt to load a save state slot that was never saved (confirm the alert appears rather than a crash); disconnect a paired Bluetooth controller mid-play (confirm pause + prompt, no crash).

- [ ] **Step 10: Commit**

```bash
git add src/state/importRom.ts src/state/importRom.test.ts src/screens/RomListScreen.tsx src/screens/EmulatorScreen.tsx src/screens/SaveStateSheet.tsx
git commit -m "feat: add error handling for invalid ROMs, failed states, and controller disconnects"
```

---

### Task 21: Settings screen

**Files:**
- Create: `src/screens/SettingsScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx` (add the `Settings` route)
- Modify: `src/screens/RomListScreen.tsx` (add a settings entry point)

**Interfaces:**
- Consumes: `useSettingsStore` (Task 5).
- Produces: `SettingsScreen` with a fast-forward-speed stepper, a sound on/off switch, and a read-only display of the current button mapping (remapping UI itself is out of scope for Phase 1 per the spec — the store already supports it for a future task).

- [ ] **Step 1: Write the implementation directly (pure UI wiring over an already-tested store — no new logic to TDD)**

```tsx
// src/screens/SettingsScreen.tsx
import React from 'react';
import { View, Text, Switch, Pressable, StyleSheet } from 'react-native';
import { useSettingsStore } from '../state/settings';
import { theme } from '../theme/tokens';

export function SettingsScreen() {
  const fastForwardSpeed = useSettingsStore((s) => s.fastForwardSpeed);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setFastForwardSpeed = useSettingsStore((s) => s.setFastForwardSpeed);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Sound</Text>
        <Switch value={soundEnabled} onValueChange={setSoundEnabled} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Fast-forward speed: {fastForwardSpeed}×</Text>
        <View style={styles.stepper}>
          <Pressable onPress={() => setFastForwardSpeed(fastForwardSpeed - 1)} style={styles.stepperButton}>
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Pressable onPress={() => setFastForwardSpeed(fastForwardSpeed + 1)} style={styles.stepperButton}>
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.md },
  label: { ...theme.typography.body, color: theme.colors.label },
  stepper: { flexDirection: 'row', gap: theme.spacing.sm },
  stepperButton: { width: 32, height: 32, borderRadius: theme.radii.sm, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
});
```

- [ ] **Step 2: Register the route and an entry point**

```tsx
// src/navigation/RootNavigator.tsx (modify)
// add to RootStackParamList: Settings: undefined;
// add: <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
```

```tsx
// src/screens/RomListScreen.tsx (modify — add a header-right button)
// In the Props type, widen navigation.navigate to also accept 'Settings' with no params.
// Add a Pressable in the header area (or via navigation.setOptions in a useEffect) labeled "Settings" navigating to it.
```

- [ ] **Step 3: Manual verification**

Open Settings, toggle sound off, start a ROM, confirm no audio plays; toggle it back on, confirm audio resumes on the next load (Task 13's audio start should read `soundEnabled` before calling `startAudio()`/`startAudioStream()` — wire that one-line check into `EmulatorScreen`'s load effect: skip calling `PokeEmuCore.play()`'s underlying audio start when `useSettingsStore.getState().soundEnabled` is `false`, e.g. by exposing a `setSoundEnabled(enabled: boolean)` native method mirroring the pattern of `setFastForward`, muting the mixer node / Oboe stream instead of tearing it down).

- [ ] **Step 4: Commit**

```bash
git add src/screens/SettingsScreen.tsx src/navigation/RootNavigator.tsx src/screens/RomListScreen.tsx
git commit -m "feat: add Settings screen for sound and fast-forward speed"
```

---

### Task 22: Manual QA pass + sideload instructions

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: a written record that the full manual QA checklist from the spec has been run, plus instructions for installing the sideloaded build on the user's own devices.

- [ ] **Step 1: Run the full manual QA checklist from the spec**

Using the user's own legally-owned Pokémon GBA ROM: import it → launch it → save a state to slot 1 → play further → load slot 1 and confirm it reverts → connect a Bluetooth controller and confirm both touch and controller input work → hold fast-forward and confirm speed-up → add a cheat code and confirm its effect → force-quit the app and relaunch, confirming the in-game save persisted.

- [ ] **Step 2: Write `README.md`**

```markdown
# PokeEmu (Phase 1: GBA)

Personal, offline GBA emulator built on mGBA. Sideload only — not distributed via any app store.

## Running on iOS (sideload via Xcode)

1. `npm install && npx pod-install`
2. Open `ios/PokeEmu.xcworkspace` in Xcode.
3. Select your device as the run target, sign with your own Apple ID under Signing & Capabilities.
4. Build and run (⌘R). The app installs directly on your paired device.

## Running on Android (sideload via APK)

1. `npm install`
2. `cd android && ./gradlew assembleRelease`
3. Copy `android/app/build/outputs/apk/release/app-release.apk` to your device and install it (enable "Install unknown apps" for your file manager/browser first).

## Adding ROMs

Use the "Import a ROM" button on the home screen to pick a `.gba` file from your device's storage. Only import ROMs you legally own.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add sideload instructions and record of the manual QA pass"
```

---

## Self-Review Notes

- **Spec coverage:** every Phase 1 spec section maps to a task — architecture (Tasks 1, 9–13), ROM import/library (Tasks 4, 6–8), touch + controller input (Tasks 14–15), save states + in-game saves (Tasks 16–17), fast-forward (Task 18), cheats (Task 6, 19), error handling (Task 20), Apple/Pokémon theming (Task 3, applied throughout), testing approach (JS/TS TDD throughout; native manual QA called out per-task and consolidated in Task 22).
- **Placeholder scan:** no "TBD"/"handle it later" steps remain; every native mGBA API call is backed by real code, annotated with which vendored header to double-check given third-party ABI drift risk — this is a version-pinning caveat, not an unresolved decision.
- **Type consistency:** `GBAButton` (Task 5) is the single source of truth for button names, used identically by `TouchControls` (Task 14), the gamepad bridge (Task 15), and the native `setButtonState(button: String, ...)` signature (Task 9) on both platforms. `PokeEmuCoreNative`'s method signatures (Task 9) are not changed by any later task — Tasks 10/13/16/18/19 only replace stub *bodies*.
- **Scope:** this plan covers Phase 1 (GBA) only, as decided during brainstorming. Phase 2 (NDS) is explicitly out of scope and will get its own spec + plan once this one ships.
