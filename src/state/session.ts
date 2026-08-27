import { create } from 'zustand';

type SessionState = {
  activeRomId: string | null;
  setActiveRomId: (id: string | null) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  activeRomId: null,
  setActiveRomId: (id) => set({ activeRomId: id }),
}));
