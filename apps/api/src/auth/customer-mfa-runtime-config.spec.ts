import { loadCustomerMfaPolicyRuntimeConfig } from "@stealth-trails-bank/config/api";

describe("loadCustomerMfaPolicyRuntimeConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
    };
    delete process.env["CUSTOMER_MFA_EMAIL_OTP_EXPIRY_SECONDS"];
    delete process.env["CUSTOMER_MFA_TOTP_ENROLLMENT_EXPIRY_SECONDS"];
    delete process.env["CUSTOMER_MFA_STEP_UP_FRESHNESS_SECONDS"];
    delete process.env["CUSTOMER_MFA_MAX_FAILED_ATTEMPTS"];
    delete process.env["CUSTOMER_MFA_LOCKOUT_SECONDS"];
    delete process.env["CUSTOMER_MFA_CHALLENGE_START_COOLDOWN_SECONDS"];
    delete process.env["CUSTOMER_MFA_RECOVERY_REQUEST_ALLOWED_OPERATOR_ROLES"];
    delete process.env["CUSTOMER_MFA_RECOVERY_APPROVER_ALLOWED_OPERATOR_ROLES"];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("loads conservative defaults when no values are configured", () => {
    expect(loadCustomerMfaPolicyRuntimeConfig(process.env)).toEqual({
      emailOtpExpirySeconds: 600,
      totpEnrollmentExpirySeconds: 900,
      stepUpFreshnessSeconds: 600,
      maxFailedAttempts: 5,
      lockoutSeconds: 900,
      challengeStartCooldownSeconds: 60,
      recoveryRequestAllowedOperatorRoles: [
        "operations_admin",
        "senior_operator",
        "risk_manager",
      ],
      recoveryApproverAllowedOperatorRoles: ["risk_manager", "compliance_lead"],
    });
  });

  it("parses governed recovery operator role lists", () => {
    process.env["CUSTOMER_MFA_RECOVERY_REQUEST_ALLOWED_OPERATOR_ROLES"] =
      "operations_admin, senior_operator";
    process.env["CUSTOMER_MFA_RECOVERY_APPROVER_ALLOWED_OPERATOR_ROLES"] =
      "risk_manager, compliance_lead";

    expect(loadCustomerMfaPolicyRuntimeConfig(process.env)).toEqual(
      expect.objectContaining({
        recoveryRequestAllowedOperatorRoles: [
          "operations_admin",
          "senior_operator",
        ],
        recoveryApproverAllowedOperatorRoles: [
          "risk_manager",
          "compliance_lead",
        ],
      }),
    );
  });

  it("rejects non-positive runtime values", () => {
    process.env["CUSTOMER_MFA_MAX_FAILED_ATTEMPTS"] = "0";

    expect(() => loadCustomerMfaPolicyRuntimeConfig(process.env)).toThrow(
      "CUSTOMER_MFA_MAX_FAILED_ATTEMPTS must be a positive integer.",
    );
  });
});
