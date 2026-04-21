import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

export type RetirementVaultProjection = {
  id: string;
  customerAccountId: string;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  status: "active" | "restricted" | "released";
  strictMode: boolean;
  unlockAt: string;
  lockedBalance: string;
  fundedAt: string | null;
  lastFundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  releaseRequests: RetirementVaultReleaseRequestProjection[];
  ruleChangeRequests: RetirementVaultRuleChangeRequestProjection[];
  events: RetirementVaultEventProjection[];
};

export type RetirementVaultReviewCaseSummary = {
  id: string;
  type: string;
  status: string;
  reasonCode: string | null;
  assignedOperatorId: string | null;
  updatedAt: string;
};

export type RetirementVaultReleaseIntentSummary = {
  id: string;
  intentType: "vault_redemption" | "vault_subscription" | string;
  status: string;
  policyDecision: string;
  requestedAmount: string;
  settledAmount: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RetirementVaultReleaseRequestProjection = {
  id: string;
  retirementVaultId: string;
  requestKind: "scheduled_unlock" | "early_unlock";
  requestedAmount: string;
  status:
    | "requested"
    | "review_required"
    | "approved"
    | "cooldown_active"
    | "ready_for_release"
    | "executing"
    | "rejected"
    | "released"
    | "cancelled"
    | "failed";
  reasonCode: string | null;
  reasonNote: string | null;
  evidence: unknown;
  requestedByActorType: string;
  requestedByActorId: string | null;
  reviewRequiredAt: string | null;
  reviewDecidedAt: string | null;
  cooldownEndsAt: string | null;
  requestedAt: string;
  cooldownStartedAt: string | null;
  readyForReleaseAt: string | null;
  approvedAt: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedAt: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  cancelledAt: string | null;
  cancelledByActorType: string | null;
  cancelledByActorId: string | null;
  executionStartedAt: string | null;
  executedByWorkerId: string | null;
  executionFailureCode: string | null;
  executionFailureReason: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewCase: RetirementVaultReviewCaseSummary | null;
  transactionIntent: RetirementVaultReleaseIntentSummary | null;
};

export type RetirementVaultEventProjection = {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  metadata: unknown;
  createdAt: string;
};

export type RetirementVaultRuleChangeRequestProjection = {
  id: string;
  retirementVaultId: string;
  status:
    | "review_required"
    | "cooldown_active"
    | "ready_to_apply"
    | "applying"
    | "rejected"
    | "cancelled"
    | "applied"
    | "failed";
  requestedByActorType: string;
  requestedByActorId: string | null;
  currentUnlockAt: string;
  requestedUnlockAt: string;
  currentStrictMode: boolean;
  requestedStrictMode: boolean;
  weakensProtection: boolean;
  reasonCode: string | null;
  reasonNote: string | null;
  reviewRequiredAt: string | null;
  reviewDecidedAt: string | null;
  requestedAt: string;
  cooldownStartedAt: string | null;
  cooldownEndsAt: string | null;
  approvedAt: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedAt: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  cancelledAt: string | null;
  cancelledByActorType: string | null;
  cancelledByActorId: string | null;
  applyStartedAt: string | null;
  appliedAt: string | null;
  appliedByWorkerId: string | null;
  applyFailureCode: string | null;
  applyFailureReason: string | null;
  createdAt: string;
  updatedAt: string;
  reviewCase: RetirementVaultReviewCaseSummary | null;
};

export type ListMyRetirementVaultsResult = {
  customerAccountId: string;
  vaults: RetirementVaultProjection[];
};

export function useMyRetirementVaults() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["retirement-vaults"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response =
        await axios.get<ApiResponse<ListMyRetirementVaultsResult>>(
          `${webRuntimeConfig.serverUrl}/retirement-vault/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load retirement vaults."
        );
      }

      return response.data.data;
    }
  });
}
