import * as SecureStore from "expo-secure-store";
import { useSessionStore } from "./session-store";

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
}));

const user = {
  id: 7,
  email: "customer@example.com",
  firstName: "Jamie",
  lastName: "Stone",
  supabaseUserId: "supabase_123",
  ethereumAddress: "0x1111111111111111111111111111111111111111",
};

const baseState = {
  token: null,
  refreshToken: null,
  user: null,
  hydrated: false,
  pendingRequestKeys: {},
};

describe("session store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState(baseState);
  });

  it("rotates a device-bound refresh token while hydrating", async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ refreshToken: "refresh_old", user }),
    );
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { token: "access_new", refreshToken: "refresh_new" },
      }),
    }) as jest.Mock;

    await useSessionStore.getState().hydrate();

    expect(useSessionStore.getState()).toEqual(
      expect.objectContaining({
        hydrated: true,
        token: "access_new",
        refreshToken: "refresh_new",
        user,
      }),
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "stb.mobile.refresh-session.v2",
      expect.stringContaining("refresh_new"),
      expect.objectContaining({ requireAuthentication: true }),
    );
  });

  it("persists only the refresh session and clears it on sign out", async () => {
    await useSessionStore.getState().signIn({
      token: "access_token",
      refreshToken: "refresh_token",
      user,
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().token).toBe("access_token");
    await useSessionStore.getState().signOut();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().token).toBeNull();
  });

  it("reuses and clears pending request keys", () => {
    const store = useSessionStore.getState();
    store.rememberRequestKey("withdraw:1", "request-key");
    expect(useSessionStore.getState().consumeRequestKey("withdraw:1")).toBe("request-key");
    useSessionStore.getState().clearRequestKey("withdraw:1");
    expect(useSessionStore.getState().consumeRequestKey("withdraw:1")).toBeNull();
  });
});
