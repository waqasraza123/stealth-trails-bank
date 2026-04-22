import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CustomerAgeProfile,
  CustomerNotificationPreferences,
  CustomerSecurityActivityProjection,
  CustomerSessionSecurityStatus,
  CustomerSessionProjection,
  CustomerTrustedContactProjection,
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

type UpdateCustomerAgeProfileResult = {
  ageProfile: CustomerAgeProfile;
};

type MutateTrustedContactResult = {
  trustedContact: CustomerTrustedContactProjection;
};

type RemoveTrustedContactResult = {
  removedTrustedContactId: string;
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

type ListCustomerSecurityActivityResult = {
  events: CustomerSecurityActivityProjection[];
  limit: number;
  totalCount: number;
};

type StartSessionTrustChallengeResult = {
  sessionSecurity: CustomerSessionSecurityStatus;
  expiresAt: string;
  deliveryChannel: "email";
  previewCode: string | null;
};

type VerifySessionTrustResult = {
  sessionSecurity: CustomerSessionSecurityStatus;
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
        const response = await axios.get<
          ApiResponse<ListCustomerSessionsResult>
        >(`${webRuntimeConfig.serverUrl}/auth/sessions`, {
          headers: buildWebAuthHeaders(token),
        });

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(response.data.message || "Failed to load sessions.");
        }

        return response.data.data;
      } catch (error) {
        throw new Error(readApiErrorMessage(error, "Failed to load sessions."));
      }
    },
  });
}

export function useListCustomerSecurityActivity() {
  const token = useUserStore((state) => state.token);

  return useQuery({
    queryKey: ["customer-security-activity"],
    enabled: Boolean(token),
    queryFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.get<
          ApiResponse<ListCustomerSecurityActivityResult>
        >(`${webRuntimeConfig.serverUrl}/auth/security-activity`, {
          headers: buildWebAuthHeaders(token),
        });

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to load security activity.",
          );
        }

        return response.data.data;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to load security activity."),
        );
      }
    },
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
        const response = await axios.post<
          ApiResponse<RevokeCustomerSessionResult>
        >(
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

export function useStartCurrentSessionTrustChallenge() {
  const token = useUserStore((state) => state.token);
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);

  return useMutation({
    mutationFn: async () => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.post<
          ApiResponse<StartSessionTrustChallengeResult>
        >(
          `${webRuntimeConfig.serverUrl}/auth/session/trust/start`,
          {},
          {
            headers: buildWebAuthHeaders(token),
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message ||
              "Failed to send session verification code.",
          );
        }

        if (user) {
          setUser({
            ...user,
            sessionSecurity: response.data.data.sessionSecurity,
          });
        }

        return response.data.data;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(
            error,
            "Failed to send session verification code.",
          ),
        );
      }
    },
  });
}

export function useVerifyCurrentSessionTrust() {
  const token = useUserStore((state) => state.token);
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      try {
        const response = await axios.post<
          ApiResponse<VerifySessionTrustResult>
        >(
          `${webRuntimeConfig.serverUrl}/auth/session/trust/verify`,
          { code },
          {
            headers: buildWebAuthHeaders(token),
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to verify current session.",
          );
        }

        if (user) {
          setUser({
            ...user,
            sessionSecurity: response.data.data.sessionSecurity,
          });
        }

        return response.data.data;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to verify current session."),
        );
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["customer-sessions"] });
      await queryClient.invalidateQueries({
        queryKey: ["customer-security-activity"],
      });
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
          `${webRuntimeConfig.serverUrl}/notifications/me/preferences`,
          {
            entries: input.entries,
          },
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

export function useUpdateCustomerAgeProfile() {
  const token = useUserStore((state) => state.token);
  const user = useUserStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { dateOfBirth: string | null }) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      if (!user?.supabaseUserId) {
        throw new Error("User profile is required.");
      }

      try {
        const response = await axios.patch<
          ApiResponse<UpdateCustomerAgeProfileResult>
        >(
          `${webRuntimeConfig.serverUrl}/user/${user.supabaseUserId}/age-profile`,
          input,
          {
            headers: {
              ...buildWebAuthHeaders(token),
            },
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to update age profile.",
          );
        }

        return response.data.data.ageProfile;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to update age profile."),
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

export function useCreateTrustedContact() {
  const token = useUserStore((state) => state.token);
  const user = useUserStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      kind: "trusted_contact" | "beneficiary";
      firstName: string;
      lastName: string;
      relationshipLabel: string;
      email?: string;
      phoneNumber?: string;
      note?: string;
    }) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      if (!user?.supabaseUserId) {
        throw new Error("User profile is required.");
      }

      try {
        const response = await axios.post<
          ApiResponse<MutateTrustedContactResult>
        >(
          `${webRuntimeConfig.serverUrl}/user/${user.supabaseUserId}/trusted-contacts`,
          input,
          {
            headers: {
              ...buildWebAuthHeaders(token),
            },
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to create trusted contact.",
          );
        }

        return response.data.data.trustedContact;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to create trusted contact."),
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

export function useUpdateTrustedContact() {
  const token = useUserStore((state) => state.token);
  const user = useUserStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      contactId: string;
      kind?: "trusted_contact" | "beneficiary";
      firstName?: string;
      lastName?: string;
      relationshipLabel?: string;
      email?: string;
      phoneNumber?: string;
      note?: string;
    }) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      if (!user?.supabaseUserId) {
        throw new Error("User profile is required.");
      }

      try {
        const response = await axios.patch<
          ApiResponse<MutateTrustedContactResult>
        >(
          `${webRuntimeConfig.serverUrl}/user/${user.supabaseUserId}/trusted-contacts/${input.contactId}`,
          {
            kind: input.kind,
            firstName: input.firstName,
            lastName: input.lastName,
            relationshipLabel: input.relationshipLabel,
            email: input.email,
            phoneNumber: input.phoneNumber,
            note: input.note,
          },
          {
            headers: {
              ...buildWebAuthHeaders(token),
            },
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to update trusted contact.",
          );
        }

        return response.data.data.trustedContact;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to update trusted contact."),
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

export function useRemoveTrustedContact() {
  const token = useUserStore((state) => state.token);
  const user = useUserStore((state) => state.user);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      if (!token) {
        throw new Error("Auth token is required.");
      }

      if (!user?.supabaseUserId) {
        throw new Error("User profile is required.");
      }

      try {
        const response = await axios.delete<
          ApiResponse<RemoveTrustedContactResult>
        >(
          `${webRuntimeConfig.serverUrl}/user/${user.supabaseUserId}/trusted-contacts/${contactId}`,
          {
            headers: {
              ...buildWebAuthHeaders(token),
            },
          },
        );

        if (response.data.status !== "success" || !response.data.data) {
          throw new Error(
            response.data.message || "Failed to remove trusted contact.",
          );
        }

        return response.data.data.removedTrustedContactId;
      } catch (error) {
        throw new Error(
          readApiErrorMessage(error, "Failed to remove trusted contact."),
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
