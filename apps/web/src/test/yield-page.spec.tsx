import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useClaimStakeReward,
  useEmergencyStakeWithdrawal,
  useMyStakingSnapshot,
  useStakeDeposit,
  useStakeWithdrawal
} from "@/hooks/staking/useMyStakingSnapshot";
import { webLocaleStorageKey } from "@/i18n/provider";
import Yield from "@/pages/Yield";
import { useUserStore } from "@/stores/userStore";
import { renderWithRouter } from "@/test/render-with-router";

const mockUseMyStakingSnapshot = vi.mocked(useMyStakingSnapshot);
const mockUseStakeDeposit = vi.mocked(useStakeDeposit);
const mockUseStakeWithdrawal = vi.mocked(useStakeWithdrawal);
const mockUseClaimStakeReward = vi.mocked(useClaimStakeReward);
const mockUseEmergencyStakeWithdrawal = vi.mocked(useEmergencyStakeWithdrawal);

vi.mock("@/hooks/staking/useMyStakingSnapshot", () => ({
  useMyStakingSnapshot: vi.fn(),
  useStakeDeposit: vi.fn(),
  useStakeWithdrawal: vi.fn(),
  useClaimStakeReward: vi.fn(),
  useEmergencyStakeWithdrawal: vi.fn()
}));

describe("yield page", () => {
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
          message:
            "Customer staking execution is disabled because contract positions are keyed by the signing wallet, and the configured signer does not match this customer's managed wallet."
        },
        pools: [
          {
            id: 11,
            blockchainPoolId: 1001,
            rewardRate: 4.8,
            totalStakedAmount: "32.5",
            totalRewardsPaid: "1.25",
            poolStatus: "active",
            createdAt: "2026-04-05T10:00:00.000Z",
            updatedAt: "2026-04-05T11:00:00.000Z",
            position: {
              stakedBalance: "1.5",
              pendingReward: "0.25",
              canReadPosition: true
            }
          },
          {
            id: 12,
            blockchainPoolId: 1002,
            rewardRate: 4.5,
            totalStakedAmount: "64",
            totalRewardsPaid: "2.5",
            poolStatus: "paused",
            createdAt: "2026-04-04T10:00:00.000Z",
            updatedAt: "2026-04-05T08:00:00.000Z",
            position: {
              stakedBalance: "0",
              pendingReward: "0",
              canReadPosition: true
            }
          }
        ]
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

  it("renders the live yield surface while respecting backend safety gates", async () => {
    renderWithRouter(<Yield />);

    expect(
      screen.getByRole("heading", { name: /yield and infrastructure/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/execution remains policy-gated/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Pool #11/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/32.5 ETH/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1.5 ETH/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/0.25 ETH/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /stake eth/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /withdraw stake/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /claim rewards/i })
    ).toBeDisabled();
    expect(
      screen.getByText(/Execution is currently disabled by backend policy/i)
    ).toBeInTheDocument();
  });

  it("submits live yield actions when the backend enables execution", async () => {
    const user = userEvent.setup();
    const depositMutateAsync = vi.fn().mockResolvedValue({
      transactionHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    });
    const withdrawMutateAsync = vi.fn().mockResolvedValue({
      transactionHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    });
    const claimMutateAsync = vi.fn().mockResolvedValue({
      transactionHash:
        "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
    });
    const emergencyMutateAsync = vi.fn().mockResolvedValue({
      transactionHash:
        "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
    });

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
          available: true,
          reasonCode: null,
          message: "Managed staking execution is enabled."
        },
        pools: [
          {
            id: 11,
            blockchainPoolId: 1001,
            rewardRate: 4.8,
            totalStakedAmount: "32.5",
            totalRewardsPaid: "1.25",
            poolStatus: "active",
            createdAt: "2026-04-05T10:00:00.000Z",
            updatedAt: "2026-04-05T11:00:00.000Z",
            position: {
              stakedBalance: "1.5",
              pendingReward: "0.25",
              canReadPosition: true
            }
          }
        ]
      },
      isLoading: false,
      isError: false,
      error: null
    } as ReturnType<typeof useMyStakingSnapshot>);

    mockUseStakeDeposit.mockReturnValue({
      mutateAsync: depositMutateAsync,
      isPending: false
    } as ReturnType<typeof useStakeDeposit>);
    mockUseStakeWithdrawal.mockReturnValue({
      mutateAsync: withdrawMutateAsync,
      isPending: false
    } as ReturnType<typeof useStakeWithdrawal>);
    mockUseClaimStakeReward.mockReturnValue({
      mutateAsync: claimMutateAsync,
      isPending: false
    } as ReturnType<typeof useClaimStakeReward>);
    mockUseEmergencyStakeWithdrawal.mockReturnValue({
      mutateAsync: emergencyMutateAsync,
      isPending: false
    } as ReturnType<typeof useEmergencyStakeWithdrawal>);

    renderWithRouter(<Yield />);

    await user.type(screen.getByLabelText(/deposit amount/i), "2.75");
    await user.click(screen.getByRole("button", { name: /stake eth/i }));
    await waitFor(() => {
      expect(depositMutateAsync).toHaveBeenCalledWith({
        poolId: 11,
        amount: "2.75"
      });
    });

    await user.type(screen.getByLabelText(/withdrawal amount/i), "0.5");
    await user.click(screen.getByRole("button", { name: /withdraw stake/i }));
    await waitFor(() => {
      expect(withdrawMutateAsync).toHaveBeenCalledWith({
        poolId: 11,
        amount: "0.5"
      });
    });

    await user.click(screen.getByRole("button", { name: /claim rewards/i }));
    await waitFor(() => {
      expect(claimMutateAsync).toHaveBeenCalledWith({
        poolId: 11
      });
    });

    await user.click(screen.getByRole("button", { name: /emergency withdrawal/i }));
    await waitFor(() => {
      expect(emergencyMutateAsync).toHaveBeenCalledWith({
        poolId: 11
      });
    });
  });

  it("renders Arabic copy when the customer locale is Arabic", () => {
    localStorage.setItem(webLocaleStorageKey, "ar");

    renderWithRouter(<Yield />);

    expect(
      screen.getByRole("heading", { name: /العائد والبنية التحتية/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/وضع المنتج/i)).toBeInTheDocument();
    expect(screen.getByText(/المجمعات المدرجة/i)).toBeInTheDocument();
  });

  it("surfaces backend failures without collapsing the page shell", () => {
    mockUseMyStakingSnapshot.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Yield feed unavailable")
    } as ReturnType<typeof useMyStakingSnapshot>);

    renderWithRouter(<Yield />);

    expect(screen.getByText("Yield feed unavailable")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /yield and infrastructure/i })
    ).toBeInTheDocument();
  });
});
