import { useState } from "react";
import { apiClient, readApiErrorMessage } from "../lib/api/client";
import type {
  ApiEnvelope,
  LoginResponseData,
  SignUpResponseData,
} from "../lib/api/types";
import { useSessionStore } from "../stores/session-store";

export function useAuthActions() {
  const signInStore = useSessionStore((state) => state.signIn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request<T>(path: string, input: unknown): Promise<T> {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<ApiEnvelope<T>>(`/auth/${path}`, input);
      if (response.data.status !== "success" || !response.data.data) {
        throw new Error(response.data.message || "Authentication failed.");
      }
      return response.data.data;
    } catch (requestError) {
      const message = readApiErrorMessage(requestError, "Authentication failed.");
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }

  async function acceptCompleted(result: LoginResponseData) {
    if (
      result.nextAction === "complete" &&
      result.user &&
      result.session?.kind === "mobile"
    ) {
      await signInStore({
        token: result.session.token,
        refreshToken: result.session.refreshToken,
        user: result.user,
      });
    }
    return result;
  }

  return {
    signIn: (input: { email: string; password: string }) =>
      request<LoginResponseData>("login", input),
    signUp: (input: { firstName: string; lastName: string; email: string; password: string }) =>
      request<SignUpResponseData>("signup", input),
    verifyEmail: (email: string, code: string) =>
      request<{ emailVerified: true }>("email-verification/verify", { email, code }),
    resendEmailVerification: (email: string) =>
      request<{ expiresAt: string | null }>("email-verification/resend", { email }),
    startTotpEnrollment: (flowId: string) =>
      request<LoginResponseData>("login/totp/enrollment/start", { flowId }),
    verifyTotpEnrollment: async (flowId: string, code: string) =>
      acceptCompleted(await request<LoginResponseData>("login/totp/enrollment/verify", { flowId, code })),
    verifyTotp: async (flowId: string, code: string) =>
      acceptCompleted(await request<LoginResponseData>("login/totp/verify", { flowId, code })),
    verifyRecoveryCode: (flowId: string, code: string) =>
      request<LoginResponseData>("login/recovery-code/verify", { flowId, code }),
    upgradePassword: async (flowId: string, newPassword: string) =>
      acceptCompleted(await request<LoginResponseData>("login/password/upgrade", { flowId, newPassword })),
    setupRecoveryCodes: async (flowId: string) =>
      acceptCompleted(await request<LoginResponseData>("login/recovery-codes/setup", { flowId })),
    loading,
    error,
  };
}
