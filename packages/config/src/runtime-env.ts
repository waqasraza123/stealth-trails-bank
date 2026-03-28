export type RuntimeEnvValue = string | boolean | undefined;

export type RuntimeEnvShape = Record<string, RuntimeEnvValue>;

function normalizeRuntimeEnvValue(value: RuntimeEnvValue): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

export function readRequiredRuntimeEnv(
  env: RuntimeEnvShape,
  name: string
): string {
  const value = normalizeRuntimeEnvValue(env[name]);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function readOptionalRuntimeEnv(
  env: RuntimeEnvShape,
  name: string
): string | undefined {
  return normalizeRuntimeEnvValue(env[name]);
}
