import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAuth from "@/hooks/auth/useAuth";
import SignIn from "@/pages/auth/SignIn";
import SignUp from "@/pages/auth/SignUp";
import { useUserStore } from "@/stores/userStore";

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

function renderWithRouter(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("auth pages", () => {
  beforeEach(() => {
    localStorage.clear();
    useUserStore.setState({ user: null, token: null });
    mockNavigate.mockReset();
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      signup: vi.fn(),
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

  it("keeps shared demo access hidden until explicitly revealed", async () => {
    const user = userEvent.setup();

    renderWithRouter(<SignIn />);

    expect(screen.queryByText("admin@gmail.com")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /use shared demo access/i }));

    expect(screen.getByText("admin@gmail.com")).toBeInTheDocument();
    expect(screen.getByText("P@ssw0rd")).toBeInTheDocument();
  });

  it("autofills the shared credentials when requested", async () => {
    const user = userEvent.setup();

    renderWithRouter(<SignIn />);

    await user.click(screen.getByRole("button", { name: /use shared demo access/i }));
    await user.click(screen.getByRole("button", { name: /fill demo credentials/i }));

    expect(screen.getByLabelText(/email address/i)).toHaveValue("admin@gmail.com");
    expect(screen.getByLabelText(/^password$/i)).toHaveValue("P@ssw0rd");
  });

  it("redirects signed-in users away from auth screens", () => {
    useUserStore.setState({ token: "existing-token" });

    renderWithRouter(<SignIn />);
    renderWithRouter(<SignUp />);

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
