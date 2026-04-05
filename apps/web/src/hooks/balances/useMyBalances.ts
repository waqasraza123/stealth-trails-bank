import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

type ApiResponse<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

export type CustomerAssetBalance = {
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  availableBalance: string;
  pendingBalance: string;
  updatedAt: string;
};

type ListMyBalancesResult = {
  customerAccountId: string;
  balances: CustomerAssetBalance[];
};

export function useMyBalances() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["customer-balances"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.get<ApiResponse<ListMyBalancesResult>>(
        `${webRuntimeConfig.serverUrl}/balances/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load customer balances."
        );
      }

      return response.data.data;
    }
  });
}
