import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useMyTransactionHistory } from "@/hooks/transactions/useMyTransactionHistory";
import Index from "@/pages/Index";
import { useUserStore } from "@/stores/userStore";

const mockUseMyBalances = vi.mocked(useMyBalances);
const mockUseMyTransactionHistory = vi.mocked(useMyTransactionHistory);

vi.mock("@/hooks/balances/useMyBalances", () => ({
  useMyBalances: vi.fn()
}));

vi.mock("@/hooks/transactions/useMyTransactionHistory", () => ({
  useMyTransactionHistory: vi.fn()
}));

function renderWithRouter(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("dashboard page", () => {
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
            pendingBalance: "0.250000",
            updatedAt: "2026-04-05T09:00:00.000Z"
          }
        ]
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyBalances>);

    mockUseMyTransactionHistory.mockReturnValue({
      data: {
        limit: 5,
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
            status: "requested",
            policyDecision: "pending",
            requestedAmount: "1.25",
            settledAmount: null,
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

  it("renders live balances, wallet details, and recent transaction history", () => {
    renderWithRouter(<Index />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText(/managed account overview for amina/i)).toBeInTheDocument();
    expect(screen.getByText("Ethereum")).toBeInTheDocument();
    expect(screen.getByText("1.5 ETH")).toBeInTheDocument();
    expect(screen.getByText("0.25 ETH pending")).toBeInTheDocument();
    expect(
      screen.getByText("0x1111222233334444555566667777888899990000")
    ).toBeInTheDocument();
    expect(screen.getByText("Deposit")).toBeInTheDocument();
    expect(screen.getByText("+1.25 ETH")).toBeInTheDocument();
    expect(screen.queryByText(/AI Investment Advisor/i)).not.toBeInTheDocument();
  });

  it("renders safe empty states when no balances or transaction history exist", () => {
    mockUseMyBalances.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        balances: []
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyBalances>);

    mockUseMyTransactionHistory.mockReturnValue({
      data: {
        limit: 5,
        intents: []
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyTransactionHistory>);

    renderWithRouter(<Index />);

    expect(screen.getByText("No balances yet")).toBeInTheDocument();
    expect(
      screen.getByText(/No transaction history has been recorded/i)
    ).toBeInTheDocument();
  });
});
