import axios from "axios";
import { useState } from "react";
import type { CustomerMfaStatus } from "@stealth-trails-bank/types";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import { useUserStore } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

type ApiResponse<T> = {
  status: "success" | "failed";
  message: string;
  error?: unknown;
  data?: T;
};

type SignUpCredentials = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

type LoginCredentials = {
  email: string;
  password: string;
};

type SignUpResponseUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  ethereumAddress: string;
};

type SignUpResponseData = {
  user: SignUpResponseUser;
};

type LoginResponseUser = {
  id: number;
  supabaseUserId: string;
  email: string;
  ethereumAddress: string;
  firstName: string;
  lastName: string;
  mfa: CustomerMfaStatus;
};

type LoginResponseData = {
  token?: string;
  user: LoginResponseUser;
};

function readErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const responseMessage =
      typeof error.response?.data?.message === "string"
        ? error.response.data.message
        : undefined;

    return responseMessage ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed.";
}

function normalizeSignUpInput(
  firstArg: SignUpCredentials | string,
  lastName?: string,
  email?: string,
  password?: string,
): SignUpCredentials {
  if (typeof firstArg !== "string") {
    return firstArg;
  }

  if (!lastName || !email || !password) {
    throw new Error(
      "Sign up requires first name, last name, email, and password.",
    );
  }

  return {
    firstName: firstArg,
    lastName,
    email,
    password,
  };
}

function normalizeLoginInput(
  firstArg: LoginCredentials | string,
  password?: string,
): LoginCredentials {
  if (typeof firstArg !== "string") {
    return firstArg;
  }

  if (!password) {
    throw new Error("Login requires email and password.");
  }

  return {
    email: firstArg,
    password,
  };
}

function mapLoginUser(user: LoginResponseUser) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    supabaseUserId: user.supabaseUserId,
    ethereumAddress: user.ethereumAddress,
    mfa: user.mfa,
  };
}

export default function useAuth() {
  const setUser = useUserStore((state) => state.setUser);
  const setToken = useUserStore((state) => state.setToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signup(
    firstArg: SignUpCredentials | string,
    lastName?: string,
    email?: string,
    password?: string,
  ) {
    const payload = normalizeSignUpInput(firstArg, lastName, email, password);

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<ApiResponse<SignUpResponseData>>(
        `${webRuntimeConfig.serverUrl}/auth/signup`,
        payload,
      );

      const user = response.data.data?.user;

      if (response.data.status !== "success" || !user) {
        throw new Error(response.data.message || "Sign up failed.");
      }

      return user;
    } catch (requestError) {
      const message = readErrorMessage(requestError);
      setError(message);
      throw requestError instanceof Error ? requestError : new Error(message);
    } finally {
      setLoading(false);
    }
  }

  async function login(firstArg: LoginCredentials | string, password?: string) {
    const payload = normalizeLoginInput(firstArg, password);

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post<ApiResponse<LoginResponseData>>(
        `${webRuntimeConfig.serverUrl}/auth/login`,
        payload,
        {
          headers: {
            "x-stb-client-platform": "web",
          },
        },
      );

      const token = response.data.data?.token;
      const user = response.data.data?.user;

      if (response.data.status !== "success" || !token || !user) {
        throw new Error(response.data.message || "Login failed.");
      }

      setToken(token);
      setUser(mapLoginUser(user));

      return {
        token,
        user,
      };
    } catch (requestError) {
      const message = readErrorMessage(requestError);
      setError(message);
      throw requestError instanceof Error ? requestError : new Error(message);
    } finally {
      setLoading(false);
    }
  }

  return {
    signup,
    login,
    loading,
    error,
  };
}
