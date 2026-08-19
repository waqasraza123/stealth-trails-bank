import {
  readOptionalRuntimeEnv,
  readRequiredRuntimeEnv,
  type RuntimeEnvShape,
} from "./runtime-env";

export type WebRuntimeConfig = {
  readonly serverUrl: string;
  readonly telemetryEndpoint: string;
  readonly telemetryEnvironment: string;
  readonly telemetryRelease: string | null;
};

export function loadWebRuntimeConfig(env: RuntimeEnvShape): WebRuntimeConfig {
  const serverUrl = readRequiredRuntimeEnv(env, "VITE_SERVER_URL");
  if (!serverUrl.startsWith("/")) {
    const parsedServerUrl = new URL(serverUrl);
    const localDevelopmentHost = ["localhost", "127.0.0.1"].includes(
      parsedServerUrl.hostname,
    );
    if (parsedServerUrl.protocol !== "https:" && !localDevelopmentHost) {
      throw new Error("VITE_SERVER_URL must use HTTPS outside local development.");
    }
  }

  return {
    serverUrl,
    telemetryEndpoint:
      readOptionalRuntimeEnv(env, "VITE_TELEMETRY_ENDPOINT") ??
      `${serverUrl.replace(/\/+$/, "")}/client-events/events`,
    telemetryEnvironment:
      readOptionalRuntimeEnv(env, "VITE_TELEMETRY_ENVIRONMENT") ??
      "development",
    telemetryRelease:
      readOptionalRuntimeEnv(env, "VITE_TELEMETRY_RELEASE") ?? null,
  };
}
