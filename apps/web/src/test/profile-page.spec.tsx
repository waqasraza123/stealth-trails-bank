import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRotatePassword, useUpdateNotificationPreferences } from "@/hooks/user/useProfileSettings";
import { useGetUser } from "@/hooks/user/useGetUser";
import Profile from "@/pages/Profile";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "@/test/render-with-router";

const mockUseGetUser = vi.mocked(useGetUser);
const mockUseRotatePassword = vi.mocked(useRotatePassword);
const mockUseUpdateNotificationPreferences = vi.mocked(
  useUpdateNotificationPreferences
);

vi.mock("@/hooks/user/useGetUser", () => ({
  useGetUser: vi.fn()
}));

vi.mock("@/hooks/user/useProfileSettings", () => ({
  useRotatePassword: vi.fn(),
  useUpdateNotificationPreferences: vi.fn()
}));

describe("profile page", () => {
  const rotatePassword = vi.fn();
  const updateNotificationPreferences = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    rotatePassword.mockReset();
    updateNotificationPreferences.mockReset();

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
        closedAt: null,
        passwordRotationAvailable: true,
        notificationPreferences: {
          depositEmails: true,
          withdrawalEmails: true,
          loanEmails: true,
          productUpdateEmails: false
        }
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useGetUser>);

    mockUseRotatePassword.mockReturnValue({
      mutateAsync: rotatePassword,
      isPending: false
    } as ReturnType<typeof useRotatePassword>);

    mockUseUpdateNotificationPreferences.mockReturnValue({
      mutateAsync: updateNotificationPreferences,
      isPending: false
    } as ReturnType<typeof useUpdateNotificationPreferences>);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders interactive customer security settings for a customer-backed profile", () => {
    renderWithRouter(<Profile />);

    expect(
      screen.getByRole("heading", { name: /customer profile/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Password Management$/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /update password/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save preferences/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /product updates/i })
    ).toHaveAttribute("data-state", "unchecked");
    expect(
      screen.getByText(/security and account-risk notifications remain mandatory/i)
    ).toBeInTheDocument();
  });

  it("blocks password submission when confirm password does not match", async () => {
    const user = userEvent.setup();

    renderWithRouter(<Profile />);

    await user.type(screen.getByLabelText(/current password/i), "current-pass");
    await user.type(screen.getByLabelText(/^new password$/i), "new-strong-pass");
    await user.type(screen.getByLabelText(/confirm new password/i), "different-pass");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(rotatePassword).not.toHaveBeenCalled();
    expect(
      screen.getByText(/confirm password must match the new password/i)
    ).toBeInTheDocument();
  });

  it("renders password mutation errors from the backend", async () => {
    const user = userEvent.setup();
    rotatePassword.mockRejectedValue(new Error("Current password is incorrect."));

    renderWithRouter(<Profile />);

    await user.type(screen.getByLabelText(/current password/i), "wrong-pass");
    await user.type(screen.getByLabelText(/^new password$/i), "new-strong-pass");
    await user.type(screen.getByLabelText(/confirm new password/i), "new-strong-pass");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(
      await screen.findByText("Current password is incorrect.")
    ).toBeInTheDocument();
  });

  it("preserves the notification preference draft when the save mutation fails", async () => {
    const user = userEvent.setup();
    updateNotificationPreferences.mockRejectedValue(
      new Error("Notification preference update failed.")
    );

    renderWithRouter(<Profile />);

    const productUpdatesSwitch = screen.getByRole("switch", {
      name: /product updates/i
    });

    await user.click(productUpdatesSwitch);
    await user.click(screen.getByRole("button", { name: /save preferences/i }));

    expect(updateNotificationPreferences).toHaveBeenCalledWith({
      depositEmails: true,
      withdrawalEmails: true,
      loanEmails: true,
      productUpdateEmails: true
    });
    expect(productUpdatesSwitch).toHaveAttribute("data-state", "checked");
    expect(
      await screen.findByText("Notification preference update failed.")
    ).toBeInTheDocument();
  });

  it("renders a read-only settings state for legacy-only profiles", () => {
    mockUseGetUser.mockReturnValue({
      data: {
        id: 1,
        customerId: null,
        supabaseUserId: "supabase_1",
        email: "amina@example.com",
        firstName: "Amina",
        lastName: "Rahman",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
        accountStatus: null,
        activatedAt: null,
        restrictedAt: null,
        frozenAt: null,
        closedAt: null,
        passwordRotationAvailable: false,
        notificationPreferences: null
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useGetUser>);

    renderWithRouter(<Profile />);

    expect(screen.getByText(/password rotation unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/notification preferences unavailable/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /update password/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save preferences/i })
    ).not.toBeInTheDocument();
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
