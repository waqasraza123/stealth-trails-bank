import { loadSharedLoginBootstrapRuntimeConfig } from "@stealth-trails-bank/config/api";

describe("loadSharedLoginBootstrapRuntimeConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv
    };
    delete process.env["NODE_ENV"];
    delete process.env["OPERATOR_RUNTIME_ENVIRONMENT"];
    delete process.env["SHARED_LOGIN_ENABLED"];
    delete process.env["SHARED_LOGIN_EMAIL"];
    delete process.env["SHARED_LOGIN_PASSWORD"];
    delete process.env["SHARED_LOGIN_FIRST_NAME"];
    delete process.env["SHARED_LOGIN_LAST_NAME"];
    delete process.env["SHARED_LOGIN_SUPABASE_USER_ID"];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("defaults shared login bootstrap to disabled in production", () => {
    process.env["NODE_ENV"] = "production";

    const result = loadSharedLoginBootstrapRuntimeConfig(process.env);

    expect(result.enabled).toBe(false);
  });

  it("defaults shared login bootstrap to disabled in development", () => {
    process.env["NODE_ENV"] = "development";

    const result = loadSharedLoginBootstrapRuntimeConfig(process.env);

    expect(result.enabled).toBe(false);
  });

  it("requires explicit shared-login credentials when bootstrap is enabled", () => {
    process.env["NODE_ENV"] = "development";
    process.env["OPERATOR_RUNTIME_ENVIRONMENT"] = "development";
    process.env["SHARED_LOGIN_ENABLED"] = "true";

    expect(() =>
      loadSharedLoginBootstrapRuntimeConfig(process.env)
    ).toThrow("Missing required environment variable: SHARED_LOGIN_EMAIL");
  });

  it("rejects production shared-login bootstrap when enabled", () => {
    process.env["NODE_ENV"] = "production";
    process.env["SHARED_LOGIN_ENABLED"] = "true";

    expect(() =>
      loadSharedLoginBootstrapRuntimeConfig(process.env)
    ).toThrow(
      "SHARED_LOGIN_ENABLED=true is allowed only when OPERATOR_RUNTIME_ENVIRONMENT=development and NODE_ENV is not production."
    );
  });

  it("rejects explicit production shared-login bootstrap credentials", () => {
    process.env["NODE_ENV"] = "production";
    process.env["SHARED_LOGIN_ENABLED"] = "true";
    process.env["SHARED_LOGIN_EMAIL"] = "ops@example.com";
    process.env["SHARED_LOGIN_PASSWORD"] = "correct-horse-battery-staple";
    process.env["SHARED_LOGIN_SUPABASE_USER_ID"] = "ops-shared-login";

    expect(() =>
      loadSharedLoginBootstrapRuntimeConfig(process.env)
    ).toThrow(
      "SHARED_LOGIN_ENABLED=true is allowed only when OPERATOR_RUNTIME_ENVIRONMENT=development and NODE_ENV is not production."
    );
  });

  it("rejects shared login bootstrap in staging-like operator environments", () => {
    process.env["OPERATOR_RUNTIME_ENVIRONMENT"] = "staging";
    process.env["SHARED_LOGIN_ENABLED"] = "true";

    expect(() =>
      loadSharedLoginBootstrapRuntimeConfig(process.env)
    ).toThrow(
      "SHARED_LOGIN_ENABLED=true is allowed only when OPERATOR_RUNTIME_ENVIRONMENT=development and NODE_ENV is not production."
    );

    process.env["OPERATOR_RUNTIME_ENVIRONMENT"] = "production_like";

    expect(() =>
      loadSharedLoginBootstrapRuntimeConfig(process.env)
    ).toThrow(
      "SHARED_LOGIN_ENABLED=true is allowed only when OPERATOR_RUNTIME_ENVIRONMENT=development and NODE_ENV is not production."
    );
  });
});
