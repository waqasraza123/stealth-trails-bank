import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMyTransactionHistory } from "@/hooks/transactions/useMyTransactionHistory";
import { webLocaleStorageKey } from "@/i18n/provider";
import Transactions from "@/pages/Transactions";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "@/test/render-with-router";

const mockUseMyTransactionHistory = vi.mocked(useMyTransactionHistory);

vi.mock("@/hooks/transactions/useMyTransactionHistory", () => ({
  useMyTransactionHistory: vi.fn()
}));

describe("transactions page", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
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

    mockUseMyTransactionHistory.mockReturnValue({
      data: {
        limit: 100,
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
          },
          {
            id: "intent_2",
            asset: {
              id: "asset_usdc",
              symbol: "USDC",
              displayName: "USD Coin",
              decimals: 6,
              chainId: 1
            },
            sourceWalletAddress: "0x1111222233334444555566667777888899990000",
            destinationWalletAddress: null,
            externalAddress: "0x0000000000000000000000000000000000000fed",
            intentType: "withdrawal",
            status: "settled",
            policyDecision: "approved",
            requestedAmount: "10",
            settledAmount: "10",
            failureCode: null,
            failureReason: null,
            createdAt: "2026-04-06T10:30:00.000Z",
            updatedAt: "2026-04-06T10:35:00.000Z",
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

  it("filters transaction rows by search input and keeps addresses bidi-safe", async () => {
    const user = userEvent.setup();

    renderWithRouter(<Transactions />);

    expect(screen.getByText("+1.25 ETH")).toBeInTheDocument();
    expect(screen.getByText("-10 USDC")).toBeInTheDocument();
    expect(
      screen.getByText("0x0000000000000000000000000000000000000fed").tagName
    ).toBe("BDI");

    await user.type(
      screen.getByPlaceholderText("Search transactions..."),
      "0fed"
    );

    expect(screen.queryByText("+1.25 ETH")).not.toBeInTheDocument();
    expect(screen.getByText("-10 USDC")).toBeInTheDocument();
  });

  it("switches to Arabic, updates the document direction, and persists the locale", async () => {
    const user = userEvent.setup();

    renderWithRouter(<Transactions />);

    await user.click(screen.getByRole("button", { name: "العربية" }));

    expect(
      await screen.findByRole("heading", { name: "المعاملات" })
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(localStorage.getItem(webLocaleStorageKey)).toBe("ar");

    cleanup();
    renderWithRouter(<Transactions />);

    expect(
      screen.getByRole("heading", { name: "المعاملات" })
    ).toBeInTheDocument();
  });
});
