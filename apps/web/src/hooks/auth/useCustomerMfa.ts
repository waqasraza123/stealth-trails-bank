import axios from "axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CustomerMfaStatus } from "@stealth-trails-bank/types";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { ApiResponse, readApiErrorMessage } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

type MfaStatusResponse = {
  mfa: CustomerMfaStatus;
};

type StartTotpEnrollmentResponse = {
  mfa: CustomerMfaStatus;
  secret: string;
  otpAuthUri: string;
};

type StartEmailEnrollmentResponse = {
  mfa: CustomerMfaStatus;
  challengeId: string;
  expiresAt: string;
  deliveryChannel: "email";
  previewCode: string | null;
};

type StartEmailRecoveryResponse = StartEmailEnrollmentResponse;

type StartMfaChallengeResponse = {
  mfa: CustomerMfaStatus;
  challengeId: string;
  method: "totp" | "email_otp";
  purpose: "withdrawal_step_up" | "password_step_up";
  expiresAt: string;
  previewCode: string | null;
};

type VerifyMfaResponse = {
  mfa: CustomerMfaStatus;
  session?: {
    token: string;
    revokedOtherSessions: boolean;
  };
};

function useMfaSessionUpdater() {
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const setToken = useUserStore((state) => state.setToken);

  return async (
    mfa: CustomerMfaStatus,
    session?: { token: string; revokedOtherSessions: boolean },
  ) => {
    if (session?.token) {
      setToken(session.token);
    }

    if (!user) {
      return;
    }

    setUser({
      ...user,
      mfa,
    });
  };
}

function useAuthenticatedRequester() {
  const token = useUserStore((state) => state.token);

  return async function request<T>(
    method: "get" | "post",
    path: string,
    body?: unknown,
  ): Promise<T> {
    if (!token) {
      throw new Error("Auth token is required.");
    }

    try {
      const response =
        method === "get"
          ? await axios.get<ApiResponse<T>>(
              `${webRuntimeConfig.serverUrl}${path}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            )
          : await axios.post<ApiResponse<T>>(
              `${webRuntimeConfig.serverUrl}${path}`,
              body,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            );

      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Request failed.");
      }

      return response.data.data;
    } catch (error) {
      throw new Error(readApiErrorMessage(error, "Request failed."));
    }
  };
}

export function useCustomerMfaStatus() {
  const user = useUserStore((state) => state.user);
  const request = useAuthenticatedRequester();
  const applyMfa = useMfaSessionUpdater();

  return useQuery({
    queryKey: ["customer-mfa-status", user?.supabaseUserId],
    enabled: Boolean(user?.supabaseUserId),
    queryFn: async () => {
      const result = await request<MfaStatusResponse>(
        "get",
        "/auth/mfa/status",
      );
      await applyMfa(result.mfa);
      return result;
    },
  });
}

export function useStartTotpEnrollment() {
  const request = useAuthenticatedRequester();
  const applyMfa = useMfaSessionUpdater();

  return useMutation({
    mutationFn: async () => {
      const result = await request<StartTotpEnrollmentResponse>(
        "post",
        "/auth/mfa/totp/enrollment/start",
      );
      await applyMfa(result.mfa);
      return result;
    },
  });
}

export function useVerifyTotpEnrollment() {
  const request = useAuthenticatedRequester();
  const applyMfa = useMfaSessionUpdater();

  return useMutation({
    mutationFn: async (input: { code: string }) => {
      const result = await request<VerifyMfaResponse>(
        "post",
        "/auth/mfa/totp/enrollment/verify",
        input,
      );
      await applyMfa(result.mfa, result.session);
      return result;
    },
  });
}

export function useStartEmailEnrollment() {
  const request = useAuthenticatedRequester();
  const applyMfa = useMfaSessionUpdater();

  return useMutation({
    mutationFn: async () => {
      const result = await request<StartEmailEnrollmentResponse>(
        "post",
        "/auth/mfa/email/enrollment/start",
      );
      await applyMfa(result.mfa);
      return result;
    },
  });
}

export function useVerifyEmailEnrollment() {
  const request = useAuthenticatedRequester();
  const applyMfa = useMfaSessionUpdater();

  return useMutation({
    mutationFn: async (input: { challengeId: string; code: string }) => {
      const result = await request<VerifyMfaResponse>(
        "post",
        "/auth/mfa/email/enrollment/verify",
        input,
      );
      await applyMfa(result.mfa, result.session);
      return result;
    },
  });
}

export function useStartEmailRecovery() {
  const request = useAuthenticatedRequester();
  const applyMfa = useMfaSessionUpdater();

  return useMutation({
    mutationFn: async () => {
      const result = await request<StartEmailRecoveryResponse>(
        "post",
        "/auth/mfa/recovery/email/start",
      );
      await applyMfa(result.mfa);
      return result;
    },
  });
}

export function useVerifyEmailRecovery() {
  const request = useAuthenticatedRequester();
  const applyMfa = useMfaSessionUpdater();

  return useMutation({
    mutationFn: async (input: { challengeId: string; code: string }) => {
      const result = await request<VerifyMfaResponse>(
        "post",
        "/auth/mfa/recovery/email/verify",
        input,
      );
      await applyMfa(result.mfa, result.session);
      return result;
    },
  });
}

export function useStartCustomerMfaChallenge() {
  const request = useAuthenticatedRequester();
  const applyMfa = useMfaSessionUpdater();

  return useMutation({
    mutationFn: async (input: {
      method: "totp" | "email_otp";
      purpose: "withdrawal_step_up" | "password_step_up";
    }) => {
      const result = await request<StartMfaChallengeResponse>(
        "post",
        "/auth/mfa/challenge/start",
        input,
      );
      await applyMfa(result.mfa);
      return result;
    },
  });
}

export function useVerifyCustomerMfaChallenge() {
  const request = useAuthenticatedRequester();
  const applyMfa = useMfaSessionUpdater();

  return useMutation({
    mutationFn: async (input: {
      challengeId: string;
      method: "totp" | "email_otp";
      purpose: "withdrawal_step_up" | "password_step_up";
      code: string;
    }) => {
      const result = await request<VerifyMfaResponse>(
        "post",
        "/auth/mfa/challenge/verify",
        input,
      );
      await applyMfa(result.mfa, result.session);
      return result;
    },
  });
}
