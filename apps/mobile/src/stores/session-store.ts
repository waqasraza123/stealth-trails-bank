import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import type { SessionUser } from "../lib/api/types";

const tokenStorageKey = "stb.mobile.token";
const userStorageKey = "stb.mobile.user";

type PendingRequestCache = Record<string, string>;

type SessionState = {
  token: string | null;
  user: SessionUser | null;
  hydrated: boolean;
  pendingRequestKeys: PendingRequestCache;
  hydrate: () => Promise<void>;
  signIn: (input: { token: string; user: SessionUser }) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: SessionUser) => Promise<void>;
  rememberRequestKey: (signature: string, key: string) => void;
  consumeRequestKey: (signature: string) => string | null;
  clearRequestKey: (signature: string) => void;
  dropSession: () => void;
};

async function persistSession(token: string, user: SessionUser) {
  await SecureStore.setItemAsync(tokenStorageKey, token);
  await SecureStore.setItemAsync(userStorageKey, JSON.stringify(user));
}

async function clearPersistedSession() {
  await SecureStore.deleteItemAsync(tokenStorageKey);
  await SecureStore.deleteItemAsync(userStorageKey);
}

export const useSessionStore = create<SessionState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,
  pendingRequestKeys: {},
  hydrate: async () => {
    const [token, userValue] = await Promise.all([
      SecureStore.getItemAsync(tokenStorageKey),
      SecureStore.getItemAsync(userStorageKey)
    ]);

    let user: SessionUser | null = null;

    if (userValue) {
      try {
        user = JSON.parse(userValue) as SessionUser;
      } catch {
        user = null;
      }
    }

    set({
      token: token ?? null,
      user,
      hydrated: true
    });
  },
  signIn: async ({ token, user }) => {
    await persistSession(token, user);
    set({ token, user, hydrated: true });
  },
  signOut: async () => {
    await clearPersistedSession();
    set({
      token: null,
      user: null,
      pendingRequestKeys: {}
    });
  },
  setUser: async (user) => {
    const token = get().token;

    if (token) {
      await persistSession(token, user);
    }

    set({ user });
  },
  rememberRequestKey: (signature, key) => {
    set((state) => ({
      pendingRequestKeys: {
        ...state.pendingRequestKeys,
        [signature]: key
      }
    }));
  },
  consumeRequestKey: (signature) => get().pendingRequestKeys[signature] ?? null,
  clearRequestKey: (signature) => {
    set((state) => {
      const next = { ...state.pendingRequestKeys };
      delete next[signature];
      return { pendingRequestKeys: next };
    });
  },
  dropSession: () => {
    set({
      token: null,
      user: null,
      pendingRequestKeys: {}
    });
    void clearPersistedSession();
  }
}));
