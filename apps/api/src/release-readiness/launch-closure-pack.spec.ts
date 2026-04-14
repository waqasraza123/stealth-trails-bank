import {
  mkdtempSync,
  readFileSync,
  rmSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  previewLaunchClosurePack,
  renderLaunchClosureValidationSummary,
  scaffoldLaunchClosurePack,
  validateLaunchClosureManifest,
  type LaunchClosureManifest
} from "./launch-closure-pack";

function buildManifest(): LaunchClosureManifest {
  return {
    releaseIdentifier: "launch-2026.04.10.1",
    environment: "production_like",
    baseUrls: {
      web: "https://prodlike-web.example.com",
      admin: "https://prodlike-admin.example.com",
      api: "https://prodlike-api.example.com",
      restoreApi: "https://restore-api.example.com"
    },
    worker: {
      identifier: "worker-prodlike-1"
    },
    operator: {
      requesterId: "ops_requester_1",
      requesterRole: "operations_admin",
      approverId: "ops_approver_1",
      approverRole: "compliance_lead",
      apiKeyEnvironmentVariable: "INTERNAL_OPERATOR_API_KEY"
    },
    artifacts: {
      apiReleaseId: "api-2026.04.10.1",
      workerReleaseId: "worker-2026.04.10.1",
      approvalRollbackReleaseId: "launch-rollback-2026.04.09.4",
      apiRollbackReleaseId: "api-2026.04.09.4",
      workerRollbackReleaseId: "worker-2026.04.09.4",
      backupReference: "snapshot-2026-04-10T08:00Z"
    },
    alerting: {
      expectedTargetName: "ops-critical",
      expectedTargetHealthStatus: "critical",
      expectedMinReEscalations: 1,
      expectedAlertDedupeKey: "worker:degraded:worker-prodlike-1"
    },
    governance: {
      secretReviewReference: "ticket/SEC-42",
      roleReviewReference: "ticket/GOV-12",
      roleReviewRosterReference: "ticket/GOV-12#launch-roster"
    },
    notes: {
      launchSummary: "Production-like launch candidate ready for final governed review.",
      requestNote: "All accepted evidence must be current before approval.",
      residualRiskNote: "No accepted residual risks remain open at request time."
    }
  };
}

describe("launch-closure-pack", () => {
  it("validates dual-control and alert identifiers", () => {
    const manifest = buildManifest();
    manifest.operator.approverId = manifest.operator.requesterId;
    delete manifest.alerting.expectedAlertDedupeKey;

    const result = validateLaunchClosureManifest(manifest);

    expect(result.errors).toContain(
      "operator.requesterId and operator.approverId must be different for dual-control approval."
    );
    expect(result.errors).toContain(
      "Provide either alerting.expectedAlertId or alerting.expectedAlertDedupeKey for critical re-escalation proof."
    );
  });

  it("scaffolds a launch-closure pack with execution and approval artifacts", () => {
    const manifest = buildManifest();
    const repoRoot = mkdtempSync(path.join(os.tmpdir(), "launch-closure-repo-"));
    const outputDir = path.join(repoRoot, "pack");

    try {
      const result = scaffoldLaunchClosurePack({
        manifest,
        repoRoot,
        outputDir
      });

      expect(result.files).toContain(path.join(outputDir, "execution-plan.md"));
      expect(result.files).toContain(
        path.join(outputDir, "approval-request.template.json")
      );

      const executionPlan = readFileSync(
        path.join(outputDir, "execution-plan.md"),
        "utf8"
      );
      const approvalRequest = readFileSync(
        path.join(outputDir, "approval-request.template.json"),
        "utf8"
      );
      const validationSummary = renderLaunchClosureValidationSummary(manifest);

      expect(executionPlan).toContain("pnpm release:readiness:probe --");
      expect(executionPlan).toContain("--probe worker_rollback_drill");
      expect(executionPlan).toContain("--release-id launch-2026.04.10.1");
      expect(executionPlan).toContain("pnpm release:readiness:verify --");
      expect(executionPlan).toContain("curl -sS -X POST");
      expect(approvalRequest).toContain('"releaseIdentifier": "launch-2026.04.10.1"');
      expect(approvalRequest).toContain('"securityConfigurationComplete": false');
      expect(validationSummary).toContain(
        "database_restore_drill: accepted only in staging, production_like, production"
      );
    } finally {
      rmSync(repoRoot, {
        force: true,
        recursive: true
      });
    }
  });

  it("previews launch-closure artifacts without writing files", () => {
    const manifest = buildManifest();

    const result = previewLaunchClosurePack(manifest);

    expect(result.outputSubpath).toBe(
      path.join("artifacts", "release-launch", "launch-2026.04.10.1-production_like")
    );
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "README.md"
        }),
        expect.objectContaining({
          relativePath: "manifest.json",
          content: expect.stringContaining('"releaseIdentifier": "launch-2026.04.10.1"')
        }),
        expect.objectContaining({
          relativePath: "execution-plan.md",
          content: expect.stringContaining("pnpm release:readiness:probe --")
        }),
        expect.objectContaining({
          relativePath: path.join("evidence", "08-final-governed-launch-approval.md"),
          content: expect.stringContaining("dual-control launch approval")
        })
      ])
    );
  });
});
