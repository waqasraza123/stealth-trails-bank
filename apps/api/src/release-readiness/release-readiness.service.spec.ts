import {
  ReleaseReadinessApprovalStatus,
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceStatus,
  ReleaseReadinessEvidenceType
} from "@prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { buildLaunchClosureArtifactManifest } from "./launch-closure-pack";
import { ReleaseReadinessService } from "./release-readiness.service";

const approvalExpectedUpdatedAt = "2026-04-08T12:00:00.000Z";

function checksumPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function buildEvidenceRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "evidence_1",
    evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
    environment: ReleaseReadinessEnvironment.staging,
    status: ReleaseReadinessEvidenceStatus.passed,
    releaseIdentifier: "release-2026-04-08.1",
    rollbackReleaseIdentifier: null,
    backupReference: null,
    summary: "Delivery target degradation opened the expected alert.",
    note: "Observed against staging webhook target.",
    operatorId: "ops_1",
    operatorRole: "operations_admin",
    runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
    evidenceLinks: ["https://example.com/evidence/1"],
    evidencePayload: {
      alertId: "alert_1",
      targetName: "ops-critical"
    },
    startedAt: new Date("2026-04-08T09:00:00.000Z"),
    completedAt: new Date("2026-04-08T09:05:00.000Z"),
    observedAt: new Date("2026-04-08T09:05:00.000Z"),
    createdAt: new Date("2026-04-08T09:05:00.000Z"),
    updatedAt: new Date("2026-04-08T09:05:00.000Z"),
    ...overrides
  };
}

function buildApprovalRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  const launchClosurePack = buildLaunchClosurePackRecord();

  return {
    id: "approval_1",
    releaseIdentifier: "release-2026-04-08.1",
    environment: ReleaseReadinessEnvironment.production_like,
    launchClosurePackId: "pack_1",
    launchClosurePackVersion: 1,
    launchClosurePackChecksumSha256: launchClosurePack.artifactChecksumSha256,
    rollbackReleaseIdentifier: "release-2026-04-07.3",
    status: ReleaseReadinessApprovalStatus.pending_approval,
    summary: "Phase 12 launch checklist reviewed against production-like proof.",
    requestNote: "Awaiting compliance sign-off.",
    approvalNote: null,
    rejectionNote: null,
    requestedByOperatorId: "ops_1",
    requestedByOperatorRole: "operations_admin",
    approvedByOperatorId: null,
    approvedByOperatorRole: null,
    rejectedByOperatorId: null,
    rejectedByOperatorRole: null,
    supersededByOperatorId: null,
    supersededByOperatorRole: null,
    supersedesApprovalId: null,
    supersededByApprovalId: null,
    securityConfigurationComplete: true,
    accessAndGovernanceComplete: true,
    dataAndRecoveryComplete: true,
    platformHealthComplete: true,
    functionalProofComplete: true,
    contractAndChainProofComplete: true,
    finalSignoffComplete: true,
    unresolvedRisksAccepted: true,
    openBlockers: [],
    residualRiskNote: null,
    evidenceSnapshot: {
      generatedAt: "2026-04-08T12:00:00.000Z",
      overallStatus: "healthy",
      summary: {
        requiredCheckCount: 12,
        passedCheckCount: 12,
        failedCheckCount: 0,
        pendingCheckCount: 0
      },
      requiredChecks: []
    },
    blockerSnapshot: {
      overallStatus: "ready",
      approvalEligible: true,
      missingChecklistItems: [],
      missingEvidenceTypes: [],
      failedEvidenceTypes: [],
      staleEvidenceTypes: [],
      metadataMismatches: [],
      maximumEvidenceAgeHours: 72,
      openBlockers: [],
      generatedAt: "2026-04-08T12:00:00.000Z"
    },
    decisionDriftSnapshot: null,
    decisionDriftCapturedAt: null,
    requestedAt: new Date("2026-04-08T12:00:00.000Z"),
    approvedAt: null,
    rejectedAt: null,
    supersededAt: null,
    createdAt: new Date("2026-04-08T12:00:00.000Z"),
    updatedAt: new Date("2026-04-08T12:00:00.000Z"),
    launchClosurePack,
    ...overrides
  };
}

function buildLaunchClosurePackRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  const files = [
    {
      relativePath: "manifest.json",
      content: JSON.stringify(
        {
          releaseIdentifier: "release-2026-04-08.1"
        },
        null,
        2
      )
    },
    {
      relativePath: "README.md",
      content: "Launch closure pack\n"
    },
    {
      relativePath: "artifact-manifest.json",
      content: "{}\n"
    }
  ];
  const artifactPayload = {
    manifest: {
      releaseIdentifier: "release-2026-04-08.1"
    },
    artifactManifest: buildLaunchClosureArtifactManifest(files),
    files
  };

  return {
    id: "pack_1",
    releaseIdentifier: "release-2026-04-08.1",
    environment: ReleaseReadinessEnvironment.production_like,
    version: 1,
    generatedByOperatorId: "ops_1",
    generatedByOperatorRole: "operations_admin",
    artifactChecksumSha256: checksumPayload(artifactPayload),
    artifactPayload,
    createdAt: new Date("2026-04-08T12:00:00.000Z"),
    updatedAt: new Date("2026-04-08T12:00:00.000Z"),
    ...overrides
  };
}

function buildVerifiableLaunchClosurePackRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return buildLaunchClosurePackRecord(overrides);
}

function buildRollbackArtifactEvidencePayload(
  service: "api" | "worker",
  environment = "staging"
) {
  return {
    proofKind: "deployment_artifact_manifest",
    service,
    approvalRollbackReleaseIdentifier: "release-2026-04-07.3",
    currentArtifact: {
      releaseId: `${service}-release-2026-04-08.1`,
      service,
      environment,
      artifactKind: service === "api" ? "vercel_deployment" : "worker_bundle",
      artifactUri: `vercel://${service}/${service}-release-2026-04-08.1`,
      artifactDigestSha256:
        service === "api"
          ? "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
          : "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      sourceCommitSha: "abc1234",
      runtime: "nodejs20.x"
    },
    rollbackArtifact: {
      releaseId: `${service}-release-2026-04-07.3`,
      service,
      environment,
      artifactKind: service === "api" ? "vercel_deployment" : "worker_bundle",
      artifactUri: `vercel://${service}/${service}-release-2026-04-07.3`,
      artifactDigestSha256:
        service === "api"
          ? "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
          : "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      sourceCommitSha: "def5678",
      runtime: "nodejs20.x"
    },
    artifactManifestPath: "payloads/release-artifacts.json"
  };
}

function buildPassedRequiredEvidenceRecords() {
  return [
    buildEvidenceRecord({
      evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo
    }),
    buildEvidenceRecord({
      id: "evidence_2",
      evidenceType: ReleaseReadinessEvidenceType.critical_alert_reescalation
    }),
    buildEvidenceRecord({
      id: "evidence_3",
      evidenceType: ReleaseReadinessEvidenceType.database_restore_drill,
      backupReference: "snapshot-2026-04-08T08:00Z",
      runbookPath: "docs/runbooks/restore-and-rollback-drills.md"
    }),
    buildEvidenceRecord({
      id: "evidence_4",
      evidenceType: ReleaseReadinessEvidenceType.api_rollback_drill,
      rollbackReleaseIdentifier: "release-2026-04-07.3",
      runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
      evidencePayload: buildRollbackArtifactEvidencePayload("api")
    }),
    buildEvidenceRecord({
      id: "evidence_5",
      evidenceType: ReleaseReadinessEvidenceType.worker_rollback_drill,
      rollbackReleaseIdentifier: "release-2026-04-07.3",
      runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
      evidencePayload: buildRollbackArtifactEvidencePayload("worker")
    }),
    buildEvidenceRecord({
      id: "evidence_6",
      evidenceType: "contract_invariant_suite",
      environment: "ci",
      runbookPath: "docs/runbooks/release-candidate-verification.md"
    }),
    buildEvidenceRecord({
      id: "evidence_7",
      evidenceType: "backend_integration_suite",
      environment: "ci",
      runbookPath: "docs/runbooks/release-candidate-verification.md"
    }),
    buildEvidenceRecord({
      id: "evidence_8",
      evidenceType: "end_to_end_finance_flows",
      environment: "ci",
      runbookPath: "docs/runbooks/release-candidate-verification.md"
    }),
    buildEvidenceRecord({
      id: "evidence_9",
      evidenceType: "secret_handling_review",
      environment: ReleaseReadinessEnvironment.production_like,
      runbookPath: "docs/security/secret-handling-review.md"
    }),
    buildEvidenceRecord({
      id: "evidence_10",
      evidenceType: "role_review",
      environment: ReleaseReadinessEnvironment.production_like,
      runbookPath: "docs/security/role-review.md"
    }),
    buildEvidenceRecord({
      id: "evidence_11",
      evidenceType: "solvency_anchor_registry_deployment",
      environment: ReleaseReadinessEnvironment.production_like,
      runbookPath: "docs/runbooks/solvency-anchor-registry-deployment-proof.md",
      evidencePayload: {
        proofKind: "manual_attestation",
        networkName: "sepolia",
        chainId: 11155111,
        contractProductSurface: "solvency_report_anchor_registry_v1",
        signerScope: "solvency_anchor_execution",
        contractAddress: "0x1111111111111111111111111111111111111111",
        deploymentTxHash:
          "0x2222222222222222222222222222222222222222222222222222222222222222",
        governanceOwner: "0x3333333333333333333333333333333333333333",
        authorizedAnchorer: "0x4444444444444444444444444444444444444444",
        abiChecksumSha256:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        manifestPath: "packages/contracts/deployments/staging.manifest.json",
        manifestCommitSha: "abc1234"
      }
    }),
    buildEvidenceRecord({
      id: "evidence_12",
      evidenceType: "notification_cutover_verification",
      environment: ReleaseReadinessEnvironment.production_like,
      runbookPath: "docs/runbooks/notification-cutover-verification.md"
    })
  ];
}

function createService() {
  const transactionClient = {
    releaseReadinessEvidence: {
      create: jest.fn()
    },
    releaseReadinessApproval: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn()
    },
    releaseLaunchClosurePack: {
      create: jest.fn(),
      findFirst: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    }
  };

  const prismaService = {
    $transaction: jest.fn(
      async (callback: (client: typeof transactionClient) => unknown) =>
        callback(transactionClient)
    ),
    releaseReadinessEvidence: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    releaseReadinessApproval: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    releaseLaunchClosurePack: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    contractDeploymentManifest: {
      findFirst: jest.fn()
    },
    governedSignerInventory: {
      findFirst: jest.fn()
    },
    governanceAuthorityManifest: {
      findFirst: jest.fn()
    },
    auditEvent: {
      create: jest.fn(),
      findMany: jest.fn()
    }
  } as unknown as PrismaService;

  const service = new ReleaseReadinessService(prismaService);

  return {
    service,
    prismaService,
    transactionClient
  };
}

describe("ReleaseReadinessService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv
    };
    jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-04-08T12:00:00.000Z").getTime());
    delete process.env["RELEASE_READINESS_APPROVAL_REQUEST_ALLOWED_OPERATOR_ROLES"];
    delete process.env["RELEASE_READINESS_APPROVER_ALLOWED_OPERATOR_ROLES"];
    delete process.env["RELEASE_READINESS_APPROVAL_ALLOWED_OPERATOR_ROLES"];
    delete process.env["RELEASE_READINESS_APPROVAL_MAX_EVIDENCE_AGE_HOURS"];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("records immutable release readiness evidence with an audit event", async () => {
    const { service, transactionClient } = createService();
    (transactionClient.releaseReadinessEvidence.create as jest.Mock).mockResolvedValue(
      buildEvidenceRecord()
    );

    const result = await service.recordEvidence(
      {
        evidenceType: "platform_alert_delivery_slo",
        environment: "staging",
        status: "passed",
        releaseIdentifier: " release-2026-04-08.1 ",
        summary: " Delivery target degradation opened the expected alert. ",
        note: " Observed against staging webhook target. ",
        evidenceLinks: [
          "https://example.com/evidence/1",
          "https://example.com/evidence/1"
        ],
        evidencePayload: {
          alertId: "alert_1"
        }
      },
      "ops_1",
      "operations_admin"
    );

    expect(
      transactionClient.releaseReadinessEvidence.create
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          releaseIdentifier: "release-2026-04-08.1",
          evidenceLinks: ["https://example.com/evidence/1"]
        })
      })
    );
    expect(transactionClient.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(result.evidence.status).toBe("passed");
    expect(result.evidence.runbookPath).toBe(
      "docs/runbooks/platform-alert-delivery-targets.md"
    );
  });

  it("rejects external-only evidence without a release identifier", async () => {
    const { service, transactionClient } = createService();

    await expect(
      service.recordEvidence(
        {
          evidenceType: "secret_handling_review",
          environment: "production_like",
          status: "passed",
          summary: "Launch secret review completed."
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Release readiness evidence for secret_handling_review requires release identifier."
    );

    expect(transactionClient.releaseReadinessEvidence.create).not.toHaveBeenCalled();
  });

  it("rejects restore drill evidence without a backup reference", async () => {
    const { service, transactionClient } = createService();

    await expect(
      service.recordEvidence(
        {
          evidenceType: "database_restore_drill",
          environment: "production_like",
          status: "passed",
          releaseIdentifier: "launch-2026.04.14.1",
          summary: "Restore drill completed against the launch snapshot."
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Release readiness evidence for database_restore_drill requires release identifier, backup reference."
    );

    expect(transactionClient.releaseReadinessEvidence.create).not.toHaveBeenCalled();
  });

  it("rejects rollback drill evidence without a rollback release identifier", async () => {
    const { service, transactionClient } = createService();

    await expect(
      service.recordEvidence(
        {
          evidenceType: "api_rollback_drill",
          environment: "production_like",
          status: "passed",
          releaseIdentifier: "launch-2026.04.14.1",
          summary: "API rollback drill completed."
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Release readiness evidence for api_rollback_drill requires release identifier, rollback release identifier."
    );

    expect(transactionClient.releaseReadinessEvidence.create).not.toHaveBeenCalled();
  });

  it("rejects rollback drill evidence without deployment artifact binding", async () => {
    const { service, transactionClient } = createService();

    await expect(
      service.recordEvidence(
        {
          evidenceType: "worker_rollback_drill",
          environment: "production_like",
          status: "passed",
          releaseIdentifier: "launch-2026.04.14.1",
          rollbackReleaseIdentifier: "launch-rollback-2026.04.13.4",
          summary: "Worker rollback drill completed."
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Release readiness evidence for worker_rollback_drill requires valid payload fields: proof kind, service, approval rollback release identifier, current deployment artifact, rollback deployment artifact, artifact manifest path."
    );

    expect(transactionClient.releaseReadinessEvidence.create).not.toHaveBeenCalled();
  });

  it("rejects rollback drill artifact payloads with the wrong environment", async () => {
    const { service, transactionClient } = createService();

    await expect(
      service.recordEvidence(
        {
          evidenceType: "api_rollback_drill",
          environment: "production_like",
          status: "passed",
          releaseIdentifier: "launch-2026.04.14.1",
          rollbackReleaseIdentifier: "launch-rollback-2026.04.13.4",
          summary: "API rollback drill completed.",
          evidencePayload: {
            ...buildRollbackArtifactEvidencePayload("api", "staging"),
            approvalRollbackReleaseIdentifier: "launch-rollback-2026.04.13.4"
          }
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Rollback drill evidence artifact binding is invalid: currentArtifact.environment, rollbackArtifact.environment."
    );

    expect(transactionClient.releaseReadinessEvidence.create).not.toHaveBeenCalled();
  });

  it("records rollback drill evidence with deployment artifact binding", async () => {
    const { service, transactionClient } = createService();
    (transactionClient.releaseReadinessEvidence.create as jest.Mock).mockResolvedValue(
      buildEvidenceRecord({
        evidenceType: ReleaseReadinessEvidenceType.api_rollback_drill,
        environment: ReleaseReadinessEnvironment.production_like,
        rollbackReleaseIdentifier: "launch-rollback-2026.04.13.4",
        evidencePayload: {
          ...buildRollbackArtifactEvidencePayload("api", "production_like"),
          approvalRollbackReleaseIdentifier: "launch-rollback-2026.04.13.4"
        }
      })
    );

    const result = await service.recordEvidence(
      {
        evidenceType: "api_rollback_drill",
        environment: "production_like",
        status: "passed",
        releaseIdentifier: "launch-2026.04.14.1",
        rollbackReleaseIdentifier: "launch-rollback-2026.04.13.4",
        summary: "API rollback drill completed.",
        evidencePayload: {
          ...buildRollbackArtifactEvidencePayload("api", "production_like"),
          approvalRollbackReleaseIdentifier: "launch-rollback-2026.04.13.4"
        }
      },
      "ops_1",
      "operations_admin"
    );

    expect(
      transactionClient.releaseReadinessEvidence.create
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          evidenceType: "api_rollback_drill",
          rollbackReleaseIdentifier: "launch-rollback-2026.04.13.4",
          evidencePayload: expect.objectContaining({
            proofKind: "deployment_artifact_manifest",
            service: "api"
          })
        })
      })
    );
    expect(result.evidence.evidenceType).toBe("api_rollback_drill");
  });

  it("rejects solvency anchor deployment evidence that drifts from the active manifest", async () => {
    const { service, prismaService, transactionClient } = createService();
    (
      prismaService.contractDeploymentManifest.findFirst as jest.Mock
    ).mockResolvedValue({
      deploymentTxHash:
        "0x9999999999999999999999999999999999999999999999999999999999999999",
      governanceOwner: "0x3333333333333333333333333333333333333333",
      authorizedAnchorer: "0x4444444444444444444444444444444444444444",
      abiChecksumSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    });
    (prismaService.governedSignerInventory.findFirst as jest.Mock).mockResolvedValue({
      id: "signer_1"
    });
    (
      prismaService.governanceAuthorityManifest.findFirst as jest.Mock
    ).mockResolvedValue({
      id: "authority_1"
    });

    await expect(
      service.recordEvidence(
        {
          evidenceType: "solvency_anchor_registry_deployment",
          environment: "production_like",
          status: "passed",
          releaseIdentifier: "launch-2026.04.14.1",
          summary: "Solvency anchor registry deployment verified.",
          evidencePayload: {
            proofKind: "manual_attestation",
            networkName: "base-sepolia",
            chainId: 84532,
            contractProductSurface: "solvency_report_anchor_registry_v1",
            signerScope: "solvency_anchor_execution",
            contractAddress: "0x1111111111111111111111111111111111111111",
            deploymentTxHash:
              "0x2222222222222222222222222222222222222222222222222222222222222222",
            governanceOwner: "0x3333333333333333333333333333333333333333",
            authorizedAnchorer: "0x4444444444444444444444444444444444444444",
            abiChecksumSha256:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            manifestPath: "packages/contracts/deployments/base-sepolia.manifest.json",
            manifestCommitSha: "abc1234",
            onchainVerification: {
              chainId: 84532,
              rpcUrlHost: "base-sepolia-rpc.example.com",
              contractAddress: "0x1111111111111111111111111111111111111111",
              deploymentTxHash:
                "0x2222222222222222222222222222222222222222222222222222222222222222",
              deploymentBlockNumber: 12_345_678,
              owner: "0x3333333333333333333333333333333333333333",
              authorizedAnchorer: "0x4444444444444444444444444444444444444444",
              bytecodePresent: true
            }
          }
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Solvency anchor registry deployment evidence does not match the active manifest fields: deployment transaction hash."
    );

    expect(transactionClient.releaseReadinessEvidence.create).not.toHaveBeenCalled();
  });

  it("lists release readiness evidence using bounded filters", async () => {
    const { service, prismaService } = createService();
    (
      prismaService.releaseReadinessEvidence.findMany as jest.Mock
    ).mockResolvedValue([
      buildEvidenceRecord(),
      buildEvidenceRecord({
        id: "evidence_2",
        evidenceType: ReleaseReadinessEvidenceType.api_rollback_drill,
        runbookPath: "docs/runbooks/restore-and-rollback-drills.md"
      })
    ]);
    (prismaService.releaseReadinessEvidence.count as jest.Mock).mockResolvedValue(2);

    const result = await service.listEvidence({
      limit: 5,
      environment: "staging",
      releaseIdentifier: "release-2026-04-08.1",
      sinceDays: 30
    });

    expect(prismaService.releaseReadinessEvidence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({
          environment: "staging",
          releaseIdentifier: {
            equals: "release-2026-04-08.1",
            mode: "insensitive"
          }
        })
      })
    );
    expect(result.totalCount).toBe(2);
    expect(result.evidence).toHaveLength(2);
  });

  it("lists governed approvals using exact release filters", async () => {
    const { service, prismaService } = createService();
    const approvalRecord = buildApprovalRecord({
      id: "approval_2",
      status: ReleaseReadinessApprovalStatus.approved,
      approvedByOperatorId: "approver_1",
      approvedByOperatorRole: "risk_manager",
      approvedAt: new Date("2026-04-08T13:00:00.000Z")
    });
    (
      prismaService.releaseReadinessApproval.findMany as jest.Mock
    ).mockResolvedValue([approvalRecord]);
    (prismaService.releaseReadinessApproval.count as jest.Mock).mockResolvedValue(1);
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      approvalRecord
    );

    const result = await service.listApprovals({
      limit: 5,
      status: "approved",
      environment: "production_like",
      releaseIdentifier: "release-2026-04-08.1"
    });

    expect(prismaService.releaseReadinessApproval.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({
          status: "approved",
          environment: "production_like",
          releaseIdentifier: {
            equals: "release-2026-04-08.1",
            mode: "insensitive"
          }
        })
      })
    );
    expect(result.totalCount).toBe(1);
    expect(result.approvals).toHaveLength(1);
    expect(result.approvals[0]?.lineageSummary).toEqual({
      status: "healthy",
      issueCount: 0,
      actionableApprovalId: null,
      isActionable: false
    });
  });

  it("lists only approval lineage incidents from the hydrated approval list", async () => {
    const { service, prismaService } = createService();
    const healthyApproval = buildApprovalRecord({
      id: "approval_healthy"
    });
    const incidentApproval = buildApprovalRecord({
      id: "approval_incident",
      releaseIdentifier: "release-2026-04-08.2",
      supersededByApprovalId: "approval_replacement"
    });

    (
      prismaService.releaseReadinessApproval.findMany as jest.Mock
    ).mockResolvedValue([healthyApproval, incidentApproval]);
    (prismaService.releaseReadinessApproval.count as jest.Mock).mockResolvedValue(2);
    (
      prismaService.releaseReadinessEvidence.findMany as jest.Mock
    ).mockResolvedValue(buildPassedRequiredEvidenceRecords());
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === "approval_healthy") {
          return healthyApproval;
        }

        if (where.id === "approval_incident") {
          return incidentApproval;
        }

        return null;
      }
    );
    (prismaService.releaseReadinessApproval.findFirst as jest.Mock).mockImplementation(
      async ({ where }: { where: { supersedesApprovalId?: string | null } }) => {
        if (where.supersedesApprovalId === "approval_incident") {
          return buildApprovalRecord({
            id: "approval_replacement",
            releaseIdentifier: "release-2026-04-08.2",
            supersedesApprovalId: "approval_incident"
          });
        }

        return null;
      }
    );

    const result = await service.listApprovalLineageIncidents({
      limit: 20
    });

    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0]?.id).toBe("approval_incident");
    expect(result.incidents[0]?.lineageSummary).toEqual({
      status: "critical",
      issueCount: 1,
      actionableApprovalId: "approval_incident",
      isActionable: true
    });
    expect(result.totalCount).toBe(1);
  });

  it("derives readiness summary from the latest evidence per required check", async () => {
    const { service, prismaService } = createService();
    (
      prismaService.releaseReadinessEvidence.findMany as jest.Mock
    )
      .mockResolvedValueOnce([
        buildEvidenceRecord({
          evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
          status: ReleaseReadinessEvidenceStatus.passed,
          observedAt: new Date("2026-04-08T09:05:00.000Z")
        }),
        buildEvidenceRecord({
          id: "evidence_2",
          evidenceType: ReleaseReadinessEvidenceType.critical_alert_reescalation,
          status: ReleaseReadinessEvidenceStatus.failed,
          runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
          observedAt: new Date("2026-04-08T10:05:00.000Z")
        }),
        buildEvidenceRecord({
          id: "evidence_3",
          evidenceType: ReleaseReadinessEvidenceType.database_restore_drill,
          status: ReleaseReadinessEvidenceStatus.passed,
          runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
          observedAt: new Date("2026-04-08T11:05:00.000Z")
        })
      ])
      .mockResolvedValueOnce([
        buildEvidenceRecord(),
        buildEvidenceRecord({
          id: "evidence_2",
          evidenceType: ReleaseReadinessEvidenceType.critical_alert_reescalation,
          status: ReleaseReadinessEvidenceStatus.failed
        })
      ]);

    const result = await service.getSummary(undefined, {
      operatorId: "ops_1",
      operatorRole: "operations_admin"
    });

    expect(result.overallStatus).toBe("critical");
    expect(result.approvalPolicy).toEqual({
      requestAllowedOperatorRoles: [
        "operations_admin",
        "compliance_lead",
        "risk_manager"
      ],
      approverAllowedOperatorRoles: ["compliance_lead", "risk_manager"],
      maximumEvidenceAgeHours: 72,
      currentOperator: {
        operatorId: "ops_1",
        operatorRole: "operations_admin",
        canRequestApproval: true,
        canApproveOrReject: false
      }
    });
    expect(result.summary.requiredCheckCount).toBe(12);
    expect(result.summary.passedCheckCount).toBe(2);
    expect(result.summary.failedCheckCount).toBe(1);
    expect(result.summary.pendingCheckCount).toBe(9);
    expect(
      result.requiredChecks.find(
        (check) =>
          check.evidenceType ===
          ReleaseReadinessEvidenceType.critical_alert_reescalation
      )?.status
    ).toBe("failed");
    expect(result.recentEvidence).toHaveLength(2);
  });

  it("scopes readiness summary to the requested release identifier", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce([
        buildEvidenceRecord({
          releaseIdentifier: "release-2026-04-08.1",
          evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo
        })
      ])
      .mockResolvedValueOnce([
        buildEvidenceRecord({
          releaseIdentifier: "release-2026-04-08.1"
        })
      ]);

    const result = await service.getSummary({
      releaseIdentifier: " release-2026-04-08.1 "
    }, {
      operatorId: "ops_2",
      operatorRole: "compliance_lead"
    });

    expect(prismaService.releaseReadinessEvidence.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          releaseIdentifier: "release-2026-04-08.1"
        })
      })
    );
    expect(result.releaseIdentifier).toBe("release-2026-04-08.1");
    expect(result.approvalPolicy.currentOperator).toEqual({
      operatorId: "ops_2",
      operatorRole: "compliance_lead",
      canRequestApproval: true,
      canApproveOrReject: true
    });
  });

  it("builds scoped launch-closure status from release evidence and approval state", async () => {
    const { service, prismaService } = createService();
    const evidenceRecords = buildPassedRequiredEvidenceRecords().slice(0, 5);

    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(evidenceRecords)
      .mockResolvedValueOnce(evidenceRecords.slice(0, 3));
    (prismaService.releaseReadinessApproval.findFirst as jest.Mock).mockResolvedValue(
      buildApprovalRecord({
        releaseIdentifier: "release-2026-04-08.1",
        blockerSnapshot: {
          overallStatus: "blocked",
          approvalEligible: false,
          missingChecklistItems: [],
          missingEvidenceTypes: ["role_review"],
          failedEvidenceTypes: [],
          staleEvidenceTypes: [],
          metadataMismatches: [],
          maximumEvidenceAgeHours: 72,
          openBlockers: [],
          generatedAt: "2026-04-08T12:00:00.000Z"
        }
      })
    );

    const result = await service.getLaunchClosureStatus({
      releaseIdentifier: "release-2026-04-08.1",
      environment: ReleaseReadinessEnvironment.production_like
    });

    expect(result.releaseIdentifier).toBe("release-2026-04-08.1");
    expect(result.environment).toBe(ReleaseReadinessEnvironment.production_like);
    expect(result.externalChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
          status: "passed"
        }),
        expect.objectContaining({
          evidenceType: ReleaseReadinessEvidenceType.role_review,
          status: "pending"
        })
      ])
    );
    expect(result.latestApproval?.gate.missingEvidenceTypes).toContain("role_review");
    expect(result.summaryMarkdown).toContain(
      "Release identifier: release-2026-04-08.1"
    );
  });

  it("stores versioned launch-closure packs with immutable artifact snapshots", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (prismaService.releaseReadinessApproval.findFirst as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (transactionClient.releaseLaunchClosurePack.findFirst as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord({
        id: "pack_0",
        version: 2
      })
    );
    (transactionClient.releaseLaunchClosurePack.create as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord({
        id: "pack_3",
        version: 3
      })
    );

    const result = await service.storeLaunchClosurePack(
      {
        releaseIdentifier: "release-2026-04-08.1",
        environment: "production_like",
        baseUrls: {
          web: "https://web.example.com",
          admin: "https://admin.example.com",
          api: "https://api.example.com",
          restoreApi: "https://restore-api.example.com"
        },
        worker: {
          identifier: "worker-prodlike-1"
        },
        operator: {
          requesterId: "ops_1",
          requesterRole: "operations_admin",
          approverId: "ops_2",
          approverRole: "compliance_lead",
          apiKeyEnvironmentVariable: "INTERNAL_OPERATOR_API_KEY"
        },
        customer: {
          accessTokenEnvironmentVariable: "CUSTOMER_ACCESS_TOKEN"
        },
        artifacts: {
          apiReleaseId: "api-1",
          workerReleaseId: "worker-1",
          approvalRollbackReleaseId: "launch-rollback-1",
          apiRollbackReleaseId: "api-rollback-1",
          workerRollbackReleaseId: "worker-rollback-1",
          backupReference: "backup-1"
        },
        deploymentArtifacts: {
          apiCurrent: {
            releaseId: "api-1",
            service: "api",
            environment: "production_like",
            artifactKind: "vercel_deployment",
            artifactUri: "vercel://api/api-1",
            artifactDigestSha256:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            sourceCommitSha: "abc1234",
            runtime: "nodejs20.x"
          },
          apiRollback: {
            releaseId: "api-rollback-1",
            service: "api",
            environment: "production_like",
            artifactKind: "vercel_deployment",
            artifactUri: "vercel://api/api-rollback-1",
            artifactDigestSha256:
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            sourceCommitSha: "def5678",
            runtime: "nodejs20.x"
          },
          workerCurrent: {
            releaseId: "worker-1",
            service: "worker",
            environment: "production_like",
            artifactKind: "worker_bundle",
            artifactUri: "vercel://worker/worker-1",
            artifactDigestSha256:
              "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            sourceCommitSha: "abc1234",
            runtime: "nodejs20.x"
          },
          workerRollback: {
            releaseId: "worker-rollback-1",
            service: "worker",
            environment: "production_like",
            artifactKind: "worker_bundle",
            artifactUri: "vercel://worker/worker-rollback-1",
            artifactDigestSha256:
              "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
            sourceCommitSha: "def5678",
            runtime: "nodejs20.x"
          }
        },
        chain: {
          networkName: "sepolia",
          chainId: 11155111
        },
        solvencyAnchorRegistryDeployment: {
          deploymentTxHash:
            "0x1111111111111111111111111111111111111111111111111111111111111111",
          governanceOwner: "0x3333333333333333333333333333333333333333",
          authorizedAnchorer: "0x4444444444444444444444444444444444444444",
          manifestPath: "packages/contracts/deployments/staging.manifest.json",
          manifestCommitSha: "abc1234",
          onchainVerification: {
            chainId: 11155111,
            rpcUrlHost: "sepolia-rpc.example.com",
            contractAddress: "0x1111111111111111111111111111111111111111",
            deploymentTxHash:
              "0x1111111111111111111111111111111111111111111111111111111111111111",
            deploymentBlockNumber: 1,
            owner: "0x3333333333333333333333333333333333333333",
            authorizedAnchorer: "0x4444444444444444444444444444444444444444",
            bytecodePresent: true
          }
        },
        alerting: {
          expectedTargetName: "ops-critical",
          expectedTargetHealthStatus: "critical",
          expectedMinReEscalations: 1,
          expectedAlertDedupeKey: "dedupe-1"
        },
        governance: {
          secretReviewReference: "ticket/SEC-1",
          roleReviewReference: "ticket/GOV-1",
          roleReviewRosterReference: "ticket/GOV-1#roster"
        },
        governedCustody: {
          governanceSafeAddress: "0x3333333333333333333333333333333333333333",
          treasurySafeAddress: "0x5555555555555555555555555555555555555555",
          emergencySafeAddress: "0x6666666666666666666666666666666666666666",
          signerInventory: [
            {
              scope: "deposit_execution",
              keyReference: "kms://launch/deposit",
              signerAddress: "0x7777777777777777777777777777777777777777"
            },
            {
              scope: "withdrawal_execution",
              keyReference: "kms://launch/withdrawal",
              signerAddress: "0x8888888888888888888888888888888888888888"
            },
            {
              scope: "solvency_anchor_execution",
              keyReference: "kms://launch/solvency-anchor",
              signerAddress: "0x4444444444444444444444444444444444444444"
            },
            {
              scope: "incident_package_release",
              keyReference: "safe://launch/incident-release",
              signerAddress: "0x9999999999999999999999999999999999999999"
            },
            {
              scope: "governance_admin",
              keyReference: "safe://launch/governance-admin",
              signerAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            }
          ]
        },
        contracts: [
          {
            productSurface: "staking_v1",
            version: "1.0.0",
            address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            abiChecksumSha256:
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
          },
          {
            productSurface: "loan_book_v1",
            version: "1.0.0",
            address: "0xcccccccccccccccccccccccccccccccccccccccc",
            abiChecksumSha256:
              "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
          },
          {
            productSurface: "solvency_report_anchor_registry_v1",
            version: "1.0.0",
            address: "0x1111111111111111111111111111111111111111",
            abiChecksumSha256:
              "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
          }
        ],
        notes: {
          launchSummary: "Launch candidate ready for final governed review.",
          requestNote: "All evidence must remain current.",
          residualRiskNote: "No accepted residual risks."
        }
      },
      "ops_1",
      "operations_admin"
    );

    expect(transactionClient.releaseLaunchClosurePack.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          releaseIdentifier: "release-2026-04-08.1",
          environment: "production_like",
          version: 3,
          generatedByOperatorId: "ops_1",
          generatedByOperatorRole: "operations_admin",
          artifactChecksumSha256: expect.any(String),
          artifactPayload: expect.objectContaining({
            artifactManifest: expect.objectContaining({
              manifestChecksumSha256: expect.any(String),
              fileCount: expect.any(Number),
              files: expect.any(Array)
            }),
            outputSubpath: expect.any(String),
            files: expect.any(Array)
          })
        })
      })
    );
    expect(result.pack.version).toBe(3);
    expect(result.pack.manifestChecksumSha256).toEqual(expect.any(String));
    expect(result.pack.artifactManifest?.files.length).toBeGreaterThan(0);
    expect(result.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "current-status-summary.md"
        }),
        expect.objectContaining({
          relativePath: "operator-actions.md"
        })
      ])
    );
  });

  it("lists stored launch-closure packs with bounded filters", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseLaunchClosurePack.findMany as jest.Mock).mockResolvedValue([
      buildLaunchClosurePackRecord()
    ]);
    (prismaService.releaseLaunchClosurePack.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listLaunchClosurePacks({
      limit: 20,
      releaseIdentifier: "release-2026-04-08.1",
      environment: "production_like",
      sinceDays: 30
    });

    expect(prismaService.releaseLaunchClosurePack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          releaseIdentifier: expect.objectContaining({
            equals: "release-2026-04-08.1"
          }),
          environment: "production_like",
          createdAt: expect.any(Object)
        }),
        take: 20
      })
    );
    expect(result.totalCount).toBe(1);
    expect(result.packs[0]?.id).toBe("pack_1");
  });

  it("retrieves a stored launch-closure pack by id", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord()
    );

    const result = await service.getLaunchClosurePack("pack_1");

    expect(result.pack.id).toBe("pack_1");
    expect(result.pack.artifactChecksumSha256).toEqual(expect.any(String));
  });

  it("verifies stored launch-closure pack artifact integrity", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildVerifiableLaunchClosurePackRecord()
    );

    const result = await service.verifyLaunchClosurePackIntegrity("pack_1");

    expect(result.valid).toBe(true);
    expect(result.artifactChecksumMatches).toBe(true);
    expect(result.checkedFileCount).toBe(2);
    expect(result.issues).toEqual([]);
  });

  it("reports stored launch-closure pack artifact drift", async () => {
    const { service, prismaService } = createService();
    const pack = buildVerifiableLaunchClosurePackRecord();
    const payload = pack.artifactPayload as {
      files: Array<{
        relativePath: string;
        content: string;
      }>;
    };
    payload.files = payload.files.filter(
      (file) => file.relativePath !== "manifest.json"
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      pack
    );

    const result = await service.verifyLaunchClosurePackIntegrity("pack_1");

    expect(result.valid).toBe(false);
    expect(result.artifactChecksumMatches).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "artifact_checksum_mismatch"
        }),
        expect.objectContaining({
          code: "file_missing",
          relativePath: "manifest.json"
        }),
        expect.objectContaining({
          code: "manifest_checksum_mismatch",
          relativePath: "manifest.json"
        })
      ])
    );
  });

  it("requests launch approval and snapshots checklist blockers from live evidence", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findFirst as jest.Mock).mockResolvedValue(
      null
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.create as jest.Mock
    ).mockResolvedValue(buildApprovalRecord());

    const result = await service.requestApproval(
      {
        releaseIdentifier: " release-2026-04-08.1 ",
        environment: "production_like",
        launchClosurePackId: "pack_1",
        rollbackReleaseIdentifier: " release-2026-04-07.3 ",
        summary: " Launch posture reviewed. ",
        securityConfigurationComplete: true,
        accessAndGovernanceComplete: true,
        dataAndRecoveryComplete: true,
        platformHealthComplete: true,
        functionalProofComplete: true,
        contractAndChainProofComplete: true,
        finalSignoffComplete: true,
        unresolvedRisksAccepted: true,
        openBlockers: []
      },
      "ops_1",
      "operations_admin"
    );

    expect(transactionClient.releaseReadinessApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          releaseIdentifier: "release-2026-04-08.1",
          environment: "production_like",
          launchClosurePackId: "pack_1",
          launchClosurePackVersion: 1,
          launchClosurePackChecksumSha256: expect.any(String),
          evidenceSnapshot: expect.any(Object),
          blockerSnapshot: expect.any(Object)
        })
      })
    );
    expect(prismaService.releaseReadinessEvidence.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          releaseIdentifier: "release-2026-04-08.1"
        })
      })
    );
    expect(transactionClient.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(result.approval.gate.overallStatus).toBe("ready");
    expect(result.approval.gate.approvalEligible).toBe(true);
    expect(result.approval.gate.staleEvidenceTypes).toEqual([]);
    expect(result.approval.launchClosurePack?.manifestChecksumSha256).toEqual(
      expect.any(String)
    );
    expect(result.approval.launchClosureDrift).toEqual(
      expect.objectContaining({
        changed: false,
        critical: false,
        newerPackAvailable: false
      })
    );
  });

  it("computes live drift for pending approvals against the stored snapshot and latest pack", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord({
        blockerSnapshot: {
          overallStatus: "blocked",
          approvalEligible: false,
          missingChecklistItems: [],
          missingEvidenceTypes: ["critical_alert_reescalation"],
          failedEvidenceTypes: [],
          staleEvidenceTypes: [],
          metadataMismatches: [],
          maximumEvidenceAgeHours: 72,
          openBlockers: [],
          generatedAt: "2026-04-08T12:00:00.000Z"
        },
        evidenceSnapshot: {
          generatedAt: "2026-04-08T12:00:00.000Z",
          overallStatus: "warning",
          summary: {
            requiredCheckCount: 12,
            passedCheckCount: 11,
            failedCheckCount: 0,
            pendingCheckCount: 1
          },
          requiredChecks: []
        }
      })
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (prismaService.releaseLaunchClosurePack.findFirst as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord({
        id: "pack_2",
        version: 2
      })
    );

    const result = await service.getApproval("approval_1");

    expect(result.approval.launchClosureDrift).toEqual(
      expect.objectContaining({
        changed: true,
        critical: true,
        currentOverallStatus: "ready",
        missingEvidenceTypesResolved: ["critical_alert_reescalation"],
        newerPackAvailable: true,
        latestPack: expect.objectContaining({
          id: "pack_2",
          version: 2
        })
      })
    );
  });

  it("blocks approval when critical drift exists against the bound launch-closure pack", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord({
        blockerSnapshot: {
          overallStatus: "blocked",
          approvalEligible: false,
          missingChecklistItems: [],
          missingEvidenceTypes: ["critical_alert_reescalation"],
          failedEvidenceTypes: [],
          staleEvidenceTypes: [],
          metadataMismatches: [],
          maximumEvidenceAgeHours: 72,
          openBlockers: [],
          generatedAt: "2026-04-08T12:00:00.000Z"
        }
      })
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (prismaService.releaseLaunchClosurePack.findFirst as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord({
        id: "pack_2",
        version: 2
      })
    );

    await expect(
      service.approveApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          approvalNote: "Approved"
        },
        "approver_1",
        "risk_manager"
      )
    ).rejects.toThrow(
      "Launch approval is blocked until the bound launch-closure pack is refreshed for current live posture."
    );
  });

  it("rebinds a pending approval to a newer scoped launch-closure pack", async () => {
    const { service, prismaService, transactionClient } = createService();
    const nextLaunchClosurePack = buildLaunchClosurePackRecord({
      id: "pack_2",
      version: 2
    });
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      nextLaunchClosurePack
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    ).mockResolvedValue(buildApprovalRecord());
    (
      transactionClient.releaseReadinessApproval.findFirst as jest.Mock
    ).mockResolvedValue(null);
    (
      transactionClient.releaseReadinessApproval.create as jest.Mock
    ).mockResolvedValue(
      buildApprovalRecord({
        id: "approval_2",
        supersedesApprovalId: "approval_1",
        launchClosurePackId: "pack_2",
        launchClosurePackVersion: 2,
        launchClosurePackChecksumSha256:
          nextLaunchClosurePack.artifactChecksumSha256,
        blockerSnapshot: {
          overallStatus: "ready",
          approvalEligible: true,
          missingChecklistItems: [],
          missingEvidenceTypes: [],
          failedEvidenceTypes: [],
          staleEvidenceTypes: [],
          metadataMismatches: [],
          maximumEvidenceAgeHours: 72,
          openBlockers: [],
          generatedAt: "2026-04-08T12:00:00.000Z"
        }
      })
    );

    const result = await service.rebindApprovalToLaunchClosurePack(
      "approval_1",
      "pack_2",
      approvalExpectedUpdatedAt,
      "ops_1",
      "operations_admin"
    );

    expect(transactionClient.releaseReadinessApproval.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "approval_1"
        },
        data: expect.objectContaining({
          status: ReleaseReadinessApprovalStatus.superseded,
          supersededByOperatorId: "ops_1",
          supersededByOperatorRole: "operations_admin",
          supersededByApprovalId: "approval_2",
          supersededAt: expect.any(Date)
        })
      })
    );
    expect(transactionClient.releaseReadinessApproval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          releaseIdentifier: "release-2026-04-08.1",
          environment: ReleaseReadinessEnvironment.production_like,
          supersedesApprovalId: "approval_1",
          launchClosurePackId: "pack_2",
          launchClosurePackVersion: 2,
          launchClosurePackChecksumSha256: expect.any(String),
          status: ReleaseReadinessApprovalStatus.pending_approval
        })
      })
    );
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "release_readiness.approval_pack_rebound",
          targetId: "approval_1",
          metadata: expect.objectContaining({
            supersededApprovalId: "approval_1",
            supersededByApprovalId: "approval_2",
            nextApprovalId: "approval_2",
            nextApprovalSupersedesApprovalId: "approval_1",
            nextLaunchClosurePackId: "pack_2"
          })
        })
      })
    );
    expect(result.approval.id).toBe("approval_2");
    expect(result.approval.supersedesApprovalId).toBe("approval_1");
    expect(result.approval.launchClosurePack?.id).toBe("pack_2");
    expect(result.approval.launchClosurePack?.manifestChecksumSha256).toEqual(
      expect.any(String)
    );
  });

  it("rejects rebind when the approval already references the requested pack", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );

    await expect(
      service.rebindApprovalToLaunchClosurePack(
        "approval_1",
        "pack_1",
        approvalExpectedUpdatedAt,
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Launch approval already references the requested launch-closure pack."
    );

    expect(transactionClient.releaseReadinessApproval.update).not.toHaveBeenCalled();
  });

  it("rejects rebind when the approval already points to a replacement approval", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord({
        supersededByApprovalId: "approval_2"
      })
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord({
        id: "pack_2",
        version: 2
      })
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    ).mockResolvedValue(
      buildApprovalRecord({
        supersededByApprovalId: "approval_2"
      })
    );

    await expect(
      service.rebindApprovalToLaunchClosurePack(
        "approval_1",
        "pack_2",
        approvalExpectedUpdatedAt,
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Launch approval already has a replacement approval in its lineage."
    );

    expect(transactionClient.releaseReadinessApproval.create).not.toHaveBeenCalled();
    expect(transactionClient.releaseReadinessApproval.update).not.toHaveBeenCalled();
  });

  it("rejects rebind when another approval already supersedes the target approval", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord({
        id: "pack_2",
        version: 2
      })
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    ).mockResolvedValue(buildApprovalRecord());
    (
      transactionClient.releaseReadinessApproval.findFirst as jest.Mock
    ).mockResolvedValue(
      buildApprovalRecord({
        id: "approval_2",
        status: ReleaseReadinessApprovalStatus.pending_approval,
        supersedesApprovalId: "approval_1"
      })
    );

    await expect(
      service.rebindApprovalToLaunchClosurePack(
        "approval_1",
        "pack_2",
        approvalExpectedUpdatedAt,
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Launch approval lineage already contains a replacement approval."
    );

    expect(transactionClient.releaseReadinessApproval.create).not.toHaveBeenCalled();
    expect(transactionClient.releaseReadinessApproval.update).not.toHaveBeenCalled();
  });

  it("rejects rebind when the approval snapshot is stale", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord({
        id: "pack_2",
        version: 2
      })
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    ).mockResolvedValue(
      buildApprovalRecord({
        updatedAt: new Date("2026-04-08T12:05:00.000Z")
      })
    );
    (
      transactionClient.releaseReadinessApproval.findFirst as jest.Mock
    ).mockResolvedValue(null);

    await expect(
      service.rebindApprovalToLaunchClosurePack(
        "approval_1",
        "pack_2",
        approvalExpectedUpdatedAt,
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Launch approval changed after it was loaded. Refresh approval data and retry."
    );

    expect(transactionClient.releaseReadinessApproval.create).not.toHaveBeenCalled();
    expect(transactionClient.releaseReadinessApproval.update).not.toHaveBeenCalled();
  });

  it("rejects rebind when lineage integrity for the selected approval is unhealthy", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord({
        id: "pack_2",
        version: 2
      })
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    )
      .mockResolvedValueOnce(
        buildApprovalRecord({
          supersedesApprovalId: "approval_missing"
        })
      )
      .mockResolvedValueOnce(null);

    await expect(
      service.rebindApprovalToLaunchClosurePack(
        "approval_1",
        "pack_2",
        approvalExpectedUpdatedAt,
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Launch approval lineage integrity must be healthy before this action can proceed. Refresh approval data and resolve lineage issues."
    );

    expect(transactionClient.releaseReadinessApproval.create).not.toHaveBeenCalled();
    expect(transactionClient.releaseReadinessApproval.update).not.toHaveBeenCalled();
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "release_readiness.approval_mutation_blocked",
          targetId: "approval_1",
          metadata: expect.objectContaining({
            attemptedAction: "rebind_pack",
            reason: "lineage_integrity_unhealthy",
            integrityStatus: "critical",
            selectedApprovalId: "approval_1"
          })
        })
      })
    );
  });

  it("reuses stored decision drift snapshots for non-pending approvals", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord({
        status: ReleaseReadinessApprovalStatus.approved,
        approvedByOperatorId: "approver_1",
        approvedByOperatorRole: "risk_manager",
        approvedAt: new Date("2026-04-08T13:00:00.000Z"),
        decisionDriftSnapshot: {
          changed: true,
          critical: true,
          blockingReasons: ["A newer launch-closure pack (pack_2) is available for this release scope."],
          currentOverallStatus: "ready",
          summaryDelta: {
            passedCheckCount: 2,
            failedCheckCount: 0,
            pendingCheckCount: -2
          },
          missingEvidenceTypesAdded: [],
          missingEvidenceTypesResolved: ["critical_alert_reescalation"],
          failedEvidenceTypesAdded: [],
          failedEvidenceTypesResolved: [],
          staleEvidenceTypesAdded: [],
          staleEvidenceTypesResolved: [],
          openBlockersAdded: [],
          openBlockersResolved: [],
          newerPackAvailable: true,
          latestPack: {
            id: "pack_2",
            version: 2
          }
        },
        decisionDriftCapturedAt: new Date("2026-04-08T13:00:00.000Z")
      })
    );

    const result = await service.getApproval("approval_1");

    expect(result.approval.status).toBe("approved");
    expect(result.approval.launchClosureDrift).toEqual(
      expect.objectContaining({
        changed: true,
        critical: true,
        newerPackAvailable: true
      })
    );
  });

  it("builds a verifiable launch decision receipt from the immutable approval pack", async () => {
    const { service, prismaService } = createService();
    const approvedAt = new Date("2026-04-08T13:00:00.000Z");
    const approval = buildApprovalRecord({
      status: ReleaseReadinessApprovalStatus.approved,
      approvedByOperatorId: "approver_1",
      approvedByOperatorRole: "risk_manager",
      approvalNote: "Approved for launch.",
      approvedAt,
      updatedAt: approvedAt
    });
    const pack = buildVerifiableLaunchClosurePackRecord();
    const auditEvent = {
      id: "audit_approval_1",
      actorType: "operator",
      actorId: "approver_1",
      action: "release_readiness.approval_approved",
      targetType: "ReleaseReadinessApproval",
      targetId: "approval_1",
      metadata: {
        releaseIdentifier: approval.releaseIdentifier
      },
      createdAt: approvedAt
    };

    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      approval
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      pack
    );
    (prismaService.auditEvent.findMany as jest.Mock).mockResolvedValue([
      auditEvent
    ]);

    const result = await service.getApprovalDecisionReceipt("approval_1");

    expect(result).toEqual(
      expect.objectContaining({
        receiptVersion: "release-readiness-approval-decision/v1",
        finalDecision: true,
        launchReady: true,
        blockers: [],
        decision: expect.objectContaining({
          status: "approved",
          decidedAt: approvedAt.toISOString(),
          decidedByOperatorId: "approver_1",
          note: "Approved for launch."
        }),
        launchClosurePack: expect.objectContaining({
          snapshotMatchesApproval: true,
          integrity: expect.objectContaining({
            valid: true
          })
        }),
        lineage: expect.objectContaining({
          status: "healthy",
          headApprovalId: "approval_1",
          tailApprovalId: "approval_1"
        }),
        auditTrail: [
          expect.objectContaining({
            id: "audit_approval_1",
            action: "release_readiness.approval_approved"
          })
        ],
        receiptChecksumSha256: expect.stringMatching(/^[a-f0-9]{64}$/)
      })
    );
    expect(prismaService.auditEvent.findMany).toHaveBeenCalledWith({
      where: {
        targetType: "ReleaseReadinessApproval",
        targetId: {
          in: ["approval_1"]
        },
        action: {
          startsWith: "release_readiness."
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });
  });

  it("returns the full approval lineage ordered from oldest to newest", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock)
      .mockResolvedValueOnce(
        buildApprovalRecord({
          id: "approval_2",
          status: ReleaseReadinessApprovalStatus.superseded,
          supersedesApprovalId: "approval_1",
          supersededByApprovalId: "approval_3"
        })
      )
      .mockResolvedValueOnce(
        buildApprovalRecord({
          id: "approval_1",
          status: ReleaseReadinessApprovalStatus.superseded,
          supersededByApprovalId: "approval_2"
        })
      )
      .mockResolvedValueOnce(
        buildApprovalRecord({
          id: "approval_3",
          status: ReleaseReadinessApprovalStatus.approved,
          supersedesApprovalId: "approval_2"
        })
      );

    const result = await service.getApprovalLineage("approval_2");

    expect(result.approval.id).toBe("approval_2");
    expect(result.currentMutationToken).toBe(approvalExpectedUpdatedAt);
    expect(result.lineage.map((approval) => approval.id)).toEqual([
      "approval_1",
      "approval_2",
      "approval_3"
    ]);
    expect(result.integrity).toEqual({
      status: "healthy",
      issues: [],
      headApprovalId: "approval_3",
      tailApprovalId: "approval_1",
      actionableApprovalId: null
    });
  });

  it("reports lineage integrity issues when linked approvals are missing", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock)
      .mockResolvedValueOnce(
        buildApprovalRecord({
          id: "approval_2",
          status: ReleaseReadinessApprovalStatus.superseded,
          supersedesApprovalId: "approval_1"
        })
      )
      .mockResolvedValueOnce(null);

    const result = await service.getApprovalLineage("approval_2");

    expect(result.lineage.map((approval) => approval.id)).toEqual(["approval_2"]);
    expect(result.integrity).toEqual({
      status: "critical",
      issues: [
        {
          code: "missing_previous_approval",
          approvalId: "approval_2",
          relatedApprovalId: "approval_1",
          description:
            "Approval approval_2 references missing previous approval approval_1."
        },
        {
          code: "superseded_head",
          approvalId: "approval_2",
          relatedApprovalId: null,
          description:
            "Latest approval approval_2 is superseded but has no valid replacement in the loaded lineage."
        }
      ],
      headApprovalId: "approval_2",
      tailApprovalId: "approval_2",
      actionableApprovalId: null
    });
  });

  it("returns the current actionable approval as a dedicated recovery target", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock)
      .mockResolvedValueOnce(
        buildApprovalRecord({
          id: "approval_1",
          status: ReleaseReadinessApprovalStatus.superseded,
          supersededByApprovalId: "approval_2"
        })
      )
      .mockResolvedValueOnce(
        buildApprovalRecord({
          id: "approval_2",
          supersedesApprovalId: "approval_1"
        })
      );

    const result = await service.getApprovalRecoveryTarget("approval_1");

    expect(result).toEqual({
      selectedApprovalId: "approval_1",
      actionableApproval: expect.objectContaining({
        id: "approval_2"
      }),
      currentMutationToken: approvalExpectedUpdatedAt,
      integrity: {
        status: "healthy",
        issues: [],
        headApprovalId: "approval_2",
        tailApprovalId: "approval_1",
        actionableApprovalId: "approval_2"
      }
    });
  });

  it("keeps launch approval blocked when the latest evidence belongs to another release", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findFirst as jest.Mock).mockResolvedValue(
      null
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock).mockImplementation(
      async (args?: {
        where?: {
          releaseIdentifier?: string;
        };
      }) => {
        if (args?.where?.releaseIdentifier === "release-2026-04-08.1") {
          return [];
        }

        return [
          buildEvidenceRecord({
            releaseIdentifier: "release-2026-04-07.9"
          })
        ];
      }
    );
    (
      transactionClient.releaseReadinessApproval.create as jest.Mock
    ).mockResolvedValue(buildApprovalRecord());

    const result = await service.requestApproval(
      {
        releaseIdentifier: "release-2026-04-08.1",
        environment: "production_like",
        launchClosurePackId: "pack_1",
        rollbackReleaseIdentifier: "release-2026-04-07.3",
        summary: "Launch posture reviewed.",
        securityConfigurationComplete: true,
        accessAndGovernanceComplete: true,
        dataAndRecoveryComplete: true,
        platformHealthComplete: true,
        functionalProofComplete: true,
        contractAndChainProofComplete: true,
        finalSignoffComplete: true,
        unresolvedRisksAccepted: true,
        openBlockers: []
      },
      "ops_1",
      "operations_admin"
    );

    expect(result.approval.gate.overallStatus).toBe("blocked");
    expect(result.approval.gate.approvalEligible).toBe(false);
    expect(result.approval.gate.missingEvidenceTypes).toEqual(
      expect.arrayContaining([
        ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
        ReleaseReadinessEvidenceType.end_to_end_finance_flows
      ])
    );
  });

  it("rejects launch approval requests when the referenced pack scope does not match", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findFirst as jest.Mock).mockResolvedValue(
      null
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord({
        releaseIdentifier: "release-2026-04-07.9"
      })
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);

    await expect(
      service.requestApproval(
        {
          releaseIdentifier: "release-2026-04-08.1",
          environment: "production_like",
          launchClosurePackId: "pack_1",
          rollbackReleaseIdentifier: "release-2026-04-07.3",
          summary: "Launch posture reviewed.",
          securityConfigurationComplete: true,
          accessAndGovernanceComplete: true,
          dataAndRecoveryComplete: true,
          platformHealthComplete: true,
          functionalProofComplete: true,
          contractAndChainProofComplete: true,
          finalSignoffComplete: true,
          unresolvedRisksAccepted: true,
          openBlockers: []
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Launch approval requests must reference a launch-closure pack for the same release identifier and environment."
    );

    expect(transactionClient.releaseReadinessApproval.create).not.toHaveBeenCalled();
  });

  it("rejects launch approval requests without rollback release identifier", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findFirst as jest.Mock).mockResolvedValue(
      null
    );

    await expect(
      service.requestApproval(
        {
          releaseIdentifier: "release-2026-04-08.1",
          environment: "production_like",
          launchClosurePackId: "pack_1",
          summary: "Launch posture reviewed.",
          securityConfigurationComplete: true,
          accessAndGovernanceComplete: true,
          dataAndRecoveryComplete: true,
          platformHealthComplete: true,
          functionalProofComplete: true,
          contractAndChainProofComplete: true,
          finalSignoffComplete: true,
          unresolvedRisksAccepted: true,
          openBlockers: []
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Launch approval requests require rollback release identifier."
    );

    expect(prismaService.releaseReadinessEvidence.findMany).not.toHaveBeenCalled();
    expect(transactionClient.releaseReadinessApproval.create).not.toHaveBeenCalled();
  });

  it("blocks launch approval when rollback drill evidence targets a different rollback release", async () => {
    const { service, prismaService, transactionClient } = createService();
    const rollbackEvidenceTypes = new Set<ReleaseReadinessEvidenceType>([
      ReleaseReadinessEvidenceType.api_rollback_drill,
      ReleaseReadinessEvidenceType.worker_rollback_drill
    ]);
    (prismaService.releaseReadinessApproval.findFirst as jest.Mock).mockResolvedValue(
      null
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(
        buildPassedRequiredEvidenceRecords().map((record) =>
          rollbackEvidenceTypes.has(
            record.evidenceType as ReleaseReadinessEvidenceType
          )
            ? {
                ...record,
                rollbackReleaseIdentifier: "release-2026-04-06.9"
              }
            : record
        )
      )
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.create as jest.Mock
    ).mockResolvedValue(buildApprovalRecord());

    const result = await service.requestApproval(
      {
        releaseIdentifier: "release-2026-04-08.1",
        environment: "production_like",
        launchClosurePackId: "pack_1",
        rollbackReleaseIdentifier: "release-2026-04-07.3",
        summary: "Launch posture reviewed.",
        securityConfigurationComplete: true,
        accessAndGovernanceComplete: true,
        dataAndRecoveryComplete: true,
        platformHealthComplete: true,
        functionalProofComplete: true,
        contractAndChainProofComplete: true,
        finalSignoffComplete: true,
        unresolvedRisksAccepted: true,
        openBlockers: []
      },
      "ops_1",
      "operations_admin"
    );

    expect(result.approval.gate.overallStatus).toBe("blocked");
    expect(result.approval.gate.approvalEligible).toBe(false);
    expect(result.approval.gate.metadataMismatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceType: ReleaseReadinessEvidenceType.api_rollback_drill
        }),
        expect.objectContaining({
          evidenceType: ReleaseReadinessEvidenceType.worker_rollback_drill
        })
      ])
    );
  });

  it("blocks launch approval requests for operators outside the request roster", async () => {
    const { service } = createService();

    await expect(
      service.requestApproval(
        {
          releaseIdentifier: "release-2026-04-08.1",
          environment: "production_like",
          launchClosurePackId: "pack_1",
          rollbackReleaseIdentifier: "release-2026-04-07.3",
          summary: "Launch posture reviewed.",
          securityConfigurationComplete: true,
          accessAndGovernanceComplete: true,
          dataAndRecoveryComplete: true,
          platformHealthComplete: true,
          functionalProofComplete: true,
          contractAndChainProofComplete: true,
          finalSignoffComplete: true,
          unresolvedRisksAccepted: true,
          openBlockers: []
        },
        "ops_1",
        "senior_operator"
      )
    ).rejects.toThrow(
      "Operator role is not authorized to request launch readiness approval."
    );
  });

  it("rejects duplicate pending approval requests for the same release and environment", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findFirst as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock).mockResolvedValue(
      buildPassedRequiredEvidenceRecords()
    );

    await expect(
      service.requestApproval(
        {
          releaseIdentifier: "release-2026-04-08.1",
          environment: "production_like",
          launchClosurePackId: "pack_1",
          rollbackReleaseIdentifier: "release-2026-04-07.3",
          summary: "Launch posture reviewed.",
          securityConfigurationComplete: true,
          accessAndGovernanceComplete: true,
          dataAndRecoveryComplete: true,
          platformHealthComplete: true,
          functionalProofComplete: true,
          contractAndChainProofComplete: true,
          finalSignoffComplete: true,
          unresolvedRisksAccepted: true,
          openBlockers: []
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "A pending launch approval already exists for this release identifier and environment."
    );
  });

  it("blocks approval when required evidence is still missing", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce([
        buildEvidenceRecord({
          evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo
        })
      ])
      .mockResolvedValueOnce([buildEvidenceRecord()]);

    await expect(
      service.approveApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          approvalNote: "Approved"
        },
        "approver_1",
        "risk_manager"
      )
    ).rejects.toThrow(
      "Launch approval is blocked until checklist gaps, failed or stale evidence, and open blockers are remediated."
    );
  });

  it("blocks self-approval so the requester cannot approve their own launch request", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );

    await expect(
      service.approveApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          approvalNote: "Approved"
        },
        "ops_1",
        "risk_manager"
      )
    ).rejects.toThrow(
      "Launch approval requires a different approver than the requester."
    );
  });

  it("blocks stale evidence from being reused for launch approval", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(
        buildPassedRequiredEvidenceRecords().map((record) => ({
          ...record,
          observedAt: new Date("2026-04-04T09:05:00.000Z")
        }))
      )
      .mockResolvedValueOnce([buildEvidenceRecord()])
      .mockResolvedValueOnce(
        buildPassedRequiredEvidenceRecords().map((record) => ({
          ...record,
          observedAt: new Date("2026-04-04T09:05:00.000Z")
        }))
      )
      .mockResolvedValueOnce([buildEvidenceRecord()]);

    await expect(
      service.approveApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          approvalNote: "Approved"
        },
        "approver_1",
        "risk_manager"
      )
    ).rejects.toThrow(
      "Launch approval is blocked until checklist gaps, failed or stale evidence, and open blockers are remediated."
    );

    const approval = await service.getApproval("approval_1");

    expect(approval.approval.gate.staleEvidenceTypes).toContain(
      ReleaseReadinessEvidenceType.platform_alert_delivery_slo
    );
    expect(approval.approval.gate.maximumEvidenceAgeHours).toBe(72);
  });

  it("approves launch readiness when the gate is healthy and operator role is allowed", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseLaunchClosurePack.findFirst as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    ).mockResolvedValue(buildApprovalRecord());
    (
      transactionClient.releaseReadinessApproval.update as jest.Mock
    ).mockResolvedValue(
      buildApprovalRecord({
        status: ReleaseReadinessApprovalStatus.approved,
        approvedByOperatorId: "approver_1",
        approvedByOperatorRole: "risk_manager",
        approvalNote: "Approved for launch.",
        approvedAt: new Date("2026-04-08T13:00:00.000Z"),
        blockerSnapshot: {
          overallStatus: "approved",
          approvalEligible: true,
          missingChecklistItems: [],
          missingEvidenceTypes: [],
          failedEvidenceTypes: [],
          staleEvidenceTypes: [],
          metadataMismatches: [],
          maximumEvidenceAgeHours: 72,
          openBlockers: [],
          generatedAt: "2026-04-08T13:00:00.000Z"
        },
        decisionDriftSnapshot: {
          changed: false,
          critical: false,
          blockingReasons: [],
          currentOverallStatus: "ready",
          summaryDelta: {
            passedCheckCount: 0,
            failedCheckCount: 0,
            pendingCheckCount: 0
          },
          missingEvidenceTypesAdded: [],
          missingEvidenceTypesResolved: [],
          failedEvidenceTypesAdded: [],
          failedEvidenceTypesResolved: [],
          staleEvidenceTypesAdded: [],
          staleEvidenceTypesResolved: [],
          openBlockersAdded: [],
          openBlockersResolved: [],
          newerPackAvailable: false,
          latestPack: null
        },
        decisionDriftCapturedAt: new Date("2026-04-08T13:00:00.000Z")
      })
    );

    const result = await service.approveApproval(
      "approval_1",
      {
        expectedUpdatedAt: approvalExpectedUpdatedAt,
        approvalNote: "Approved for launch."
      },
      "approver_1",
      "risk_manager"
    );

    expect(transactionClient.releaseReadinessApproval.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "approved",
          approvedByOperatorId: "approver_1",
          decisionDriftSnapshot: expect.objectContaining({
            changed: false,
            critical: false
          }),
          decisionDriftCapturedAt: expect.any(Date)
        })
      })
    );
    expect(result.approval.status).toBe("approved");
    expect(result.approval.gate.overallStatus).toBe("approved");
    expect(result.approval.launchClosureDrift).toEqual(
      expect.objectContaining({
        changed: false,
        critical: false
      })
    );
  });

  it("rejects approval when the approval snapshot is stale", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseLaunchClosurePack.findFirst as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    ).mockResolvedValue(
      buildApprovalRecord({
        updatedAt: new Date("2026-04-08T12:05:00.000Z")
      })
    );

    await expect(
      service.approveApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          approvalNote: "Approved for launch."
        },
        "approver_1",
        "risk_manager"
      )
    ).rejects.toThrow(
      "Launch approval changed after it was loaded. Refresh approval data and retry."
    );

    expect(transactionClient.releaseReadinessApproval.update).not.toHaveBeenCalled();
  });

  it("blocks approval when lineage integrity for the selected approval is unhealthy", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseLaunchClosurePack.findFirst as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    )
      .mockResolvedValueOnce(
        buildApprovalRecord({
          supersedesApprovalId: "approval_missing"
        })
      )
      .mockResolvedValueOnce(null);

    await expect(
      service.approveApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          approvalNote: "Approved for launch."
        },
        "approver_1",
        "risk_manager"
      )
    ).rejects.toThrow(
      "Launch approval lineage integrity must be healthy before this action can proceed. Refresh approval data and resolve lineage issues."
    );

    expect(transactionClient.releaseReadinessApproval.update).not.toHaveBeenCalled();
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "release_readiness.approval_mutation_blocked",
          targetId: "approval_1",
          metadata: expect.objectContaining({
            attemptedAction: "approve",
            reason: "lineage_integrity_unhealthy",
            integrityStatus: "critical",
            selectedApprovalId: "approval_1"
          })
        })
      })
    );
  });

  it("blocks approval for operator roles outside the launch-approval roster", async () => {
    const { service } = createService();

    await expect(
      service.approveApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          approvalNote: "Approved for launch."
        },
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Operator role is not authorized to approve or reject launch readiness."
    );
  });

  it("rejects launch readiness using the approver gate", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce([
        buildEvidenceRecord({
          evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo
        })
      ])
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    ).mockResolvedValue(buildApprovalRecord());
    (
      transactionClient.releaseReadinessApproval.update as jest.Mock
    ).mockResolvedValue(
      buildApprovalRecord({
        status: ReleaseReadinessApprovalStatus.rejected,
        rejectedByOperatorId: "approver_1",
        rejectedByOperatorRole: "risk_manager",
        rejectionNote: "Rollback drill evidence is missing.",
        rejectedAt: new Date("2026-04-08T13:00:00.000Z"),
        blockerSnapshot: {
          overallStatus: "rejected",
          approvalEligible: false,
          missingChecklistItems: [],
          missingEvidenceTypes: [
            ReleaseReadinessEvidenceType.critical_alert_reescalation
          ],
          failedEvidenceTypes: [],
          staleEvidenceTypes: [],
          metadataMismatches: [],
          maximumEvidenceAgeHours: 72,
          openBlockers: [],
          generatedAt: "2026-04-08T13:00:00.000Z"
        },
        decisionDriftSnapshot: {
          changed: true,
          critical: true,
          blockingReasons: ["Missing evidence was introduced for critical_alert_reescalation."],
          currentOverallStatus: "blocked",
          summaryDelta: {
            passedCheckCount: -1,
            failedCheckCount: 0,
            pendingCheckCount: 1
          },
          missingEvidenceTypesAdded: ["critical_alert_reescalation"],
          missingEvidenceTypesResolved: [],
          failedEvidenceTypesAdded: [],
          failedEvidenceTypesResolved: [],
          staleEvidenceTypesAdded: [],
          staleEvidenceTypesResolved: [],
          openBlockersAdded: [],
          openBlockersResolved: [],
          newerPackAvailable: false,
          latestPack: null
        },
        decisionDriftCapturedAt: new Date("2026-04-08T13:00:00.000Z")
      })
    );

    const result = await service.rejectApproval(
      "approval_1",
      {
        expectedUpdatedAt: approvalExpectedUpdatedAt,
        rejectionNote: "Rollback drill evidence is missing."
      },
      "approver_1",
      "risk_manager"
    );

    expect(result.approval.status).toBe("rejected");
    expect(result.approval.gate.overallStatus).toBe("rejected");
    expect(result.approval.launchClosureDrift).toEqual(
      expect.objectContaining({
        changed: true,
        critical: true
      })
    );
  });

  it("rejects rejection when the approval snapshot is stale", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce([
        buildEvidenceRecord({
          evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo
        })
      ])
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    ).mockResolvedValue(
      buildApprovalRecord({
        updatedAt: new Date("2026-04-08T12:05:00.000Z")
      })
    );

    await expect(
      service.rejectApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          rejectionNote: "Rollback drill evidence is missing."
        },
        "approver_1",
        "risk_manager"
      )
    ).rejects.toThrow(
      "Launch approval changed after it was loaded. Refresh approval data and retry."
    );

    expect(transactionClient.releaseReadinessApproval.update).not.toHaveBeenCalled();
  });

  it("blocks rejection when lineage integrity for the selected approval is unhealthy", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce([
        buildEvidenceRecord({
          evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo
        })
      ])
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.findUnique as jest.Mock
    )
      .mockResolvedValueOnce(
        buildApprovalRecord({
          supersedesApprovalId: "approval_missing"
        })
      )
      .mockResolvedValueOnce(null);

    await expect(
      service.rejectApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          rejectionNote: "Rejected from console."
        },
        "approver_1",
        "risk_manager"
      )
    ).rejects.toThrow(
      "Launch approval lineage integrity must be healthy before this action can proceed. Refresh approval data and resolve lineage issues."
    );

    expect(transactionClient.releaseReadinessApproval.update).not.toHaveBeenCalled();
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "release_readiness.approval_mutation_blocked",
          targetId: "approval_1",
          metadata: expect.objectContaining({
            attemptedAction: "reject",
            reason: "lineage_integrity_unhealthy",
            integrityStatus: "critical",
            selectedApprovalId: "approval_1"
          })
        })
      })
    );
  });

  it("blocks self-rejection so the requester cannot reject their own launch request", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );

    await expect(
      service.rejectApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          rejectionNote: "Rejected"
        },
        "ops_1",
        "risk_manager"
      )
    ).rejects.toThrow(
      "Launch approval requires a different approver than the requester."
    );
  });

  it("blocks approving an already-approved launch request", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord({
        status: ReleaseReadinessApprovalStatus.approved,
        approvedByOperatorId: "approver_1",
        approvedByOperatorRole: "risk_manager",
        approvedAt: new Date("2026-04-08T13:00:00.000Z")
      })
    );

    await expect(
      service.approveApproval(
        "approval_1",
        {
          expectedUpdatedAt: approvalExpectedUpdatedAt,
          approvalNote: "Approved for launch."
        },
        "approver_2",
        "risk_manager"
      )
    ).rejects.toThrow("Only pending launch approvals can be approved.");
  });
});
