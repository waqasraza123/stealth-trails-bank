import { loadReleaseReadinessApprovalRuntimeConfig } from "@stealth-trails-bank/config/api";

describe("loadReleaseReadinessApprovalRuntimeConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv
    };
    delete process.env["RELEASE_READINESS_APPROVAL_REQUEST_ALLOWED_OPERATOR_ROLES"];
    delete process.env["RELEASE_READINESS_APPROVER_ALLOWED_OPERATOR_ROLES"];
    delete process.env["RELEASE_READINESS_APPROVAL_ALLOWED_OPERATOR_ROLES"];
    delete process.env["RELEASE_READINESS_APPROVAL_MAX_EVIDENCE_AGE_HOURS"];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("defaults release readiness requester, approver, and freshness policy", () => {
    const result = loadReleaseReadinessApprovalRuntimeConfig(process.env);

    expect(result.releaseReadinessApprovalRequestAllowedOperatorRoles).toEqual([
      "operations_admin",
      "compliance_lead",
      "risk_manager"
    ]);
    expect(result.releaseReadinessApprovalApproverAllowedOperatorRoles).toEqual([
      "compliance_lead",
      "risk_manager"
    ]);
    expect(result.releaseReadinessApprovalMaxEvidenceAgeHours).toBe(72);
  });

  it("accepts explicit requester, approver, and evidence freshness overrides", () => {
    process.env["RELEASE_READINESS_APPROVAL_REQUEST_ALLOWED_OPERATOR_ROLES"] =
      "operations_admin, release_manager";
    process.env["RELEASE_READINESS_APPROVER_ALLOWED_OPERATOR_ROLES"] =
      "operations_admin, risk_manager";
    process.env["RELEASE_READINESS_APPROVAL_MAX_EVIDENCE_AGE_HOURS"] = "24";

    const result = loadReleaseReadinessApprovalRuntimeConfig(process.env);

    expect(result.releaseReadinessApprovalRequestAllowedOperatorRoles).toEqual([
      "operations_admin",
      "release_manager"
    ]);
    expect(result.releaseReadinessApprovalApproverAllowedOperatorRoles).toEqual([
      "operations_admin",
      "risk_manager"
    ]);
    expect(result.releaseReadinessApprovalMaxEvidenceAgeHours).toBe(24);
  });

  it("keeps the legacy approval env var as an approver fallback", () => {
    process.env["RELEASE_READINESS_APPROVAL_ALLOWED_OPERATOR_ROLES"] =
      "operations_admin, risk_manager";

    const result = loadReleaseReadinessApprovalRuntimeConfig(process.env);

    expect(result.releaseReadinessApprovalApproverAllowedOperatorRoles).toEqual([
      "operations_admin",
      "risk_manager"
    ]);
  });
});
