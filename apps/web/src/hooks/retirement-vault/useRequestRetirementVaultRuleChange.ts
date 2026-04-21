import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";
import type {
  RetirementVaultProjection,
  RetirementVaultRuleChangeRequestProjection,
} from "./useMyRetirementVaults";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

type RequestRetirementVaultRuleChangeInput = {
  assetSymbol: string;
  unlockAt?: string;
  strictMode?: boolean;
  reasonCode?: string;
  reasonNote?: string;
};

export type RequestMyRetirementVaultRuleChangeResult = {
  vault: RetirementVaultProjection;
  ruleChangeRequest: RetirementVaultRuleChangeRequestProjection;
  reviewCaseReused: boolean;
  appliedImmediately: boolean;
};

export function useRequestRetirementVaultRuleChange() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RequestRetirementVaultRuleChangeInput) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<
        ApiResponse<RequestMyRetirementVaultRuleChangeResult>
      >(
        `${webRuntimeConfig.serverUrl}/retirement-vault/me/rule-change-requests`,
        input,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message ||
            "Failed to request retirement vault rule change.",
        );
      }

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["retirement-vaults"],
      });
    },
  });
}
