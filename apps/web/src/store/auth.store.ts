import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  _hasHydrated: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (partial: Partial<User>) => void;
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
}

/** localStorage throws in some Incognito / cookie-blocked browsers. */
const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function safeStorage(): StateStorage {
  if (typeof window === 'undefined') return memoryStorage;
  try {
    const key = '__os_probe';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return window.localStorage;
  } catch {
    return memoryStorage;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      _hasHydrated: false,
      setAuth: (user, token) => {
        try {
          if (typeof window !== 'undefined') localStorage.setItem('access_token', token);
        } catch { /* storage blocked */ }
        set({ user, token });
      },
      updateUser: (partial) => set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
      logout: () => {
        try {
          if (typeof window !== 'undefined') localStorage.removeItem('access_token');
        } catch { /* storage blocked */ }
        set({ user: null, token: null });
      },
      setHasHydrated: (v) => set({ _hasHydrated: v }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(safeStorage),
      skipHydration: true,
      partialize: (s) => ({ user: s.user, token: s.token }),
      onRehydrateStorage: () => (state, error) => {
        useAuthStore.setState({ _hasHydrated: true });
        if (!error && state?.token && typeof window !== 'undefined') {
          try {
            localStorage.setItem('access_token', state.token);
          } catch { /* storage blocked */ }
        }
      },
    },
  ),
);
