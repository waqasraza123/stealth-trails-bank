import axios from "axios";
import { useState } from "react";
import type {
  CustomerMfaStatus,
  CustomerSessionSecurityStatus,
} from "@stealth-trails-bank/types";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";
import {
  setWebCsrfToken,
  WEB_COOKIE_SESSION_MARKER,
} from "@/lib/auth-session";

const config = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

type ApiResponse<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

type LoginUser = {
  id: number;
  supabaseUserId: string;
  email: string;
  ethereumAddress: string;
  firstName: string;
  lastName: string;
  mfa: CustomerMfaStatus;
  sessionSecurity: CustomerSessionSecurityStatus;
};

export type LoginNextAction =
  | "verify_email"
  | "enroll_totp"
  | "verify_totp"
  | "upgrade_password"
  | "setup_recovery_codes"
  | "complete";

export type LoginFlowResult = {
  flowId: string;
  nextAction: LoginNextAction;
  expiresAt: string;
  previewCode?: string | null;
  secret?: string;
  otpAuthUri?: string;
  recoveryCodes?: string[];
  user?: LoginUser;
  session?: {
    kind: "web";
    csrfToken: string;
  };
};

type SignUpInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

function readErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return typeof error.response?.data?.message === "string"
      ? error.response.data.message
      : error.message;
  }
  return error instanceof Error ? error.message : "Request failed.";
}

export default function useAuth() {
  const setUser = useUserStore((state) => state.setUser);
  const setToken = useUserStore((state) => state.setToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request<T>(path: string, payload: unknown): Promise<T> {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<ApiResponse<T>>(
        `${config.serverUrl}/auth/${path}`,
        payload,
      );
      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Authentication failed.");
      }
      return response.data.data;
    } catch (requestError) {
      const message = readErrorMessage(requestError);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }

  function acceptCompleted(result: LoginFlowResult) {
    if (result.nextAction !== "complete" || !result.user || !result.session) {
      return result;
    }
    setWebCsrfToken(result.session.csrfToken);
    setUser(result.user);
    setToken(WEB_COOKIE_SESSION_MARKER);
    return result;
  }

  return {
    signup: (input: SignUpInput) =>
      request<{ nextAction: "verify_email"; email: string; expiresAt: string }>(
        "signup",
        input,
      ),
    verifyEmail: (email: string, code: string) =>
      request<{ emailVerified: true }>("email-verification/verify", {
        email,
        code,
      }),
    resendEmailVerification: (email: string) =>
      request<{ expiresAt: string | null }>("email-verification/resend", {
        email,
      }),
    login: (input: { email: string; password: string }) =>
      request<LoginFlowResult>("login", input),
    startTotpEnrollment: (flowId: string) =>
      request<LoginFlowResult>("login/totp/enrollment/start", { flowId }),
    verifyTotpEnrollment: async (flowId: string, code: string) =>
      acceptCompleted(
        await request<LoginFlowResult>("login/totp/enrollment/verify", {
          flowId,
          code,
        }),
      ),
    verifyTotp: async (flowId: string, code: string) =>
      acceptCompleted(
        await request<LoginFlowResult>("login/totp/verify", { flowId, code }),
      ),
    verifyRecoveryCode: (flowId: string, code: string) =>
      request<LoginFlowResult>("login/recovery-code/verify", { flowId, code }),
    upgradePassword: async (flowId: string, newPassword: string) =>
      acceptCompleted(
        await request<LoginFlowResult>("login/password/upgrade", {
          flowId,
          newPassword,
        }),
      ),
    setupRecoveryCodes: async (flowId: string) =>
      acceptCompleted(
        await request<LoginFlowResult>("login/recovery-codes/setup", { flowId }),
      ),
    loading,
    error,
  };
}
