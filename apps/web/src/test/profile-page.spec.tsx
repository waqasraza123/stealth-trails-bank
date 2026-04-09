import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGetUser } from "@/hooks/user/useGetUser";
import Profile from "@/pages/Profile";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "@/test/render-with-router";

const mockUseGetUser = vi.mocked(useGetUser);

vi.mock("@/hooks/user/useGetUser", () => ({
  useGetUser: vi.fn()
}));

describe("profile page", () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000"
      }
    });

    mockUseGetUser.mockReturnValue({
      data: {
        id: 1,
        customerId: "customer_1",
        supabaseUserId: "supabase_1",
        email: "amina@example.com",
        firstName: "Amina",
        lastName: "Rahman",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
        accountStatus: "active",
        activatedAt: "2026-04-01T10:00:00.000Z",
        restrictedAt: null,
        frozenAt: null,
        closedAt: null
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useGetUser>);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders truthful customer profile data and removes fake self-service controls", () => {
    renderWithRouter(<Profile />);

    expect(
      screen.getByRole("heading", { name: /customer profile/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("customer_1")).toBeInTheDocument();
    expect(
      screen.getByText("0x1111222233334444555566667777888899990000")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/fake browser wallet linking, profile-image uploads/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connect metamask/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /update password/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("renders a destructive profile alert when the backend profile request fails", () => {
    mockUseGetUser.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error("profile backend unavailable")
    } as ReturnType<typeof useGetUser>);

    renderWithRouter(<Profile />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("profile backend unavailable")).toBeInTheDocument();
  });
});
