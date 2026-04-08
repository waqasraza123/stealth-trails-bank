import axios, { type AxiosInstance } from "axios";
import { ReleaseReadinessEvidenceType } from "@prisma/client";

type ApiEnvelope<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

type ReleaseReadinessDrillSession = {
  baseUrl: string;
  operatorId: string;
  apiKey: string;
  operatorRole?: string;
};

type ReleaseReadinessDrillOptions = {
  evidenceType: ReleaseReadinessEvidenceType;
  staleAfterSeconds?: number;
  recentAlertLimit?: number;
  lookbackHours?: number;
  expectedTargetName?: string;
  expectedTargetHealthStatus?: "warning" | "critical";
  expectedAlertId?: string;
  expectedDedupeKey?: string;
  expectedMinReEscalations?: number;
  expectedWorkerId?: string;
  expectedMinHealthyWorkers?: number;
};

type DrillCheckResult = {
  name: string;
  path: string;
  ok: boolean;
  statusCode: number;
  summary: string;
  payload: Record<string, unknown>;
};

type ReleaseReadinessDrillResult = {
  evidenceType: ReleaseReadinessEvidenceType;
  status: "passed" | "failed";
  summary: string;
  observedAt: string;
  failures: string[];
  checks: DrillCheckResult[];
  evidencePayload: Record<string, unknown>;
};

type OperationsStatusData = {
  generatedAt: string;
  workerHealth: {
    status: "healthy" | "warning" | "critical";
    healthyWorkers: number;
    totalWorkers: number;
    staleWorkers: number;
  };
  queueHealth: {
    status: "healthy" | "warning" | "critical";
    totalQueuedCount: number;
  };
  reconciliationHealth: {
    status: "healthy" | "warning" | "critical";
    recentFailedScanCount: number;
    latestScanStatus: string | null;
  };
  recentAlerts: Array<{
    id: string;
    severity: string;
    status: string;
    code: string;
    summary: string;
  }>;
};

type WorkerRuntimeHealthListData = {
  workers: Array<{
    workerId: string;
    healthStatus: "healthy" | "degraded" | "stale";
    lastHeartbeatAt: string;
    lastIterationStatus: string;
    consecutiveFailureCount: number;
  }>;
  staleAfterSeconds: number;
  totalCount: number;
};

type PlatformAlertListData = {
  alerts: Array<{
    id: string;
    dedupeKey: string;
    severity: "warning" | "critical";
    status: "open" | "resolved";
    category: string;
    code: string;
    summary: string;
    deliverySummary: {
      reEscalationCount: number;
      escalatedCount: number;
      failedCount: number;
      pendingCount: number;
      lastStatus: "pending" | "succeeded" | "failed" | null;
      lastTargetName: string | null;
    };
  }>;
  limit: number;
  totalCount: number;
};

type PlatformAlertDeliveryTargetHealthListData = {
  generatedAt: string;
  lookbackHours: number;
  summary: {
    totalTargetCount: number;
    healthyTargetCount: number;
    warningTargetCount: number;
    criticalTargetCount: number;
  };
  targets: Array<{
    targetName: string;
    healthStatus: "healthy" | "warning" | "critical";
    recentDeliveryCount: number;
    recentFailedCount: number;
    pendingDeliveryCount: number;
    recentFailureRatePercent: number | null;
    consecutiveFailureCount: number;
    sloBreaches: string[];
  }>;
};

type LedgerReconciliationRunListData = {
  runs: Array<{
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
  }>;
  totalCount: number;
};

type ReviewCaseListData = {
  reviewCases: Array<{
    id: string;
    status: string;
    type: string;
    updatedAt: string;
  }>;
  limit: number;
};

type AuditEventListData = {
  events: Array<{
    id: string;
    action: string;
    targetType: string;
    createdAt: string;
  }>;
  totalCount: number;
};

const DEFAULT_STALE_AFTER_SECONDS = 180;
const DEFAULT_RECENT_ALERT_LIMIT = 20;
const DEFAULT_LOOKBACK_HOURS = 24;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function createClient(session: ReleaseReadinessDrillSession): AxiosInstance {
  return axios.create({
    baseURL: normalizeBaseUrl(session.baseUrl),
    headers: {
      "x-operator-api-key": session.apiKey.trim(),
      "x-operator-id": session.operatorId.trim(),
      ...(session.operatorRole?.trim()
        ? {
            "x-operator-role": session.operatorRole.trim().toLowerCase()
          }
        : {})
    },
    timeout: 15_000
  });
}

async function requestData<T>(
  client: AxiosInstance,
  path: string,
  params: Record<string, string | number | undefined>
): Promise<{
  statusCode: number;
  data: T;
}> {
  const response = await client.get<ApiEnvelope<T>>(path, {
    params
  });

  if (response.data.data === undefined) {
    throw new Error(response.data.message || `API response for ${path} had no data.`);
  }

  return {
    statusCode: response.status,
    data: response.data.data
  };
}

function buildFailedResult(
  evidenceType: ReleaseReadinessEvidenceType,
  checks: DrillCheckResult[],
  failures: string[],
  evidencePayload: Record<string, unknown>
): ReleaseReadinessDrillResult {
  return {
    evidenceType,
    status: "failed",
    summary: failures[0] ?? `${evidenceType} drill validation failed.`,
    observedAt: new Date().toISOString(),
    failures,
    checks,
    evidencePayload
  };
}

function buildPassedResult(
  evidenceType: ReleaseReadinessEvidenceType,
  checks: DrillCheckResult[],
  summary: string,
  evidencePayload: Record<string, unknown>
): ReleaseReadinessDrillResult {
  return {
    evidenceType,
    status: "passed",
    summary,
    observedAt: new Date().toISOString(),
    failures: [],
    checks,
    evidencePayload
  };
}

export function evaluatePlatformAlertDeliverySloProbe(
  targetHealth: PlatformAlertDeliveryTargetHealthListData,
  alerts: PlatformAlertListData,
  options: ReleaseReadinessDrillOptions
): ReleaseReadinessDrillResult {
  const expectedTargetName = options.expectedTargetName?.trim();
  const expectedHealthStatus = options.expectedTargetHealthStatus;
  const failures: string[] = [];
  const matchingTargets = expectedTargetName
    ? targetHealth.targets.filter((target) => target.targetName === expectedTargetName)
    : targetHealth.targets.filter(
        (target) =>
          target.healthStatus !== "healthy" || target.sloBreaches.length > 0
      );
  const matchingTarget = matchingTargets[0] ?? null;

  if (!matchingTarget) {
    failures.push(
      expectedTargetName
        ? `No delivery target named ${expectedTargetName} was found in target health output.`
        : "No delivery target showed a warning or critical SLO posture."
    );
  } else if (
    expectedHealthStatus &&
    matchingTarget.healthStatus !== expectedHealthStatus
  ) {
    failures.push(
      `Delivery target ${matchingTarget.targetName} was ${matchingTarget.healthStatus}, expected ${expectedHealthStatus}.`
    );
  }

  const matchingOperationsAlerts = alerts.alerts.filter(
    (alert) => alert.category === "operations"
  );

  if (matchingOperationsAlerts.length === 0) {
    failures.push(
      "No open operations alert was present while validating delivery-target SLO posture."
    );
  }

  const checks: DrillCheckResult[] = [
    {
      name: "delivery_target_health",
      path: "/operations/internal/alerts/delivery-target-health",
      ok: matchingTarget !== null,
      statusCode: 200,
      summary: matchingTarget
        ? `Matched delivery target ${matchingTarget.targetName} with ${matchingTarget.healthStatus} health.`
        : "No matching delivery target found.",
      payload: {
        generatedAt: targetHealth.generatedAt,
        matchingTarget,
        targetSummary: targetHealth.summary
      }
    },
    {
      name: "operations_alerts",
      path: "/operations/internal/alerts",
      ok: matchingOperationsAlerts.length > 0,
      statusCode: 200,
      summary:
        matchingOperationsAlerts.length > 0
          ? `${matchingOperationsAlerts.length} open operations alerts observed.`
          : "No open operations alerts observed.",
      payload: {
        observedAlertCount: matchingOperationsAlerts.length,
        matchingOperationsAlerts
      }
    }
  ];

  const evidencePayload = {
    targetHealth: {
      generatedAt: targetHealth.generatedAt,
      lookbackHours: targetHealth.lookbackHours,
      summary: targetHealth.summary,
      matchingTarget
    },
    operationsAlerts: matchingOperationsAlerts
  };

  if (failures.length > 0) {
    return buildFailedResult(
      ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
      checks,
      failures,
      evidencePayload
    );
  }

  return buildPassedResult(
    ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
    checks,
    `Validated delivery-target SLO drill through target ${
      matchingTarget!.targetName
    } with ${matchingTarget!.healthStatus} health and ${
      matchingOperationsAlerts.length
    } open operations alerts.`,
    evidencePayload
  );
}

export function evaluateCriticalAlertReEscalationProbe(
  alerts: PlatformAlertListData,
  options: ReleaseReadinessDrillOptions
): ReleaseReadinessDrillResult {
  const expectedAlertId = options.expectedAlertId?.trim();
  const expectedDedupeKey = options.expectedDedupeKey?.trim();
  const expectedMinReEscalations = options.expectedMinReEscalations ?? 1;
  const matchingAlert =
    alerts.alerts.find((alert) => alert.id === expectedAlertId) ??
    alerts.alerts.find((alert) => alert.dedupeKey === expectedDedupeKey) ??
    alerts.alerts.find(
      (alert) => alert.deliverySummary.reEscalationCount >= expectedMinReEscalations
    ) ??
    null;
  const failures: string[] = [];

  if (!matchingAlert) {
    failures.push(
      "No critical alert matched the requested re-escalation proof criteria."
    );
  } else if (
    matchingAlert.deliverySummary.reEscalationCount < expectedMinReEscalations
  ) {
    failures.push(
      `Alert ${matchingAlert.id} had ${matchingAlert.deliverySummary.reEscalationCount} re-escalations, expected at least ${expectedMinReEscalations}.`
    );
  }

  const checks: DrillCheckResult[] = [
    {
      name: "critical_alerts",
      path: "/operations/internal/alerts",
      ok: matchingAlert !== null,
      statusCode: 200,
      summary: matchingAlert
        ? `Alert ${matchingAlert.id} recorded ${matchingAlert.deliverySummary.reEscalationCount} re-escalations.`
        : "No matching critical alert found.",
      payload: {
        matchingAlert,
        observedAlertCount: alerts.alerts.length
      }
    }
  ];

  const evidencePayload = {
    matchingAlert,
    observedAlertCount: alerts.alerts.length,
    expectedMinReEscalations
  };

  if (failures.length > 0) {
    return buildFailedResult(
      ReleaseReadinessEvidenceType.critical_alert_reescalation,
      checks,
      failures,
      evidencePayload
    );
  }

  return buildPassedResult(
    ReleaseReadinessEvidenceType.critical_alert_reescalation,
    checks,
    `Validated critical alert re-escalation drill on alert ${matchingAlert!.id} with ${matchingAlert!.deliverySummary.reEscalationCount} re-escalations.`,
    evidencePayload
  );
}

export function evaluateRestoreOrApiRollbackProbe(
  evidenceType: "database_restore_drill" | "api_rollback_drill",
  operationsStatus: OperationsStatusData,
  ledgerRuns: LedgerReconciliationRunListData,
  reviewCases: ReviewCaseListData,
  auditEvents: AuditEventListData
): ReleaseReadinessDrillResult {
  const checks: DrillCheckResult[] = [
    {
      name: "operations_status",
      path: "/operations/internal/status",
      ok: true,
      statusCode: 200,
      summary: `Operations status returned ${operationsStatus.workerHealth.status} worker health and ${operationsStatus.reconciliationHealth.status} reconciliation health.`,
      payload: {
        generatedAt: operationsStatus.generatedAt,
        workerHealth: operationsStatus.workerHealth,
        reconciliationHealth: operationsStatus.reconciliationHealth
      }
    },
    {
      name: "ledger_reconciliation_runs",
      path: "/ledger/internal/reconciliation/runs",
      ok: true,
      statusCode: 200,
      summary: `Loaded ${ledgerRuns.totalCount} reconciliation runs.`,
      payload: {
        latestRun: ledgerRuns.runs[0] ?? null,
        totalCount: ledgerRuns.totalCount
      }
    },
    {
      name: "review_cases",
      path: "/review-cases/internal",
      ok: true,
      statusCode: 200,
      summary: `Loaded ${reviewCases.reviewCases.length} review cases from operator API.`,
      payload: {
        firstReviewCase: reviewCases.reviewCases[0] ?? null,
        returnedCount: reviewCases.reviewCases.length
      }
    },
    {
      name: "audit_events",
      path: "/audit-events/internal",
      ok: true,
      statusCode: 200,
      summary: `Loaded ${auditEvents.events.length} audit events from operator API.`,
      payload: {
        firstAuditEvent: auditEvents.events[0] ?? null,
        totalCount: auditEvents.totalCount
      }
    }
  ];

  const evidencePayload = {
    operationsStatus: {
      generatedAt: operationsStatus.generatedAt,
      workerHealth: operationsStatus.workerHealth,
      reconciliationHealth: operationsStatus.reconciliationHealth
    },
    ledgerRuns: {
      latestRun: ledgerRuns.runs[0] ?? null,
      totalCount: ledgerRuns.totalCount
    },
    reviewCases: {
      firstReviewCase: reviewCases.reviewCases[0] ?? null,
      returnedCount: reviewCases.reviewCases.length
    },
    auditEvents: {
      firstAuditEvent: auditEvents.events[0] ?? null,
      totalCount: auditEvents.totalCount
    }
  };

  return buildPassedResult(
    evidenceType,
    checks,
    evidenceType === ReleaseReadinessEvidenceType.database_restore_drill
      ? "Validated restore drill operator surfaces and reconciliation reads after restore."
      : "Validated rollback drill operator surfaces and reconciliation reads after API rollback.",
    evidencePayload
  );
}

export function evaluateWorkerRollbackProbe(
  operationsStatus: OperationsStatusData,
  workerHealth: WorkerRuntimeHealthListData,
  options: ReleaseReadinessDrillOptions
): ReleaseReadinessDrillResult {
  const expectedMinHealthyWorkers = options.expectedMinHealthyWorkers ?? 1;
  const expectedWorkerId = options.expectedWorkerId?.trim();
  const matchingWorker = expectedWorkerId
    ? workerHealth.workers.find((worker) => worker.workerId === expectedWorkerId) ??
      null
    : workerHealth.workers.find((worker) => worker.healthStatus === "healthy") ??
      null;
  const failures: string[] = [];

  if (workerHealth.workers.length < expectedMinHealthyWorkers) {
    failures.push(
      `Only ${workerHealth.workers.length} worker records were returned, expected at least ${expectedMinHealthyWorkers}.`
    );
  }

  if (!matchingWorker) {
    failures.push(
      expectedWorkerId
        ? `Expected worker ${expectedWorkerId} was not found in worker health output.`
        : "No healthy worker was observed after rollback validation."
    );
  } else if (matchingWorker.healthStatus !== "healthy") {
    failures.push(
      `Worker ${matchingWorker.workerId} reported ${matchingWorker.healthStatus} health instead of healthy.`
    );
  }

  if (operationsStatus.workerHealth.healthyWorkers < expectedMinHealthyWorkers) {
    failures.push(
      `Operations status reported ${operationsStatus.workerHealth.healthyWorkers} healthy workers, expected at least ${expectedMinHealthyWorkers}.`
    );
  }

  const checks: DrillCheckResult[] = [
    {
      name: "worker_runtime_health",
      path: "/operations/internal/workers/health",
      ok: matchingWorker !== null && matchingWorker.healthStatus === "healthy",
      statusCode: 200,
      summary: matchingWorker
        ? `Worker ${matchingWorker.workerId} is ${matchingWorker.healthStatus}.`
        : "No matching worker found.",
      payload: {
        staleAfterSeconds: workerHealth.staleAfterSeconds,
        matchingWorker,
        workers: workerHealth.workers
      }
    },
    {
      name: "operations_status",
      path: "/operations/internal/status",
      ok: operationsStatus.workerHealth.healthyWorkers >= expectedMinHealthyWorkers,
      statusCode: 200,
      summary: `Operations status reported ${operationsStatus.workerHealth.healthyWorkers}/${operationsStatus.workerHealth.totalWorkers} healthy workers.`,
      payload: {
        workerHealth: operationsStatus.workerHealth
      }
    }
  ];

  const evidencePayload = {
    workerHealth: {
      staleAfterSeconds: workerHealth.staleAfterSeconds,
      workers: workerHealth.workers,
      matchingWorker
    },
    operationsStatus: {
      workerHealth: operationsStatus.workerHealth
    },
    expectedMinHealthyWorkers
  };

  if (failures.length > 0) {
    return buildFailedResult(
      ReleaseReadinessEvidenceType.worker_rollback_drill,
      checks,
      failures,
      evidencePayload
    );
  }

  return buildPassedResult(
    ReleaseReadinessEvidenceType.worker_rollback_drill,
    checks,
    `Validated worker rollback drill with ${
      operationsStatus.workerHealth.healthyWorkers
    } healthy workers and fresh heartbeat for ${matchingWorker!.workerId}.`,
    evidencePayload
  );
}

export async function runReleaseReadinessDrill(
  session: ReleaseReadinessDrillSession,
  options: ReleaseReadinessDrillOptions,
  client: AxiosInstance = createClient(session)
): Promise<ReleaseReadinessDrillResult> {
  const staleAfterSeconds = options.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
  const recentAlertLimit = options.recentAlertLimit ?? DEFAULT_RECENT_ALERT_LIMIT;
  const lookbackHours = options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;

  switch (options.evidenceType) {
    case ReleaseReadinessEvidenceType.database_restore_drill:
    case ReleaseReadinessEvidenceType.api_rollback_drill: {
      const [operationsStatus, ledgerRuns, reviewCases, auditEvents] =
        await Promise.all([
          requestData<OperationsStatusData>(client, "/operations/internal/status", {
            staleAfterSeconds,
            recentAlertLimit
          }),
          requestData<LedgerReconciliationRunListData>(
            client,
            "/ledger/internal/reconciliation/runs",
            {
              limit: 1
            }
          ),
          requestData<ReviewCaseListData>(client, "/review-cases/internal", {
            limit: 1
          }),
          requestData<AuditEventListData>(client, "/audit-events/internal", {
            limit: 1
          })
        ]);

      return evaluateRestoreOrApiRollbackProbe(
        options.evidenceType,
        operationsStatus.data,
        ledgerRuns.data,
        reviewCases.data,
        auditEvents.data
      );
    }

    case ReleaseReadinessEvidenceType.worker_rollback_drill: {
      const [operationsStatus, workerHealth] = await Promise.all([
        requestData<OperationsStatusData>(client, "/operations/internal/status", {
          staleAfterSeconds,
          recentAlertLimit
        }),
        requestData<WorkerRuntimeHealthListData>(
          client,
          "/operations/internal/workers/health",
          {
            limit: Math.max(options.expectedMinHealthyWorkers ?? 1, 5),
            staleAfterSeconds,
            workerId: options.expectedWorkerId
          }
        )
      ]);

      return evaluateWorkerRollbackProbe(
        operationsStatus.data,
        workerHealth.data,
        options
      );
    }

    case ReleaseReadinessEvidenceType.platform_alert_delivery_slo: {
      const [targetHealth, alerts] = await Promise.all([
        requestData<PlatformAlertDeliveryTargetHealthListData>(
          client,
          "/operations/internal/alerts/delivery-target-health",
          {
            lookbackHours
          }
        ),
        requestData<PlatformAlertListData>(client, "/operations/internal/alerts", {
          limit: recentAlertLimit,
          staleAfterSeconds,
          status: "open",
          category: "operations"
        })
      ]);

      return evaluatePlatformAlertDeliverySloProbe(
        targetHealth.data,
        alerts.data,
        options
      );
    }

    case ReleaseReadinessEvidenceType.critical_alert_reescalation: {
      const alerts = await requestData<PlatformAlertListData>(
        client,
        "/operations/internal/alerts",
        {
          limit: recentAlertLimit,
          staleAfterSeconds,
          status: "open",
          severity: "critical"
        }
      );

      return evaluateCriticalAlertReEscalationProbe(alerts.data, options);
    }

    default:
      throw new Error(`Unsupported drill evidence type: ${options.evidenceType}`);
  }
}

export async function recordReleaseReadinessEvidence(
  session: ReleaseReadinessDrillSession,
  payload: {
    evidenceType: ReleaseReadinessEvidenceType;
    environment: "staging" | "production_like" | "production";
    status: "passed" | "failed";
    summary: string;
    note?: string;
    releaseIdentifier?: string;
    rollbackReleaseIdentifier?: string;
    backupReference?: string;
    observedAt: string;
    evidencePayload: Record<string, unknown>;
  },
  client: AxiosInstance = createClient(session)
): Promise<{
  evidence: {
    id: string;
    status: "passed" | "failed";
  };
}> {
  const response = await client.post<
    ApiEnvelope<{
      evidence: {
        id: string;
        status: "passed" | "failed";
      };
    }>
  >("/release-readiness/internal/evidence", payload);

  if (response.data.data === undefined) {
    throw new Error(
      response.data.message ||
        "Release readiness evidence API response did not include data."
    );
  }

  return response.data.data;
}

export type {
  ReleaseReadinessDrillOptions,
  ReleaseReadinessDrillResult,
  ReleaseReadinessDrillSession
};
