import axios, { AxiosHeaders } from "axios";
import { loadMobileRuntimeConfig } from "@stealth-trails-bank/config/mobile";
import { reportMobileApiError } from "../observability";
import { useSessionStore } from "../../stores/session-store";

const runtimeConfig = loadMobileRuntimeConfig({
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL
});

export const apiClient = axios.create({
  baseURL: runtimeConfig.apiBaseUrl,
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const token = useSessionStore.getState().token;

  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-stb-client-platform", "mobile");
    config.headers = headers;
  } else {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("x-stb-client-platform", "mobile");
    config.headers = headers;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    reportMobileApiError(error);

    const original = error.config as (typeof error.config & { _stbRetried?: boolean });
    const session = useSessionStore.getState();
    if (
      status === 401 &&
      !original?._stbRetried &&
      session.refreshToken &&
      !String(original?.url ?? "").includes("/auth/mobile/refresh")
    ) {
      original._stbRetried = true;
      try {
        const refreshed = await axios.post<{
          data?: { token: string; refreshToken: string };
        }>(
          `${runtimeConfig.apiBaseUrl}/auth/mobile/refresh`,
          { refreshToken: session.refreshToken },
          { headers: { "x-stb-client-platform": "mobile" }, timeout: 15_000 },
        );
        const next = refreshed.data.data;
        if (!next) throw new Error("Session refresh failed.");
        await session.setTokens(next.token, next.refreshToken);
        const headers = AxiosHeaders.from(original.headers);
        headers.set("Authorization", `Bearer ${next.token}`);
        original.headers = headers;
        return apiClient.request(original);
      } catch {
        session.dropSession();
      }
    } else if (status === 401 || status === 403) {
      session.dropSession();
    }

    return Promise.reject(error);
  }
);

export function readApiErrorMessage(
  error: unknown,
  fallbackMessage = "Request failed."
): string {
  if (axios.isAxiosError(error)) {
    const responseMessage =
      typeof error.response?.data?.message === "string"
        ? error.response.data.message
        : undefined;

    return responseMessage ?? error.message ?? fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}
