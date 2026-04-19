import axios from "axios";
import { loadMobileRuntimeConfig } from "@stealth-trails-bank/config/mobile";
import { createClientTelemetry } from "@stealth-trails-bank/ui-foundation";

const runtimeConfig = loadMobileRuntimeConfig({
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_TELEMETRY_ENDPOINT: process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT,
  EXPO_PUBLIC_TELEMETRY_ENVIRONMENT:
    process.env.EXPO_PUBLIC_TELEMETRY_ENVIRONMENT,
  EXPO_PUBLIC_TELEMETRY_RELEASE: process.env.EXPO_PUBLIC_TELEMETRY_RELEASE
});

export const mobileTelemetry = createClientTelemetry({
  app: "mobile-app",
  endpoint: runtimeConfig.telemetryEndpoint,
  environment: runtimeConfig.telemetryEnvironment,
  release: runtimeConfig.telemetryRelease
});

function isReportableHttpError(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return true;
  }

  const status = error.response?.status;

  // Browser-level network and CORS failures already surface in devtools and
  // often fail telemetry delivery too, which just adds duplicate noise.
  if (status === undefined) {
    return false;
  }

  return status >= 500;
}

export function reportMobileApiError(
  error: unknown,
  context: Record<string, unknown> = {}
) {
  if (!isReportableHttpError(error)) {
    return;
  }

  const requestError = axios.isAxiosError(error) ? error : null;

  mobileTelemetry.captureException(error, {
    kind: "http_error",
    message: "Mobile API request failed",
    context: {
      ...context,
      method: requestError?.config?.method?.toUpperCase(),
      url: requestError?.config?.url,
      status: requestError?.response?.status
    }
  });
}

export function reportMobileRuntimeError(
  error: unknown,
  context: Record<string, unknown> = {}
) {
  mobileTelemetry.captureException(error, {
    kind: "exception",
    message: "Mobile runtime boundary triggered",
    context
  });
}

export function reportMobileQueryError(
  error: unknown,
  context: Record<string, unknown> = {}
) {
  if (axios.isAxiosError(error)) {
    return;
  }

  mobileTelemetry.captureException(error, {
    kind: "query_error",
    message: "Mobile query failed",
    context
  });
}
