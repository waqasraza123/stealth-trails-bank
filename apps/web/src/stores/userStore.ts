import type { CustomerNotificationPreferences } from "@stealth-trails-bank/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string;
  passwordRotationAvailable?: boolean;
  notificationPreferences?: CustomerNotificationPreferences | null;
}

interface UserState {
  user: User | null;
  token: string | null;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      clearUser: () => set({ user: null, token: null })
    }),
    {
      name: "user-storage",
      partialize: (state) => ({ user: state.user, token: state.token })
    }
  )
);
