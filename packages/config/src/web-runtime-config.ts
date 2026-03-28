import {
  readRequiredRuntimeEnv,
  type RuntimeEnvShape
} from "./runtime-env";

export type WebRuntimeConfig = {
  readonly serverUrl: string;
  readonly supabaseUrl: string;
  readonly supabaseAnonKey: string;
};

export function loadWebRuntimeConfig(
  env: RuntimeEnvShape
): WebRuntimeConfig {
  return {
    serverUrl: readRequiredRuntimeEnv(env, "VITE_SERVER_URL"),
    supabaseUrl: readRequiredRuntimeEnv(env, "VITE_SUPABASE_URL"),
    supabaseAnonKey: readRequiredRuntimeEnv(env, "VITE_SUPABASE_ANON_KEY")
  };
}
