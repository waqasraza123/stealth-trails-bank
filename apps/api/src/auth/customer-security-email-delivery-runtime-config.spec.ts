import { loadCustomerSecurityEmailDeliveryRuntimeConfig } from "@stealth-trails-bank/config/api";

describe("loadCustomerSecurityEmailDeliveryRuntimeConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
    };
    delete process.env["CUSTOMER_SECURITY_EMAIL_DELIVERY_MODE"];
    delete process.env["CUSTOMER_SECURITY_EMAIL_DELIVERY_WEBHOOK_URL"];
    delete process.env["CUSTOMER_SECURITY_EMAIL_DELIVERY_BEARER_TOKEN"];
    delete process.env["CUSTOMER_SECURITY_EMAIL_DELIVERY_REQUEST_TIMEOUT_MS"];
    delete process.env["CUSTOMER_SECURITY_EMAIL_DELIVERY_FROM_EMAIL"];
    delete process.env["CUSTOMER_SECURITY_EMAIL_DELIVERY_FROM_NAME"];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("loads preview-mode defaults when no values are configured", () => {
    expect(loadCustomerSecurityEmailDeliveryRuntimeConfig(process.env)).toEqual({
      mode: "preview",
      webhookUrl: null,
      bearerToken: null,
      requestTimeoutMs: 5000,
      fromEmail: "security@stealthtrailsbank.local",
      fromName: "Stealth Trails Bank Security",
    });
  });

  it("requires a webhook url in webhook mode", () => {
    process.env["CUSTOMER_SECURITY_EMAIL_DELIVERY_MODE"] = "webhook";

    expect(() =>
      loadCustomerSecurityEmailDeliveryRuntimeConfig(process.env),
    ).toThrow(
      "CUSTOMER_SECURITY_EMAIL_DELIVERY_WEBHOOK_URL is required when CUSTOMER_SECURITY_EMAIL_DELIVERY_MODE=webhook.",
    );
  });
});
