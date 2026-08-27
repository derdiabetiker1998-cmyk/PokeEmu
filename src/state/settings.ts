import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { GBAButton } from '../native/buttons';

const storage = new MMKV({ id: 'pokeemu-settings' });
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
