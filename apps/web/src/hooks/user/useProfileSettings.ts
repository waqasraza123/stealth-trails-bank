import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CustomerNotificationPreferences,
  CustomerSessionProjection,
} from "@stealth-trails-bank/types";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse, readApiErrorMessage } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

type RotatePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

type RotatePasswordResult = {
  passwordRotationAvailable: boolean;
  session: {
    token: string;
    revokedOtherSessions: boolean;
  };
};

type UpdateNotificationPreferencesResult = {
  notificationPreferences: CustomerNotificationPreferences;
};

type RevokeCustomerSessionsResult = {
  session: {
    token: string;
    revokedOtherSessions: boolean;
  };
};

type ListCustomerSessionsResult = {
  sessions: CustomerSessionProjection[];
  activeSessionCount: number;
};

type RevokeCustomerSessionResult = {
  revokedSessionId: string;
  activeSessionCount: number;
};

function buildWebAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "x-stb-client-platform": "web",
  };
}

export function useRotatePassword() {
  const token = useUserStore((state) => state.token);
  const setToken = useUserStore((state) => state.setToken);

  return useMutation({
    mutationFn: async (input: RotatePasswordInput) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.patch<ApiResponse<RotatePasswordResult>>(
          `${webRuntimeConfig.serverUrl}/auth/password`,
          input,
          {
            headers: {
              ...buildWebAuthHeaders(token),
            },
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to update password.",
          );
        }

        setToken(response.data.data.session.token);
        return response.data.data;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to update password."),
        );
      }
    },
  });
}

export function useRevokeAllSessions() {
  const token = useUserStore((state) => state.token);
  const setToken = useUserStore((state) => state.setToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.post<
          ApiResponse<RevokeCustomerSessionsResult>
        >(
          `${webRuntimeConfig.serverUrl}/auth/session/revoke-all`,
          {},
          {
            headers: buildWebAuthHeaders(token),
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to revoke sessions.",
          );
        }

        setToken(response.data.data.session.token);
        return response.data.data;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to revoke sessions."),
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-sessions"] });
    },
  });
}

export function useListCustomerSessions() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["customer-sessions"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.get<ApiResponse<ListCustomerSessionsResult>>(
          `${webRuntimeConfig.serverUrl}/auth/sessions`,
          {
            headers: buildWebAuthHeaders(token),
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(response.data.message || "Failed to load sessions.");
        }

        return response.data.data;
      } catch (error) {
        throw new Error(readApiErrorMessage(error, "Failed to load sessions."));
      }
    }
  });
}

export function useRevokeCustomerSession() {
  const token = useUserStore((state) => state.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.post<ApiResponse<RevokeCustomerSessionResult>>(
          `${webRuntimeConfig.serverUrl}/auth/session/${sessionId}/revoke`,
          {},
          {
            headers: buildWebAuthHeaders(token),
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(response.data.message || "Failed to revoke session.");
        }

        return response.data.data;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to revoke session."),
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-sessions"] });
    },
  });
}

export function useUpdateNotificationPreferences() {
  const token = useUserStore((state) => state.token);
  const user = useUserStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CustomerNotificationPreferences) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      if (!user?.supabaseUserId) {
        throw new Error("User profile is required.");
      }

      try {
        const response = await axios.patch<
          ApiResponse<UpdateNotificationPreferencesResult>
        >(
          `${webRuntimeConfig.serverUrl}/user/${user.supabaseUserId}/notification-preferences`,
          input,
          {
            headers: {
              ...buildWebAuthHeaders(token),
            },
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message ||
              "Failed to update notification preferences.",
          );
        }

        return response.data.data.notificationPreferences;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(
            error,
            "Failed to update notification preferences.",
          ),
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["user-profile", user?.supabaseUserId],
      });
    },
  });
}
