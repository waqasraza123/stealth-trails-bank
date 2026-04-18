import { useState } from "react";
import { apiClient, readApiErrorMessage } from "../lib/api/client";
import type {
  ApiEnvelope,
  LoginResponseData,
  SessionUser,
  SignUpResponseData
} from "../lib/api/types";
import { useSessionStore } from "../stores/session-store";

type SignUpInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

function mapLoginUser(user: LoginResponseData["user"]): SessionUser {
  return {
    id: user.id,
    supabaseUserId: user.supabaseUserId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    ethereumAddress: user.ethereumAddress
  };
}

export function useAuthActions() {
  const signInStore = useSessionStore((state) => state.signIn);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(input: LoginInput) {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<ApiEnvelope<LoginResponseData>>(
        "/auth/login",
        input
      );
      const token = response.data.data?.token;
      const user = response.data.data?.user;

      if (response.data.status !== "success" || !token || !user) {
        throw new Error(response.data.message || "Login failed.");
      }

      await signInStore({
        token,
        user: mapLoginUser(user)
      });

      return response.data.data;
    } catch (requestError) {
      const message = readApiErrorMessage(requestError, "Login failed.");
      setError(message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }

  async function signUp(input: SignUpInput) {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<ApiEnvelope<SignUpResponseData>>(
        "/auth/signup",
        input
      );

      if (response.data.status !== "success" || !response.data.data?.user) {
        throw new Error(response.data.message || "Sign up failed.");
      }

      return response.data.data.user;
    } catch (requestError) {
      const message = readApiErrorMessage(requestError, "Sign up failed.");
      setError(message);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }

  return {
    signIn,
    signUp,
    loading,
    error
  };
}
