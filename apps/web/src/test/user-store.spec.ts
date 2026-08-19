import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-session", () => ({
  WEB_COOKIE_SESSION_MARKER: "web-cookie-session",
  setWebCsrfToken: vi.fn(),
  restoreWebSession: vi.fn().mockResolvedValue(null),
}));

import { initializeUserStore, useUserStore } from "@/stores/userStore";

describe("user store hydration", () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.persist.clearStorage();
    useUserStore.setState({ user: null, token: null });
  });

  it("rejects persisted bearer state and restores only a server cookie session", async () => {
    localStorage.setItem(
      "user-storage",
      JSON.stringify({
        state: {
          token: "stolen-persisted-token",
          user: { email: "attacker-controlled@example.com" },
        },
        version: 0,
      }),
    );

    await initializeUserStore();

    expect(useUserStore.persist.hasHydrated()).toBe(true);
    expect(useUserStore.getState().token).toBeNull();
    expect(useUserStore.getState().user).toBeNull();
  });
});
