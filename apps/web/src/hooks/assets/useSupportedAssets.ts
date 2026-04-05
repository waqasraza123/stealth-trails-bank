import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

export type SupportedAsset = {
  id: string;
  symbol: string;
  displayName: string;
  decimals: number;
  chainId: number;
  assetType: string;
  contractAddress: string | null;
};

type ListSupportedAssetsResult = {
  assets: SupportedAsset[];
};

export function useSupportedAssets() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["supported-assets"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.get<ApiResponse<ListSupportedAssetsResult>>(
        `${webRuntimeConfig.serverUrl}/assets/supported`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(
          response.data.message || "Failed to load supported assets."
        );
      }

      return response.data.data;
    }
  });
}
