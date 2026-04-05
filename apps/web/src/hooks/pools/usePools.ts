import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

export type PoolStatus =
  | "active"
  | "disabled"
  | "paused"
  | "closed"
  | "completed";

export type StakingPool = {
  id: number;
  blockchainPoolId: number | null;
  rewardRate: number;
  totalStakedAmount: string;
  totalRewardsPaid: string;
  poolStatus: PoolStatus;
  createdAt: string;
  updatedAt: string;
};

export function usePools(status?: PoolStatus) {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["pools", status ?? "all"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.get<ApiResponse<StakingPool[]>>(
        `${webRuntimeConfig.serverUrl}/pools`,
        {
          params: status ? { status } : undefined,
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Failed to load staking pools.");
      }

      return response.data.data;
    }
  });
}
