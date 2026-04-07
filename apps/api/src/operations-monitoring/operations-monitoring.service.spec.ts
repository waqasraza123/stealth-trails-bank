import {
  LedgerReconciliationScanRunStatus,
  PlatformAlertCategory,
  PlatformAlertRoutingStatus,
  PlatformAlertRoutingTargetType,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  ReviewCaseStatus,
  ReviewCaseType,
  WorkerRuntimeExecutionMode,
  WorkerRuntimeEnvironment,
  WorkerRuntimeIterationStatus
} from "@prisma/client";
import { ApiRequestMetricsService } from "../logging/api-request-metrics.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { PlatformAlertDeliveryService } from "./platform-alert-delivery.service";
import { OperationsMonitoringService } from "./operations-monitoring.service";

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  }),
  loadPlatformAlertAutomationRuntimeConfig: () => ({
    policies: [
      {
        name: "critical-worker-auto-route",
        categories: ["worker"],
        minimumSeverity: "critical",
        autoRouteToReviewCase: true,
        routeNote: "Escalate worker outages immediately."
      }
    ]
  })
}));

function buildHeartbeatRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "heartbeat_1",
    workerId: "worker_1",
    environment: WorkerRuntimeEnvironment.production,
    executionMode: WorkerRuntimeExecutionMode.monitor,
    lastIterationStatus: WorkerRuntimeIterationStatus.succeeded,
    lastHeartbeatAt: new Date("2026-04-06T10:00:00.000Z"),
    lastIterationStartedAt: new Date("2026-04-06T09:59:58.000Z"),
    lastIterationCompletedAt: new Date("2026-04-06T10:00:00.000Z"),
    consecutiveFailureCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastReconciliationScanRunId: "scan_run_1",
    lastReconciliationScanStartedAt: new Date("2026-04-06T09:55:00.000Z"),
    lastReconciliationScanCompletedAt: new Date("2026-04-06T09:55:01.000Z"),
    lastReconciliationScanStatus: LedgerReconciliationScanRunStatus.succeeded,
    runtimeMetadata: {
      pollIntervalMs: 1000
    },
    latestIterationMetrics: {
      queuedDepositCount: 1,
      manualWithdrawalBacklogCount: 0
    },
    createdAt: new Date("2026-04-06T09:00:00.000Z"),
    updatedAt: new Date("2026-04-06T10:00:00.000Z"),
    ...overrides
  };
}

function buildPlatformAlertRecord(
  overrides: Partial<Record<string, unknown>> = {}
) {
  return {
    id: "alert_1",
    dedupeKey: "worker:degraded:worker_1",
    category: PlatformAlertCategory.worker,
    severity: PlatformAlertSeverity.warning,
    status: PlatformAlertStatus.open,
    routingStatus: PlatformAlertRoutingStatus.unrouted,
    routingTargetType: null,
    routingTargetId: null,
    routedAt: null,
    routedByOperatorId: null,
    routingNote: null,
    ownerOperatorId: null,
    ownerAssignedAt: null,
    ownerAssignedByOperatorId: null,
    ownershipNote: null,
    acknowledgedAt: null,
    acknowledgedByOperatorId: null,
    acknowledgementNote: null,
    suppressedUntil: null,
    suppressedByOperatorId: null,
    suppressionNote: null,
    code: "worker_runtime_degraded",
    summary: "Worker worker_1 is degraded.",
    detail: "Iteration status is failed.",
    metadata: {
      workerId: "worker_1"
    },
    firstDetectedAt: new Date("2026-04-06T10:00:00.000Z"),
    lastDetectedAt: new Date("2026-04-06T10:00:00.000Z"),
    resolvedAt: null,
    createdAt: new Date("2026-04-06T10:00:00.000Z"),
    updatedAt: new Date("2026-04-06T10:00:00.000Z"),
    ...overrides
  };
}

function createService() {
  const transactionClient = {
    platformAlert: {
      findUnique: jest.fn(),
      update: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    }
  };
  const prismaService = {
    $transaction: jest.fn(async (callback: (client: typeof transactionClient) => unknown) =>
      callback(transactionClient)
    ),
    workerRuntimeHeartbeat: {
      upsert: jest.fn(),
      findMany: jest.fn()
    },
    transactionIntent: {
      count: jest.fn(),
      findFirst: jest.fn()
    },
    blockchainTransaction: {
      count: jest.fn(),
      findFirst: jest.fn()
    },
    ledgerReconciliationMismatch: {
      count: jest.fn()
    },
    ledgerReconciliationScanRun: {
      count: jest.fn(),
      findFirst: jest.fn()
    },
    wallet: {
      count: jest.fn()
    },
    reviewCase: {
      count: jest.fn()
    },
    oversightIncident: {
      count: jest.fn()
    },
    customerAccount: {
      count: jest.fn()
    },
    auditEvent: {
      create: jest.fn()
    },
    platformAlert: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn()
    },
    platformAlertDelivery: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn()
    }
  } as unknown as PrismaService;
  const reviewCasesService = {
    openOrReuseReviewCase: jest.fn()
  } as unknown as ReviewCasesService;
  const platformAlertDeliveryService = {
    enqueueAlertEvent: jest.fn().mockResolvedValue(0),
    retryFailedDeliveriesForAlert: jest.fn().mockResolvedValue(0)
  } as unknown as PlatformAlertDeliveryService;

  return {
    prismaService,
    reviewCasesService,
    platformAlertDeliveryService,
    transactionClient,
    service: new OperationsMonitoringService(
      prismaService,
      reviewCasesService,
      platformAlertDeliveryService
    )
  };
}

function mockHealthySnapshotQueries(prismaService: PrismaService) {
  (prismaService.workerRuntimeHeartbeat.findMany as jest.Mock).mockResolvedValue([
    buildHeartbeatRecord()
  ]);
  (prismaService.transactionIntent.count as jest.Mock)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0);
  (prismaService.transactionIntent.findFirst as jest.Mock).mockResolvedValue({
    createdAt: new Date("2026-04-06T09:59:00.000Z")
  });
  (prismaService.blockchainTransaction.count as jest.Mock)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0);
  (prismaService.blockchainTransaction.findFirst as jest.Mock).mockResolvedValue(
    null
  );
  (prismaService.ledgerReconciliationMismatch.count as jest.Mock)
    .mockResolvedValueOnce(0)
    .mockResolvedValueOnce(0);
  (prismaService.ledgerReconciliationScanRun.count as jest.Mock).mockResolvedValue(
    0
  );
  (prismaService.ledgerReconciliationScanRun.findFirst as jest.Mock).mockResolvedValue(
    {
      status: LedgerReconciliationScanRunStatus.succeeded,
      startedAt: new Date("2026-04-06T09:55:00.000Z")
    }
  );
  (prismaService.wallet.count as jest.Mock)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(1);
  (prismaService.reviewCase.count as jest.Mock).mockResolvedValue(2);
  (prismaService.oversightIncident.count as jest.Mock).mockResolvedValue(1);
  (prismaService.customerAccount.count as jest.Mock).mockResolvedValue(0);
}

describe("OperationsMonitoringService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("records worker heartbeat updates and resets consecutive failures after a successful iteration", async () => {
    const { service, prismaService } = createService();
    const stored = buildHeartbeatRecord();

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );
    (prismaService.workerRuntimeHeartbeat.upsert as jest.Mock).mockResolvedValue(
      stored
    );

    const result = await service.reportWorkerRuntimeHeartbeat("worker_1", {
      environment: "production",
      executionMode: "monitor",
      lastIterationStatus: "succeeded",
      lastIterationStartedAt: "2026-04-06T09:59:58.000Z",
      lastIterationCompletedAt: "2026-04-06T10:00:00.000Z",
      lastReconciliationScanRunId: "scan_run_1",
      lastReconciliationScanStatus: "succeeded",
      runtimeMetadata: {
        pollIntervalMs: 1000
      },
      latestIterationMetrics: {
        queuedDepositCount: 1
      },
      lastIterationDurationMs: 2000
    });

    expect(prismaService.workerRuntimeHeartbeat.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          consecutiveFailureCount: 0,
          lastIterationStatus: WorkerRuntimeIterationStatus.succeeded
        })
      })
    );
    expect(result.heartbeat.healthStatus).toBe("healthy");
  });

  it("classifies workers as degraded when the latest reconciliation scan failed", async () => {
    const { service, prismaService } = createService();
    const degraded = buildHeartbeatRecord({
      lastReconciliationScanStatus: LedgerReconciliationScanRunStatus.failed
    });

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );
    (prismaService.workerRuntimeHeartbeat.findMany as jest.Mock).mockResolvedValue([
      degraded
    ]);

    const result = await service.listWorkerRuntimeHealth({
      staleAfterSeconds: 120
    });

    expect(result.workers[0]?.healthStatus).toBe("degraded");
  });

  it("classifies workers as stale when the last heartbeat is too old", async () => {
    const { service, prismaService } = createService();
    const stale = buildHeartbeatRecord({
      lastHeartbeatAt: new Date("2026-04-06T09:55:00.000Z")
    });

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );
    (prismaService.workerRuntimeHeartbeat.findMany as jest.Mock).mockResolvedValue([
      stale
    ]);

    const result = await service.listWorkerRuntimeHealth({
      staleAfterSeconds: 120
    });

    expect(result.workers[0]?.healthStatus).toBe("stale");
  });

  it("builds operations status and persists open alerts for degraded worker and reconciliation failures", async () => {
    const { service, prismaService } = createService();

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );

    (prismaService.workerRuntimeHeartbeat.findMany as jest.Mock).mockResolvedValue([
      buildHeartbeatRecord({
        lastIterationStatus: WorkerRuntimeIterationStatus.failed,
        consecutiveFailureCount: 2,
        lastErrorMessage: "RPC timeout"
      })
    ]);
    (prismaService.transactionIntent.count as jest.Mock)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3);
    (prismaService.transactionIntent.findFirst as jest.Mock).mockResolvedValue({
      createdAt: new Date("2026-04-06T09:50:00.000Z")
    });
    (prismaService.blockchainTransaction.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);
    (prismaService.blockchainTransaction.findFirst as jest.Mock).mockResolvedValue(
      {
        createdAt: new Date("2026-04-06T08:45:00.000Z")
      }
    );
    (prismaService.ledgerReconciliationMismatch.count as jest.Mock)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2);
    (prismaService.ledgerReconciliationScanRun.count as jest.Mock).mockResolvedValue(
      1
    );
    (prismaService.ledgerReconciliationScanRun.findFirst as jest.Mock).mockResolvedValue(
      {
        status: LedgerReconciliationScanRunStatus.failed,
        startedAt: new Date("2026-04-06T09:59:00.000Z")
      }
    );
    (prismaService.wallet.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    (prismaService.reviewCase.count as jest.Mock).mockResolvedValue(14);
    (prismaService.oversightIncident.count as jest.Mock).mockResolvedValue(6);
    (prismaService.customerAccount.count as jest.Mock).mockResolvedValue(5);
    (prismaService.platformAlert.create as jest.Mock).mockResolvedValue(
      buildPlatformAlertRecord()
    );
    (prismaService.platformAlert.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildPlatformAlertRecord(),
        buildPlatformAlertRecord({
          id: "alert_2",
          dedupeKey: "reconciliation:core-health",
          category: PlatformAlertCategory.reconciliation,
          severity: PlatformAlertSeverity.critical,
          code: "ledger_reconciliation_attention_required",
          summary: "Ledger reconciliation requires operator attention."
        })
      ]);
    (prismaService.platformAlert.count as jest.Mock)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const result = await service.getOperationsStatus({
      recentAlertLimit: 8,
      staleAfterSeconds: 180
    });

    expect(result.workerHealth.status).toBe("warning");
    expect(result.queueHealth.status).toBe("warning");
    expect(result.chainHealth.status).toBe("warning");
    expect(result.reconciliationHealth.status).toBe("critical");
    expect(result.treasuryHealth.status).toBe("healthy");
    expect(result.alertSummary.openCount).toBe(2);
    expect(prismaService.platformAlert.create).toHaveBeenCalled();
    expect(prismaService.platformAlert.updateMany).not.toHaveBeenCalled();
  });

  it("lists platform alerts after refreshing durable alert state", async () => {
    const { service, prismaService } = createService();

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );

    mockHealthySnapshotQueries(prismaService);
    (prismaService.platformAlert.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          dedupeKey: "worker:stale:worker_legacy"
        }
      ])
      .mockResolvedValueOnce([
        buildPlatformAlertRecord({
          status: PlatformAlertStatus.resolved,
          resolvedAt: new Date("2026-04-06T10:00:30.000Z")
        })
      ]);
    (prismaService.platformAlert.count as jest.Mock).mockResolvedValue(1);

    const result = await service.listPlatformAlerts({
      limit: 20,
      status: "resolved"
    });

    expect(prismaService.platformAlert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dedupeKey: {
            in: ["worker:stale:worker_legacy"]
          }
        })
      })
    );
    expect(result.totalCount).toBe(1);
    expect(result.alerts[0]?.status).toBe("resolved");
  });

  it("renders Prometheus metrics from request and operations state", async () => {
    const { service, prismaService } = createService();
    const requestMetrics = new ApiRequestMetricsService();

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );
    mockHealthySnapshotQueries(prismaService);
    (prismaService.platformAlert.create as jest.Mock).mockResolvedValue(
      buildPlatformAlertRecord()
    );
    (prismaService.platformAlert.updateMany as jest.Mock).mockResolvedValue({
      count: 0
    });
    (prismaService.platformAlert.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([buildPlatformAlertRecord()]);

    requestMetrics.recordRequestStarted();
    requestMetrics.recordRequestCompleted({
      method: "GET",
      routePath: "/operations/internal/status",
      statusCode: 200,
      actorType: "operator",
      durationMs: 120
    });

    const result = await service.renderPrometheusMetrics(
      {
        staleAfterSeconds: 180
      },
      requestMetrics
    );

    expect(result).toContain("stb_api_http_requests_total");
    expect(result).toContain("stb_operations_workers_total");
    expect(result).toContain("stb_platform_alerts_open_total");
    expect(result).toContain("stb_worker_latest_iteration_metric");
    expect(result).toContain('category="worker"');
  });

  it("assigns an owner to an open platform alert", async () => {
    const { service, prismaService } = createService();
    const openAlert = buildPlatformAlertRecord();
    const updatedAlert = buildPlatformAlertRecord({
      ownerOperatorId: "ops_1",
      ownerAssignedAt: new Date("2026-04-06T10:05:00.000Z"),
      ownerAssignedByOperatorId: "ops_2",
      ownershipNote: "Taking primary ownership."
    });

    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(openAlert);
    (prismaService.platformAlert.update as jest.Mock).mockResolvedValue(updatedAlert);

    const result = await service.assignPlatformAlertOwner(
      openAlert.id,
      "ops_2",
      "ops_1",
      "Taking primary ownership."
    );

    expect(prismaService.platformAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ownerOperatorId: "ops_1",
          ownerAssignedByOperatorId: "ops_2"
        })
      })
    );
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "platform_alert.owner_assigned",
          targetId: openAlert.id
        })
      })
    );
    expect(result.alert.ownerOperatorId).toBe("ops_1");
    expect(result.stateReused).toBe(false);
  });

  it("acknowledges an open platform alert once", async () => {
    const { service, prismaService } = createService();
    const openAlert = buildPlatformAlertRecord();
    const updatedAlert = buildPlatformAlertRecord({
      acknowledgedAt: new Date("2026-04-06T10:06:00.000Z"),
      acknowledgedByOperatorId: "ops_1",
      acknowledgementNote: "Investigating now."
    });

    (prismaService.platformAlert.findUnique as jest.Mock).mockResolvedValue(openAlert);
    (prismaService.platformAlert.update as jest.Mock).mockResolvedValue(updatedAlert);

    const result = await service.acknowledgePlatformAlert(
      openAlert.id,
      "ops_1",
      "Investigating now."
    );

    expect(prismaService.platformAlert.update).toHaveBeenCalled();
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "platform_alert.acknowledged",
          targetId: openAlert.id
        })
      })
    );
    expect(result.alert.isAcknowledged).toBe(true);
    expect(result.stateReused).toBe(false);
  });

  it("suppresses and clears suppression for an open platform alert", async () => {
    const { service, prismaService } = createService();
    const openAlert = buildPlatformAlertRecord();
    const suppressedUntil = new Date("2026-04-06T11:00:00.000Z");
    const suppressedAlert = buildPlatformAlertRecord({
      suppressedUntil,
      suppressedByOperatorId: "ops_1",
      suppressionNote: "Known maintenance window."
    });
    const unsuppressedAlert = buildPlatformAlertRecord({
      suppressedUntil: null,
      suppressedByOperatorId: null,
      suppressionNote: "Suppression cleared after maintenance."
    });

    jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-04-06T10:00:00.000Z").getTime());
    (prismaService.platformAlert.findUnique as jest.Mock)
      .mockResolvedValueOnce(openAlert)
      .mockResolvedValueOnce(suppressedAlert);
    (prismaService.platformAlert.update as jest.Mock)
      .mockResolvedValueOnce(suppressedAlert)
      .mockResolvedValueOnce(unsuppressedAlert);

    const suppressedResult = await service.suppressPlatformAlert(
      openAlert.id,
      "ops_1",
      suppressedUntil,
      "Known maintenance window."
    );
    const clearedResult = await service.clearPlatformAlertSuppression(
      openAlert.id,
      "ops_1",
      "Suppression cleared after maintenance."
    );

    expect(prismaService.auditEvent.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          action: "platform_alert.suppressed"
        })
      })
    );
    expect(prismaService.auditEvent.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          action: "platform_alert.suppression_cleared"
        })
      })
    );
    expect(suppressedResult.alert.hasActiveSuppression).toBe(true);
    expect(clearedResult.alert.hasActiveSuppression).toBe(false);
  });

  it("routes an open platform alert into a manual intervention review case", async () => {
    const { service, prismaService, reviewCasesService, transactionClient } =
      createService();
    const openAlert = buildPlatformAlertRecord({
      id: "alert_route_1",
      severity: PlatformAlertSeverity.critical
    });
    const routedAlert = buildPlatformAlertRecord({
      id: "alert_route_1",
      severity: PlatformAlertSeverity.critical,
      routingStatus: PlatformAlertRoutingStatus.routed,
      routingTargetType: PlatformAlertRoutingTargetType.review_case,
      routingTargetId: "review_case_1",
      routedAt: new Date("2026-04-06T10:05:00.000Z"),
      routedByOperatorId: "ops_1",
      routingNote: "Escalated from critical worker outage."
    });

    (transactionClient.platformAlert.findUnique as jest.Mock).mockResolvedValue(
      openAlert
    );
    (reviewCasesService.openOrReuseReviewCase as jest.Mock).mockResolvedValue({
      reviewCase: {
        id: "review_case_1",
        status: ReviewCaseStatus.open,
        type: ReviewCaseType.manual_intervention,
        reasonCode: "platform_alert:worker:degraded:worker_1",
        assignedOperatorId: null
      },
      reviewCaseReused: false
    });
    (transactionClient.platformAlert.update as jest.Mock).mockResolvedValue(
      routedAlert
    );

    const result = await service.routePlatformAlertToReviewCase(
      openAlert.id,
      "ops_1",
      {
        note: "Escalated from critical worker outage."
      }
    );

    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        type: ReviewCaseType.manual_intervention,
        reasonCode: "platform_alert:worker:degraded:worker_1",
        actorId: "ops_1"
      })
    );
    expect(transactionClient.platformAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          routingStatus: PlatformAlertRoutingStatus.routed,
          routingTargetType: PlatformAlertRoutingTargetType.review_case,
          routingTargetId: "review_case_1"
        })
      })
    );
    expect(transactionClient.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "platform_alert.routed_to_review_case",
          targetType: "PlatformAlert",
          targetId: openAlert.id
        })
      })
    );
    expect(result.reviewCase.id).toBe("review_case_1");
    expect(result.alert.routingStatus).toBe("routed");
    expect(result.routingStateReused).toBe(false);
  });

  it("auto-routes critical worker alerts that match automation policy", async () => {
    const { service, prismaService, reviewCasesService, transactionClient } =
      createService();
    const createdAlert = buildPlatformAlertRecord({
      id: "alert_auto_1",
      severity: PlatformAlertSeverity.critical
    });
    const routedAlert = buildPlatformAlertRecord({
      id: "alert_auto_1",
      severity: PlatformAlertSeverity.critical,
      routingStatus: PlatformAlertRoutingStatus.routed,
      routingTargetType: PlatformAlertRoutingTargetType.review_case,
      routingTargetId: "review_case_auto_1",
      routedAt: new Date("2026-04-06T10:05:00.000Z"),
      routedByOperatorId: null,
      routingNote:
        'Automatically routed by platform alert automation policy "critical-worker-auto-route". Escalate worker outages immediately.'
    });

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );
    (prismaService.workerRuntimeHeartbeat.findMany as jest.Mock).mockResolvedValue([
      buildHeartbeatRecord({
        lastIterationStatus: WorkerRuntimeIterationStatus.failed,
        consecutiveFailureCount: 3,
        lastErrorMessage: "RPC timeout"
      })
    ]);
    (prismaService.transactionIntent.count as jest.Mock)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    (prismaService.transactionIntent.findFirst as jest.Mock).mockResolvedValue({
      createdAt: new Date("2026-04-06T09:59:00.000Z")
    });
    (prismaService.blockchainTransaction.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    (prismaService.blockchainTransaction.findFirst as jest.Mock).mockResolvedValue(
      null
    );
    (prismaService.ledgerReconciliationMismatch.count as jest.Mock)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    (prismaService.ledgerReconciliationScanRun.count as jest.Mock).mockResolvedValue(
      0
    );
    (prismaService.ledgerReconciliationScanRun.findFirst as jest.Mock).mockResolvedValue(
      {
        status: LedgerReconciliationScanRunStatus.succeeded,
        startedAt: new Date("2026-04-06T09:55:00.000Z")
      }
    );
    (prismaService.wallet.count as jest.Mock)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);
    (prismaService.reviewCase.count as jest.Mock).mockResolvedValue(1);
    (prismaService.oversightIncident.count as jest.Mock).mockResolvedValue(0);
    (prismaService.customerAccount.count as jest.Mock).mockResolvedValue(0);
    (prismaService.platformAlert.create as jest.Mock).mockResolvedValue(createdAlert);
    (prismaService.platformAlert.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([routedAlert]);
    (prismaService.platformAlert.count as jest.Mock)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    (transactionClient.platformAlert.findUnique as jest.Mock).mockResolvedValue(
      createdAlert
    );
    (reviewCasesService.openOrReuseReviewCase as jest.Mock).mockResolvedValue({
      reviewCase: {
        id: "review_case_auto_1",
        status: ReviewCaseStatus.open,
        type: ReviewCaseType.manual_intervention,
        reasonCode: "platform_alert:worker:degraded:worker_1",
        assignedOperatorId: null
      },
      reviewCaseReused: false
    });
    (transactionClient.platformAlert.update as jest.Mock).mockResolvedValue(
      routedAlert
    );

    const result = await service.getOperationsStatus({
      staleAfterSeconds: 180,
      recentAlertLimit: 4
    });

    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        actorType: "system",
        actorId: "platform-alert-automation"
      })
    );
    expect(transactionClient.platformAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          routingStatus: PlatformAlertRoutingStatus.routed,
          routedByOperatorId: null
        })
      })
    );
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "platform_alert.automation_policy_applied",
          actorType: "system",
          actorId: "platform-alert-automation",
          targetId: "alert_auto_1"
        })
      })
    );
    expect(result.recentAlerts[0]?.routingStatus).toBe("routed");
    expect(result.recentAlerts[0]?.routingNote).toContain(
      "critical-worker-auto-route"
    );
  });

  it("routes only unrouted critical alerts in batch", async () => {
    const { service, prismaService } = createService();

    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-04-06T10:00:30.000Z").getTime()
    );
    mockHealthySnapshotQueries(prismaService);
    (prismaService.platformAlert.findMany as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildPlatformAlertRecord({
          id: "alert_batch_1",
          severity: PlatformAlertSeverity.critical
        }),
        buildPlatformAlertRecord({
          id: "alert_batch_2",
          dedupeKey: "chain:broadcast-health",
          category: PlatformAlertCategory.chain,
          severity: PlatformAlertSeverity.critical,
          code: "chain_broadcast_confirmation_lag",
          summary: "Broadcast confirmations are lagging or failing."
        })
      ]);
    (prismaService.platformAlert.count as jest.Mock).mockResolvedValue(1);

    const routeSpy = jest
      .spyOn(service, "routePlatformAlertToReviewCase")
      .mockResolvedValue({
        alert: {
          id: "alert_batch_1",
          dedupeKey: "worker:degraded:worker_1",
          category: PlatformAlertCategory.worker,
          severity: PlatformAlertSeverity.critical,
          status: PlatformAlertStatus.open,
          routingStatus: PlatformAlertRoutingStatus.routed,
          routingTargetType: PlatformAlertRoutingTargetType.review_case,
          routingTargetId: "review_case_1",
          routedAt: "2026-04-06T10:05:00.000Z",
          routedByOperatorId: "ops_1",
          routingNote: null,
          ownerOperatorId: null,
          ownerAssignedAt: null,
          ownerAssignedByOperatorId: null,
          ownershipNote: null,
          acknowledgedAt: null,
          acknowledgedByOperatorId: null,
          acknowledgementNote: null,
          suppressedUntil: null,
          suppressedByOperatorId: null,
          suppressionNote: null,
          isAcknowledged: false,
          hasActiveSuppression: false,
          deliverySummary: {
            totalCount: 0,
            pendingCount: 0,
            failedCount: 0,
            escalatedCount: 0,
            highestEscalationLevel: 0,
            lastAttemptedAt: null,
            lastStatus: null,
            lastTargetName: null,
            lastEscalatedFromTargetName: null,
            lastErrorMessage: null
          },
          code: "worker_runtime_degraded",
          summary: "Worker worker_1 is degraded.",
          detail: "Iteration status is failed.",
          metadata: {
            workerId: "worker_1"
          },
          firstDetectedAt: "2026-04-06T10:00:00.000Z",
          lastDetectedAt: "2026-04-06T10:00:00.000Z",
          resolvedAt: null,
          createdAt: "2026-04-06T10:00:00.000Z",
          updatedAt: "2026-04-06T10:05:00.000Z"
        },
        reviewCase: {
          id: "review_case_1",
          status: ReviewCaseStatus.open,
          type: ReviewCaseType.manual_intervention,
          reasonCode: "platform_alert:worker:degraded:worker_1",
          assignedOperatorId: null
        },
        reviewCaseReused: false,
        routingStateReused: false
      });

    const result = await service.routeCriticalPlatformAlerts("ops_1", {
      limit: 2,
      staleAfterSeconds: 180
    });

    expect(routeSpy).toHaveBeenCalledTimes(2);
    expect(result.routedAlerts).toHaveLength(2);
    expect(result.remainingUnroutedCriticalAlertCount).toBe(1);
  });
});
