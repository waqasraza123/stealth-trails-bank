import { beforeEach, describe, expect, it } from "vitest";
import { initializeUserStore, useUserStore } from "@/stores/userStore";

describe("user store hydration", () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.persist.clearStorage();
    useUserStore.setState({ user: null, token: null });
  });

  it("rehydrates persisted auth state only when explicitly initialized", async () => {
    localStorage.setItem(
      "user-storage",
      JSON.stringify({
        state: {
          token: "persisted-token",
          user: {
            id: 1,
            firstName: "Amina",
            lastName: "Rahman",
            email: "amina@example.com",
            supabaseUserId: "supabase_1",
            ethereumAddress: "0x1111222233334444555566667777888899990000"
          }
        },
        version: 0
      })
    );

    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.persist.hasHydrated()).toBe(false);

    await initializeUserStore();

    expect(useUserStore.persist.hasHydrated()).toBe(true);
    expect(useUserStore.getState()).toMatchObject({
      token: "persisted-token",
      user: {
        email: "amina@example.com",
        ethereumAddress: "0x1111222233334444555566667777888899990000"
      }
    });
  });
});
