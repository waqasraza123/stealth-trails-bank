import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCreateTrustedContact,
  useListCustomerSessions,
  useListCustomerSecurityActivity,
  useRemoveTrustedContact,
  useRevokeCustomerSession,
  useRevokeAllSessions,
  useRotatePassword,
  useStartCurrentSessionTrustChallenge,
  useUpdateCustomerAgeProfile,
  useUpdateNotificationPreferences,
  useUpdateTrustedContact,
  useVerifyCurrentSessionTrust,
} from "@/hooks/user/useProfileSettings";
import { useGetUser } from "@/hooks/user/useGetUser";
import Profile from "@/pages/Profile";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "@/test/render-with-router";

const mockUseGetUser = vi.mocked(useGetUser);
const mockUseRotatePassword = vi.mocked(useRotatePassword);
const mockUseRevokeAllSessions = vi.mocked(useRevokeAllSessions);
const mockUseListCustomerSessions = vi.mocked(useListCustomerSessions);
const mockUseListCustomerSecurityActivity = vi.mocked(
  useListCustomerSecurityActivity,
);
const mockUseRevokeCustomerSession = vi.mocked(useRevokeCustomerSession);
const mockUseStartCurrentSessionTrustChallenge = vi.mocked(
  useStartCurrentSessionTrustChallenge,
);
const mockUseUpdateCustomerAgeProfile = vi.mocked(useUpdateCustomerAgeProfile);
const mockUseUpdateNotificationPreferences = vi.mocked(
  useUpdateNotificationPreferences,
);
const mockUseCreateTrustedContact = vi.mocked(useCreateTrustedContact);
const mockUseUpdateTrustedContact = vi.mocked(useUpdateTrustedContact);
const mockUseRemoveTrustedContact = vi.mocked(useRemoveTrustedContact);
const mockUseVerifyCurrentSessionTrust = vi.mocked(
  useVerifyCurrentSessionTrust,
);

vi.mock("@/hooks/user/useGetUser", () => ({
  useGetUser: vi.fn(),
}));

vi.mock("@/hooks/user/useProfileSettings", () => ({
  useListCustomerSessions: vi.fn(),
  useListCustomerSecurityActivity: vi.fn(),
  useRevokeCustomerSession: vi.fn(),
  useStartCurrentSessionTrustChallenge: vi.fn(),
  useUpdateCustomerAgeProfile: vi.fn(),
  useRevokeAllSessions: vi.fn(),
  useRotatePassword: vi.fn(),
  useUpdateNotificationPreferences: vi.fn(),
  useCreateTrustedContact: vi.fn(),
  useUpdateTrustedContact: vi.fn(),
  useRemoveTrustedContact: vi.fn(),
  useVerifyCurrentSessionTrust: vi.fn(),
}));

describe("profile page", () => {
  const rotatePassword = vi.fn();
  const revokeAllSessions = vi.fn();
  const revokeCustomerSession = vi.fn();
  const startSessionTrustChallenge = vi.fn();
  const updateCustomerAgeProfile = vi.fn();
  const updateNotificationPreferences = vi.fn();
  const createTrustedContact = vi.fn();
  const updateTrustedContact = vi.fn();
  const removeTrustedContact = vi.fn();
  const verifyCurrentSessionTrust = vi.fn();
  const freshMfa = {
    required: true,
    totpEnrolled: true,
    emailOtpEnrolled: true,
    requiresSetup: false,
    moneyMovementBlocked: false,
    stepUpFreshUntil: "2099-04-01T10:00:00.000Z",
    lockedUntil: null,
  } as const;

  beforeEach(() => {
    localStorage.clear();
    rotatePassword.mockReset();
    revokeAllSessions.mockReset();
    revokeCustomerSession.mockReset();
    startSessionTrustChallenge.mockReset();
    updateCustomerAgeProfile.mockReset();
    updateNotificationPreferences.mockReset();
    createTrustedContact.mockReset();
    updateTrustedContact.mockReset();
    removeTrustedContact.mockReset();
    verifyCurrentSessionTrust.mockReset();

    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
        sessionSecurity: {
          currentSessionTrusted: true,
          currentSessionRequiresVerification: false,
        },
      },
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
          audience: "customer",
          supportedChannels: ["in_app", "email"],
          updatedAt: null,
          entries: [
            {
              category: "security",
              channels: [
                { channel: "in_app", enabled: true, mandatory: true },
                { channel: "email", enabled: true, mandatory: true },
              ],
            },
            {
              category: "money_movement",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: true, mandatory: false },
              ],
            },
            {
              category: "yield",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: true, mandatory: false },
              ],
            },
            {
              category: "vault",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: true, mandatory: false },
              ],
            },
            {
              category: "loans",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: true, mandatory: false },
              ],
            },
            {
              category: "account",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: true, mandatory: false },
              ],
            },
            {
              category: "governance",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: false, mandatory: false },
              ],
            },
            {
              category: "operations",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: false, mandatory: false },
              ],
            },
            {
              category: "incident",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: false, mandatory: false },
              ],
            },
            {
              category: "product",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: false, mandatory: false },
              ],
            },
          ],
        },
        ageProfile: {
          dateOfBirth: "1990-04-11",
          ageYears: 35,
          legalAdult: true,
          verificationStatus: "verified",
          verifiedAt: "2026-04-01T00:00:00.000Z",
          verifiedByOperatorId: "operator_1",
          verificationNote: "Verified during KYC refresh.",
        },
        trustedContacts: [
          {
            id: "contact_1",
            kind: "trusted_contact",
            status: "active",
            firstName: "Sara",
            lastName: "Rahman",
            relationshipLabel: "Sister",
            email: "sara@example.com",
            phoneNumber: null,
            note: null,
            createdAt: "2026-04-10T00:00:00.000Z",
            updatedAt: "2026-04-11T00:00:00.000Z",
            removedAt: null,
          },
        ],
        mfa: freshMfa,
        sessionSecurity: {
          currentSessionTrusted: true,
          currentSessionRequiresVerification: false,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useGetUser>);

    mockUseRotatePassword.mockReturnValue({
      mutateAsync: rotatePassword,
      isPending: false,
    } as ReturnType<typeof useRotatePassword>);

    mockUseRevokeAllSessions.mockReturnValue({
      mutateAsync: revokeAllSessions,
      isPending: false,
    } as ReturnType<typeof useRevokeAllSessions>);

    mockUseListCustomerSessions.mockReturnValue({
      data: {
        sessions: [
          {
            id: "session_current",
            current: true,
            clientPlatform: "web",
            trusted: true,
            userAgent: "Mozilla/5.0",
            ipAddress: "203.0.113.10",
            createdAt: "2026-04-19T10:00:00.000Z",
            lastSeenAt: "2026-04-19T10:15:00.000Z",
          },
          {
            id: "session_other",
            current: false,
            clientPlatform: "mobile",
            trusted: true,
            userAgent: "Expo/ios",
            ipAddress: "198.51.100.24",
            createdAt: "2026-04-18T10:00:00.000Z",
            lastSeenAt: "2026-04-18T12:30:00.000Z",
          },
        ],
        activeSessionCount: 2,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useListCustomerSessions>);
    mockUseListCustomerSecurityActivity.mockReturnValue({
      data: {
        events: [
          {
            id: "audit_login",
            kind: "login",
            createdAt: "2026-04-19T10:00:00.000Z",
            clientPlatform: "web",
            ipAddress: "203.0.113.10",
            userAgent: "Mozilla/5.0",
            purpose: null,
            method: null,
          },
        ],
        limit: 20,
        totalCount: 1,
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useListCustomerSecurityActivity>);

    mockUseRevokeCustomerSession.mockReturnValue({
      mutateAsync: revokeCustomerSession,
      isPending: false,
    } as ReturnType<typeof useRevokeCustomerSession>);
    mockUseStartCurrentSessionTrustChallenge.mockReturnValue({
      mutateAsync: startSessionTrustChallenge,
      isPending: false,
    } as ReturnType<typeof useStartCurrentSessionTrustChallenge>);

    mockUseUpdateNotificationPreferences.mockReturnValue({
      mutateAsync: updateNotificationPreferences,
      isPending: false,
    } as ReturnType<typeof useUpdateNotificationPreferences>);
    mockUseUpdateCustomerAgeProfile.mockReturnValue({
      mutateAsync: updateCustomerAgeProfile,
      isPending: false,
    } as ReturnType<typeof useUpdateCustomerAgeProfile>);
    mockUseCreateTrustedContact.mockReturnValue({
      mutateAsync: createTrustedContact,
      isPending: false,
    } as ReturnType<typeof useCreateTrustedContact>);
    mockUseUpdateTrustedContact.mockReturnValue({
      mutateAsync: updateTrustedContact,
      isPending: false,
    } as ReturnType<typeof useUpdateTrustedContact>);
    mockUseRemoveTrustedContact.mockReturnValue({
      mutateAsync: removeTrustedContact,
      isPending: false,
    } as ReturnType<typeof useRemoveTrustedContact>);
    mockUseVerifyCurrentSessionTrust.mockReturnValue({
      mutateAsync: verifyCurrentSessionTrust,
      isPending: false,
    } as ReturnType<typeof useVerifyCurrentSessionTrust>);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders interactive customer security settings for a customer-backed profile", () => {
    renderWithRouter(<Profile />);

    expect(
      screen.getByRole("heading", { name: /customer profile/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^Password Management$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /update password/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save preferences/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save date of birth/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/trusted contacts and beneficiaries/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /product email/i }),
    ).toHaveAttribute("data-state", "unchecked");
    expect(
      screen.getByText(
        /security and account-risk notifications remain mandatory/i,
      ),
    ).toBeInTheDocument();
  });

  it("recommends named authenticator apps when MFA setup is incomplete", () => {
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
          audience: "customer",
          supportedChannels: ["in_app", "email"],
          updatedAt: null,
          entries: [
            {
              category: "security",
              channels: [
                { channel: "in_app", enabled: true, mandatory: true },
                { channel: "email", enabled: true, mandatory: true },
              ],
            },
            {
              category: "money_movement",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: true, mandatory: false },
              ],
            },
            {
              category: "yield",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: true, mandatory: false },
              ],
            },
            {
              category: "vault",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: true, mandatory: false },
              ],
            },
            {
              category: "loans",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: true, mandatory: false },
              ],
            },
            {
              category: "account",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: true, mandatory: false },
              ],
            },
            {
              category: "governance",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: false, mandatory: false },
              ],
            },
            {
              category: "operations",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: false, mandatory: false },
              ],
            },
            {
              category: "incident",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: false, mandatory: false },
              ],
            },
            {
              category: "product",
              channels: [
                { channel: "in_app", enabled: true, mandatory: false },
                { channel: "email", enabled: false, mandatory: false },
              ],
            },
          ],
        },
        ageProfile: {
          dateOfBirth: "1990-04-11",
          ageYears: 35,
          legalAdult: true,
          verificationStatus: "verified",
          verifiedAt: "2026-04-01T00:00:00.000Z",
          verifiedByOperatorId: "operator_1",
          verificationNote: "Verified during KYC refresh.",
        },
        trustedContacts: [],
        mfa: {
          ...freshMfa,
          totpEnrolled: false,
          emailOtpEnrolled: false,
          requiresSetup: true,
          moneyMovementBlocked: true,
          stepUpFreshUntil: null,
        },
        sessionSecurity: {
          currentSessionTrusted: true,
          currentSessionRequiresVerification: false,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useGetUser>);

    renderWithRouter(<Profile />);

    expect(
      screen.getByText(
        /recommended apps: google authenticator or microsoft authenticator/i,
      ),
    ).toBeInTheDocument();
  });

  it("blocks password submission when confirm password does not match", async () => {
    const user = userEvent.setup();

    renderWithRouter(<Profile />);

    await user.type(screen.getByLabelText(/current password/i), "current-pass");
    await user.type(
      screen.getByLabelText(/^new password$/i),
      "new-strong-pass",
    );
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "different-pass",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(rotatePassword).not.toHaveBeenCalled();
    expect(
      screen.getByText(/confirm password must match the new password/i),
    ).toBeInTheDocument();
  });

  it("renders password mutation errors from the backend", async () => {
    const user = userEvent.setup();
    rotatePassword.mockRejectedValue(
      new Error("Current password is incorrect."),
    );

    renderWithRouter(<Profile />);

    await user.type(screen.getByLabelText(/current password/i), "wrong-pass");
    await user.type(
      screen.getByLabelText(/^new password$/i),
      "new-strong-pass",
    );
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      "new-strong-pass",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(
      await screen.findByText("Current password is incorrect."),
    ).toBeInTheDocument();
  });

  it("preserves the notification preference draft when the save mutation fails", async () => {
    const user = userEvent.setup();
    updateNotificationPreferences.mockRejectedValue(
      new Error("Notification preference update failed."),
    );

    renderWithRouter(<Profile />);

    const productUpdatesSwitch = screen.getByRole("switch", {
      name: /product email/i,
    });

    await user.click(productUpdatesSwitch);
    await user.click(screen.getByRole("button", { name: /save preferences/i }));

    expect(updateNotificationPreferences).toHaveBeenCalledWith({
      audience: "customer",
      supportedChannels: ["in_app", "email"],
      updatedAt: null,
      entries: expect.any(Array),
    });
    expect(productUpdatesSwitch).toHaveAttribute("data-state", "checked");
    expect(
      await screen.findByText("Notification preference update failed."),
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
        notificationPreferences: null,
        ageProfile: null,
        trustedContacts: [],
        mfa: {
          ...freshMfa,
          requiresSetup: true,
          moneyMovementBlocked: true,
          stepUpFreshUntil: null,
        },
        sessionSecurity: {
          currentSessionTrusted: true,
          currentSessionRequiresVerification: false,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useGetUser>);

    renderWithRouter(<Profile />);

    expect(
      screen.getByText(/password rotation unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/notification preferences unavailable/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/age profile unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/trusted contacts unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /update password/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /save preferences/i }),
    ).not.toBeInTheDocument();
  });

  it("renders a destructive profile alert when the backend profile request fails", () => {
    mockUseGetUser.mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error("profile backend unavailable"),
    } as ReturnType<typeof useGetUser>);

    renderWithRouter(<Profile />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("profile backend unavailable")).toBeInTheDocument();
  });

  it("revokes other customer sessions from the profile security card", async () => {
    const user = userEvent.setup();

    renderWithRouter(<Profile />);

    await user.click(
      screen.getByRole("button", { name: /revoke all other sessions/i }),
    );

    expect(revokeAllSessions).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        /all other active customer sessions were signed out/i,
      ),
    ).toBeInTheDocument();
  });

  it("lists active sessions and revokes a selected non-current session", async () => {
    const user = userEvent.setup();

    renderWithRouter(<Profile />);

    expect(screen.getByText(/active sessions/i)).toBeInTheDocument();
    expect(screen.getAllByText(/web browser/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/mobile app/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /revoke session/i }));

    expect(revokeCustomerSession).toHaveBeenCalledWith("session_other");
    expect(
      await screen.findByText(/selected customer session was signed out/i),
    ).toBeInTheDocument();
  });

  it("renders recent customer security activity in the session security card", () => {
    renderWithRouter(<Profile />);

    expect(screen.getByText(/recent security activity/i)).toBeInTheDocument();
    expect(screen.getByText(/new sign-in/i)).toBeInTheDocument();
    expect(screen.getAllByText(/203.0.113.10/i).length).toBeGreaterThan(0);
  });
});
