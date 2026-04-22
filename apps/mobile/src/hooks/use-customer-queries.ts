import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CustomerAgeProfile,
  CustomerMfaStatus,
  CustomerNotificationPreferences,
  CustomerSessionSecurityStatus,
  UserProfileProjection,
} from "@stealth-trails-bank/types";
import { apiClient, readApiErrorMessage } from "../lib/api/client";
import type {
  ApiEnvelope,
  CreateBalanceTransferResult,
  CreateDepositIntentResult,
  CreateMyRetirementVaultResult,
  CreateWithdrawalIntentResult,
  CancelMyRetirementVaultReleaseResult,
  CancelMyRetirementVaultRuleChangeResult,
  FundMyRetirementVaultResult,
  CustomerLoansDashboard,
  CustomerStakingSnapshot,
  ListCustomerSecurityActivityResult,
  ListMyBalancesResult,
  ListMyRetirementVaultsResult,
  ListMyTransactionHistoryResult,
  ListCustomerSessionsResult,
  ListSupportedAssetsResult,
  LoanApplicationInput,
  LoanQuotePreview,
  MfaStatusResponseData,
  ProfileProjection,
  RemoveTrustedContactResult,
  RequestMyRetirementVaultReleaseResult,
  RequestMyRetirementVaultRuleChangeResult,
  RotatePasswordResult,
  StartEmailEnrollmentResult,
  StartEmailRecoveryResult,
  StartMfaChallengeResult,
  StartSessionTrustChallengeResult,
  RevokeCustomerSessionsResult,
  RevokeCustomerSessionResult,
  StartTotpEnrollmentResult,
  StakingMutationResult,
  MutateTrustedContactResult,
  PreviewBalanceTransferRecipientResult,
  UpdateNotificationPreferencesResult,
  UpdateCustomerAgeProfileResult,
  VerifyMfaResult,
  VerifySessionTrustResult,
} from "../lib/api/types";
import { useSessionStore } from "../stores/session-store";

function mapProfileToSessionUser(
  profile: UserProfileProjection,
  currentUserId: number | undefined,
) {
  return {
    id: currentUserId ?? profile.id ?? 0,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    supabaseUserId: profile.supabaseUserId,
    ethereumAddress: profile.ethereumAddress,
    passwordRotationAvailable: profile.passwordRotationAvailable,
    notificationPreferences: profile.notificationPreferences,
    mfa: profile.mfa,
    sessionSecurity: profile.sessionSecurity,
  };
}

export function useProfileQuery() {
  const token = useSessionStore((state) => state.token);
  const user = useSessionStore((state) => state.user);
  const setUser = useSessionStore((state) => state.setUser);

  return useQuery({
    queryKey: ["profile", user?.supabaseUserId],
    enabled: Boolean(token && user?.supabaseUserId),
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<ProfileProjection>>(
        `/user/${user?.supabaseUserId}`,
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to load profile.");
      }

      await setUser(mapProfileToSessionUser(response.data.data, user?.id));
      return response.data.data;
    },
  });
}

export function useSupportedAssetsQuery() {
  const token = useSessionStore((state) => state.token);

  return useQuery({
    queryKey: ["supported-assets"],
    enabled: Boolean(token),
    queryFn: async () => {
      const response =
        await apiClient.get<ApiEnvelope<ListSupportedAssetsResult>>(
          "/assets/supported",
        );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load supported assets.",
        );
      }

      return response.data.data;
    },
  });
}

export function useBalancesQuery() {
  const token = useSessionStore((state) => state.token);

  return useQuery({
    queryKey: ["balances"],
    enabled: Boolean(token),
    queryFn: async () => {
      const response =
        await apiClient.get<ApiEnvelope<ListMyBalancesResult>>("/balances/me");

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to load balances.");
      }

      return response.data.data;
    },
  });
}

export function useRetirementVaultsQuery() {
  const token = useSessionStore((state) => state.token);

  return useQuery({
    queryKey: ["retirement-vaults"],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await apiClient.get<
        ApiEnvelope<ListMyRetirementVaultsResult>
      >("/retirement-vault/me");

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load retirement vaults.",
        );
      }

      return response.data.data;
    },
  });
}

export function useTransactionHistoryQuery(limit = 100) {
  const token = useSessionStore((state) => state.token);

  return useQuery({
    queryKey: ["transactions", limit],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await apiClient.get<
        ApiEnvelope<ListMyTransactionHistoryResult>
      >("/transaction-intents/me/history", {
        params: { limit },
      });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load transaction history.",
        );
      }

      return response.data.data;
    },
  });
}

export function useCreateDepositIntentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      idempotencyKey: string;
      assetSymbol: string;
      amount: string;
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<CreateDepositIntentResult>
      >("/transaction-intents/deposit-requests", input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to create deposit request.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useCreateWithdrawalIntentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      idempotencyKey: string;
      assetSymbol: string;
      amount: string;
      destinationAddress: string;
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<CreateWithdrawalIntentResult>
      >("/transaction-intents/withdrawal-requests", input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to create withdrawal request.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function usePreviewBalanceTransferRecipientMutation() {
  return useMutation({
    mutationFn: async (input: {
      email: string;
      assetSymbol?: string;
      amount?: string;
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<PreviewBalanceTransferRecipientResult>
      >("/balance-transfers/me/recipient-preview", input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message ||
            "Failed to preview internal transfer recipient."
        );
      }

      return response.data.data;
    },
  });
}

export function useCreateBalanceTransferMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      idempotencyKey: string;
      assetSymbol: string;
      amount: string;
      recipientEmail: string;
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<CreateBalanceTransferResult>
      >("/balance-transfers/me", input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message ||
            "Failed to create internal balance transfer."
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useCreateRetirementVaultMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      assetSymbol: string;
      unlockAt: string;
      strictMode?: boolean;
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<CreateMyRetirementVaultResult>
      >("/retirement-vault/me", input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to create retirement vault.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["retirement-vaults"] });
    },
  });
}

export function useFundRetirementVaultMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      idempotencyKey: string;
      assetSymbol: string;
      amount: string;
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<FundMyRetirementVaultResult>
      >("/retirement-vault/me/funding-requests", input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to fund retirement vault.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["retirement-vaults"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useRequestRetirementVaultReleaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      assetSymbol: string;
      amount: string;
      reasonCode?: string;
      reasonNote?: string;
      evidenceNote?: string;
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<RequestMyRetirementVaultReleaseResult>
      >("/retirement-vault/me/release-requests", input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to request retirement vault unlock.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["retirement-vaults"] });
    },
  });
}

export function useCancelRetirementVaultReleaseMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (releaseRequestId: string) => {
      const response = await apiClient.post<
        ApiEnvelope<CancelMyRetirementVaultReleaseResult>
      >(`/retirement-vault/me/release-requests/${releaseRequestId}/cancel`, {});

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message ||
            "Failed to cancel retirement vault unlock request.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["retirement-vaults"] });
    },
  });
}

export function useRequestRetirementVaultRuleChangeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      assetSymbol: string;
      unlockAt?: string;
      strictMode?: boolean;
      reasonCode?: string;
      reasonNote?: string;
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<RequestMyRetirementVaultRuleChangeResult>
      >("/retirement-vault/me/rule-change-requests", input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message ||
            "Failed to request retirement vault rule change.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["retirement-vaults"] });
    },
  });
}

export function useCancelRetirementVaultRuleChangeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleChangeRequestId: string) => {
      const response = await apiClient.post<
        ApiEnvelope<CancelMyRetirementVaultRuleChangeResult>
      >(
        `/retirement-vault/me/rule-change-requests/${ruleChangeRequestId}/cancel`,
        {},
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message ||
            "Failed to cancel retirement vault rule change request.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["retirement-vaults"] });
    },
  });
}

export function useStakingSnapshotQuery() {
  const token = useSessionStore((state) => state.token);

  return useQuery({
    queryKey: ["staking"],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await apiClient.get<
        ApiEnvelope<CustomerStakingSnapshot>
      >("/staking/me/snapshot");

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load staking snapshot.",
        );
      }

      return response.data.data;
    },
  });
}

function useStakingMutation(path: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      try {
        const response = await apiClient.post<
          ApiEnvelope<StakingMutationResult>
        >(`/staking/${path}`, input);

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(response.data.message || "Staking request failed.");
        }

        return response.data.data;
      } catch (error) {
        throw new Error(readApiErrorMessage(error, "Staking request failed."));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["staking"] });
    },
  });
}

export function useStakeDepositMutation() {
  return useStakingMutation("deposit");
}

export function useStakeWithdrawalMutation() {
  return useStakingMutation("withdraw");
}

export function useClaimRewardMutation() {
  return useStakingMutation("claim-reward");
}

export function useEmergencyWithdrawMutation() {
  return useStakingMutation("emergency-withdraw");
}

export function useRotatePasswordMutation() {
  const setToken = useSessionStore((state) => state.setToken);

  return useMutation({
    mutationFn: async (input: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const response = await apiClient.patch<ApiEnvelope<RotatePasswordResult>>(
        "/auth/password",
        input,
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to update password.");
      }

      if (response.data.data.session?.token) {
        await setToken(response.data.data.session.token);
      }

      return response.data.data;
    },
  });
}

function createMfaSessionUpdater(
  setUser: ((user: any) => Promise<void>) | undefined,
  currentUser: any,
) {
  return async (mfa: CustomerMfaStatus) => {
    if (!setUser || !currentUser) {
      return;
    }

    await setUser({
      ...currentUser,
      mfa,
    });
  };
}

function createSessionRefreshUpdater(
  setToken: ((token: string) => Promise<void>) | undefined,
) {
  return async (token: string | undefined) => {
    if (!setToken || !token) {
      return;
    }

    await setToken(token);
  };
}

function createSessionSecurityUpdater(
  setUser: ((user: any) => Promise<void>) | undefined,
  currentUser: any,
) {
  return async (sessionSecurity: CustomerSessionSecurityStatus) => {
    if (!setUser || !currentUser) {
      return;
    }

    await setUser({
      ...currentUser,
      sessionSecurity,
    });
  };
}

export function useMfaStatusQuery() {
  const token = useSessionStore((state) => state.token);
  const setUser = useSessionStore((state) => state.setUser);
  const user = useSessionStore((state) => state.user);
  const applyMfa = createMfaSessionUpdater(setUser, user);

  return useQuery({
    queryKey: ["mfa-status", user?.supabaseUserId],
    enabled: Boolean(token && user?.supabaseUserId),
    queryFn: async () => {
      const response =
        await apiClient.get<ApiEnvelope<MfaStatusResponseData>>(
          "/auth/mfa/status",
        );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to load MFA status.");
      }

      await applyMfa(response.data.data.mfa);
      return response.data.data;
    },
  });
}

export function useStartTotpEnrollmentMutation() {
  const setUser = useSessionStore((state) => state.setUser);
  const user = useSessionStore((state) => state.user);
  const applyMfa = createMfaSessionUpdater(setUser, user);

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<
        ApiEnvelope<StartTotpEnrollmentResult>
      >("/auth/mfa/totp/enrollment/start");

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to start authenticator setup.",
        );
      }

      await applyMfa(response.data.data.mfa);
      return response.data.data;
    },
  });
}

export function useVerifyTotpEnrollmentMutation() {
  const setUser = useSessionStore((state) => state.setUser);
  const setToken = useSessionStore((state) => state.setToken);
  const user = useSessionStore((state) => state.user);
  const applyMfa = createMfaSessionUpdater(setUser, user);
  const applySession = createSessionRefreshUpdater(setToken);

  return useMutation({
    mutationFn: async (input: { code: string }) => {
      const response = await apiClient.post<ApiEnvelope<VerifyMfaResult>>(
        "/auth/mfa/totp/enrollment/verify",
        input,
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to verify authenticator setup.",
        );
      }

      await applyMfa(response.data.data.mfa);
      await applySession(response.data.data.session?.token);
      return response.data.data;
    },
  });
}

export function useStartEmailEnrollmentMutation() {
  const setUser = useSessionStore((state) => state.setUser);
  const user = useSessionStore((state) => state.user);
  const applyMfa = createMfaSessionUpdater(setUser, user);

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<
        ApiEnvelope<StartEmailEnrollmentResult>
      >("/auth/mfa/email/enrollment/start");

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to start email MFA setup.",
        );
      }

      await applyMfa(response.data.data.mfa);
      return response.data.data;
    },
  });
}

export function useVerifyEmailEnrollmentMutation() {
  const setUser = useSessionStore((state) => state.setUser);
  const setToken = useSessionStore((state) => state.setToken);
  const user = useSessionStore((state) => state.user);
  const applyMfa = createMfaSessionUpdater(setUser, user);
  const applySession = createSessionRefreshUpdater(setToken);

  return useMutation({
    mutationFn: async (input: { challengeId: string; code: string }) => {
      const response = await apiClient.post<ApiEnvelope<VerifyMfaResult>>(
        "/auth/mfa/email/enrollment/verify",
        input,
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to verify email MFA setup.",
        );
      }

      await applyMfa(response.data.data.mfa);
      await applySession(response.data.data.session?.token);
      return response.data.data;
    },
  });
}

export function useStartEmailRecoveryMutation() {
  const setUser = useSessionStore((state) => state.setUser);
  const user = useSessionStore((state) => state.user);
  const applyMfa = createMfaSessionUpdater(setUser, user);

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<
        ApiEnvelope<StartEmailRecoveryResult>
      >("/auth/mfa/recovery/email/start");

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to start MFA recovery.",
        );
      }

      await applyMfa(response.data.data.mfa);
      return response.data.data;
    },
  });
}

export function useVerifyEmailRecoveryMutation() {
  const setUser = useSessionStore((state) => state.setUser);
  const setToken = useSessionStore((state) => state.setToken);
  const user = useSessionStore((state) => state.user);
  const applyMfa = createMfaSessionUpdater(setUser, user);
  const applySession = createSessionRefreshUpdater(setToken);

  return useMutation({
    mutationFn: async (input: { challengeId: string; code: string }) => {
      const response = await apiClient.post<ApiEnvelope<VerifyMfaResult>>(
        "/auth/mfa/recovery/email/verify",
        input,
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to verify MFA recovery.",
        );
      }

      await applyMfa(response.data.data.mfa);
      await applySession(response.data.data.session?.token);
      return response.data.data;
    },
  });
}

export function useStartMfaChallengeMutation() {
  const setUser = useSessionStore((state) => state.setUser);
  const user = useSessionStore((state) => state.user);
  const applyMfa = createMfaSessionUpdater(setUser, user);

  return useMutation({
    mutationFn: async (input: {
      method: "totp" | "email_otp";
      purpose: "withdrawal_step_up" | "password_step_up";
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<StartMfaChallengeResult>
      >("/auth/mfa/challenge/start", input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to start MFA challenge.",
        );
      }

      await applyMfa(response.data.data.mfa);
      return response.data.data;
    },
  });
}

export function useVerifyMfaChallengeMutation() {
  const setUser = useSessionStore((state) => state.setUser);
  const setToken = useSessionStore((state) => state.setToken);
  const user = useSessionStore((state) => state.user);
  const applyMfa = createMfaSessionUpdater(setUser, user);
  const applySession = createSessionRefreshUpdater(setToken);

  return useMutation({
    mutationFn: async (input: {
      challengeId: string;
      method: "totp" | "email_otp";
      purpose: "withdrawal_step_up" | "password_step_up";
      code: string;
    }) => {
      const response = await apiClient.post<ApiEnvelope<VerifyMfaResult>>(
        "/auth/mfa/challenge/verify",
        input,
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to verify MFA challenge.",
        );
      }

      await applyMfa(response.data.data.mfa);
      await applySession(response.data.data.session?.token);
      return response.data.data;
    },
  });
}

export function useRevokeAllCustomerSessionsMutation() {
  const setToken = useSessionStore((state) => state.setToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<
        ApiEnvelope<RevokeCustomerSessionsResult>
      >("/auth/session/revoke-all");

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to revoke sessions.");
      }

      await setToken(response.data.data.session.token);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-sessions"] });
    },
  });
}

export function useStartSessionTrustChallengeMutation() {
  const setUser = useSessionStore((state) => state.setUser);
  const user = useSessionStore((state) => state.user);
  const applySessionSecurity = createSessionSecurityUpdater(setUser, user);

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<
        ApiEnvelope<StartSessionTrustChallengeResult>
      >("/auth/session/trust/start");

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to send session verification code.",
        );
      }

      await applySessionSecurity(response.data.data.sessionSecurity);
      return response.data.data;
    },
  });
}

export function useVerifySessionTrustMutation() {
  const setUser = useSessionStore((state) => state.setUser);
  const user = useSessionStore((state) => state.user);
  const applySessionSecurity = createSessionSecurityUpdater(setUser, user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      const response = await apiClient.post<
        ApiEnvelope<VerifySessionTrustResult>
      >("/auth/session/trust/verify", { code });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to verify current session.",
        );
      }

      await applySessionSecurity(response.data.data.sessionSecurity);
      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-sessions"] });
      await queryClient.invalidateQueries({
        queryKey: ["customer-security-activity"],
      });
    },
  });
}

export function useCustomerSessionsQuery() {
  const token = useSessionStore((state) => state.token);

  return useQuery({
    queryKey: ["customer-sessions"],
    enabled: Boolean(token),
    queryFn: async () => {
      const response =
        await apiClient.get<ApiEnvelope<ListCustomerSessionsResult>>(
          "/auth/sessions",
        );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load customer sessions.",
        );
      }

      return response.data.data;
    },
  });
}

export function useCustomerSecurityActivityQuery() {
  const token = useSessionStore((state) => state.token);

  return useQuery({
    queryKey: ["customer-security-activity"],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await apiClient.get<
        ApiEnvelope<ListCustomerSecurityActivityResult>
      >("/auth/security-activity");

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load security activity.",
        );
      }

      return response.data.data;
    },
  });
}

export function useRevokeCustomerSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await apiClient.post<
        ApiEnvelope<RevokeCustomerSessionResult>
      >(`/auth/session/${sessionId}/revoke`);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to revoke customer session.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-sessions"] });
    },
  });
}

export function useUpdateNotificationPreferencesMutation() {
  const user = useSessionStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CustomerNotificationPreferences) => {
      const response = await apiClient.patch<
        ApiEnvelope<UpdateNotificationPreferencesResult>
      >("/notifications/me/preferences", {
        entries: input.entries,
      });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to update notification preferences.",
        );
      }

      return response.data.data.notificationPreferences;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["profile", user?.supabaseUserId],
      });
    },
  });
}

export function useUpdateCustomerAgeProfileMutation() {
  const user = useSessionStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { dateOfBirth: string | null }) => {
      const response = await apiClient.patch<
        ApiEnvelope<UpdateCustomerAgeProfileResult>
      >(`/user/${user?.supabaseUserId}/age-profile`, input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to update age profile.",
        );
      }

      return response.data.data.ageProfile;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["profile", user?.supabaseUserId],
      });
    },
  });
}

export function useCreateTrustedContactMutation() {
  const user = useSessionStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      kind: "trusted_contact" | "beneficiary";
      firstName: string;
      lastName: string;
      relationshipLabel: string;
      email?: string;
      phoneNumber?: string;
      note?: string;
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<MutateTrustedContactResult>
      >(`/user/${user?.supabaseUserId}/trusted-contacts`, input);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to create trusted contact.",
        );
      }

      return response.data.data.trustedContact;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["profile", user?.supabaseUserId],
      });
    },
  });
}

export function useUpdateTrustedContactMutation() {
  const user = useSessionStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      contactId: string;
      kind?: "trusted_contact" | "beneficiary";
      firstName?: string;
      lastName?: string;
      relationshipLabel?: string;
      email?: string;
      phoneNumber?: string;
      note?: string;
    }) => {
      const response = await apiClient.patch<
        ApiEnvelope<MutateTrustedContactResult>
      >(`/user/${user?.supabaseUserId}/trusted-contacts/${input.contactId}`, {
        kind: input.kind,
        firstName: input.firstName,
        lastName: input.lastName,
        relationshipLabel: input.relationshipLabel,
        email: input.email,
        phoneNumber: input.phoneNumber,
        note: input.note,
      });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to update trusted contact.",
        );
      }

      return response.data.data.trustedContact;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["profile", user?.supabaseUserId],
      });
    },
  });
}

export function useRemoveTrustedContactMutation() {
  const user = useSessionStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const response = await apiClient.delete<
        ApiEnvelope<RemoveTrustedContactResult>
      >(`/user/${user?.supabaseUserId}/trusted-contacts/${contactId}`);

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to remove trusted contact.",
        );
      }

      return response.data.data.removedTrustedContactId;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["profile", user?.supabaseUserId],
      });
    },
  });
}

export function useLoansDashboardQuery() {
  const token = useSessionStore((state) => state.token);

  return useQuery({
    queryKey: ["loans-dashboard"],
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<CustomerLoansDashboard>>(
        "/loans/me/dashboard",
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load customer loans.",
        );
      }

      return response.data.data;
    },
  });
}

export function useQuotePreviewMutation() {
  return useMutation({
    mutationFn: async (
      input: Omit<
        LoanApplicationInput,
        | "disclosureAcknowledgement"
        | "acceptServiceFeeDisclosure"
        | "supportNote"
      >,
    ) => {
      const response = await apiClient.post<ApiEnvelope<LoanQuotePreview>>(
        "/loans/me/quote-preview",
        input,
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to preview loan quote.",
        );
      }

      return response.data.data;
    },
  });
}

export function useCreateLoanApplicationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LoanApplicationInput) => {
      const response = await apiClient.post<ApiEnvelope<{ id: string }>>(
        "/loans/me/applications",
        input,
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to submit loan application.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loans-dashboard"] });
    },
  });
}

export function useAutopayMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      loanAgreementId: string;
      enabled: boolean;
      note?: string;
    }) => {
      const response = await apiClient.post<
        ApiEnvelope<{ autopayEnabled: boolean }>
      >(`/loans/me/${input.loanAgreementId}/autopay`, {
        policyOverride: input.enabled,
        note: input.note,
      });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to update autopay preference.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loans-dashboard"] });
    },
  });
}
