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

export type CancelMyRetirementVaultRuleChangeResult = {
  vault: RetirementVaultProjection;
  ruleChangeRequest: RetirementVaultRuleChangeRequestProjection;
};

export function useCancelRetirementVaultRuleChange() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleChangeRequestId: string) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.post<
        ApiResponse<CancelMyRetirementVaultRuleChangeResult>
      >(
        `${webRuntimeConfig.serverUrl}/retirement-vault/me/rule-change-requests/${ruleChangeRequestId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
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
      await queryClient.invalidateQueries({
        queryKey: ["retirement-vaults"],
      });
    },
  });
}
