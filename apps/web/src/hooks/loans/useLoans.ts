import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse, readApiErrorMessage } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

export type LoanPolicyPack = {
  jurisdiction: "saudi_arabia" | "uae" | "usa";
  displayName: string;
  disclosureTitle: string;
  disclosureBody: string;
  serviceFeeRateBps: number;
  warningLtvBps: number;
  liquidationLtvBps: number;
  gracePeriodDays: number;
};

export type LoanApplicationSummary = {
  id: string;
  status: string;
  jurisdiction: string;
  requestedBorrowAmount: string;
  requestedCollateralAmount: string;
  requestedTermMonths: number;
  serviceFeeAmount: string;
  borrowAsset: {
    symbol: string;
    displayName: string;
  };
  collateralAsset: {
    symbol: string;
    displayName: string;
  };
  submittedAt: string;
  reviewedAt: string | null;
  note: string | null;
  linkedLoanAgreementId: string | null;
  timeline: Array<{
    id: string;
    label: string;
    tone: "neutral" | "positive" | "warning" | "critical" | "technical";
    timestamp: string;
    description: string;
  }>;
};

export type LoanAgreementSummary = {
  id: string;
  status: string;
  jurisdiction: string;
  principalAmount: string;
  collateralAmount: string;
  serviceFeeAmount: string;
  outstandingPrincipalAmount: string;
  outstandingServiceFeeAmount: string;
  outstandingTotalAmount: string;
  installmentAmount: string;
  installmentCount: number;
  termMonths: number;
  autopayEnabled: boolean;
  borrowAsset: {
    symbol: string;
    displayName: string;
  };
  collateralAsset: {
    symbol: string;
    displayName: string;
  };
  nextDueAt: string | null;
  fundedAt: string | null;
  activatedAt: string | null;
  gracePeriodEndsAt: string | null;
  statementReferences: Array<{
    id: string;
    referenceId: string;
    statementDate: string;
  }>;
  collateralPositions: Array<{
    id: string;
    assetId: string;
    amount: string;
    status: string;
    walletAddress: string | null;
    currentValuationUsd: string | null;
    latestLtvBps: number | null;
  }>;
  installments: Array<{
    id: string;
    installmentNumber: number;
    dueAt: string;
    status: string;
    scheduledPrincipalAmount: string;
    scheduledServiceFeeAmount: string;
    scheduledTotalAmount: string;
    paidTotalAmount: string;
  }>;
  liquidationCases: Array<{
    id: string;
    status: string;
    reasonCode: string;
    recoveredAmount: string | null;
    shortfallAmount: string | null;
    updatedAt: string;
  }>;
  timeline: Array<{
    id: string;
    label: string;
    tone: "neutral" | "positive" | "warning" | "critical" | "technical";
    timestamp: string;
    description: string;
  }>;
  notice: string;
};

export type CustomerLoansDashboard = {
  account: {
    customerId: string;
    customerAccountId: string;
    email: string;
    walletAddress: string;
    accountStatus: string;
    walletStatus: string;
    custodyType: string;
  };
  eligibility: {
    eligible: boolean;
    accountReady: boolean;
    custodyReady: boolean;
    anyCollateralReady: boolean;
    reasons: string[];
    borrowingCapacity: {
      ETH: string;
      USDC: string;
    };
  };
  policyPacks: LoanPolicyPack[];
  supportedBorrowAssets: string[];
  supportedCollateralAssets: string[];
  balances: Array<{
    asset: {
      id: string;
      symbol: string;
      displayName: string;
      decimals: number;
      chainId: number;
      assetType: string;
      contractAddress: string | null;
    };
    availableBalance: string;
    pendingBalance: string;
  }>;
  applications: LoanApplicationSummary[];
  agreements: LoanAgreementSummary[];
};

export type LoanQuotePreview = {
  applicationReferenceId: string;
  jurisdiction: string;
  borrowAssetSymbol: string;
  collateralAssetSymbol: string;
  principalAmount: string;
  collateralAmount: string;
  serviceFeeAmount: string;
  totalRepayableAmount: string;
  installmentAmount: string;
  installmentCount: number;
  termMonths: number;
  initialLtvBps: number;
  warningLtvBps: number;
  liquidationLtvBps: number;
  gracePeriodDays: number;
  autopayEnabled: boolean;
  disclosureSummary: string;
  requestedCollateralRatioBps: number;
  policyPack: LoanPolicyPack;
};

export type LoanApplicationInput = {
  jurisdiction: "saudi_arabia" | "uae" | "usa";
  borrowAssetSymbol: "ETH" | "USDC";
  collateralAssetSymbol: "ETH" | "USDC";
  borrowAmount: string;
  collateralAmount: string;
  termMonths: string;
  autopayEnabled: boolean;
  disclosureAcknowledgement: string;
  acceptServiceFeeDisclosure: boolean;
  supportNote?: string;
};

function useAuthedClient() {
  const token = useUserStore((state) => state.token);

  return {
    token,
    get headers() {
      return token
        ? {
            Authorization: `Bearer ${token}`
          }
        : undefined;
    }
  };
}

export function useLoansDashboard() {
  const { token, headers } = useAuthedClient();

  return useQuery({
    queryKey: ["loans-dashboard"],
    enabled: Boolean(token),
    queryFn: async () => {
      try {
        const response = await axios.get<ApiResponse<CustomerLoansDashboard>>(
          `${webRuntimeConfig.serverUrl}/loans/me/dashboard`,
          { headers }
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(response.data.message || "Failed to load customer loans.");
        }

        return response.data.data;
      } catch (error) {
        throw new Error(readApiErrorMessage(error, "Failed to load customer loans."));
      }
    }
  });
}

export function usePreviewLoanQuote() {
  const { token, headers } = useAuthedClient();

  return useMutation({
    mutationFn: async (input: Omit<LoanApplicationInput, "disclosureAcknowledgement" | "acceptServiceFeeDisclosure" | "supportNote">) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<ApiResponse<LoanQuotePreview>>(
        `${webRuntimeConfig.serverUrl}/loans/me/quote-preview`,
        input,
        { headers }
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to preview loan quote.");
      }

      return response.data.data;
    }
  });
}

export function useCreateLoanApplication() {
  const { token, headers } = useAuthedClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LoanApplicationInput) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<
        ApiResponse<{
          applicationId: string;
          status: string;
          quote: LoanQuotePreview;
        }>
      >(`${webRuntimeConfig.serverUrl}/loans/me/applications`, input, {
        headers
      });

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to submit loan application.");
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loans-dashboard"] });
    }
  });
}

export function useSetLoanAutopay() {
  const { token, headers } = useAuthedClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      loanAgreementId,
      enabled,
      note
    }: {
      loanAgreementId: string;
      enabled: boolean;
      note?: string;
    }) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<
        ApiResponse<{ loanAgreementId: string; autopayEnabled: boolean }>
      >(
        `${webRuntimeConfig.serverUrl}/loans/me/${loanAgreementId}/autopay`,
        {
          policyOverride: enabled,
          note
        },
        { headers }
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to update autopay.");
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loans-dashboard"] });
    }
  });
}
