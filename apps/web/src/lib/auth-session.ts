import axios, { AxiosHeaders } from "axios";
import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import type { User } from "@/stores/userStore";

const webRuntimeConfig = loadWebRuntimeConfig(
  import.meta.env as Record<string, string | boolean | undefined>,
);

export const WEB_COOKIE_SESSION_MARKER = "web-cookie-session";
let csrfToken: string | null = null;

export function setWebCsrfToken(value: string | null) {
  csrfToken = value;
}

axios.defaults.withCredentials = true;
axios.interceptors.request.use((config) => {
  if (
    typeof window !== "undefined" &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    /^https?:\/\//u.test(webRuntimeConfig.serverUrl) &&
    typeof config.url === "string" &&
    /^https?:\/\//u.test(config.url)
  ) {
    const requestUrl = new URL(config.url);
    const configuredOrigin = new URL(webRuntimeConfig.serverUrl).origin;
    if (requestUrl.origin === configuredOrigin) {
      config.url = `/api${requestUrl.pathname}${requestUrl.search}`;
      config.baseURL = undefined;
    }
  }
  const headers = AxiosHeaders.from(config.headers);
  if (headers.get("Authorization") === `Bearer ${WEB_COOKIE_SESSION_MARKER}`) {
    headers.delete("Authorization");
  }
  if (csrfToken && !["get", "head", "options"].includes(config.method ?? "get")) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  headers.set("X-Stb-Client-Platform", "web");
  config.headers = headers;
  config.withCredentials = true;
  return config;
});

type SessionEnvelope = {
  status: "success" | "failed";
  data?: { user: User; csrfToken: string };
};

export async function restoreWebSession(): Promise<User | null> {
  try {
    const response = await axios.get<SessionEnvelope>(
      `${webRuntimeConfig.serverUrl}/auth/session`,
    );
    if (!response.data.data?.user || !response.data.data.csrfToken) return null;
    setWebCsrfToken(response.data.data.csrfToken);
    return response.data.data.user;
  } catch {
    setWebCsrfToken(null);
    return null;
  }
}

export async function logoutWebSession(): Promise<void> {
  try {
    await axios.post(`${webRuntimeConfig.serverUrl}/auth/logout`, {});
  } finally {
    setWebCsrfToken(null);
  }
}
