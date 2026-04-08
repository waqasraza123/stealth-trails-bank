import {
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

function createService() {
  const transactionClient = {
    releaseReadinessEvidence: {
      create: jest.fn()
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
      create: jest.fn(),
      findUnique: jest.fn(),
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
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(result.summary.requiredCheckCount).toBe(5);
    expect(result.summary.passedCheckCount).toBe(2);
    expect(result.summary.failedCheckCount).toBe(1);
    expect(result.summary.pendingCheckCount).toBe(2);
    expect(
      result.requiredChecks.find(
        (check) =>
          check.evidenceType ===
          ReleaseReadinessEvidenceType.critical_alert_reescalation
      )?.status
    ).toBe("failed");
    expect(result.recentEvidence).toHaveLength(2);
  });
});
