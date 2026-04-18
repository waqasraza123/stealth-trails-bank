import {
  readRequiredRuntimeEnv,
  type RuntimeEnvShape
} from "./runtime-env";

export type MobileRuntimeConfig = {
  readonly apiBaseUrl: string;
};

export function loadMobileRuntimeConfig(
  env: RuntimeEnvShape
): MobileRuntimeConfig {
  return {
    apiBaseUrl: readRequiredRuntimeEnv(env, "EXPO_PUBLIC_API_BASE_URL")
  };
}
