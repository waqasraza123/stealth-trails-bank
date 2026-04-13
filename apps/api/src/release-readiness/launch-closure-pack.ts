import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  externalOnlyReleaseReadinessChecks,
  releaseReadinessChecklistSections
} from "./release-readiness-checks";

export type LaunchClosureEnvironment =
  | "staging"
  | "production_like"
  | "production";

export type LaunchClosureManifest = {
  releaseIdentifier: string;
  environment: LaunchClosureEnvironment;
  baseUrls: {
    web: string;
    admin: string;
    api: string;
    restoreApi: string;
  };
  worker: {
    identifier: string;
  };
  operator: {
    requesterId: string;
    requesterRole: string;
    approverId: string;
    approverRole: string;
    apiKeyEnvironmentVariable: string;
  };
  artifacts: {
    apiReleaseId: string;
    workerReleaseId: string;
    approvalRollbackReleaseId: string;
    apiRollbackReleaseId: string;
    workerRollbackReleaseId: string;
    backupReference: string;
  };
  alerting: {
    expectedTargetName: string;
    expectedTargetHealthStatus: "warning" | "critical";
    expectedMinReEscalations: number;
    expectedAlertId?: string;
    expectedAlertDedupeKey?: string;
  };
  governance: {
    secretReviewReference: string;
    roleReviewReference: string;
    roleReviewRosterReference: string;
  };
  notes: {
    launchSummary: string;
    requestNote?: string;
    residualRiskNote?: string;
  };
};

export type LaunchClosureValidationResult = {
  errors: string[];
  warnings: string[];
};

export type LaunchClosurePackResult = {
  outputDir: string;
  files: string[];
};

export type LaunchClosurePackFile = {
  relativePath: string;
  content: string;
};

export type LaunchClosurePackPreview = {
  outputSubpath: string;
  files: LaunchClosurePackFile[];
};

type LaunchClosureArtifact = {
  filename: string;
  title: string;
  objective: string;
  runbookPath: string;
  requiredInputs: string[];
  steps: string[];
  expectedOutcome: string[];
  exactCommand?: string;
};

const knownOperatorRoles = [
  "operations_admin",
  "risk_manager",
  "senior_operator",
  "compliance_lead"
] as const;

const localSatisfiedChecks = [
  "contract_invariant_suite",
  "backend_integration_suite",
  "end_to_end_finance_flows"
] as const;

const localDryRunOnlyChecks = [
  "database_restore_drill",
  "api_rollback_drill",
  "worker_rollback_drill"
] as const;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readString(
  value: unknown,
  key: string,
  errors: string[],
  options: {
    allowEmpty?: boolean;
  } = {}
): string {
  const normalizedValue = normalizeString(value);

  if (!options.allowEmpty && normalizedValue.length === 0) {
    errors.push(`Missing required manifest field: ${key}.`);
  }

  return normalizedValue;
}

function readPositiveInteger(
  value: unknown,
  key: string,
  errors: string[]
): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    errors.push(`Manifest field ${key} must be a positive integer.`);
    return 0;
  }

  return Number(value);
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function buildOutputSubpath(manifest: LaunchClosureManifest): string {
  return path.join(
    "artifacts",
    "release-launch",
    `${sanitizePathSegment(manifest.releaseIdentifier)}-${manifest.environment}`
  );
}

function defaultOutputDir(manifest: LaunchClosureManifest, repoRoot: string): string {
  return path.join(repoRoot, buildOutputSubpath(manifest));
}

function jsonStringify(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

function buildProbeCommand(args: string[]): string {
  return [
    "pnpm release:readiness:probe -- \\",
    ...args.map((arg, index) =>
      index === args.length - 1 ? `  ${arg}` : `  ${arg} \\`
    )
  ].join("\n");
}

function buildVerifyCommand(args: string[]): string {
  return [
    "pnpm release:readiness:verify -- \\",
    ...args.map((arg, index) =>
      index === args.length - 1 ? `  ${arg}` : `  ${arg} \\`
    )
  ].join("\n");
}

function buildApprovalRequestBody(
  manifest: LaunchClosureManifest
): Record<string, unknown> {
  return {
    releaseIdentifier: manifest.releaseIdentifier,
    environment: manifest.environment,
    rollbackReleaseIdentifier: manifest.artifacts.approvalRollbackReleaseId,
    summary: manifest.notes.launchSummary,
    requestNote: manifest.notes.requestNote ?? "",
    securityConfigurationComplete: false,
    accessAndGovernanceComplete: false,
    dataAndRecoveryComplete: false,
    platformHealthComplete: false,
    functionalProofComplete: false,
    contractAndChainProofComplete: false,
    finalSignoffComplete: false,
    unresolvedRisksAccepted: false,
    openBlockers: [],
    residualRiskNote: manifest.notes.residualRiskNote ?? ""
  };
}

function buildApprovalCurlCommand(manifest: LaunchClosureManifest): string {
  return [
    "curl -sS -X POST \\",
    `  '${manifest.baseUrls.api}/release-readiness/internal/approvals' \\`,
    `  -H 'x-operator-api-key: $${manifest.operator.apiKeyEnvironmentVariable}' \\`,
    `  -H 'x-operator-id: ${manifest.operator.requesterId}' \\`,
    `  -H 'x-operator-role: ${manifest.operator.requesterRole}' \\`,
    "  -H 'content-type: application/json' \\",
    "  --data @approval-request.template.json"
  ].join("\n");
}

function buildApprovalBodyTemplate(
  manifest: LaunchClosureManifest
): string {
  return jsonStringify(buildApprovalRequestBody(manifest));
}

function buildLaunchClosureArtifacts(
  manifest: LaunchClosureManifest
): LaunchClosureArtifact[] {
  return [
    {
      filename: "01-platform-alert-delivery-slo.md",
      title: "Platform Alert Delivery SLO",
      objective:
        "Prove sustained delivery-target degradation is visible through the operator API and leaves durable operations alert evidence in an accepted environment.",
      runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
      requiredInputs: [
        `API base URL: ${manifest.baseUrls.api}`,
        `Expected target name: ${manifest.alerting.expectedTargetName}`,
        `Expected target health status: ${manifest.alerting.expectedTargetHealthStatus}`,
        `Release identifier recorded with evidence: ${manifest.artifacts.apiReleaseId}`,
        `Requester operator: ${manifest.operator.requesterId} (${manifest.operator.requesterRole})`,
        `Operator API key environment variable: ${manifest.operator.apiKeyEnvironmentVariable}`
      ],
      steps: [
        "Generate sustained degraded or critical delivery-target behavior against the configured staging or production-like alert target.",
        "Confirm the target appears through the delivery-target health operator API with the expected degraded status.",
        "Confirm an open operations alert exists for the same degraded posture.",
        "Run the repo-owned probe command below with --record-evidence."
      ],
      expectedOutcome: [
        "The probe returns passed status.",
        "Release-readiness evidence is recorded with evidenceType platform_alert_delivery_slo.",
        "The accepted environment remains staging, production_like, or production."
      ],
      exactCommand: buildProbeCommand([
        "--probe platform_alert_delivery_slo",
        `--base-url ${manifest.baseUrls.api}`,
        `--operator-id ${manifest.operator.requesterId}`,
        `--api-key \"$${manifest.operator.apiKeyEnvironmentVariable}\"`,
        `--operator-role ${manifest.operator.requesterRole}`,
        `--expected-target-name ${manifest.alerting.expectedTargetName}`,
        `--expected-target-health-status ${manifest.alerting.expectedTargetHealthStatus}`,
        `--environment ${manifest.environment}`,
        `--release-id ${manifest.artifacts.apiReleaseId}`,
        "--record-evidence"
      ])
    },
    {
      filename: "02-critical-alert-reescalation.md",
      title: "Critical Alert Re-escalation",
      objective:
        "Prove an overdue critical alert is re-escalated on the expected cadence and leaves durable evidence in an accepted environment.",
      runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
      requiredInputs: [
        `API base URL: ${manifest.baseUrls.api}`,
        `Expected minimum re-escalations: ${manifest.alerting.expectedMinReEscalations}`,
        manifest.alerting.expectedAlertId
          ? `Expected alert id: ${manifest.alerting.expectedAlertId}`
          : `Expected alert dedupe key: ${manifest.alerting.expectedAlertDedupeKey ?? ""}`,
        `Release identifier recorded with evidence: ${manifest.artifacts.apiReleaseId}`,
        `Requester operator: ${manifest.operator.requesterId} (${manifest.operator.requesterRole})`
      ],
      steps: [
        "Select or create an overdue critical alert in the accepted environment that remains unacknowledged or unowned long enough to trigger timed re-escalation.",
        "Confirm the worker-driven re-escalation sweep has executed.",
        "Run the repo-owned probe command below with the alert id or dedupe key and --record-evidence."
      ],
      expectedOutcome: [
        "The probe returns passed status.",
        "The matching alert shows at least the expected minimum re-escalation count.",
        "Release-readiness evidence is recorded with evidenceType critical_alert_reescalation."
      ],
      exactCommand: buildProbeCommand([
        "--probe critical_alert_reescalation",
        `--base-url ${manifest.baseUrls.api}`,
        `--operator-id ${manifest.operator.requesterId}`,
        `--api-key \"$${manifest.operator.apiKeyEnvironmentVariable}\"`,
        `--operator-role ${manifest.operator.requesterRole}`,
        manifest.alerting.expectedAlertId
          ? `--expected-alert-id ${manifest.alerting.expectedAlertId}`
          : `--expected-dedupe-key ${manifest.alerting.expectedAlertDedupeKey ?? ""}`,
        `--expected-min-re-escalations ${manifest.alerting.expectedMinReEscalations}`,
        `--environment ${manifest.environment}`,
        `--release-id ${manifest.artifacts.apiReleaseId}`,
        "--record-evidence"
      ])
    },
    {
      filename: "03-database-restore-drill.md",
      title: "Database Restore Drill",
      objective:
        "Prove a recent production-like backup restores cleanly and the restored API surface remains readable without schema drift.",
      runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
      requiredInputs: [
        `Restore validation API base URL: ${manifest.baseUrls.restoreApi}`,
        `Backup reference: ${manifest.artifacts.backupReference}`,
        `Release identifier recorded with evidence: ${manifest.artifacts.apiReleaseId}`,
        `Requester operator: ${manifest.operator.requesterId} (${manifest.operator.requesterRole})`
      ],
      steps: [
        "Provision a clean restore environment and restore the named backup into it.",
        "Boot the API against that restored environment and confirm it is reachable at the restore validation API base URL.",
        "Run the repo-owned restore probe below with --record-evidence."
      ],
      expectedOutcome: [
        "The probe returns passed status.",
        "Operator reads for operations status, reconciliation runs, review cases, and audit events succeed after restore.",
        "Release-readiness evidence is recorded with evidenceType database_restore_drill."
      ],
      exactCommand: buildProbeCommand([
        "--probe database_restore_drill",
        `--base-url ${manifest.baseUrls.restoreApi}`,
        `--operator-id ${manifest.operator.requesterId}`,
        `--api-key \"$${manifest.operator.apiKeyEnvironmentVariable}\"`,
        `--operator-role ${manifest.operator.requesterRole}`,
        `--environment ${manifest.environment}`,
        `--release-id ${manifest.artifacts.apiReleaseId}`,
        `--backup-ref ${manifest.artifacts.backupReference}`,
        "--record-evidence"
      ])
    },
    {
      filename: "04-api-rollback-drill.md",
      title: "API Rollback Drill",
      objective:
        "Prove the prior known-good API artifact can be restored against the current schema without hidden runtime migration assumptions.",
      runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
      requiredInputs: [
        `Primary API base URL: ${manifest.baseUrls.api}`,
        `Current API release id: ${manifest.artifacts.apiReleaseId}`,
        `Rollback API release id: ${manifest.artifacts.apiRollbackReleaseId}`,
        `Requester operator: ${manifest.operator.requesterId} (${manifest.operator.requesterRole})`
      ],
      steps: [
        "Capture the currently deployed API release id and confirm the rollback artifact reference is the intended prior known-good build.",
        "Deploy the rollback API artifact against the current database schema in the accepted environment.",
        "Run the repo-owned rollback probe below with --record-evidence."
      ],
      expectedOutcome: [
        "The probe returns passed status.",
        "Operator monitoring, reconciliation, review-case, and audit surfaces remain readable after rollback.",
        "Release-readiness evidence is recorded with evidenceType api_rollback_drill."
      ],
      exactCommand: buildProbeCommand([
        "--probe api_rollback_drill",
        `--base-url ${manifest.baseUrls.api}`,
        `--operator-id ${manifest.operator.requesterId}`,
        `--api-key \"$${manifest.operator.apiKeyEnvironmentVariable}\"`,
        `--operator-role ${manifest.operator.requesterRole}`,
        `--environment ${manifest.environment}`,
        `--release-id ${manifest.artifacts.apiReleaseId}`,
        `--rollback-release-id ${manifest.artifacts.apiRollbackReleaseId}`,
        "--record-evidence"
      ])
    },
    {
      filename: "05-worker-rollback-drill.md",
      title: "Worker Rollback Drill",
      objective:
        "Prove the prior worker artifact resumes heartbeat and safe queue processing without duplicate execution.",
      runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
      requiredInputs: [
        `Primary API base URL: ${manifest.baseUrls.api}`,
        `Worker identifier: ${manifest.worker.identifier}`,
        `Current worker release id: ${manifest.artifacts.workerReleaseId}`,
        `Rollback worker release id: ${manifest.artifacts.workerRollbackReleaseId}`,
        `Requester operator: ${manifest.operator.requesterId} (${manifest.operator.requesterRole})`
      ],
      steps: [
        "Stop the current worker and deploy the prior worker artifact in the accepted environment.",
        "Confirm the reverted worker is using the expected worker identifier and the intended execution mode.",
        "Run the repo-owned rollback probe below with --record-evidence."
      ],
      expectedOutcome: [
        "The probe returns passed status.",
        "The worker health surface shows the named worker as healthy with a fresh heartbeat.",
        "Release-readiness evidence is recorded with evidenceType worker_rollback_drill."
      ],
      exactCommand: buildProbeCommand([
        "--probe worker_rollback_drill",
        `--base-url ${manifest.baseUrls.api}`,
        `--operator-id ${manifest.operator.requesterId}`,
        `--api-key \"$${manifest.operator.apiKeyEnvironmentVariable}\"`,
        `--operator-role ${manifest.operator.requesterRole}`,
        `--expected-worker-id ${manifest.worker.identifier}`,
        "--expected-min-healthy-workers 1",
        `--environment ${manifest.environment}`,
        `--release-id ${manifest.artifacts.workerReleaseId}`,
        `--rollback-release-id ${manifest.artifacts.workerRollbackReleaseId}`,
        "--record-evidence"
      ])
    },
    {
      filename: "06-secret-handling-review.md",
      title: "Secret Handling Review",
      objective:
        "Record the reviewed launch secret posture, rotation evidence, and any residual exceptions in an accepted environment.",
      runbookPath: "docs/security/secret-handling-review.md",
      requiredInputs: [
        `Primary API base URL: ${manifest.baseUrls.api}`,
        `Launch release identifier: ${manifest.releaseIdentifier}`,
        `Secret review reference: ${manifest.governance.secretReviewReference}`,
        `Requester operator: ${manifest.operator.requesterId} (${manifest.operator.requesterRole})`
      ],
      steps: [
        "Complete the human secret-handling review against the actual launch environment using the secret review runbook.",
        "Collect links or ticket references showing rotation, secret-manager posture, and any approved exceptions.",
        "Record the review through the repo-owned verifier below with --record-evidence."
      ],
      expectedOutcome: [
        "A passed manual evidence record exists for secret_handling_review.",
        "Evidence links point to the actual launch secret review artifacts.",
        "The release-readiness summary reflects the latest accepted secret review evidence."
      ],
      exactCommand: buildVerifyCommand([
        "--proof secret_handling_review",
        `--environment ${manifest.environment}`,
        `--summary \"Launch secret handling reviewed for ${manifest.releaseIdentifier}.\"`,
        `--note \"Reference: ${manifest.governance.secretReviewReference}\"`,
        `--evidence-links ${manifest.governance.secretReviewReference}`,
        "--record-evidence",
        `--base-url ${manifest.baseUrls.api}`,
        `--operator-id ${manifest.operator.requesterId}`,
        `--operator-role ${manifest.operator.requesterRole}`,
        `--api-key \"$${manifest.operator.apiKeyEnvironmentVariable}\"`
      ])
    },
    {
      filename: "07-role-review.md",
      title: "Role Review",
      objective:
        "Record the approved launch operator roster, mapped roles, and any scoped governance exceptions in an accepted environment.",
      runbookPath: "docs/security/role-review.md",
      requiredInputs: [
        `Primary API base URL: ${manifest.baseUrls.api}`,
        `Launch release identifier: ${manifest.releaseIdentifier}`,
        `Role review reference: ${manifest.governance.roleReviewReference}`,
        `Roster reference: ${manifest.governance.roleReviewRosterReference}`,
        `Requester operator: ${manifest.operator.requesterId} (${manifest.operator.requesterRole})`
      ],
      steps: [
        "Complete the human operator roster and role review against the actual launch roster.",
        "Collect links or ticket references showing the approved roster and scoped exceptions.",
        "Record the review through the repo-owned verifier below with --record-evidence."
      ],
      expectedOutcome: [
        "A passed manual evidence record exists for role_review.",
        "Evidence links point to the actual launch role review artifacts.",
        "The release-readiness summary reflects the latest accepted role review evidence."
      ],
      exactCommand: buildVerifyCommand([
        "--proof role_review",
        `--environment ${manifest.environment}`,
        `--summary \"Launch role review completed for ${manifest.releaseIdentifier}.\"`,
        `--note \"References: ${manifest.governance.roleReviewReference}; roster ${manifest.governance.roleReviewRosterReference}\"`,
        `--evidence-links ${manifest.governance.roleReviewReference},${manifest.governance.roleReviewRosterReference}`,
        "--record-evidence",
        `--base-url ${manifest.baseUrls.api}`,
        `--operator-id ${manifest.operator.requesterId}`,
        `--operator-role ${manifest.operator.requesterRole}`,
        `--api-key \"$${manifest.operator.apiKeyEnvironmentVariable}\"`
      ])
    },
    {
      filename: "08-final-governed-launch-approval.md",
      title: "Final Governed Launch Approval",
      objective:
        "Request and complete the dual-control launch approval only after all required evidence and checklist attestations are satisfied.",
      runbookPath: "docs/runbooks/release-launch-approval.md",
      requiredInputs: [
        `Primary API base URL: ${manifest.baseUrls.api}`,
        `Launch release identifier: ${manifest.releaseIdentifier}`,
        `Approval rollback release id: ${manifest.artifacts.approvalRollbackReleaseId}`,
        `Requester operator: ${manifest.operator.requesterId} (${manifest.operator.requesterRole})`,
        `Approver operator: ${manifest.operator.approverId} (${manifest.operator.approverRole})`
      ],
      steps: [
        "Update approval-request.template.json so every checklist field reflects the actual launch state and open blockers are truthful.",
        "Submit the approval request with the curl command below.",
        "Have the separate approver review the generated approval record and complete approve or reject through the governed API."
      ],
      expectedOutcome: [
        "The approval request is created only after the evidence snapshot is acceptable.",
        "The requester and approver identities remain different.",
        "Launch approval succeeds only when every required proof is passed, fresh, and checklist-complete."
      ],
      exactCommand: buildApprovalCurlCommand(manifest)
    }
  ];
}

function renderPackReadme(manifest: LaunchClosureManifest): string {
  return `# Phase 12 Launch-Closure Pack

## Release

- Release identifier: \`${manifest.releaseIdentifier}\`
- Environment: \`${manifest.environment}\`
- API base URL: \`${manifest.baseUrls.api}\`
- Restore validation API base URL: \`${manifest.baseUrls.restoreApi}\`
- Worker identifier: \`${manifest.worker.identifier}\`

## Purpose

This pack does not mark launch readiness complete. It freezes the remaining Phase 12 operational work into a governed execution set for staging, production-like, or production proof.

Use this pack to:

- validate that the launch manifest is complete before execution starts
- run the remaining accepted probes and manual attestations in the correct order
- capture auditable evidence for each remaining Phase 12 item
- request governed launch approval only after the evidence set is actually complete

## Sequence

1. Run the alert delivery SLO proof.
2. Run the critical alert re-escalation proof.
3. Run the database restore drill.
4. Run the API rollback drill.
5. Run the worker rollback drill.
6. Record the secret handling review.
7. Record the role review.
8. Submit the governed launch approval request and complete dual-control approval.

## Important truth

- Repo-owned automated proofs are already available for contract invariants, backend integration, and end-to-end finance flows.
- Local development dry-runs exist for restore and rollback, but they are diagnostic only and are not accepted launch proof.
- Accepted evidence for the remaining operational items must come from \`${manifest.environment}\`, not local development.
`;
}

function renderLocalVsAcceptedStatus(): string {
  const externalChecks = externalOnlyReleaseReadinessChecks
    .map((check) => `- \`${check.evidenceType}\`: accepted only in staging, production_like, or production`)
    .join("\n");

  const locallySatisfied = localSatisfiedChecks
    .map((evidenceType) => `- \`${evidenceType}\`: repo-owned automated proof can be accepted from development or ci`)
    .join("\n");

  const dryRunOnly = localDryRunOnlyChecks
    .map((evidenceType) => `- \`${evidenceType}\`: local dry-run support exists, but accepted evidence still requires staging-like execution`)
    .join("\n");

  return `# Local Vs Accepted Proof

## Already satisfiable from repo-owned automation

${locallySatisfied}

## Local dry-run support that is not accepted launch proof

${dryRunOnly}

## Remaining external-only or staging-like proof

${externalChecks}

## Approval truth

- Final governed launch approval is not an evidence type.
- Approval remains blocked until every required proof has latest passed evidence in an accepted environment and every checklist attestation is complete.
`;
}

function renderExecutionPlan(manifest: LaunchClosureManifest): string {
  const artifacts = buildLaunchClosureArtifacts(manifest);

  return `# Execution Plan

## Preconditions

- Manifest validated with \`pnpm release:launch-closure -- validate --manifest <path>\`
- Accepted environment selected: \`${manifest.environment}\`
- Requester and approver identities are different
- Repo-owned automated proof already rerun or explicitly accepted from the latest verified main state

${artifacts
  .map((artifact, index) => {
    const commandSection = artifact.exactCommand
      ? `\n### Exact command\n\n\`\`\`bash\n${artifact.exactCommand}\n\`\`\`\n`
      : "";

    return `## ${index + 1}. ${artifact.title}

- Objective: ${artifact.objective}
- Runbook: [${artifact.runbookPath}](/Users/mc/development/blockchain/ethereum/stealth-trails-bank/${artifact.runbookPath})
- Required inputs:
${artifact.requiredInputs.map((value) => `  - ${value}`).join("\n")}
- Steps:
${artifact.steps.map((value) => `  - ${value}`).join("\n")}
- Expected outcome:
${artifact.expectedOutcome.map((value) => `  - ${value}`).join("\n")}${commandSection}`;
  })
  .join("\n")}
`;
}

function renderEvidenceTemplate(
  manifest: LaunchClosureManifest,
  artifact: LaunchClosureArtifact
): string {
  return `# ${artifact.title}

## Objective

${artifact.objective}

## Preconditions

- Manifest validated for \`${manifest.environment}\`
- Required inputs below are populated with real staging-like values
- This document must not be marked passed unless the accepted-environment proof actually ran

## Required Inputs

${artifact.requiredInputs.map((value) => `- ${value}`).join("\n")}

## Steps Performed

${artifact.steps.map((value, index) => `${index + 1}. ${value}`).join("\n")}

## Expected Outcome

${artifact.expectedOutcome.map((value) => `- ${value}`).join("\n")}

## Actual Outcome

- Status: pending
- Summary:
- Details:

## Timestamps

- Started at:
- Completed at:
- Observed at:

## Environment

- Release identifier: ${manifest.releaseIdentifier}
- Environment: ${manifest.environment}
- API base URL: ${manifest.baseUrls.api}

## Operators

- Requester: ${manifest.operator.requesterId} (${manifest.operator.requesterRole})
- Approver or reviewer:

## Artifact Links Or References

- 

## Notes Or Exceptions

- 

## Final Status

- pending
`;
}

function renderStatusSummary(): string {
  return [
    "# Launch-Closure Status",
    "",
    "## Repo-local proof already in place",
    ...localSatisfiedChecks.map(
      (evidenceType) =>
        `- ${evidenceType}: repo-owned automation can record accepted proof from development or ci`
    ),
    "",
    "## Remaining operational checks",
    ...externalOnlyReleaseReadinessChecks.map(
      (check) =>
        `- ${check.evidenceType}: ${check.description} Accepted environments: ${check.acceptedEnvironments.join(", ")}`
    ),
    "",
    "## Local dry-run truth",
    ...localDryRunOnlyChecks.map(
      (evidenceType) =>
        `- ${evidenceType}: local dry-run support exists, but accepted proof still requires staging-like execution`
    ),
    "",
    "## Approval truth",
    "- Launch approval remains blocked until every required proof has latest passed evidence in an accepted environment and every checklist item is complete."
  ].join("\n");
}

export function validateLaunchClosureManifest(
  manifest: LaunchClosureManifest
): LaunchClosureValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  readString(manifest.releaseIdentifier, "releaseIdentifier", errors);

  if (
    manifest.environment !== "staging" &&
    manifest.environment !== "production_like" &&
    manifest.environment !== "production"
  ) {
    errors.push(
      "Manifest field environment must be staging, production_like, or production."
    );
  }

  readString(manifest.baseUrls?.web, "baseUrls.web", errors);
  readString(manifest.baseUrls?.admin, "baseUrls.admin", errors);
  readString(manifest.baseUrls?.api, "baseUrls.api", errors);
  readString(manifest.baseUrls?.restoreApi, "baseUrls.restoreApi", errors);
  readString(manifest.worker?.identifier, "worker.identifier", errors);

  const requesterId = readString(
    manifest.operator?.requesterId,
    "operator.requesterId",
    errors
  );
  const requesterRole = readString(
    manifest.operator?.requesterRole,
    "operator.requesterRole",
    errors
  );
  const approverId = readString(
    manifest.operator?.approverId,
    "operator.approverId",
    errors
  );
  const approverRole = readString(
    manifest.operator?.approverRole,
    "operator.approverRole",
    errors
  );

  readString(
    manifest.operator?.apiKeyEnvironmentVariable,
    "operator.apiKeyEnvironmentVariable",
    errors
  );

  if (requesterId && approverId && requesterId === approverId) {
    errors.push(
      "operator.requesterId and operator.approverId must be different for dual-control approval."
    );
  }

  if (
    requesterRole &&
    !knownOperatorRoles.includes(requesterRole as (typeof knownOperatorRoles)[number])
  ) {
    warnings.push(
      `operator.requesterRole ${requesterRole} is not one of the repo-documented operator roles.`
    );
  }

  if (
    approverRole &&
    !knownOperatorRoles.includes(approverRole as (typeof knownOperatorRoles)[number])
  ) {
    warnings.push(
      `operator.approverRole ${approverRole} is not one of the repo-documented operator roles.`
    );
  }

  readString(manifest.artifacts?.apiReleaseId, "artifacts.apiReleaseId", errors);
  readString(
    manifest.artifacts?.workerReleaseId,
    "artifacts.workerReleaseId",
    errors
  );
  readString(
    manifest.artifacts?.approvalRollbackReleaseId,
    "artifacts.approvalRollbackReleaseId",
    errors
  );
  readString(
    manifest.artifacts?.apiRollbackReleaseId,
    "artifacts.apiRollbackReleaseId",
    errors
  );
  readString(
    manifest.artifacts?.workerRollbackReleaseId,
    "artifacts.workerRollbackReleaseId",
    errors
  );
  readString(
    manifest.artifacts?.backupReference,
    "artifacts.backupReference",
    errors
  );

  readString(
    manifest.alerting?.expectedTargetName,
    "alerting.expectedTargetName",
    errors
  );

  if (
    manifest.alerting?.expectedTargetHealthStatus !== "warning" &&
    manifest.alerting?.expectedTargetHealthStatus !== "critical"
  ) {
    errors.push(
      "Manifest field alerting.expectedTargetHealthStatus must be warning or critical."
    );
  }

  readPositiveInteger(
    manifest.alerting?.expectedMinReEscalations,
    "alerting.expectedMinReEscalations",
    errors
  );

  const expectedAlertId = normalizeString(manifest.alerting?.expectedAlertId);
  const expectedAlertDedupeKey = normalizeString(
    manifest.alerting?.expectedAlertDedupeKey
  );

  if (!expectedAlertId && !expectedAlertDedupeKey) {
    errors.push(
      "Provide either alerting.expectedAlertId or alerting.expectedAlertDedupeKey for critical re-escalation proof."
    );
  }

  readString(
    manifest.governance?.secretReviewReference,
    "governance.secretReviewReference",
    errors
  );
  readString(
    manifest.governance?.roleReviewReference,
    "governance.roleReviewReference",
    errors
  );
  readString(
    manifest.governance?.roleReviewRosterReference,
    "governance.roleReviewRosterReference",
    errors
  );

  readString(manifest.notes?.launchSummary, "notes.launchSummary", errors);

  return {
    errors,
    warnings
  };
}

export function loadLaunchClosureManifest(
  manifestPath: string
): LaunchClosureManifest {
  const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as LaunchClosureManifest;
  return raw;
}

export function scaffoldLaunchClosurePack(args: {
  manifest: LaunchClosureManifest;
  repoRoot: string;
  outputDir?: string;
  force?: boolean;
}): LaunchClosurePackResult {
  const validation = validateLaunchClosureManifest(args.manifest);

  if (validation.errors.length > 0) {
    throw new Error(validation.errors.join(" "));
  }

  const outputDir =
    args.outputDir ?? defaultOutputDir(args.manifest, args.repoRoot);

  if (args.force) {
    rmSync(outputDir, {
      force: true,
      recursive: true
    });
  }

  mkdirSync(path.join(outputDir, "evidence"), {
    recursive: true
  });

  const preview = previewLaunchClosurePack(args.manifest);
  const files: string[] = [];

  const writeArtifact = (file: LaunchClosurePackFile) => {
    const targetPath = path.join(outputDir, file.relativePath);
    mkdirSync(path.dirname(targetPath), {
      recursive: true
    });
    writeFileSync(targetPath, file.content, "utf8");
    files.push(targetPath);
  };

  for (const file of preview.files) {
    writeArtifact(file);
  }

  return {
    outputDir,
    files
  };
}

export function previewLaunchClosurePack(
  manifest: LaunchClosureManifest
): LaunchClosurePackPreview {
  return {
    outputSubpath: buildOutputSubpath(manifest),
    files: [
      {
        relativePath: "README.md",
        content: renderPackReadme(manifest)
      },
      {
        relativePath: "manifest.json",
        content: jsonStringify(manifest)
      },
      {
        relativePath: "local-vs-accepted-status.md",
        content: renderLocalVsAcceptedStatus()
      },
      {
        relativePath: "execution-plan.md",
        content: renderExecutionPlan(manifest)
      },
      {
        relativePath: "approval-request.template.json",
        content: buildApprovalBodyTemplate(manifest)
      },
      ...buildLaunchClosureArtifacts(manifest).map((artifact) => ({
        relativePath: path.join("evidence", artifact.filename),
        content: renderEvidenceTemplate(manifest, artifact)
      }))
    ]
  };
}

export function renderLaunchClosureStatusSummary(): string {
  return renderStatusSummary();
}

export function renderLaunchClosureValidationSummary(
  manifest: LaunchClosureManifest
): string {
  const validation = validateLaunchClosureManifest(manifest);
  const checklistLabels = releaseReadinessChecklistSections
    .map((section) => `- ${section.label}`)
    .join("\n");

  return [
    "# Launch-Closure Manifest Validation",
    "",
    `- Release identifier: ${manifest.releaseIdentifier}`,
    `- Environment: ${manifest.environment}`,
    `- Requester: ${manifest.operator.requesterId} (${manifest.operator.requesterRole})`,
    `- Approver: ${manifest.operator.approverId} (${manifest.operator.approverRole})`,
    "",
    "## Required approval checklist sections",
    checklistLabels,
    "",
    "## Errors",
    ...(validation.errors.length > 0
      ? validation.errors.map((error) => `- ${error}`)
      : ["- none"]),
    "",
    "## Warnings",
    ...(validation.warnings.length > 0
      ? validation.warnings.map((warning) => `- ${warning}`)
      : ["- none"]),
    "",
    "## External-only checks",
    ...externalOnlyReleaseReadinessChecks.map(
      (check) =>
        `- ${check.evidenceType}: accepted only in ${check.acceptedEnvironments.join(", ")}`
    )
  ].join("\n");
}
