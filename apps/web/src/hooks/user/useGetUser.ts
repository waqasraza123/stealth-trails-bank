import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import type { UserProfileProjection } from "@stealth-trails-bank/types";
import type { User } from "@/stores/userStore";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>
);

function mapUserProfileToStoreUser(profile: UserProfileProjection): User {
  return {
    id: profile.id ?? 0,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    supabaseUserId: profile.supabaseUserId,
    ethereumAddress: profile.ethereumAddress
  };
}

export function useGetUser(userId: string | undefined) {
  const token = useUserStore((state) => state.token);
  const setUser = useUserStore((state) => state.setUser);

  return useQuery({
    queryKey: ["user", userId],
    enabled: Boolean(userId && token),
    queryFn: async () => {
      if (!userId) {
        throw new Error("User id is required.");
      }

      if (!token) {
        throw new Error("Auth token is required.");
      }

      const response = await axios.get<UserProfileProjection>(
        `${webRuntimeConfig.serverUrl}/user/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setUser(mapUserProfileToStoreUser(response.data));

      return response.data;
    }
  });
}
