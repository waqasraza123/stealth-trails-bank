import {
  ReleaseReadinessApprovalStatus,
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceStatus,
  ReleaseReadinessEvidenceType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseReadinessService } from "./release-readiness.service";

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
  return {
    id: "approval_1",
    releaseIdentifier: "release-2026-04-08.1",
    environment: ReleaseReadinessEnvironment.production_like,
    launchClosurePackId: "pack_1",
    launchClosurePackVersion: 1,
    launchClosurePackChecksumSha256: "checksum_1",
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
        requiredCheckCount: 10,
        passedCheckCount: 10,
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
    launchClosurePack: buildLaunchClosurePackRecord(),
    ...overrides
  };
}

function buildLaunchClosurePackRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "pack_1",
    releaseIdentifier: "release-2026-04-08.1",
    environment: ReleaseReadinessEnvironment.production_like,
    version: 1,
    generatedByOperatorId: "ops_1",
    generatedByOperatorRole: "operations_admin",
    artifactChecksumSha256: "checksum_1",
    artifactPayload: {
      manifest: {
        releaseIdentifier: "release-2026-04-08.1"
      },
      files: []
    },
    createdAt: new Date("2026-04-08T12:00:00.000Z"),
    updatedAt: new Date("2026-04-08T12:00:00.000Z"),
    ...overrides
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
      runbookPath: "docs/runbooks/restore-and-rollback-drills.md"
    }),
    buildEvidenceRecord({
      id: "evidence_5",
      evidenceType: ReleaseReadinessEvidenceType.worker_rollback_drill,
      rollbackReleaseIdentifier: "release-2026-04-07.3",
      runbookPath: "docs/runbooks/restore-and-rollback-drills.md"
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
      update: jest.fn()
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
    auditEvent: {
      create: jest.fn()
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
    (
      prismaService.releaseReadinessApproval.findMany as jest.Mock
    ).mockResolvedValue([
      buildApprovalRecord({
        id: "approval_2",
        status: ReleaseReadinessApprovalStatus.approved,
        approvedByOperatorId: "approver_1",
        approvedByOperatorRole: "risk_manager",
        approvedAt: new Date("2026-04-08T13:00:00.000Z")
      })
    ]);
    (prismaService.releaseReadinessApproval.count as jest.Mock).mockResolvedValue(1);

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
    expect(result.summary.requiredCheckCount).toBe(10);
    expect(result.summary.passedCheckCount).toBe(2);
    expect(result.summary.failedCheckCount).toBe(1);
    expect(result.summary.pendingCheckCount).toBe(7);
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
        artifacts: {
          apiReleaseId: "api-1",
          workerReleaseId: "worker-1",
          approvalRollbackReleaseId: "launch-rollback-1",
          apiRollbackReleaseId: "api-rollback-1",
          workerRollbackReleaseId: "worker-rollback-1",
          backupReference: "backup-1"
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
            outputSubpath: expect.any(String),
            files: expect.any(Array)
          })
        })
      })
    );
    expect(result.pack.version).toBe(3);
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
    expect(result.pack.artifactChecksumSha256).toBe("checksum_1");
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
          launchClosurePackChecksumSha256: "checksum_1",
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
            requiredCheckCount: 10,
            passedCheckCount: 9,
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
        version: 2,
        artifactChecksumSha256: "checksum_2"
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
          version: 2,
          artifactChecksumSha256: "checksum_2"
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
        version: 2,
        artifactChecksumSha256: "checksum_2"
      })
    );

    await expect(
      service.approveApproval(
        "approval_1",
        {
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
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );
    (prismaService.releaseLaunchClosurePack.findUnique as jest.Mock).mockResolvedValue(
      buildLaunchClosurePackRecord({
        id: "pack_2",
        version: 2,
        artifactChecksumSha256: "checksum_2"
      })
    );
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
    (
      transactionClient.releaseReadinessApproval.create as jest.Mock
    ).mockResolvedValue(
      buildApprovalRecord({
        id: "approval_2",
        supersedesApprovalId: "approval_1",
        launchClosurePackId: "pack_2",
        launchClosurePackVersion: 2,
        launchClosurePackChecksumSha256: "checksum_2",
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
          launchClosurePackChecksumSha256: "checksum_2",
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
        "ops_1",
        "operations_admin"
      )
    ).rejects.toThrow(
      "Launch approval already references the requested launch-closure pack."
    );

    expect(transactionClient.releaseReadinessApproval.update).not.toHaveBeenCalled();
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
            version: 2,
            artifactChecksumSha256: "checksum_2"
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
    (prismaService.releaseReadinessEvidence.findMany as jest.Mock)
      .mockResolvedValueOnce(buildPassedRequiredEvidenceRecords())
      .mockResolvedValueOnce([buildEvidenceRecord()]);
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

  it("blocks approval for operator roles outside the launch-approval roster", async () => {
    const { service } = createService();

    await expect(
      service.approveApproval(
        "approval_1",
        {
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

  it("blocks self-rejection so the requester cannot reject their own launch request", async () => {
    const { service, prismaService } = createService();
    (prismaService.releaseReadinessApproval.findUnique as jest.Mock).mockResolvedValue(
      buildApprovalRecord()
    );

    await expect(
      service.rejectApproval(
        "approval_1",
        {
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
          approvalNote: "Approved for launch."
        },
        "approver_2",
        "risk_manager"
      )
    ).rejects.toThrow("Only pending launch approvals can be approved.");
  });
});
