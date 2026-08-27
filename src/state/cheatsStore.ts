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
