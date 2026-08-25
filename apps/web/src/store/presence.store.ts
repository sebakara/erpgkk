import { create } from 'zustand';

interface PresenceState {
  onlineIds: string[];
  setAll: (ids: string[]) => void;
  add: (id: string) => void;
  remove: (id: string) => void;
  isOnline: (id: string) => boolean;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineIds: [],
  setAll: (ids) => set({ onlineIds: Array.from(new Set(ids)) }),
  add: (id) => set((s) => ({ onlineIds: s.onlineIds.includes(id) ? s.onlineIds : [...s.onlineIds, id] })),
  remove: (id) => set((s) => ({ onlineIds: s.onlineIds.filter((x) => x !== id) })),
  isOnline: (id) => get().onlineIds.includes(id),
}));
