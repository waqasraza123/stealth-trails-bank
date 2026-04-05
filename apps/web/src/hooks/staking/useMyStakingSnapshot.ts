import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse, readApiErrorMessage } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

export type StakingExecutionCapability = {
  available: boolean;
  reasonCode:
    | "staking_contract_unconfigured"
    | "staking_write_unconfigured"
    | "customer_wallet_missing"
    | "customer_account_not_active"
    | "customer_wallet_not_active"
    | "wallet_custody_unsupported"
    | "signer_wallet_mismatch"
    | null;
  message: string;
};

export type CustomerStakingPoolSnapshot = {
  id: number;
  blockchainPoolId: number | null;
  rewardRate: number;
  totalStakedAmount: string;
  totalRewardsPaid: string;
  poolStatus: "active" | "disabled" | "paused" | "closed" | "completed";
  createdAt: string;
  updatedAt: string;
  position: {
    stakedBalance: string;
    pendingReward: string;
    canReadPosition: boolean;
  };
};

export type CustomerStakingSnapshot = {
  walletAddress: string | null;
  accountStatus: string;
  walletStatus: string;
  walletCustodyType: string;
  readModel: {
    available: boolean;
    message: string;
  };
  execution: StakingExecutionCapability;
  pools: CustomerStakingPoolSnapshot[];
};

type StakingMutationResult = {
  transactionHash: string;
};

type StakingAmountInput = {
  poolId: number;
  amount: string;
};

type StakingPoolInput = {
  poolId: number;
};

function useStakingMutation() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return async <TInput extends Record<string, unknown>>(
    path: string,
    input: TInput
  ) => {
    if (!token) {
      throw new Error("Auth token is required.");
    }

    try {
      const response = await axios.post<ApiResponse<StakingMutationResult>>(
        `${webRuntimeConfig.serverUrl}/staking/${path}`,
        input,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Staking request failed.");
      }

      await queryClient.invalidateQueries({
        queryKey: ["staking-snapshot"]
      });

      return response.data.data;
    } catch (error) {
      throw new Error(readApiErrorMessage(error, "Staking request failed."));
    }
  };
}

export function useMyStakingSnapshot() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["staking-snapshot"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.get<ApiResponse<CustomerStakingSnapshot>>(
          `${webRuntimeConfig.serverUrl}/staking/me/snapshot`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to load staking snapshot."
          );
        }

        return response.data.data;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to load staking snapshot.")
        );
      }
    }
  });
}

export function useStakeDeposit() {
  const mutateStaking = useStakingMutation();

  return useMutation({
    mutationFn: async (input: StakingAmountInput) =>
      mutateStaking("deposit", input)
  });
}

export function useStakeWithdrawal() {
  const mutateStaking = useStakingMutation();

  return useMutation({
    mutationFn: async (input: StakingAmountInput) =>
      mutateStaking("withdraw", input)
  });
}

export function useClaimStakeReward() {
  const mutateStaking = useStakingMutation();

  return useMutation({
    mutationFn: async (input: StakingPoolInput) =>
      mutateStaking("claim-reward", input)
  });
}

export function useEmergencyStakeWithdrawal() {
  const mutateStaking = useStakingMutation();

  return useMutation({
    mutationFn: async (input: StakingPoolInput) =>
      mutateStaking("emergency-withdraw", input)
  });
}
