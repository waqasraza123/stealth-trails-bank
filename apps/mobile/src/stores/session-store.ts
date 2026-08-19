import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import { loadMobileRuntimeConfig } from "@stealth-trails-bank/config/mobile";
import type { SessionUser } from "../lib/api/types";

const sessionStorageKey = "stb.mobile.refresh-session.v2";
type PendingRequestCache = Record<string, string>;
type PersistedSession = { refreshToken: string; user: SessionUser };

async function secureStoreOptions(): Promise<SecureStore.SecureStoreOptions> {
  const biometricAvailable =
    Platform.OS !== "web" &&
    (await LocalAuthentication.hasHardwareAsync()) &&
    (await LocalAuthentication.isEnrolledAsync());
  return {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    requireAuthentication: biometricAvailable,
    authenticationPrompt: "Unlock Stealth Trails Bank",
  };
}

async function readPersistedSession(): Promise<PersistedSession | null> {
  if (Platform.OS === "web") return null;
  try {
    const value = await SecureStore.getItemAsync(
      sessionStorageKey,
      await secureStoreOptions(),
    );
    return value ? (JSON.parse(value) as PersistedSession) : null;
  } catch {
    return null;
  }
}

async function persistRefreshSession(value: PersistedSession): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(
    sessionStorageKey,
    JSON.stringify(value),
    await secureStoreOptions(),
  );
}

async function clearPersistedSession(): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(sessionStorageKey);
}

type SessionState = {
  token: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  hydrated: boolean;
  pendingRequestKeys: PendingRequestCache;
  hydrate: () => Promise<void>;
  signIn: (input: { token: string; refreshToken: string; user: SessionUser }) => Promise<void>;
  signOut: () => Promise<void>;
  setTokens: (token: string, refreshToken: string) => Promise<void>;
  setToken: (token: string) => Promise<void>;
  setUser: (user: SessionUser) => Promise<void>;
  rememberRequestKey: (signature: string, key: string) => void;
  consumeRequestKey: (signature: string) => string | null;
  clearRequestKey: (signature: string) => void;
  dropSession: () => void;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  pendingRequestKeys: {},
  hydrate: async () => {
    const persisted = await readPersistedSession();
    if (persisted) {
      try {
        const runtimeConfig = loadMobileRuntimeConfig({
          EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
        });
        const response = await fetch(`${runtimeConfig.apiBaseUrl}/auth/mobile/refresh`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-stb-client-platform": "mobile",
          },
          body: JSON.stringify({ refreshToken: persisted.refreshToken }),
        });
        if (!response.ok) throw new Error("Session refresh failed.");
        const envelope = (await response.json()) as {
          data?: { token: string; refreshToken: string };
        };
        const refreshed = envelope.data;
        if (refreshed) {
          await persistRefreshSession({
            refreshToken: refreshed.refreshToken,
            user: persisted.user,
          });
          set({
            token: refreshed.token,
            refreshToken: refreshed.refreshToken,
            user: persisted.user,
            hydrated: true,
          });
          return;
        }
      } catch {
        await clearPersistedSession();
      }
    }
    set({
      refreshToken: null,
      user: null,
      token: null,
      hydrated: true,
    });
  },
  signIn: async ({ token, refreshToken, user }) => {
    await persistRefreshSession({ refreshToken, user });
    set({ token, refreshToken, user, hydrated: true });
  },
  signOut: async () => {
    await clearPersistedSession();
    set({ token: null, refreshToken: null, user: null, pendingRequestKeys: {} });
  },
  setTokens: async (token, refreshToken) => {
    const user = get().user;
    if (user) await persistRefreshSession({ refreshToken, user });
    set({ token, refreshToken });
  },
  setToken: async (token) => set({ token }),
  setUser: async (user) => {
    const refreshToken = get().refreshToken;
    if (refreshToken) await persistRefreshSession({ refreshToken, user });
    set({ user });
  },
  rememberRequestKey: (signature, key) => set((state) => ({ pendingRequestKeys: { ...state.pendingRequestKeys, [signature]: key } })),
  consumeRequestKey: (signature) => get().pendingRequestKeys[signature] ?? null,
  clearRequestKey: (signature) => set((state) => {
    const next = { ...state.pendingRequestKeys };
    delete next[signature];
    return { pendingRequestKeys: next };
  }),
  dropSession: () => {
    set({ token: null, refreshToken: null, user: null, pendingRequestKeys: {} });
    void clearPersistedSession();
  },
}));
