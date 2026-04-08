import { loadReleaseReadinessApprovalRuntimeConfig } from "@stealth-trails-bank/config/api";

describe("loadReleaseReadinessApprovalRuntimeConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv
    };
    delete process.env["RELEASE_READINESS_APPROVAL_ALLOWED_OPERATOR_ROLES"];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("defaults release readiness approvers to compliance and risk roles", () => {
    const result = loadReleaseReadinessApprovalRuntimeConfig(process.env);

    expect(result.releaseReadinessApprovalAllowedOperatorRoles).toEqual([
      "compliance_lead",
      "risk_manager"
    ]);
  });

  it("accepts explicit approver role overrides", () => {
    process.env["RELEASE_READINESS_APPROVAL_ALLOWED_OPERATOR_ROLES"] =
      "operations_admin, risk_manager";

    const result = loadReleaseReadinessApprovalRuntimeConfig(process.env);

    expect(result.releaseReadinessApprovalAllowedOperatorRoles).toEqual([
      "operations_admin",
      "risk_manager"
    ]);
  });
});
