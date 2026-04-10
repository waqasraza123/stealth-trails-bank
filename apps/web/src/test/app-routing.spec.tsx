import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import useAuth from "@/hooks/auth/useAuth";
import {
  useClaimStakeReward,
  useEmergencyStakeWithdrawal,
  useMyStakingSnapshot,
  useStakeDeposit,
  useStakeWithdrawal
} from "@/hooks/staking/useMyStakingSnapshot";
import { useMyTransactionHistory } from "@/hooks/transactions/useMyTransactionHistory";
import App from "@/App";
import { useUserStore } from "@/stores/userStore";

const mockUseMyBalances = vi.mocked(useMyBalances);
const mockUseMyTransactionHistory = vi.mocked(useMyTransactionHistory);
const mockUseAuth = vi.mocked(useAuth);
const mockUseMyStakingSnapshot = vi.mocked(useMyStakingSnapshot);
const mockUseStakeDeposit = vi.mocked(useStakeDeposit);
const mockUseStakeWithdrawal = vi.mocked(useStakeWithdrawal);
const mockUseClaimStakeReward = vi.mocked(useClaimStakeReward);
const mockUseEmergencyStakeWithdrawal = vi.mocked(useEmergencyStakeWithdrawal);

vi.mock("@/hooks/balances/useMyBalances", () => ({
  useMyBalances: vi.fn(),
}));

vi.mock("@/hooks/transactions/useMyTransactionHistory", () => ({
  useMyTransactionHistory: vi.fn(),
}));

vi.mock("@/hooks/staking/useMyStakingSnapshot", () => ({
  useMyStakingSnapshot: vi.fn(),
  useStakeDeposit: vi.fn(),
  useStakeWithdrawal: vi.fn(),
  useClaimStakeReward: vi.fn(),
  useEmergencyStakeWithdrawal: vi.fn()
}));

vi.mock("@/hooks/auth/useAuth", () => ({
  default: vi.fn(),
}));

describe("app routing", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, "", "/");

    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      signup: vi.fn(),
      loading: false,
      error: null,
    });

    mockUseMyBalances.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        balances: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useMyBalances>);

    mockUseMyTransactionHistory.mockReturnValue({
      data: {
        limit: 5,
        intents: [],
      },
      isLoading: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useMyTransactionHistory>);

    mockUseMyStakingSnapshot.mockReturnValue({
      data: {
        walletAddress: "0x1111222233334444555566667777888899990000",
        accountStatus: "active",
        walletStatus: "active",
        walletCustodyType: "platform_managed",
        readModel: {
          available: true,
          message: "Live reads are available."
        },
        execution: {
          available: false,
          reasonCode: "signer_wallet_mismatch",
          message: "Managed execution is policy-gated."
        },
        pools: []
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyStakingSnapshot>);

    mockUseStakeDeposit.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    } as ReturnType<typeof useStakeDeposit>);
    mockUseStakeWithdrawal.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    } as ReturnType<typeof useStakeWithdrawal>);
    mockUseClaimStakeReward.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    } as ReturnType<typeof useClaimStakeReward>);
    mockUseEmergencyStakeWithdrawal.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false
    } as ReturnType<typeof useEmergencyStakeWithdrawal>);
  });

  afterEach(() => {
    cleanup();
  });

  it("redirects unauthenticated protected traffic to the sign-in route", async () => {
    useUserStore.setState({ user: null, token: null });

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /sign in to managed digital banking/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders the lazy dashboard route for authenticated users", async () => {
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
      },
    });

    render(<App />);

    expect(
      (await screen.findAllByRole("heading", { name: "Dashboard" })).length,
    ).toBeGreaterThan(0);
  });

  it("redirects the legacy staking route to the canonical yield route", async () => {
    window.history.pushState({}, "", "/staking");
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
      },
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /yield and infrastructure/i })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/yield");
    });
  });

  it("redirects the removed create-pool route to yield", async () => {
    window.history.pushState({}, "", "/create-pool");
    useUserStore.setState({
      token: "test-token",
      user: {
        id: 1,
        firstName: "Amina",
        lastName: "Rahman",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        ethereumAddress: "0x1111222233334444555566667777888899990000",
      },
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /yield and infrastructure/i })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/yield");
    });
  });
});
