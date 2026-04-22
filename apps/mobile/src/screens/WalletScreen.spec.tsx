import { fireEvent, waitFor } from "@testing-library/react-native";
import { WalletScreen } from "./WalletScreen";
import { renderMobile } from "../test/test-utils";

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate
  })
}));

jest.mock("../components/ui/ScreenHeaderActions", () => ({
  ScreenHeaderActions: () => null
}));

jest.mock("../hooks/use-customer-queries", () => ({
  useSupportedAssetsQuery: jest.fn(),
  useBalancesQuery: jest.fn(),
  useRetirementVaultsQuery: jest.fn(),
  useCreateDepositIntentMutation: jest.fn(),
  useCreateBalanceTransferMutation: jest.fn(),
  usePreviewBalanceTransferRecipientMutation: jest.fn(),
  useCreateWithdrawalIntentMutation: jest.fn(),
  useCreateRetirementVaultMutation: jest.fn(),
  useFundRetirementVaultMutation: jest.fn(),
  useStartMfaChallengeMutation: jest.fn(),
  useVerifyMfaChallengeMutation: jest.fn()
}));

const {
  useSupportedAssetsQuery,
  useBalancesQuery,
  useRetirementVaultsQuery,
  useCreateDepositIntentMutation,
  useCreateBalanceTransferMutation,
  usePreviewBalanceTransferRecipientMutation,
  useCreateWithdrawalIntentMutation,
  useCreateRetirementVaultMutation,
  useFundRetirementVaultMutation,
  useStartMfaChallengeMutation,
  useVerifyMfaChallengeMutation
} = jest.requireMock("../hooks/use-customer-queries") as {
  useSupportedAssetsQuery: jest.Mock;
  useBalancesQuery: jest.Mock;
  useRetirementVaultsQuery: jest.Mock;
  useCreateDepositIntentMutation: jest.Mock;
  useCreateBalanceTransferMutation: jest.Mock;
  usePreviewBalanceTransferRecipientMutation: jest.Mock;
  useCreateWithdrawalIntentMutation: jest.Mock;
  useCreateRetirementVaultMutation: jest.Mock;
  useFundRetirementVaultMutation: jest.Mock;
  useStartMfaChallengeMutation: jest.Mock;
  useVerifyMfaChallengeMutation: jest.Mock;
};

describe("WalletScreen", () => {
  const depositMutateAsync = jest.fn();
  const sendMutateAsync = jest.fn();
  const previewSendRecipientMutateAsync = jest.fn();
  const withdrawalMutateAsync = jest.fn();
  const createVaultMutateAsync = jest.fn();
  const fundVaultMutateAsync = jest.fn();
  const readyMfa = {
    required: true,
    totpEnrolled: true,
    emailOtpEnrolled: true,
    requiresSetup: false,
    moneyMovementBlocked: false,
    stepUpFreshUntil: "2099-04-18T08:00:00.000Z",
    lockedUntil: null
  };
  const readySessionSecurity = {
    currentSessionTrusted: true,
    currentSessionRequiresVerification: false
  };

  beforeEach(() => {
    mockNavigate.mockReset();
    depositMutateAsync.mockReset();
    sendMutateAsync.mockReset();
    previewSendRecipientMutateAsync.mockReset();
    withdrawalMutateAsync.mockReset();
    createVaultMutateAsync.mockReset();
    fundVaultMutateAsync.mockReset();
    useSupportedAssetsQuery.mockReturnValue({
      data: {
        assets: [
          {
            id: "eth",
            symbol: "ETH",
            displayName: "Ether",
            decimals: 18,
            chainId: 1,
            assetType: "native",
            contractAddress: null
          }
        ]
      },
      isError: false
    });
    useBalancesQuery.mockReturnValue({
      data: {
        balances: [
          {
            asset: {
              id: "eth",
              symbol: "ETH",
              displayName: "Ether",
              decimals: 18,
              chainId: 1
            },
            availableBalance: "5",
            pendingBalance: "1",
            updatedAt: "2026-04-18T08:00:00.000Z"
          }
        ]
      },
      isError: false
    });
    useRetirementVaultsQuery.mockReturnValue({
      data: {
        vaults: [
          {
            id: "vault-1",
            customerAccountId: "acct-1",
            asset: {
              id: "eth",
              symbol: "ETH",
              displayName: "Ether",
              decimals: 18,
              chainId: 1
            },
            status: "active",
            strictMode: true,
            unlockAt: "2036-04-18T08:00:00.000Z",
            lockedBalance: "1.25",
            fundedAt: "2026-04-18T08:00:00.000Z",
            lastFundedAt: "2026-04-18T08:00:00.000Z",
            createdAt: "2026-04-18T07:00:00.000Z",
            updatedAt: "2026-04-18T08:00:00.000Z"
          }
        ]
      },
      isError: false,
      isLoading: false
    });
    useCreateDepositIntentMutation.mockReturnValue({
      mutateAsync: depositMutateAsync,
      isPending: false
    });
    useCreateBalanceTransferMutation.mockReturnValue({
      mutateAsync: sendMutateAsync,
      isPending: false
    });
    usePreviewBalanceTransferRecipientMutation.mockReturnValue({
      mutateAsync: previewSendRecipientMutateAsync,
      isPending: false
    });
    useCreateWithdrawalIntentMutation.mockReturnValue({
      mutateAsync: withdrawalMutateAsync,
      isPending: false
    });
    useCreateRetirementVaultMutation.mockReturnValue({
      mutateAsync: createVaultMutateAsync,
      isPending: false
    });
    useFundRetirementVaultMutation.mockReturnValue({
      mutateAsync: fundVaultMutateAsync,
      isPending: false
    });
    useStartMfaChallengeMutation.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false
    });
    useVerifyMfaChallengeMutation.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false
    });
  });

  it("submits a deposit request and renders the latest request card", async () => {
    depositMutateAsync.mockResolvedValueOnce({
      idempotencyReused: false,
      intent: {
        id: "deposit-1",
        customerAccountId: "acct-1",
        asset: {
          id: "eth",
          symbol: "ETH",
          displayName: "Ether",
          decimals: 18,
          chainId: 1
        },
        destinationWalletAddress: "0x1234567890123456789012345678901234567890",
        intentType: "deposit",
        status: "review_required",
        policyDecision: "review_required",
        requestedAmount: "1.5",
        createdAt: "2026-04-18T08:00:00.000Z",
        updatedAt: "2026-04-18T08:00:00.000Z"
      }
    });

    const screen = renderMobile(<WalletScreen />, {
      user: {
        id: 1,
        email: "user@example.com",
        firstName: "Mobile",
        lastName: "Customer",
        supabaseUserId: "supabase-user",
        ethereumAddress: "0x1234567890123456789012345678901234567890",
        mfa: readyMfa,
        sessionSecurity: readySessionSecurity
      }
    });

    expect(
      screen.getByText(
        "Deposits are credited only after managed wallet detection, chain confirmation, and policy-safe settlement. Larger or anomalous deposits may pause for operator review."
      )
    ).toBeTruthy();
    expect(screen.getByText("Retirement Vault")).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText("Amount"), "1.5");
    fireEvent.press(screen.getByText("Create deposit request"));

    await waitFor(() => {
      expect(depositMutateAsync).toHaveBeenCalledWith({
        idempotencyKey: expect.any(String),
        assetSymbol: "ETH",
        amount: "1.5"
      });
    });

    expect(screen.getByText("Latest deposit request")).toBeTruthy();
    expect(screen.getByText("Reference: deposit-1")).toBeTruthy();
    expect(
      screen.getByText(
        "This deposit is paused for operator review before custody execution or final settlement continues."
      )
    ).toBeTruthy();
    expect(
      screen.getByText("Deposit request recorded and routed for operator review.")
    ).toBeTruthy();
  });

  it("rejects self-directed withdrawals before calling the mutation", async () => {
    const screen = renderMobile(<WalletScreen />, {
      user: {
        id: 1,
        email: "user@example.com",
        firstName: "Mobile",
        lastName: "Customer",
        supabaseUserId: "supabase-user",
        ethereumAddress: "0x1234567890123456789012345678901234567890",
        mfa: readyMfa,
        sessionSecurity: readySessionSecurity
      }
    });

    fireEvent.press(screen.getByTestId("wallet-action-withdraw"));
    fireEvent.changeText(
      screen.getByLabelText("Destination address"),
      "0x1234567890123456789012345678901234567890"
    );
    fireEvent.changeText(screen.getByLabelText("Amount"), "1.2");
    fireEvent.press(screen.getByText("Create withdrawal request"));

    await waitFor(() => {
      expect(withdrawalMutateAsync).not.toHaveBeenCalled();
      expect(
        screen.getByText(
          "Destination address must be different from your managed wallet address."
        )
      ).toBeTruthy();
    });
  });
});
