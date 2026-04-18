import * as SecureStore from "expo-secure-store";
import { useSessionStore } from "./session-store";

const baseState = {
  token: null,
  user: null,
  hydrated: false,
  pendingRequestKeys: {}
};

describe("session store", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState(baseState);
  });

  it("hydrates token and user from secure storage", async () => {
    const mockUser = {
      id: 7,
      email: "customer@example.com",
      firstName: "Jamie",
      lastName: "Stone",
      supabaseUserId: "supabase_123",
      ethereumAddress: "0x1111111111111111111111111111111111111111"
    };

    jest
      .mocked(SecureStore.getItemAsync)
      .mockResolvedValueOnce("jwt_token")
      .mockResolvedValueOnce(JSON.stringify(mockUser));

    await useSessionStore.getState().hydrate();

    expect(useSessionStore.getState().hydrated).toBe(true);
    expect(useSessionStore.getState().token).toBe("jwt_token");
    expect(useSessionStore.getState().user).toEqual(mockUser);
  });

  it("persists and clears session state", async () => {
    const mockUser = {
      id: 12,
      email: "wallet@example.com",
      firstName: "Ava",
      lastName: "Cole",
      supabaseUserId: "supabase_456",
      ethereumAddress: "0x2222222222222222222222222222222222222222"
    };

    await useSessionStore.getState().signIn({
      token: "signed_in_token",
      user: mockUser
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(2);
    expect(useSessionStore.getState().token).toBe("signed_in_token");
    expect(useSessionStore.getState().user).toEqual(mockUser);

    await useSessionStore.getState().signOut();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(2);
    expect(useSessionStore.getState().token).toBeNull();
    expect(useSessionStore.getState().user).toBeNull();
  });

  it("reuses and clears pending request keys", () => {
    useSessionStore.getState().rememberRequestKey("deposit:1", "key_123");

    expect(useSessionStore.getState().consumeRequestKey("deposit:1")).toBe(
      "key_123"
    );

    useSessionStore.getState().clearRequestKey("deposit:1");

    expect(useSessionStore.getState().consumeRequestKey("deposit:1")).toBeNull();
  });
});
