import { loadApiServerRuntimeConfig } from "@stealth-trails-bank/config/api";

type RuntimeEnvShape = Record<string, string | boolean | undefined>;

type CorsOriginDecisionCallback = (
  error: Error | null,
  allow?: boolean
) => void;

export function createCorsOriginDelegate(allowedOrigins: readonly string[]) {
  const allowedOriginSet = new Set(allowedOrigins);

  return (origin: string | undefined, callback: CorsOriginDecisionCallback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, allowedOriginSet.has(origin));
  };
}

export function loadApiBootstrapRuntime(env?: RuntimeEnvShape) {
  const runtimeConfig = loadApiServerRuntimeConfig(env);

  return {
    port: runtimeConfig.port,
    environment: runtimeConfig.environment,
    corsAllowedOrigins: runtimeConfig.corsAllowedOrigins,
    corsOriginDelegate: createCorsOriginDelegate(
      runtimeConfig.corsAllowedOrigins
    )
  };
}
