import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

type CreateDepositIntentInput = {
  idempotencyKey: string;
  assetSymbol: string;
  amount: string;
};

type DepositIntentProjection = {
  id: string;
  customerAccountId: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  destinationWalletAddress: string | null;
  intentType: "deposit";
  status: string;
  policyDecision: string;
  requestedAmount: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateDepositIntentResult = {
  intent: DepositIntentProjection;
  idempotencyReused: boolean;
};

export function useCreateDepositIntent() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDepositIntentInput) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<ApiResponse<CreateDepositIntentResult>>(
        `${webRuntimeConfig.serverUrl}/transaction-intents/deposit-requests`,
        input,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to create deposit request."
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
