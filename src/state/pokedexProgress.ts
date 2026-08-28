import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'pokeemu-pokedex-progress' });
const STORAGE_KEY = 'caught';

type PokedexProgressState = {
  caught: Record<string, boolean>;
  toggleCaught: (key: string) => void;
};

function loadPersisted(): Record<string, boolean> {
  const raw = storage.getString(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

function persist(state: Record<string, boolean>) {
  storage.set(STORAGE_KEY, JSON.stringify(state));
}

export const usePokedexProgressStore = create<PokedexProgressState>((set, get) => ({
  caught: loadPersisted(),
  toggleCaught: (key) => {
    const caught = { ...get().caught, [key]: !get().caught[key] };
    persist(caught);
    set({ caught });
  },
}));
