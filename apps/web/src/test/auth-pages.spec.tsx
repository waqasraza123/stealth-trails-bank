import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuth from "@/hooks/auth/useAuth";
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "@/test/render-with-router";

const mockNavigate = vi.fn();
const mockUseAuth = vi.mocked(useAuth);

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/auth/useAuth", () => ({
  default: vi.fn(),
}));

describe("auth pages", () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({ user: null, token: null });
    mockNavigate.mockReset();
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      signup: vi.fn(),
      verifyEmail: vi.fn(),
      resendEmailVerification: vi.fn(),
      startTotpEnrollment: vi.fn(),
      verifyTotpEnrollment: vi.fn(),
      verifyTotp: vi.fn(),
      verifyRecoveryCode: vi.fn(),
      upgradePassword: vi.fn(),
      setupRecoveryCodes: vi.fn(),
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the branded sign-in shell and login form", () => {
    renderWithRouter(<SignIn />);

    expect(
      screen.getByRole("heading", { name: /sign in to managed digital banking/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/institutional digital banking/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it("renders the branded sign-up shell and onboarding form", () => {
    renderWithRouter(<SignUp />);

    expect(
      screen.getByRole("heading", { name: /create your secure banking profile/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it("does not render shared access controls", () => {
    renderWithRouter(<SignIn />);

    expect(
      screen.queryByRole("button", { name: /use shared access/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/shared system access/i)).not.toBeInTheDocument();
  });

  it("redirects signed-in users away from auth screens", () => {
    useUserStore.setState({ token: "existing-token" });

    renderWithRouter(<SignIn />);
    renderWithRouter(<SignUp />);

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("does not crash when a persisted signed-in user is missing newer mfa fields", () => {
    useUserStore.setState({
      token: "existing-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000"
      }
    });

    renderWithRouter(<SignIn />);

    expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
