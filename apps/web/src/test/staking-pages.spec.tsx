import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useClaimStakeReward,
  useEmergencyStakeWithdrawal,
  useMyStakingSnapshot,
  useStakeDeposit,
  useStakeWithdrawal
} from "@/hooks/staking/useMyStakingSnapshot";
import CreatePool from "@/pages/CreatePool";
import Staking from "@/pages/Staking";
import { useUserStore } from "@/stores/userStore";

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

function renderWithRouter(element: ReactNode) {
  return render(<MemoryRouter>{element}</MemoryRouter>);
}

describe("staking product pages", () => {
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

  it("renders the live staking execution surface while respecting backend safety gates", async () => {
    const user = userEvent.setup();

    renderWithRouter(<Staking />);

    expect(
      screen.getByRole("heading", { name: /ethereum staking/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/customer staking execution remains policy-gated/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/96.5 ETH/i)).toBeInTheDocument();
    expect(screen.getByText(/Pool #11 Overview/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /view pool/i })[0]);

    expect(screen.getByText(/Pool #11 Overview/i)).toBeInTheDocument();
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
      screen.getByText(/execution is currently disabled by the backend/i)
    ).toBeInTheDocument();
  });

  it("replaces the mocked create-pool flow with an internal-only notice", () => {
    renderWithRouter(<CreatePool />);

    expect(
      screen.getByRole("heading", { name: /pool governance/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/internal-only workflow/i)).toBeInTheDocument();
    expect(
      screen.getByText(/pool creation currently depends on backend-controlled contract writes/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /connect metamask/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^create pool$/i })
    ).not.toBeInTheDocument();
  });
});
