import type {
  CustomerMfaStatus,
  CustomerNotificationPreferences,
  CustomerSessionSecurityStatus,
} from "@stealth-trails-bank/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  restoreWebSession,
  setWebCsrfToken,
  WEB_COOKIE_SESSION_MARKER,
} from "@/lib/auth-session";

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  supabaseUserId: string;
  ethereumAddress: string;
  passwordRotationAvailable?: boolean;
  notificationPreferences?: CustomerNotificationPreferences | null;
  mfa?: CustomerMfaStatus;
  sessionSecurity?: CustomerSessionSecurityStatus;
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
      clearUser: () => {
        setWebCsrfToken(null);
        set({ user: null, token: null });
      },
    }),
    {
      name: "user-storage",
      // Authentication state is recovered from the HttpOnly cookie. No bearer
      // credential or signed-in marker is written to browser storage.
      partialize: () => ({ user: null, token: null }),
      skipHydration: true,
    },
  ),
);

export function initializeUserStore(): Promise<void> {
  return useUserStore.persist.rehydrate().then(async () => {
    const user = await restoreWebSession();
    useUserStore.setState({
      user,
      token: user ? WEB_COOKIE_SESSION_MARKER : null,
    });
  });
}
