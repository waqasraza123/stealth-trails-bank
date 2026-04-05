import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSupportedAssets } from "@/hooks/assets/useSupportedAssets";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useCreateDepositIntent } from "@/hooks/transaction-intents/useCreateDepositIntent";
import { useCreateWithdrawalIntent } from "@/hooks/transaction-intents/useCreateWithdrawalIntent";
import Wallet from "@/pages/Wallet";
import { useUserStore } from "@/stores/userStore";

const mockUseSupportedAssets = vi.mocked(useSupportedAssets);
const mockUseMyBalances = vi.mocked(useMyBalances);
const mockUseCreateDepositIntent = vi.mocked(useCreateDepositIntent);
const mockUseCreateWithdrawalIntent = vi.mocked(useCreateWithdrawalIntent);

vi.mock("@/hooks/assets/useSupportedAssets", () => ({
  useSupportedAssets: vi.fn()
}));

vi.mock("@/hooks/balances/useMyBalances", () => ({
  useMyBalances: vi.fn()
}));

vi.mock("@/hooks/transaction-intents/useCreateDepositIntent", () => ({
  useCreateDepositIntent: vi.fn()
}));

vi.mock("@/hooks/transaction-intents/useCreateWithdrawalIntent", () => ({
  useCreateWithdrawalIntent: vi.fn()
}));

function renderWithRouter(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("wallet page", () => {
  const mutateDepositAsync = vi.fn();
  const mutateWithdrawalAsync = vi.fn();

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

    mutateDepositAsync.mockReset();
    mutateWithdrawalAsync.mockReset();

    mockUseSupportedAssets.mockReturnValue({
      data: {
        assets: [
          {
            id: "asset_eth",
            symbol: "ETH",
            displayName: "Ether",
            decimals: 18,
            chainId: 1,
            assetType: "native",
            contractAddress: null
          },
          {
            id: "asset_usdc",
            symbol: "USDC",
            displayName: "USD Coin",
            decimals: 6,
            chainId: 1,
            assetType: "erc20",
            contractAddress: "0x0000000000000000000000000000000000000abc"
          }
        ]
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useSupportedAssets>);

    mockUseMyBalances.mockReturnValue({
      data: {
        customerAccountId: "account_1",
        balances: [
          {
            asset: {
              id: "asset_eth",
              symbol: "ETH",
              displayName: "Ether",
              decimals: 18,
              chainId: 1
            },
            availableBalance: "2.5",
            pendingBalance: "0",
            updatedAt: "2026-04-05T10:00:00.000Z"
          },
          {
            asset: {
              id: "asset_usdc",
              symbol: "USDC",
              displayName: "USD Coin",
              decimals: 6,
              chainId: 1
            },
            availableBalance: "100",
            pendingBalance: "10",
            updatedAt: "2026-04-05T10:00:00.000Z"
          }
        ]
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyBalances>);

    mockUseCreateDepositIntent.mockReturnValue({
      mutateAsync: mutateDepositAsync,
      isPending: false
    } as ReturnType<typeof useCreateDepositIntent>);

    mockUseCreateWithdrawalIntent.mockReturnValue({
      mutateAsync: mutateWithdrawalAsync,
      isPending: false
    } as ReturnType<typeof useCreateWithdrawalIntent>);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the managed wallet operations flow with live assets and balances", () => {
    renderWithRouter(<Wallet />);

    expect(
      screen.getByRole("heading", { name: /managed wallet operations/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/^Managed Deposit Address$/i)).toBeInTheDocument();
    expect(
      screen.getByText("0x1111222233334444555566667777888899990000")
    ).toBeInTheDocument();
    expect(screen.getByText(/Available:/i)).toBeInTheDocument();
    expect(screen.getByText(/2.5 ETH/i)).toBeInTheDocument();
    expect(screen.queryByText(/Transfer Funds/i)).not.toBeInTheDocument();
  });

  it("submits a deposit request through the live mutation flow", async () => {
    const user = userEvent.setup();

    mutateDepositAsync.mockResolvedValue({
      idempotencyReused: false,
      intent: {
        id: "intent_deposit_1",
        customerAccountId: "account_1",
        asset: {
          id: "asset_eth",
          symbol: "ETH",
          displayName: "Ether",
          decimals: 18,
          chainId: 1
        },
        destinationWalletAddress: "0x1111222233334444555566667777888899990000",
        intentType: "deposit",
        status: "requested",
        policyDecision: "pending",
        requestedAmount: "1.25",
        createdAt: "2026-04-05T10:00:00.000Z",
        updatedAt: "2026-04-05T10:00:00.000Z"
      }
    });

    renderWithRouter(<Wallet />);

    await user.type(screen.getByLabelText(/^Amount$/i, { selector: "#deposit-amount" }), "1.25");
    await user.click(screen.getByRole("button", { name: /create deposit request/i }));

    await waitFor(() => {
      expect(mutateDepositAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          assetSymbol: "ETH",
          amount: "1.25",
          idempotencyKey: expect.any(String)
        })
      );
    });

    expect(screen.getByText(/Latest deposit request/i)).toBeInTheDocument();
    expect(screen.getByText(/1.25 ETH/i)).toBeInTheDocument();
  });

  it("submits a withdrawal request with validated destination and live balance context", async () => {
    const user = userEvent.setup();

    mutateWithdrawalAsync.mockResolvedValue({
      idempotencyReused: false,
      intent: {
        id: "intent_withdraw_1",
        customerAccountId: "account_1",
        asset: {
          id: "asset_usdc",
          symbol: "USDC",
          displayName: "USD Coin",
          decimals: 6,
          chainId: 1
        },
        sourceWalletAddress: "0x1111222233334444555566667777888899990000",
        externalAddress: "0x0000000000000000000000000000000000000abc",
        intentType: "withdrawal",
        status: "requested",
        policyDecision: "pending",
        requestedAmount: "25",
        createdAt: "2026-04-05T10:00:00.000Z",
        updatedAt: "2026-04-05T10:00:00.000Z"
      }
    });

    renderWithRouter(<Wallet />);

    await user.selectOptions(screen.getByLabelText(/^Asset$/i, { selector: "#withdraw-asset" }), "USDC");
    await user.type(screen.getByLabelText(/destination address/i), "0x0000000000000000000000000000000000000abc");
    await user.type(screen.getByLabelText(/^Amount$/i, { selector: "#withdraw-amount" }), "25");
    await user.click(screen.getByRole("button", { name: /create withdrawal request/i }));

    await waitFor(() => {
      expect(mutateWithdrawalAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          assetSymbol: "USDC",
          amount: "25",
          destinationAddress: "0x0000000000000000000000000000000000000abc",
          idempotencyKey: expect.any(String)
        })
      );
    });

    expect(screen.getByText(/Latest withdrawal request/i)).toBeInTheDocument();
    expect(screen.getByText(/25 USDC/i)).toBeInTheDocument();
  });
});
