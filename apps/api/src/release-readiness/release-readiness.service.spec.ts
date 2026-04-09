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
      maximumEvidenceAgeHours: 72,
      openBlockers: [],
      generatedAt: "2026-04-08T12:00:00.000Z"
    },
    requestedAt: new Date("2026-04-08T12:00:00.000Z"),
    approvedAt: null,
    rejectedAt: null,
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
      runbookPath: "docs/runbooks/restore-and-rollback-drills.md"
    }),
    buildEvidenceRecord({
      id: "evidence_4",
      evidenceType: ReleaseReadinessEvidenceType.api_rollback_drill,
      runbookPath: "docs/runbooks/restore-and-rollback-drills.md"
    }),
    buildEvidenceRecord({
      id: "evidence_5",
      evidenceType: ReleaseReadinessEvidenceType.worker_rollback_drill,
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
      sinceDays: 30
    });

    expect(prismaService.releaseReadinessEvidence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        where: expect.objectContaining({
          environment: "staging"
        })
      })
    );
    expect(result.totalCount).toBe(2);
    expect(result.evidence).toHaveLength(2);
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

    const result = await service.getSummary();

    expect(result.overallStatus).toBe("critical");
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

  it("requests launch approval and snapshots checklist blockers from live evidence", async () => {
    const { service, prismaService, transactionClient } = createService();
    (prismaService.releaseReadinessApproval.findFirst as jest.Mock).mockResolvedValue(
      null
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
          evidenceSnapshot: expect.any(Object),
          blockerSnapshot: expect.any(Object)
        })
      })
    );
    expect(transactionClient.auditEvent.create).toHaveBeenCalledTimes(1);
    expect(result.approval.gate.overallStatus).toBe("ready");
    expect(result.approval.gate.approvalEligible).toBe(true);
    expect(result.approval.gate.staleEvidenceTypes).toEqual([]);
  });

  it("blocks launch approval requests for operators outside the request roster", async () => {
    const { service } = createService();

    await expect(
      service.requestApproval(
        {
          releaseIdentifier: "release-2026-04-08.1",
          environment: "production_like",
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
          maximumEvidenceAgeHours: 72,
          openBlockers: [],
          generatedAt: "2026-04-08T13:00:00.000Z"
        }
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
          approvedByOperatorId: "approver_1"
        })
      })
    );
    expect(result.approval.status).toBe("approved");
    expect(result.approval.gate.overallStatus).toBe("approved");
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
          maximumEvidenceAgeHours: 72,
          openBlockers: [],
          generatedAt: "2026-04-08T13:00:00.000Z"
        }
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
