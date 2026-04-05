import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

type CreateWithdrawalIntentInput = {
  idempotencyKey: string;
  assetSymbol: string;
  amount: string;
  destinationAddress: string;
};

type WithdrawalIntentProjection = {
  id: string;
  customerAccountId: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  sourceWalletAddress: string | null;
  externalAddress: string | null;
  intentType: "withdrawal";
  status: string;
  policyDecision: string;
  requestedAmount: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateWithdrawalIntentResult = {
  intent: WithdrawalIntentProjection;
  idempotencyReused: boolean;
};

export function useCreateWithdrawalIntent() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateWithdrawalIntentInput) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response =
        await axios.post<ApiResponse<CreateWithdrawalIntentResult>>(
          `${webRuntimeConfig.serverUrl}/transaction-intents/withdrawal-requests`,
          input,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to create withdrawal request."
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["transaction-history"]
      });
      await queryClient.invalidateQueries({
        queryKey: ["customer-balances"]
      });
    }
  });
}
