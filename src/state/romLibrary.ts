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
