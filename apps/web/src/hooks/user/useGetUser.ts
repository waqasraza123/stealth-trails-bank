import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import type { UserProfileProjection } from "@stealth-trails-bank/types";
import { ApiResponse, readApiErrorMessage } from "@/lib/api";
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
    ethereumAddress: profile.ethereumAddress,
    passwordRotationAvailable: profile.passwordRotationAvailable,
    notificationPreferences: profile.notificationPreferences
  };
}

export function useGetUser(userId: string | undefined) {
  const token = useUserStore((state) => state.token);
  const setUser = useUserStore((state) => state.setUser);

  return useQuery({
    queryKey: ["user-profile", userId],
    enabled: Boolean(userId && token),
    queryFn: async () => {
      if (!userId) {
        throw new Error("User id is required.");
      }

      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.get<ApiResponse<UserProfileProjection>>(
        `${webRuntimeConfig.serverUrl}/user/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to load user profile."
          );
        }

        setUser(mapUserProfileToStoreUser(response.data.data));

        return response.data.data;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to load user profile.")
        );
      }
    }
  });
}
