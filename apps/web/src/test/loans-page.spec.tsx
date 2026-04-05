import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useMyTransactionHistory } from "@/hooks/transactions/useMyTransactionHistory";
import { useGetUser } from "@/hooks/user/useGetUser";
import Loans from "@/pages/Loans";
import { useUserStore } from "@/stores/userStore";

const mockUseGetUser = vi.mocked(useGetUser);
const mockUseMyBalances = vi.mocked(useMyBalances);
const mockUseMyTransactionHistory = vi.mocked(useMyTransactionHistory);

vi.mock("@/hooks/user/useGetUser", () => ({
  useGetUser: vi.fn()
}));

vi.mock("@/hooks/balances/useMyBalances", () => ({
  useMyBalances: vi.fn()
}));

vi.mock("@/hooks/transactions/useMyTransactionHistory", () => ({
  useMyTransactionHistory: vi.fn()
}));

function renderWithRouter(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("loans page", () => {
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

    mockUseMyBalances.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        balances: [
          {
            asset: {
              id: "asset_eth",
              symbol: "ETH",
              displayName: "Ethereum",
              decimals: 18,
              chainId: 1
            },
            availableBalance: "1.500000",
            pendingBalance: "0",
            updatedAt: "2026-04-05T09:00:00.000Z"
          },
          {
            asset: {
              id: "asset_usdc",
              symbol: "USDC",
              displayName: "USD Coin",
              decimals: 6,
              chainId: 1
            },
            availableBalance: "0",
            pendingBalance: "10",
            updatedAt: "2026-04-05T09:10:00.000Z"
          }
        ]
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyBalances>);

    mockUseMyTransactionHistory.mockReturnValue({
      data: {
        limit: 10,
        intents: [
          {
            id: "intent_1",
            asset: {
              id: "asset_eth",
              symbol: "ETH",
              displayName: "Ethereum",
              decimals: 18,
              chainId: 1
            },
            sourceWalletAddress: null,
            destinationWalletAddress: "0x1111222233334444555566667777888899990000",
            externalAddress: null,
            intentType: "deposit",
            status: "settled",
            policyDecision: "approved",
            requestedAmount: "1.25",
            settledAmount: "1.25",
            failureCode: null,
            failureReason: null,
            createdAt: "2026-04-05T10:30:00.000Z",
            updatedAt: "2026-04-05T10:30:00.000Z",
            latestBlockchainTransaction: null
          }
        ]
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyTransactionHistory>);
  });

  afterEach(() => {
    cleanup();
  });

  it("replaces mocked capital-product forms with truthful API-backed availability data", () => {
    renderWithRouter(<Loans />);

    expect(
      screen.getByRole("heading", { name: /loans & savings/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/customer self-service lending is not enabled/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText("Latest recorded activity")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /loans & savings/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Deposit").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/\+1.25 ETH/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /apply now/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /open savings account/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add to savings/i })
    ).not.toBeInTheDocument();
  });
});
