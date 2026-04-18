import axios, { AxiosHeaders } from "axios";
import { loadMobileRuntimeConfig } from "@stealth-trails-bank/config/mobile";
import { useSessionStore } from "../../stores/session-store";

const runtimeConfig = loadMobileRuntimeConfig(
  process.env as Record<string, string | undefined>
);

export const apiClient = axios.create({
  baseURL: runtimeConfig.apiBaseUrl
});

apiClient.interceptors.request.use((config) => {
  const token = useSessionStore.getState().token;

  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401 || status === 403) {
      useSessionStore.getState().dropSession();
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
