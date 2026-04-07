import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  loadPlatformAlertAutomationRuntimeConfig,
  loadProductChainRuntimeConfig,
  type PlatformAlertAutomationPolicyRuntimeConfig
} from "@stealth-trails-bank/config/api";
import {
  AccountLifecycleStatus,
  BlockchainTransactionStatus,
  LedgerReconciliationMismatchSeverity,
  LedgerReconciliationMismatchStatus,
  LedgerReconciliationScanRunStatus,
  OversightIncidentStatus,
  PlatformAlertCategory,
  PlatformAlertDeliveryEventType,
  PlatformAlertDeliveryStatus,
  PlatformAlertRoutingStatus,
  PlatformAlertRoutingTargetType,
  PlatformAlertSeverity,
  PlatformAlertStatus,
  Prisma,
  ReviewCaseStatus,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType,
  WalletKind,
  WalletStatus,
  WorkerRuntimeEnvironment,
  WorkerRuntimeExecutionMode,
  WorkerRuntimeIterationStatus
} from "@prisma/client";
import { ApiRequestMetricsService } from "../logging/api-request-metrics.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { PlatformAlertDeliveryService } from "./platform-alert-delivery.service";
import { GetOperationsMetricsDto } from "./dto/get-operations-metrics.dto";
import { GetOperationsStatusDto } from "./dto/get-operations-status.dto";
import { ListPlatformAlertsDto } from "./dto/list-platform-alerts.dto";
import { ListWorkerRuntimeHealthDto } from "./dto/list-worker-runtime-health.dto";
import { ReportWorkerRuntimeHeartbeatDto } from "./dto/report-worker-runtime-heartbeat.dto";
import { RouteCriticalPlatformAlertsDto } from "./dto/route-critical-platform-alerts.dto";
import { RoutePlatformAlertToReviewCaseDto } from "./dto/route-platform-alert-to-review-case.dto";

type WorkerRuntimeHeartbeatRecord = Prisma.WorkerRuntimeHeartbeatGetPayload<{}>;
type PlatformAlertRecord = Prisma.PlatformAlertGetPayload<{}>;
type PlatformAlertDeliveryRecord = Prisma.PlatformAlertDeliveryGetPayload<{}>;

type WorkerRuntimeHealthProjection = {
  workerId: string;
  healthStatus: "healthy" | "degraded" | "stale";
  environment: WorkerRuntimeEnvironment;
  executionMode: WorkerRuntimeExecutionMode;
  lastIterationStatus: WorkerRuntimeIterationStatus;
  lastHeartbeatAt: string;
  lastIterationStartedAt: string | null;
  lastIterationCompletedAt: string | null;
  consecutiveFailureCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastReconciliationScanRunId: string | null;
  lastReconciliationScanStartedAt: string | null;
  lastReconciliationScanCompletedAt: string | null;
  lastReconciliationScanStatus: LedgerReconciliationScanRunStatus | null;
  runtimeMetadata: Prisma.JsonValue | null;
  latestIterationMetrics: Prisma.JsonValue | null;
  createdAt: string;
  updatedAt: string;
};

type WorkerRuntimeHeartbeatMutationResult = {
  heartbeat: WorkerRuntimeHealthProjection;
};

type WorkerRuntimeHealthListResult = {
  workers: WorkerRuntimeHealthProjection[];
  limit: number;
  staleAfterSeconds: number;
  totalCount: number;
};

type PlatformAlertProjection = {
  id: string;
  dedupeKey: string;
  category: PlatformAlertCategory;
  severity: PlatformAlertSeverity;
  status: PlatformAlertStatus;
  routingStatus: PlatformAlertRoutingStatus;
  routingTargetType: PlatformAlertRoutingTargetType | null;
  routingTargetId: string | null;
  routedAt: string | null;
  routedByOperatorId: string | null;
  routingNote: string | null;
  ownerOperatorId: string | null;
  ownerAssignedAt: string | null;
  ownerAssignedByOperatorId: string | null;
  ownershipNote: string | null;
  acknowledgedAt: string | null;
  acknowledgedByOperatorId: string | null;
  acknowledgementNote: string | null;
  suppressedUntil: string | null;
  suppressedByOperatorId: string | null;
  suppressionNote: string | null;
  isAcknowledged: boolean;
  hasActiveSuppression: boolean;
  deliverySummary: {
    totalCount: number;
    pendingCount: number;
    failedCount: number;
    escalatedCount: number;
    highestEscalationLevel: number;
    lastAttemptedAt: string | null;
    lastStatus: PlatformAlertDeliveryStatus | null;
    lastTargetName: string | null;
    lastEscalatedFromTargetName: string | null;
    lastErrorMessage: string | null;
  };
  code: string;
  summary: string;
  detail: string | null;
  metadata: Prisma.JsonValue | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlatformAlertListResult = {
  alerts: PlatformAlertProjection[];
  limit: number;
  totalCount: number;
};

type RoutedPlatformAlertReviewCaseProjection = {
  id: string;
  status: ReviewCaseStatus;
  type: ReviewCaseType;
  reasonCode: string | null;
  assignedOperatorId: string | null;
};

type RoutePlatformAlertResult = {
  alert: PlatformAlertProjection;
  reviewCase: RoutedPlatformAlertReviewCaseProjection;
  reviewCaseReused: boolean;
  routingStateReused: boolean;
};

type RoutePlatformAlertActor = {
  actorType: "operator" | "system";
  actorId: string;
};

type RouteCriticalPlatformAlertsResult = {
  routedAlerts: RoutePlatformAlertResult[];
  limit: number;
  remainingUnroutedCriticalAlertCount: number;
  staleAfterSeconds: number;
};

type PlatformAlertGovernanceMutationResult = {
  alert: PlatformAlertProjection;
  stateReused: boolean;
};

type OperationsSectionStatus = "healthy" | "warning" | "critical";

type OperationsStatusResult = {
  generatedAt: string;
  alertSummary: {
    openCount: number;
    criticalCount: number;
    warningCount: number;
  };
  workerHealth: {
    status: OperationsSectionStatus;
    staleAfterSeconds: number;
    totalWorkers: number;
    healthyWorkers: number;
    degradedWorkers: number;
    staleWorkers: number;
  };
  queueHealth: {
    status: OperationsSectionStatus;
    queuedDepositCount: number;
    queuedWithdrawalCount: number;
    totalQueuedCount: number;
    agedQueuedCount: number;
    manualWithdrawalBacklogCount: number;
    oldestQueuedIntentCreatedAt: string | null;
  };
  chainHealth: {
    status: OperationsSectionStatus;
    laggingBroadcastCount: number;
    criticalLaggingBroadcastCount: number;
    recentFailedTransactionCount: number;
    oldestLaggingBroadcastCreatedAt: string | null;
  };
  treasuryHealth: {
    status: OperationsSectionStatus;
    managedWorkerCount: number;
    activeTreasuryWalletCount: number;
    activeOperationalWalletCount: number;
    missingManagedWalletCoverage: boolean;
  };
  reconciliationHealth: {
    status: OperationsSectionStatus;
    openMismatchCount: number;
    criticalMismatchCount: number;
    recentFailedScanCount: number;
    latestScanStatus: LedgerReconciliationScanRunStatus | null;
    latestScanStartedAt: string | null;
  };
  incidentSafety: {
    status: OperationsSectionStatus;
    openReviewCaseCount: number;
    openOversightIncidentCount: number;
    activeRestrictedAccountCount: number;
  };
  recentAlerts: PlatformAlertProjection[];
};

type OperationsSnapshot = {
  generatedAt: Date;
  staleAfterSeconds: number;
  workers: WorkerRuntimeHealthProjection[];
  workerHealth: OperationsStatusResult["workerHealth"];
  queueHealth: OperationsStatusResult["queueHealth"];
  chainHealth: OperationsStatusResult["chainHealth"];
  treasuryHealth: OperationsStatusResult["treasuryHealth"];
  reconciliationHealth: OperationsStatusResult["reconciliationHealth"];
  incidentSafety: OperationsStatusResult["incidentSafety"];
  alertCandidates: PlatformAlertCandidate[];
};

type PlatformAlertCandidate = {
  dedupeKey: string;
  category: PlatformAlertCategory;
  severity: PlatformAlertSeverity;
  code: string;
  summary: string;
  detail: string | null;
  metadata: Prisma.InputJsonValue | null;
};

const DEFAULT_STALE_AFTER_SECONDS = 180;
const DEFAULT_RECENT_ALERT_LIMIT = 8;
const FAILED_SCAN_LOOKBACK_HOURS = 6;
const FAILED_BLOCKCHAIN_LOOKBACK_HOURS = 6;
const QUEUE_WARNING_COUNT = 10;
const QUEUE_CRITICAL_COUNT = 25;
const QUEUE_WARNING_AGE_SECONDS = 15 * 60;
const QUEUE_CRITICAL_AGE_SECONDS = 60 * 60;
const CHAIN_WARNING_AGE_SECONDS = 15 * 60;
const CHAIN_CRITICAL_AGE_SECONDS = 60 * 60;
const CHAIN_FAILED_WARNING_COUNT = 1;
const CHAIN_FAILED_CRITICAL_COUNT = 5;
const INCIDENT_REVIEW_WARNING_COUNT = 10;
const INCIDENT_OVERSIGHT_WARNING_COUNT = 5;
const INCIDENT_RESTRICTED_WARNING_COUNT = 5;
const WORKER_ITERATION_METRIC_KEYS = [
  "queuedDepositCount",
  "queuedWithdrawalCount",
  "broadcastDepositCount",
  "broadcastWithdrawalCount",
  "depositBroadcastRecordedCount",
  "withdrawalBroadcastRecordedCount",
  "depositConfirmedCount",
  "withdrawalConfirmedCount",
  "depositSettledCount",
  "withdrawalSettledCount",
  "depositFailedCount",
  "withdrawalFailedCount",
  "manualWithdrawalBacklogCount",
  "lastIterationDurationMs"
] as const;

function buildPastDate(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function buildPastDateSeconds(seconds: number): Date {
  return new Date(Date.now() - seconds * 1000);
}

function isJsonObject(
  value: unknown
): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJsonNumber(
  value: Prisma.JsonValue | null,
  key: string
): number {
  if (!isJsonObject(value)) {
    return 0;
  }

  const rawValue = value[key];
  return typeof rawValue === "number" && Number.isFinite(rawValue)
    ? rawValue
    : 0;
}

function escapePrometheusLabelValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatPrometheusLine(
  name: string,
  value: number,
  labels?: Record<string, string>
): string {
  if (!labels || Object.keys(labels).length === 0) {
    return `${name} ${Number.isFinite(value) ? value : 0}`;
  }

  const serializedLabels = Object.entries(labels)
    .map(([label, labelValue]) => `${label}="${escapePrometheusLabelValue(labelValue)}"`)
    .join(",");

  return `${name}{${serializedLabels}} ${Number.isFinite(value) ? value : 0}`;
}

@Injectable()
export class OperationsMonitoringService {
  private readonly productChainId: number;
  private readonly platformAlertAutomationPolicies: readonly PlatformAlertAutomationPolicyRuntimeConfig[];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly reviewCasesService: ReviewCasesService,
    private readonly platformAlertDeliveryService: PlatformAlertDeliveryService
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
    this.platformAlertAutomationPolicies =
      loadPlatformAlertAutomationRuntimeConfig().policies;
  }

  private resolveHealthStatus(
    record: WorkerRuntimeHeartbeatRecord,
    staleAfterSeconds: number
  ): "healthy" | "degraded" | "stale" {
    const staleThresholdMs = staleAfterSeconds * 1000;
    const heartbeatAgeMs = Date.now() - record.lastHeartbeatAt.getTime();

    if (heartbeatAgeMs > staleThresholdMs) {
      return "stale";
    }

    if (
      record.lastIterationStatus === WorkerRuntimeIterationStatus.failed ||
      record.consecutiveFailureCount > 0 ||
      record.lastReconciliationScanStatus === LedgerReconciliationScanRunStatus.failed
    ) {
      return "degraded";
    }

    return "healthy";
  }

  private mapWorkerRuntimeHealthProjection(
    record: WorkerRuntimeHeartbeatRecord,
    staleAfterSeconds: number
  ): WorkerRuntimeHealthProjection {
    return {
      workerId: record.workerId,
      healthStatus: this.resolveHealthStatus(record, staleAfterSeconds),
      environment: record.environment,
      executionMode: record.executionMode,
      lastIterationStatus: record.lastIterationStatus,
      lastHeartbeatAt: record.lastHeartbeatAt.toISOString(),
      lastIterationStartedAt: record.lastIterationStartedAt?.toISOString() ?? null,
      lastIterationCompletedAt:
        record.lastIterationCompletedAt?.toISOString() ?? null,
      consecutiveFailureCount: record.consecutiveFailureCount,
      lastErrorCode: record.lastErrorCode ?? null,
      lastErrorMessage: record.lastErrorMessage ?? null,
      lastReconciliationScanRunId: record.lastReconciliationScanRunId ?? null,
      lastReconciliationScanStartedAt:
        record.lastReconciliationScanStartedAt?.toISOString() ?? null,
      lastReconciliationScanCompletedAt:
        record.lastReconciliationScanCompletedAt?.toISOString() ?? null,
      lastReconciliationScanStatus: record.lastReconciliationScanStatus ?? null,
      runtimeMetadata: record.runtimeMetadata ?? null,
      latestIterationMetrics: record.latestIterationMetrics ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private mapPlatformAlertProjection(
    record: PlatformAlertRecord,
    deliverySummary?: PlatformAlertProjection["deliverySummary"]
  ): PlatformAlertProjection {
    const now = Date.now();
    const hasActiveSuppression =
      record.suppressedUntil !== null &&
      record.suppressedUntil.getTime() > now;

    return {
      id: record.id,
      dedupeKey: record.dedupeKey,
      category: record.category,
      severity: record.severity,
      status: record.status,
      routingStatus: record.routingStatus,
      routingTargetType: record.routingTargetType ?? null,
      routingTargetId: record.routingTargetId ?? null,
      routedAt: record.routedAt?.toISOString() ?? null,
      routedByOperatorId: record.routedByOperatorId ?? null,
      routingNote: record.routingNote ?? null,
      ownerOperatorId: record.ownerOperatorId ?? null,
      ownerAssignedAt: record.ownerAssignedAt?.toISOString() ?? null,
      ownerAssignedByOperatorId: record.ownerAssignedByOperatorId ?? null,
      ownershipNote: record.ownershipNote ?? null,
      acknowledgedAt: record.acknowledgedAt?.toISOString() ?? null,
      acknowledgedByOperatorId: record.acknowledgedByOperatorId ?? null,
      acknowledgementNote: record.acknowledgementNote ?? null,
      suppressedUntil: record.suppressedUntil?.toISOString() ?? null,
      suppressedByOperatorId: record.suppressedByOperatorId ?? null,
      suppressionNote: record.suppressionNote ?? null,
      isAcknowledged: record.acknowledgedAt !== null,
      hasActiveSuppression,
      deliverySummary: deliverySummary ?? {
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
      code: record.code,
      summary: record.summary,
      detail: record.detail ?? null,
      metadata: record.metadata ?? null,
      firstDetectedAt: record.firstDetectedAt.toISOString(),
      lastDetectedAt: record.lastDetectedAt.toISOString(),
      resolvedAt: record.resolvedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private buildPlatformAlertDeliveryPayload(alert: PlatformAlertRecord) {
    return {
      id: alert.id,
      dedupeKey: alert.dedupeKey,
      category: alert.category,
      severity: alert.severity,
      status: alert.status,
      summary: alert.summary,
      detail: alert.detail ?? null,
      routingStatus: alert.routingStatus,
      ownerOperatorId: alert.ownerOperatorId ?? null,
      acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
      suppressedUntil: alert.suppressedUntil?.toISOString() ?? null,
      metadata: alert.metadata ?? null
    };
  }

  private buildPlatformAlertDeliverySummary(
    deliveries: PlatformAlertDeliveryRecord[]
  ): PlatformAlertProjection["deliverySummary"] {
    const latestDelivery =
      deliveries
        .slice()
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ??
      null;

    return {
      totalCount: deliveries.length,
      pendingCount: deliveries.filter(
        (delivery) => delivery.status === PlatformAlertDeliveryStatus.pending
      ).length,
      failedCount: deliveries.filter(
        (delivery) => delivery.status === PlatformAlertDeliveryStatus.failed
      ).length,
      escalatedCount: deliveries.filter(
        (delivery) => delivery.escalationLevel > 0
      ).length,
      highestEscalationLevel: deliveries.reduce(
        (highestLevel, delivery) =>
          Math.max(highestLevel, delivery.escalationLevel),
        0
      ),
      lastAttemptedAt: latestDelivery?.lastAttemptedAt?.toISOString() ?? null,
      lastStatus: latestDelivery?.status ?? null,
      lastTargetName: latestDelivery?.targetName ?? null,
      lastEscalatedFromTargetName:
        latestDelivery?.escalatedFromDeliveryId !== null &&
        latestDelivery?.requestPayload &&
        isJsonObject(latestDelivery.requestPayload) &&
        isJsonObject(latestDelivery.requestPayload["delivery"]) &&
        typeof latestDelivery.requestPayload["delivery"]["escalatedFromTargetName"] ===
          "string"
          ? latestDelivery.requestPayload["delivery"][
              "escalatedFromTargetName"
            ]
          : null,
      lastErrorMessage: latestDelivery?.errorMessage ?? null
    };
  }

  private async buildPlatformAlertDeliverySummaryMap(
    alertIds: string[]
  ): Promise<Map<string, PlatformAlertProjection["deliverySummary"]>> {
    if (alertIds.length === 0) {
      return new Map();
    }

    const deliveries = await this.prismaService.platformAlertDelivery.findMany({
      where: {
        platformAlertId: {
          in: alertIds
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    const deliveriesByAlertId = new Map<string, PlatformAlertDeliveryRecord[]>();

    for (const delivery of deliveries) {
      const current = deliveriesByAlertId.get(delivery.platformAlertId) ?? [];
      current.push(delivery);
      deliveriesByAlertId.set(delivery.platformAlertId, current);
    }

    return new Map(
      alertIds.map((alertId) => [
        alertId,
        this.buildPlatformAlertDeliverySummary(
          deliveriesByAlertId.get(alertId) ?? []
        )
      ])
    );
  }

  private buildPlatformAlertReviewCaseReasonCode(
    alert: Pick<PlatformAlertRecord, "dedupeKey">
  ): string {
    return `platform_alert:${alert.dedupeKey}`;
  }

  private buildPlatformAlertReviewCaseNotes(
    alert: Pick<PlatformAlertRecord, "code" | "summary" | "detail">,
    routeNote: string | null
  ): string {
    return [
      `Platform alert ${alert.code}: ${alert.summary}`,
      alert.detail?.trim() ? `Detail: ${alert.detail.trim()}` : null,
      routeNote
    ]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .join("\n\n");
  }

  private mapRoutedReviewCaseProjection(reviewCase: {
    id: string;
    status: ReviewCaseStatus;
    type: ReviewCaseType;
    reasonCode: string | null;
    assignedOperatorId: string | null;
  }): RoutedPlatformAlertReviewCaseProjection {
    return {
      id: reviewCase.id,
      status: reviewCase.status,
      type: reviewCase.type,
      reasonCode: reviewCase.reasonCode ?? null,
      assignedOperatorId: reviewCase.assignedOperatorId ?? null
    };
  }

  private ensureOpenPlatformAlert(
    alert: PlatformAlertRecord | null
  ): PlatformAlertRecord {
    if (!alert) {
      throw new NotFoundException("Platform alert not found.");
    }

    if (alert.status !== PlatformAlertStatus.open) {
      throw new ConflictException("Platform alert is already resolved.");
    }

    return alert;
  }

  private emitPlatformAlertDeliveryEvent(
    alert: PlatformAlertRecord,
    eventType: PlatformAlertDeliveryEventType,
    metadata?: Record<string, unknown>
  ): void {
    void this.platformAlertDeliveryService.enqueueAlertEvent({
      alert: this.buildPlatformAlertDeliveryPayload(alert),
      eventType,
      metadata
    });
  }

  private severityRank(severity: PlatformAlertSeverity): number {
    return severity === PlatformAlertSeverity.critical ? 2 : 1;
  }

  private resolveMatchingAutomationPolicy(
    alert: Pick<PlatformAlertRecord, "category" | "severity">
  ): PlatformAlertAutomationPolicyRuntimeConfig | null {
    return (
      this.platformAlertAutomationPolicies.find(
        (policy) =>
          policy.autoRouteToReviewCase &&
          policy.categories.includes(alert.category) &&
          this.severityRank(alert.severity) >=
            this.severityRank(policy.minimumSeverity)
      ) ?? null
    );
  }

  private async maybeAutoRoutePlatformAlert(
    alert: PlatformAlertRecord,
    trigger: "created" | "reopened" | "eligible_update",
    previousSeverity?: PlatformAlertSeverity
  ): Promise<void> {
    if (
      alert.status !== PlatformAlertStatus.open ||
      alert.routingStatus === PlatformAlertRoutingStatus.routed
    ) {
      return;
    }

    const policy = this.resolveMatchingAutomationPolicy(alert);

    if (!policy) {
      return;
    }

    const routeNote = [
      `Automatically routed by platform alert automation policy "${policy.name}".`,
      policy.routeNote
    ]
      .filter((value): value is string => Boolean(value && value.trim().length > 0))
      .join(" ");

    await this.routePlatformAlertToReviewCaseInternal(alert.id, {
      actorType: "system",
      actorId: "platform-alert-automation"
    }, {
      note: routeNote
    });

    await this.prismaService.auditEvent.create({
      data: {
        customerId: null,
        actorType: "system",
        actorId: "platform-alert-automation",
        action: "platform_alert.automation_policy_applied",
        targetType: "PlatformAlert",
        targetId: alert.id,
        metadata: {
          policyName: policy.name,
          trigger,
          previousSeverity: previousSeverity ?? null,
          currentSeverity: alert.severity,
          routeNote
        } as Prisma.InputJsonValue
      }
    });
  }

  private summarizeWorkerHealth(
    workers: WorkerRuntimeHealthProjection[],
    staleAfterSeconds: number
  ): OperationsStatusResult["workerHealth"] {
    const healthyWorkers = workers.filter(
      (worker) => worker.healthStatus === "healthy"
    ).length;
    const degradedWorkers = workers.filter(
      (worker) => worker.healthStatus === "degraded"
    ).length;
    const staleWorkers = workers.filter(
      (worker) => worker.healthStatus === "stale"
    ).length;

    let status: OperationsSectionStatus = "healthy";

    if (workers.length === 0 || staleWorkers > 0) {
      status = "critical";
    } else if (degradedWorkers > 0) {
      status = "warning";
    }

    return {
      status,
      staleAfterSeconds,
      totalWorkers: workers.length,
      healthyWorkers,
      degradedWorkers,
      staleWorkers
    };
  }

  private buildAlertCandidates(snapshot: {
    workers: WorkerRuntimeHealthProjection[];
    workerHealth: OperationsStatusResult["workerHealth"];
    queueHealth: OperationsStatusResult["queueHealth"];
    chainHealth: OperationsStatusResult["chainHealth"];
    treasuryHealth: OperationsStatusResult["treasuryHealth"];
    reconciliationHealth: OperationsStatusResult["reconciliationHealth"];
  }): PlatformAlertCandidate[] {
    const alertCandidates: PlatformAlertCandidate[] = [];

    if (snapshot.workerHealth.totalWorkers === 0) {
      alertCandidates.push({
        dedupeKey: "worker:no-heartbeats",
        category: PlatformAlertCategory.worker,
        severity: PlatformAlertSeverity.critical,
        code: "worker_runtime_absent",
        summary: "No worker heartbeats are being recorded.",
        detail:
          "The platform has no active worker runtime heartbeat coverage, so queue execution and reconciliation scheduling may be stopped.",
        metadata: {
          runbookPath:
            "docs/runbooks/operations-monitoring-and-alerts-api.md",
          staleAfterSeconds: snapshot.workerHealth.staleAfterSeconds
        }
      });
    }

    for (const worker of snapshot.workers) {
      if (worker.healthStatus === "stale") {
        alertCandidates.push({
          dedupeKey: `worker:stale:${worker.workerId}`,
          category: PlatformAlertCategory.worker,
          severity: PlatformAlertSeverity.critical,
          code: "worker_heartbeat_stale",
          summary: `Worker ${worker.workerId} heartbeat is stale.`,
          detail: `The last heartbeat for ${worker.workerId} was recorded at ${worker.lastHeartbeatAt}.`,
          metadata: {
            runbookPath:
              "docs/runbooks/operations-monitoring-and-alerts-api.md",
            workerId: worker.workerId,
            lastHeartbeatAt: worker.lastHeartbeatAt,
            staleAfterSeconds: snapshot.workerHealth.staleAfterSeconds
          }
        });
      }

      if (worker.healthStatus === "degraded") {
        const severity =
          worker.lastIterationStatus === "failed" ||
          worker.lastReconciliationScanStatus === "failed" ||
          worker.consecutiveFailureCount >= 3
            ? PlatformAlertSeverity.critical
            : PlatformAlertSeverity.warning;

        alertCandidates.push({
          dedupeKey: `worker:degraded:${worker.workerId}`,
          category: PlatformAlertCategory.worker,
          severity,
          code: "worker_runtime_degraded",
          summary: `Worker ${worker.workerId} is degraded.`,
          detail:
            worker.lastErrorMessage ??
            `Iteration status is ${worker.lastIterationStatus} with ${worker.consecutiveFailureCount} consecutive failures.`,
          metadata: {
            runbookPath:
              "docs/runbooks/operations-monitoring-and-alerts-api.md",
            workerId: worker.workerId,
            lastIterationStatus: worker.lastIterationStatus,
            lastErrorCode: worker.lastErrorCode,
            consecutiveFailureCount: worker.consecutiveFailureCount,
            lastReconciliationScanStatus: worker.lastReconciliationScanStatus
          }
        });
      }
    }

    if (
      snapshot.reconciliationHealth.criticalMismatchCount > 0 ||
      snapshot.reconciliationHealth.recentFailedScanCount > 0
    ) {
      alertCandidates.push({
        dedupeKey: "reconciliation:core-health",
        category: PlatformAlertCategory.reconciliation,
        severity:
          snapshot.reconciliationHealth.criticalMismatchCount > 0
            ? PlatformAlertSeverity.critical
            : PlatformAlertSeverity.warning,
        code: "ledger_reconciliation_attention_required",
        summary: "Ledger reconciliation requires operator attention.",
        detail: `Open critical mismatches: ${snapshot.reconciliationHealth.criticalMismatchCount}. Failed scans in the recent window: ${snapshot.reconciliationHealth.recentFailedScanCount}.`,
        metadata: {
          runbookPath:
            "docs/runbooks/operations-monitoring-and-alerts-api.md",
          openMismatchCount: snapshot.reconciliationHealth.openMismatchCount,
          criticalMismatchCount:
            snapshot.reconciliationHealth.criticalMismatchCount,
          recentFailedScanCount:
            snapshot.reconciliationHealth.recentFailedScanCount,
          latestScanStatus: snapshot.reconciliationHealth.latestScanStatus,
          latestScanStartedAt: snapshot.reconciliationHealth.latestScanStartedAt
        }
      });
    }

    if (
      snapshot.queueHealth.totalQueuedCount >= QUEUE_WARNING_COUNT ||
      snapshot.queueHealth.agedQueuedCount > 0 ||
      snapshot.queueHealth.manualWithdrawalBacklogCount > 0
    ) {
      alertCandidates.push({
        dedupeKey: "queue:backlog",
        category: PlatformAlertCategory.queue,
        severity:
          snapshot.queueHealth.totalQueuedCount >= QUEUE_CRITICAL_COUNT ||
          snapshot.queueHealth.manualWithdrawalBacklogCount >= 10 ||
          snapshot.queueHealth.oldestQueuedIntentCreatedAt !== null
            ? snapshot.queueHealth.status === "critical"
              ? PlatformAlertSeverity.critical
              : PlatformAlertSeverity.warning
            : PlatformAlertSeverity.warning,
        code: "execution_queue_backlog",
        summary: "Execution queue backlog is above the healthy envelope.",
        detail: `Queued deposits: ${snapshot.queueHealth.queuedDepositCount}. Queued withdrawals: ${snapshot.queueHealth.queuedWithdrawalCount}. Manual withdrawal backlog: ${snapshot.queueHealth.manualWithdrawalBacklogCount}.`,
        metadata: {
          runbookPath:
            "docs/runbooks/operations-monitoring-and-alerts-api.md",
          queuedDepositCount: snapshot.queueHealth.queuedDepositCount,
          queuedWithdrawalCount: snapshot.queueHealth.queuedWithdrawalCount,
          agedQueuedCount: snapshot.queueHealth.agedQueuedCount,
          manualWithdrawalBacklogCount:
            snapshot.queueHealth.manualWithdrawalBacklogCount,
          oldestQueuedIntentCreatedAt:
            snapshot.queueHealth.oldestQueuedIntentCreatedAt
        }
      });
    }

    if (
      snapshot.chainHealth.laggingBroadcastCount > 0 ||
      snapshot.chainHealth.recentFailedTransactionCount > 0
    ) {
      alertCandidates.push({
        dedupeKey: "chain:broadcast-health",
        category: PlatformAlertCategory.chain,
        severity:
          snapshot.chainHealth.criticalLaggingBroadcastCount > 0 ||
          snapshot.chainHealth.recentFailedTransactionCount >=
            CHAIN_FAILED_CRITICAL_COUNT
            ? PlatformAlertSeverity.critical
            : PlatformAlertSeverity.warning,
        code: "chain_broadcast_confirmation_lag",
        summary: "Broadcast confirmations are lagging or failing.",
        detail: `Lagging broadcasts: ${snapshot.chainHealth.laggingBroadcastCount}. Recent failed blockchain transactions: ${snapshot.chainHealth.recentFailedTransactionCount}.`,
        metadata: {
          runbookPath:
            "docs/runbooks/operations-monitoring-and-alerts-api.md",
          laggingBroadcastCount: snapshot.chainHealth.laggingBroadcastCount,
          criticalLaggingBroadcastCount:
            snapshot.chainHealth.criticalLaggingBroadcastCount,
          recentFailedTransactionCount:
            snapshot.chainHealth.recentFailedTransactionCount,
          oldestLaggingBroadcastCreatedAt:
            snapshot.chainHealth.oldestLaggingBroadcastCreatedAt
        }
      });
    }

    if (snapshot.treasuryHealth.missingManagedWalletCoverage) {
      alertCandidates.push({
        dedupeKey: "treasury:managed-wallet-coverage",
        category: PlatformAlertCategory.treasury,
        severity: PlatformAlertSeverity.critical,
        code: "managed_wallet_boundary_missing",
        summary: "Managed execution is missing treasury or operational wallet coverage.",
        detail: `Managed workers: ${snapshot.treasuryHealth.managedWorkerCount}. Active treasury wallets: ${snapshot.treasuryHealth.activeTreasuryWalletCount}. Active operational wallets: ${snapshot.treasuryHealth.activeOperationalWalletCount}.`,
        metadata: {
          runbookPath:
            "docs/runbooks/operations-monitoring-and-alerts-api.md",
          managedWorkerCount: snapshot.treasuryHealth.managedWorkerCount,
          activeTreasuryWalletCount:
            snapshot.treasuryHealth.activeTreasuryWalletCount,
          activeOperationalWalletCount:
            snapshot.treasuryHealth.activeOperationalWalletCount,
          chainId: this.productChainId
        }
      });
    }

    return alertCandidates;
  }

  private async syncPlatformAlerts(
    alertCandidates: PlatformAlertCandidate[],
    generatedAt: Date
  ): Promise<void> {
    const activeDedupeKeys = new Set(
      alertCandidates.map((candidate) => candidate.dedupeKey)
    );
    const existingAlerts = await this.prismaService.platformAlert.findMany({
      where: {
        dedupeKey: {
          in: alertCandidates.map((candidate) => candidate.dedupeKey)
        }
      }
    });
    const existingAlertsByDedupeKey = new Map(
      existingAlerts.map((alert) => [alert.dedupeKey, alert])
    );

    for (const candidate of alertCandidates) {
      const existingAlert = existingAlertsByDedupeKey.get(candidate.dedupeKey);

      if (!existingAlert) {
        const createdAlert = await this.prismaService.platformAlert.create({
          data: {
            dedupeKey: candidate.dedupeKey,
            category: candidate.category,
            severity: candidate.severity,
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
            code: candidate.code,
            summary: candidate.summary,
            detail: candidate.detail ?? null,
            metadata: candidate.metadata ?? Prisma.JsonNull,
            firstDetectedAt: generatedAt,
            lastDetectedAt: generatedAt,
            resolvedAt: null
          }
        });
        void this.platformAlertDeliveryService.enqueueAlertEvent({
          alert: this.buildPlatformAlertDeliveryPayload(createdAlert),
          eventType: PlatformAlertDeliveryEventType.opened
        });
        await this.maybeAutoRoutePlatformAlert(createdAlert, "created");
        continue;
      }

      const reopened = existingAlert.status === PlatformAlertStatus.resolved;
      const previousSeverity = existingAlert.severity;
      const eligibleBeforeUpdate =
        existingAlert.routingStatus === PlatformAlertRoutingStatus.unrouted &&
        this.resolveMatchingAutomationPolicy(existingAlert) !== null;

      const updatedAlert = await this.prismaService.platformAlert.update({
        where: {
          id: existingAlert.id
        },
        data: {
          category: candidate.category,
          severity: candidate.severity,
          status: PlatformAlertStatus.open,
          code: candidate.code,
          summary: candidate.summary,
          detail: candidate.detail ?? null,
          metadata: candidate.metadata ?? Prisma.JsonNull,
          firstDetectedAt: reopened ? generatedAt : undefined,
          lastDetectedAt: generatedAt,
          resolvedAt: null,
          routingStatus: reopened
            ? PlatformAlertRoutingStatus.unrouted
            : undefined,
          routingTargetType: reopened ? null : undefined,
          routingTargetId: reopened ? null : undefined,
          routedAt: reopened ? null : undefined,
          routedByOperatorId: reopened ? null : undefined,
          routingNote: reopened ? null : undefined,
          ownerOperatorId: reopened ? null : undefined,
          ownerAssignedAt: reopened ? null : undefined,
          ownerAssignedByOperatorId: reopened ? null : undefined,
          ownershipNote: reopened ? null : undefined,
          acknowledgedAt: reopened ? null : undefined,
          acknowledgedByOperatorId: reopened ? null : undefined,
          acknowledgementNote: reopened ? null : undefined,
          suppressedUntil: reopened ? null : undefined,
          suppressedByOperatorId: reopened ? null : undefined,
          suppressionNote: reopened ? null : undefined
        }
      });

      if (reopened) {
        void this.platformAlertDeliveryService.enqueueAlertEvent({
          alert: this.buildPlatformAlertDeliveryPayload(updatedAlert),
          eventType: PlatformAlertDeliveryEventType.reopened
        });
        await this.maybeAutoRoutePlatformAlert(
          updatedAlert,
          "reopened",
          previousSeverity
        );
        continue;
      }

      const eligibleAfterUpdate =
        updatedAlert.routingStatus === PlatformAlertRoutingStatus.unrouted &&
        this.resolveMatchingAutomationPolicy(updatedAlert) !== null;

      if (!eligibleBeforeUpdate && eligibleAfterUpdate) {
        await this.maybeAutoRoutePlatformAlert(
          updatedAlert,
          "eligible_update",
          previousSeverity
        );
      }
    }

    const existingOpenAlerts = await this.prismaService.platformAlert.findMany({
      where: {
        status: PlatformAlertStatus.open
      },
      select: {
        dedupeKey: true
      }
    });

    const resolvedAlertKeys = existingOpenAlerts
      .map((alert) => alert.dedupeKey)
      .filter((dedupeKey) => !activeDedupeKeys.has(dedupeKey));

    if (resolvedAlertKeys.length > 0) {
      await this.prismaService.platformAlert.updateMany({
        where: {
          dedupeKey: {
            in: resolvedAlertKeys
          },
          status: PlatformAlertStatus.open
        },
        data: {
          status: PlatformAlertStatus.resolved,
          resolvedAt: generatedAt,
          lastDetectedAt: generatedAt
        }
      });
    }
  }

  private async buildOperationsSnapshot(
    staleAfterSeconds: number
  ): Promise<OperationsSnapshot> {
    const failedScanSince = buildPastDate(FAILED_SCAN_LOOKBACK_HOURS);
    const failedBlockchainSince = buildPastDate(FAILED_BLOCKCHAIN_LOOKBACK_HOURS);
    const queueWarningBefore = buildPastDateSeconds(QUEUE_WARNING_AGE_SECONDS);
    const queueCriticalBefore = buildPastDateSeconds(QUEUE_CRITICAL_AGE_SECONDS);
    const chainWarningBefore = buildPastDateSeconds(CHAIN_WARNING_AGE_SECONDS);
    const chainCriticalBefore = buildPastDateSeconds(CHAIN_CRITICAL_AGE_SECONDS);

    const [
      workerRecords,
      queuedDepositCount,
      queuedWithdrawalCount,
      agedQueuedCount,
      oldestQueuedIntent,
      criticalLaggingBroadcastCount,
      warningLaggingBroadcastCount,
      oldestLaggingBroadcast,
      recentFailedTransactionCount,
      openMismatchCount,
      criticalMismatchCount,
      recentFailedScanCount,
      latestScanRun,
      activeTreasuryWalletCount,
      activeOperationalWalletCount,
      openReviewCaseCount,
      openOversightIncidentCount,
      activeRestrictedAccountCount
    ] = await Promise.all([
      this.prismaService.workerRuntimeHeartbeat.findMany({
        orderBy: {
          lastHeartbeatAt: "desc"
        }
      }),
      this.prismaService.transactionIntent.count({
        where: {
          status: TransactionIntentStatus.queued,
          intentType: TransactionIntentType.deposit
        }
      }),
      this.prismaService.transactionIntent.count({
        where: {
          status: TransactionIntentStatus.queued,
          intentType: TransactionIntentType.withdrawal
        }
      }),
      this.prismaService.transactionIntent.count({
        where: {
          status: TransactionIntentStatus.queued,
          createdAt: {
            lte: queueWarningBefore
          }
        }
      }),
      this.prismaService.transactionIntent.findFirst({
        where: {
          status: TransactionIntentStatus.queued
        },
        orderBy: {
          createdAt: "asc"
        },
        select: {
          createdAt: true
        }
      }),
      this.prismaService.blockchainTransaction.count({
        where: {
          status: BlockchainTransactionStatus.broadcast,
          confirmedAt: null,
          createdAt: {
            lte: chainCriticalBefore
          }
        }
      }),
      this.prismaService.blockchainTransaction.count({
        where: {
          status: BlockchainTransactionStatus.broadcast,
          confirmedAt: null,
          createdAt: {
            lte: chainWarningBefore
          }
        }
      }),
      this.prismaService.blockchainTransaction.findFirst({
        where: {
          status: BlockchainTransactionStatus.broadcast,
          confirmedAt: null,
          createdAt: {
            lte: chainWarningBefore
          }
        },
        orderBy: {
          createdAt: "asc"
        },
        select: {
          createdAt: true
        }
      }),
      this.prismaService.blockchainTransaction.count({
        where: {
          status: {
            in: [
              BlockchainTransactionStatus.failed,
              BlockchainTransactionStatus.dropped,
              BlockchainTransactionStatus.replaced
            ]
          },
          updatedAt: {
            gte: failedBlockchainSince
          }
        }
      }),
      this.prismaService.ledgerReconciliationMismatch.count({
        where: {
          status: LedgerReconciliationMismatchStatus.open
        }
      }),
      this.prismaService.ledgerReconciliationMismatch.count({
        where: {
          status: LedgerReconciliationMismatchStatus.open,
          severity: LedgerReconciliationMismatchSeverity.critical
        }
      }),
      this.prismaService.ledgerReconciliationScanRun.count({
        where: {
          status: LedgerReconciliationScanRunStatus.failed,
          startedAt: {
            gte: failedScanSince
          }
        }
      }),
      this.prismaService.ledgerReconciliationScanRun.findFirst({
        orderBy: {
          startedAt: "desc"
        },
        select: {
          status: true,
          startedAt: true
        }
      }),
      this.prismaService.wallet.count({
        where: {
          chainId: this.productChainId,
          kind: WalletKind.treasury,
          status: WalletStatus.active
        }
      }),
      this.prismaService.wallet.count({
        where: {
          chainId: this.productChainId,
          kind: WalletKind.operational,
          status: WalletStatus.active
        }
      }),
      this.prismaService.reviewCase.count({
        where: {
          status: {
            in: [ReviewCaseStatus.open, ReviewCaseStatus.in_progress]
          }
        }
      }),
      this.prismaService.oversightIncident.count({
        where: {
          status: {
            in: [OversightIncidentStatus.open, OversightIncidentStatus.in_progress]
          }
        }
      }),
      this.prismaService.customerAccount.count({
        where: {
          status: AccountLifecycleStatus.restricted
        }
      })
    ]);

    const workers = workerRecords.map((record) =>
      this.mapWorkerRuntimeHealthProjection(record, staleAfterSeconds)
    );
    const workerHealth = this.summarizeWorkerHealth(workers, staleAfterSeconds);

    const totalQueuedCount = queuedDepositCount + queuedWithdrawalCount;
    const manualWithdrawalBacklogCount = workers.reduce(
      (total, worker) =>
        total + readJsonNumber(worker.latestIterationMetrics, "manualWithdrawalBacklogCount"),
      0
    );
    const oldestQueuedIntentCreatedAt = oldestQueuedIntent?.createdAt.toISOString() ?? null;
    let queueStatus: OperationsSectionStatus = "healthy";

    if (
      totalQueuedCount >= QUEUE_CRITICAL_COUNT ||
      manualWithdrawalBacklogCount >= 10 ||
      (oldestQueuedIntentCreatedAt !== null &&
        new Date(oldestQueuedIntentCreatedAt).getTime() <=
          queueCriticalBefore.getTime())
    ) {
      queueStatus = "critical";
    } else if (
      totalQueuedCount >= QUEUE_WARNING_COUNT ||
      agedQueuedCount > 0 ||
      manualWithdrawalBacklogCount > 0
    ) {
      queueStatus = "warning";
    }

    const queueHealth: OperationsStatusResult["queueHealth"] = {
      status: queueStatus,
      queuedDepositCount,
      queuedWithdrawalCount,
      totalQueuedCount,
      agedQueuedCount,
      manualWithdrawalBacklogCount,
      oldestQueuedIntentCreatedAt
    };

    let chainStatus: OperationsSectionStatus = "healthy";

    if (
      criticalLaggingBroadcastCount > 0 ||
      recentFailedTransactionCount >= CHAIN_FAILED_CRITICAL_COUNT
    ) {
      chainStatus = "critical";
    } else if (
      warningLaggingBroadcastCount > 0 ||
      recentFailedTransactionCount >= CHAIN_FAILED_WARNING_COUNT
    ) {
      chainStatus = "warning";
    }

    const chainHealth: OperationsStatusResult["chainHealth"] = {
      status: chainStatus,
      laggingBroadcastCount: warningLaggingBroadcastCount,
      criticalLaggingBroadcastCount,
      recentFailedTransactionCount,
      oldestLaggingBroadcastCreatedAt:
        oldestLaggingBroadcast?.createdAt.toISOString() ?? null
    };

    const managedWorkerCount = workers.filter(
      (worker) =>
        worker.executionMode === WorkerRuntimeExecutionMode.managed &&
        worker.healthStatus !== "stale"
    ).length;
    const missingManagedWalletCoverage =
      managedWorkerCount > 0 &&
      (activeTreasuryWalletCount === 0 || activeOperationalWalletCount === 0);
    const treasuryStatus: OperationsSectionStatus = missingManagedWalletCoverage
      ? "critical"
      : "healthy";
    const treasuryHealth: OperationsStatusResult["treasuryHealth"] = {
      status: treasuryStatus,
      managedWorkerCount,
      activeTreasuryWalletCount,
      activeOperationalWalletCount,
      missingManagedWalletCoverage
    };

    let reconciliationStatus: OperationsSectionStatus = "healthy";

    if (criticalMismatchCount > 0 || recentFailedScanCount > 0) {
      reconciliationStatus = "critical";
    } else if (openMismatchCount > 0) {
      reconciliationStatus = "warning";
    }

    const reconciliationHealth: OperationsStatusResult["reconciliationHealth"] = {
      status: reconciliationStatus,
      openMismatchCount,
      criticalMismatchCount,
      recentFailedScanCount,
      latestScanStatus: latestScanRun?.status ?? null,
      latestScanStartedAt: latestScanRun?.startedAt.toISOString() ?? null
    };

    let incidentSafetyStatus: OperationsSectionStatus = "healthy";

    if (
      openReviewCaseCount >= INCIDENT_REVIEW_WARNING_COUNT ||
      openOversightIncidentCount >= INCIDENT_OVERSIGHT_WARNING_COUNT ||
      activeRestrictedAccountCount >= INCIDENT_RESTRICTED_WARNING_COUNT
    ) {
      incidentSafetyStatus = "warning";
    }

    const incidentSafety: OperationsStatusResult["incidentSafety"] = {
      status: incidentSafetyStatus,
      openReviewCaseCount,
      openOversightIncidentCount,
      activeRestrictedAccountCount
    };

    return {
      generatedAt: new Date(),
      staleAfterSeconds,
      workers,
      workerHealth,
      queueHealth,
      chainHealth,
      treasuryHealth,
      reconciliationHealth,
      incidentSafety,
      alertCandidates: this.buildAlertCandidates({
        workers,
        workerHealth,
        queueHealth,
        chainHealth,
        treasuryHealth,
        reconciliationHealth
      })
    };
  }

  async reportWorkerRuntimeHeartbeat(
    workerId: string,
    dto: ReportWorkerRuntimeHeartbeatDto
  ): Promise<WorkerRuntimeHeartbeatMutationResult> {
    const heartbeat = await this.prismaService.workerRuntimeHeartbeat.upsert({
      where: {
        workerId
      },
      create: {
        workerId,
        environment: dto.environment,
        executionMode: dto.executionMode,
        lastIterationStatus: dto.lastIterationStatus,
        lastHeartbeatAt: new Date(),
        lastIterationStartedAt: dto.lastIterationStartedAt
          ? new Date(dto.lastIterationStartedAt)
          : null,
        lastIterationCompletedAt: dto.lastIterationCompletedAt
          ? new Date(dto.lastIterationCompletedAt)
          : null,
        consecutiveFailureCount: dto.lastIterationStatus === "failed" ? 1 : 0,
        lastErrorCode: dto.lastErrorCode?.trim() || null,
        lastErrorMessage: dto.lastErrorMessage?.trim() || null,
        lastReconciliationScanRunId:
          dto.lastReconciliationScanRunId?.trim() || null,
        lastReconciliationScanStartedAt: dto.lastReconciliationScanStartedAt
          ? new Date(dto.lastReconciliationScanStartedAt)
          : null,
        lastReconciliationScanCompletedAt: dto.lastReconciliationScanCompletedAt
          ? new Date(dto.lastReconciliationScanCompletedAt)
          : null,
        lastReconciliationScanStatus:
          (dto.lastReconciliationScanStatus as LedgerReconciliationScanRunStatus | undefined) ??
          null,
        runtimeMetadata: dto.runtimeMetadata
          ? (dto.runtimeMetadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        latestIterationMetrics: dto.latestIterationMetrics
          ? ({
              ...dto.latestIterationMetrics,
              lastIterationDurationMs: dto.lastIterationDurationMs ?? null
            } as Prisma.InputJsonValue)
          : Prisma.JsonNull
      },
      update: {
        environment: dto.environment,
        executionMode: dto.executionMode,
        lastIterationStatus: dto.lastIterationStatus,
        lastHeartbeatAt: new Date(),
        lastIterationStartedAt: dto.lastIterationStartedAt
          ? new Date(dto.lastIterationStartedAt)
          : null,
        lastIterationCompletedAt: dto.lastIterationCompletedAt
          ? new Date(dto.lastIterationCompletedAt)
          : null,
        consecutiveFailureCount:
          dto.lastIterationStatus === "failed" ? { increment: 1 } : 0,
        lastErrorCode: dto.lastErrorCode?.trim() || null,
        lastErrorMessage: dto.lastErrorMessage?.trim() || null,
        lastReconciliationScanRunId:
          dto.lastReconciliationScanRunId?.trim() || null,
        lastReconciliationScanStartedAt: dto.lastReconciliationScanStartedAt
          ? new Date(dto.lastReconciliationScanStartedAt)
          : null,
        lastReconciliationScanCompletedAt: dto.lastReconciliationScanCompletedAt
          ? new Date(dto.lastReconciliationScanCompletedAt)
          : null,
        lastReconciliationScanStatus:
          (dto.lastReconciliationScanStatus as LedgerReconciliationScanRunStatus | undefined) ??
          null,
        runtimeMetadata: dto.runtimeMetadata
          ? (dto.runtimeMetadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        latestIterationMetrics: dto.latestIterationMetrics
          ? ({
              ...dto.latestIterationMetrics,
              lastIterationDurationMs: dto.lastIterationDurationMs ?? null
            } as Prisma.InputJsonValue)
          : Prisma.JsonNull
      }
    });

    return {
      heartbeat: this.mapWorkerRuntimeHealthProjection(
        heartbeat,
        DEFAULT_STALE_AFTER_SECONDS
      )
    };
  }

  async listWorkerRuntimeHealth(
    query: ListWorkerRuntimeHealthDto
  ): Promise<WorkerRuntimeHealthListResult> {
    const limit = query.limit ?? 20;
    const staleAfterSeconds =
      query.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
    const where: Prisma.WorkerRuntimeHeartbeatWhereInput = {};

    if (query.workerId?.trim()) {
      where.workerId = query.workerId.trim();
    }

    const records = await this.prismaService.workerRuntimeHeartbeat.findMany({
      where,
      orderBy: {
        lastHeartbeatAt: "desc"
      },
      ...(query.healthStatus ? {} : { take: limit })
    });

    const projectedWorkers = records
      .map((record) =>
        this.mapWorkerRuntimeHealthProjection(record, staleAfterSeconds)
      )
      .filter((record) =>
        query.healthStatus ? record.healthStatus === query.healthStatus : true
      );

    return {
      workers: projectedWorkers.slice(0, limit),
      limit,
      staleAfterSeconds,
      totalCount: projectedWorkers.length
    };
  }

  async getOperationsStatus(
    query: GetOperationsStatusDto
  ): Promise<OperationsStatusResult> {
    const staleAfterSeconds =
      query.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
    const recentAlertLimit = query.recentAlertLimit ?? DEFAULT_RECENT_ALERT_LIMIT;
    const snapshot = await this.buildOperationsSnapshot(staleAfterSeconds);

    await this.syncPlatformAlerts(snapshot.alertCandidates, snapshot.generatedAt);

    const [recentAlerts, openCount, criticalCount, warningCount] =
      await Promise.all([
        this.prismaService.platformAlert.findMany({
          where: {
            status: PlatformAlertStatus.open
          },
          orderBy: [
            {
              severity: "desc"
            },
            {
              lastDetectedAt: "desc"
            }
          ],
          take: recentAlertLimit
        }),
        this.prismaService.platformAlert.count({
          where: {
            status: PlatformAlertStatus.open
          }
        }),
        this.prismaService.platformAlert.count({
          where: {
            status: PlatformAlertStatus.open,
            severity: PlatformAlertSeverity.critical
          }
        }),
        this.prismaService.platformAlert.count({
          where: {
            status: PlatformAlertStatus.open,
            severity: PlatformAlertSeverity.warning
          }
        })
      ]);

    const deliverySummaryMap = await this.buildPlatformAlertDeliverySummaryMap(
      recentAlerts.map((alert) => alert.id)
    );

    return {
      generatedAt: snapshot.generatedAt.toISOString(),
      alertSummary: {
        openCount,
        criticalCount,
        warningCount
      },
      workerHealth: snapshot.workerHealth,
      queueHealth: snapshot.queueHealth,
      chainHealth: snapshot.chainHealth,
      treasuryHealth: snapshot.treasuryHealth,
      reconciliationHealth: snapshot.reconciliationHealth,
      incidentSafety: snapshot.incidentSafety,
      recentAlerts: recentAlerts.map((alert) =>
        this.mapPlatformAlertProjection(
          alert,
          deliverySummaryMap.get(alert.id)
        )
      )
    };
  }

  async listPlatformAlerts(
    query: ListPlatformAlertsDto
  ): Promise<PlatformAlertListResult> {
    const limit = query.limit ?? 20;
    const staleAfterSeconds =
      query.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
    const snapshot = await this.buildOperationsSnapshot(staleAfterSeconds);

    await this.syncPlatformAlerts(snapshot.alertCandidates, snapshot.generatedAt);

    const where: Prisma.PlatformAlertWhereInput = {};

    if (query.status) {
      where.status = query.status as PlatformAlertStatus;
    }

    if (query.severity) {
      where.severity = query.severity as PlatformAlertSeverity;
    }

    if (query.category) {
      where.category = query.category as PlatformAlertCategory;
    }

    if (query.routingStatus) {
      where.routingStatus = query.routingStatus as PlatformAlertRoutingStatus;
    }

    if (query.ownerOperatorId?.trim()) {
      where.ownerOperatorId = query.ownerOperatorId.trim();
    }

    if (query.acknowledged) {
      where.acknowledgedAt =
        query.acknowledged === "true" ? { not: null } : null;
    }

    if (query.suppressed) {
      if (query.suppressed === "true") {
        where.suppressedUntil = {
          gt: new Date()
        };
      } else {
        where.OR = [
          {
            suppressedUntil: null
          },
          {
            suppressedUntil: {
              lte: new Date()
            }
          }
        ];
      }
    }

    const alerts = await this.prismaService.platformAlert.findMany({
      where,
      orderBy: [
        {
          status: "asc"
        },
        {
          severity: "desc"
        },
        {
          lastDetectedAt: "desc"
        }
      ],
      take: limit
    });

    const totalCount = await this.prismaService.platformAlert.count({
      where
    });

    const deliverySummaryMap = await this.buildPlatformAlertDeliverySummaryMap(
      alerts.map((alert) => alert.id)
    );

    return {
      alerts: alerts.map((alert) =>
        this.mapPlatformAlertProjection(
          alert,
          deliverySummaryMap.get(alert.id)
        )
      ),
      limit,
      totalCount
    };
  }

  async assignPlatformAlertOwner(
    alertId: string,
    operatorId: string,
    ownerOperatorId: string,
    note?: string
  ): Promise<PlatformAlertGovernanceMutationResult> {
    const trimmedOwnerOperatorId = ownerOperatorId.trim();
    const ownershipNote = note?.trim() ? note.trim() : null;

    if (trimmedOwnerOperatorId.length === 0) {
      throw new BadRequestException("Owner operator id is required.");
    }

    const alert = this.ensureOpenPlatformAlert(
      await this.prismaService.platformAlert.findUnique({
        where: {
          id: alertId
        }
      })
    );
    const stateReused =
      alert.ownerOperatorId === trimmedOwnerOperatorId &&
      (alert.ownershipNote ?? null) === ownershipNote;

    if (stateReused) {
      return {
        alert: this.mapPlatformAlertProjection(alert),
        stateReused: true
      };
    }

    const updatedAlert = await this.prismaService.platformAlert.update({
      where: {
        id: alert.id
      },
      data: {
        ownerOperatorId: trimmedOwnerOperatorId,
        ownerAssignedAt: new Date(),
        ownerAssignedByOperatorId: operatorId,
        ownershipNote
      }
    });

    await this.prismaService.auditEvent.create({
      data: {
        customerId: null,
        actorType: "operator",
        actorId: operatorId,
        action: "platform_alert.owner_assigned",
        targetType: "PlatformAlert",
        targetId: alert.id,
        metadata: {
          previousOwnerOperatorId: alert.ownerOperatorId ?? null,
          ownerOperatorId: trimmedOwnerOperatorId,
          ownershipNote
        } as Prisma.InputJsonValue
      }
    });

    this.emitPlatformAlertDeliveryEvent(
      updatedAlert,
      PlatformAlertDeliveryEventType.owner_assigned,
      {
        ownerOperatorId: trimmedOwnerOperatorId,
        ownershipNote
      }
    );

    return {
      alert: this.mapPlatformAlertProjection(updatedAlert),
      stateReused: false
    };
  }

  async acknowledgePlatformAlert(
    alertId: string,
    operatorId: string,
    note?: string
  ): Promise<PlatformAlertGovernanceMutationResult> {
    const acknowledgementNote = note?.trim() ? note.trim() : null;
    const alert = this.ensureOpenPlatformAlert(
      await this.prismaService.platformAlert.findUnique({
        where: {
          id: alertId
        }
      })
    );

    if (alert.acknowledgedAt) {
      return {
        alert: this.mapPlatformAlertProjection(alert),
        stateReused: true
      };
    }

    const updatedAlert = await this.prismaService.platformAlert.update({
      where: {
        id: alert.id
      },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedByOperatorId: operatorId,
        acknowledgementNote
      }
    });

    await this.prismaService.auditEvent.create({
      data: {
        customerId: null,
        actorType: "operator",
        actorId: operatorId,
        action: "platform_alert.acknowledged",
        targetType: "PlatformAlert",
        targetId: alert.id,
        metadata: {
          acknowledgementNote
        } as Prisma.InputJsonValue
      }
    });

    this.emitPlatformAlertDeliveryEvent(
      updatedAlert,
      PlatformAlertDeliveryEventType.acknowledged,
      {
        acknowledgementNote
      }
    );

    return {
      alert: this.mapPlatformAlertProjection(updatedAlert),
      stateReused: false
    };
  }

  async suppressPlatformAlert(
    alertId: string,
    operatorId: string,
    suppressedUntil: Date,
    note?: string
  ): Promise<PlatformAlertGovernanceMutationResult> {
    if (suppressedUntil.getTime() <= Date.now()) {
      throw new BadRequestException(
        "Suppressed-until must be in the future."
      );
    }

    const suppressionNote = note?.trim() ? note.trim() : null;
    const alert = this.ensureOpenPlatformAlert(
      await this.prismaService.platformAlert.findUnique({
        where: {
          id: alertId
        }
      })
    );
    const stateReused =
      alert.suppressedUntil?.toISOString() === suppressedUntil.toISOString() &&
      (alert.suppressionNote ?? null) === suppressionNote;

    if (stateReused) {
      return {
        alert: this.mapPlatformAlertProjection(alert),
        stateReused: true
      };
    }

    const updatedAlert = await this.prismaService.platformAlert.update({
      where: {
        id: alert.id
      },
      data: {
        suppressedUntil,
        suppressedByOperatorId: operatorId,
        suppressionNote
      }
    });

    await this.prismaService.auditEvent.create({
      data: {
        customerId: null,
        actorType: "operator",
        actorId: operatorId,
        action: "platform_alert.suppressed",
        targetType: "PlatformAlert",
        targetId: alert.id,
        metadata: {
          previousSuppressedUntil: alert.suppressedUntil?.toISOString() ?? null,
          suppressedUntil: suppressedUntil.toISOString(),
          suppressionNote
        } as Prisma.InputJsonValue
      }
    });

    this.emitPlatformAlertDeliveryEvent(
      updatedAlert,
      PlatformAlertDeliveryEventType.suppressed,
      {
        suppressedUntil: suppressedUntil.toISOString(),
        suppressionNote
      }
    );

    return {
      alert: this.mapPlatformAlertProjection(updatedAlert),
      stateReused: false
    };
  }

  async clearPlatformAlertSuppression(
    alertId: string,
    operatorId: string,
    note?: string
  ): Promise<PlatformAlertGovernanceMutationResult> {
    const suppressionNote = note?.trim() ? note.trim() : null;
    const alert = this.ensureOpenPlatformAlert(
      await this.prismaService.platformAlert.findUnique({
        where: {
          id: alertId
        }
      })
    );

    if (!alert.suppressedUntil || alert.suppressedUntil.getTime() <= Date.now()) {
      return {
        alert: this.mapPlatformAlertProjection(alert),
        stateReused: true
      };
    }

    const updatedAlert = await this.prismaService.platformAlert.update({
      where: {
        id: alert.id
      },
      data: {
        suppressedUntil: null,
        suppressedByOperatorId: null,
        suppressionNote
      }
    });

    await this.prismaService.auditEvent.create({
      data: {
        customerId: null,
        actorType: "operator",
        actorId: operatorId,
        action: "platform_alert.suppression_cleared",
        targetType: "PlatformAlert",
        targetId: alert.id,
        metadata: {
          previousSuppressedUntil: alert.suppressedUntil.toISOString(),
          suppressionNote
        } as Prisma.InputJsonValue
      }
    });

    this.emitPlatformAlertDeliveryEvent(
      updatedAlert,
      PlatformAlertDeliveryEventType.suppression_cleared,
      {
        previousSuppressedUntil: alert.suppressedUntil.toISOString(),
        suppressionNote
      }
    );

    return {
      alert: this.mapPlatformAlertProjection(updatedAlert),
      stateReused: false
    };
  }

  async retryFailedPlatformAlertDeliveries(
    alertId: string,
    operatorId: string,
    note?: string
  ): Promise<{ retriedDeliveryCount: number }> {
    const alert = await this.prismaService.platformAlert.findUnique({
      where: {
        id: alertId
      }
    });

    if (!alert) {
      throw new NotFoundException("Platform alert not found.");
    }

    const retriedDeliveryCount =
      await this.platformAlertDeliveryService.retryFailedDeliveriesForAlert(alertId);

    if (retriedDeliveryCount > 0) {
      await this.prismaService.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operatorId,
          action: "platform_alert.delivery_retry_requested",
          targetType: "PlatformAlert",
          targetId: alert.id,
          metadata: {
            retriedDeliveryCount,
            note: note?.trim() ? note.trim() : null
          } as Prisma.InputJsonValue
        }
      });
    }

    return {
      retriedDeliveryCount
    };
  }

  private async routePlatformAlertToReviewCaseInternal(
    alertId: string,
    actor: RoutePlatformAlertActor,
    dto: RoutePlatformAlertToReviewCaseDto
  ): Promise<RoutePlatformAlertResult> {
    const routeNote = dto.note?.trim() ? dto.note.trim() : null;
    const result = await this.prismaService.$transaction(async (transaction) => {
      const alert = this.ensureOpenPlatformAlert(
        await transaction.platformAlert.findUnique({
          where: {
            id: alertId
          }
        })
      );

      const reviewCaseResult = await this.reviewCasesService.openOrReuseReviewCase(
        transaction,
        {
          customerId: null,
          customerAccountId: null,
          transactionIntentId: null,
          type: ReviewCaseType.manual_intervention,
          reasonCode: this.buildPlatformAlertReviewCaseReasonCode(alert),
          notes: this.buildPlatformAlertReviewCaseNotes(alert, routeNote),
          actorType: actor.actorType,
          actorId: actor.actorId,
          auditAction: "review_case.platform_alert.opened",
          auditMetadata: {
            platformAlertId: alert.id,
            platformAlertDedupeKey: alert.dedupeKey,
            platformAlertCategory: alert.category,
            platformAlertSeverity: alert.severity,
            platformAlertCode: alert.code,
            platformAlertSummary: alert.summary,
            routeNote
          }
        }
      );

      const routingStateReused =
        alert.routingStatus === PlatformAlertRoutingStatus.routed &&
        alert.routingTargetType === PlatformAlertRoutingTargetType.review_case &&
        alert.routingTargetId === reviewCaseResult.reviewCase.id;
      const routedAt = routingStateReused ? alert.routedAt ?? new Date() : new Date();
      const routedByOperatorId =
        actor.actorType === "operator"
          ? routingStateReused
            ? alert.routedByOperatorId ?? actor.actorId
            : actor.actorId
          : null;
      const updatedAlert = await transaction.platformAlert.update({
        where: {
          id: alert.id
        },
        data: {
          routingStatus: PlatformAlertRoutingStatus.routed,
          routingTargetType: PlatformAlertRoutingTargetType.review_case,
          routingTargetId: reviewCaseResult.reviewCase.id,
          routedAt,
          routedByOperatorId,
          routingNote: routeNote
        }
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "platform_alert.routed_to_review_case",
          targetType: "PlatformAlert",
          targetId: alert.id,
          metadata: {
            platformAlertDedupeKey: alert.dedupeKey,
            platformAlertCategory: alert.category,
            platformAlertSeverity: alert.severity,
            platformAlertCode: alert.code,
            reviewCaseId: reviewCaseResult.reviewCase.id,
            reviewCaseReasonCode: reviewCaseResult.reviewCase.reasonCode,
            reviewCaseStatus: reviewCaseResult.reviewCase.status,
            reviewCaseReused: reviewCaseResult.reviewCaseReused,
            routingStateReused,
            routeNote,
            initiatedBy: actor.actorType
          } as Prisma.InputJsonValue
        }
      });

      return {
        alert: this.mapPlatformAlertProjection(updatedAlert),
        reviewCase: this.mapRoutedReviewCaseProjection(reviewCaseResult.reviewCase),
        reviewCaseReused: reviewCaseResult.reviewCaseReused,
        routingStateReused
      };
    });

    this.emitPlatformAlertDeliveryEvent(
      {
        id: result.alert.id,
        dedupeKey: result.alert.dedupeKey,
        category: result.alert.category,
        severity: result.alert.severity,
        status: result.alert.status,
        routingStatus: result.alert.routingStatus as PlatformAlertRoutingStatus,
        routingTargetType: result.alert.routingTargetType,
        routingTargetId: result.alert.routingTargetId,
        routedAt: result.alert.routedAt ? new Date(result.alert.routedAt) : null,
        routedByOperatorId: result.alert.routedByOperatorId,
        routingNote: result.alert.routingNote,
        ownerOperatorId: result.alert.ownerOperatorId,
        ownerAssignedAt: result.alert.ownerAssignedAt
          ? new Date(result.alert.ownerAssignedAt)
          : null,
        ownerAssignedByOperatorId: result.alert.ownerAssignedByOperatorId,
        ownershipNote: result.alert.ownershipNote,
        acknowledgedAt: result.alert.acknowledgedAt
          ? new Date(result.alert.acknowledgedAt)
          : null,
        acknowledgedByOperatorId: result.alert.acknowledgedByOperatorId,
        acknowledgementNote: result.alert.acknowledgementNote,
        suppressedUntil: result.alert.suppressedUntil
          ? new Date(result.alert.suppressedUntil)
          : null,
        suppressedByOperatorId: result.alert.suppressedByOperatorId,
        suppressionNote: result.alert.suppressionNote,
        code: result.alert.code,
        summary: result.alert.summary,
        detail: result.alert.detail,
        metadata: result.alert.metadata,
        firstDetectedAt: new Date(result.alert.firstDetectedAt),
        lastDetectedAt: new Date(result.alert.lastDetectedAt),
        resolvedAt: result.alert.resolvedAt ? new Date(result.alert.resolvedAt) : null,
        createdAt: new Date(result.alert.createdAt),
        updatedAt: new Date(result.alert.updatedAt)
      },
      PlatformAlertDeliveryEventType.routed_to_review_case,
      {
        reviewCaseId: result.reviewCase.id,
        routingStateReused: result.routingStateReused,
        initiatedBy: actor.actorType
      }
    );

    return result;
  }

  async routePlatformAlertToReviewCase(
    alertId: string,
    operatorId: string,
    dto: RoutePlatformAlertToReviewCaseDto
  ): Promise<RoutePlatformAlertResult> {
    return this.routePlatformAlertToReviewCaseInternal(
      alertId,
      {
        actorType: "operator",
        actorId: operatorId
      },
      dto
    );
  }

  async routeCriticalPlatformAlerts(
    operatorId: string,
    dto: RouteCriticalPlatformAlertsDto
  ): Promise<RouteCriticalPlatformAlertsResult> {
    const limit = dto.limit ?? 10;
    const staleAfterSeconds =
      dto.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
    const snapshot = await this.buildOperationsSnapshot(staleAfterSeconds);

    await this.syncPlatformAlerts(snapshot.alertCandidates, snapshot.generatedAt);

    const alerts = await this.prismaService.platformAlert.findMany({
      where: {
        status: PlatformAlertStatus.open,
        severity: PlatformAlertSeverity.critical,
        routingStatus: PlatformAlertRoutingStatus.unrouted
      },
      orderBy: [
        {
          lastDetectedAt: "desc"
        },
        {
          createdAt: "asc"
        }
      ],
      take: limit
    });

    const routedAlerts: RoutePlatformAlertResult[] = [];

    for (const alert of alerts) {
      routedAlerts.push(
        await this.routePlatformAlertToReviewCase(alert.id, operatorId, {
          note: dto.note
        })
      );
    }

    const remainingUnroutedCriticalAlertCount =
      await this.prismaService.platformAlert.count({
        where: {
          status: PlatformAlertStatus.open,
          severity: PlatformAlertSeverity.critical,
          routingStatus: PlatformAlertRoutingStatus.unrouted
        }
      });

    return {
      routedAlerts,
      limit,
      remainingUnroutedCriticalAlertCount,
      staleAfterSeconds
    };
  }

  async renderPrometheusMetrics(
    query: GetOperationsMetricsDto,
    apiRequestMetricsService: ApiRequestMetricsService
  ): Promise<string> {
    const staleAfterSeconds =
      query.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
    const snapshot = await this.buildOperationsSnapshot(staleAfterSeconds);

    await this.syncPlatformAlerts(snapshot.alertCandidates, snapshot.generatedAt);

    const openAlerts = await this.prismaService.platformAlert.findMany({
      where: {
        status: PlatformAlertStatus.open
      }
    });

    const alertCounts = new Map<string, number>();

    for (const alert of openAlerts) {
      const key = `${alert.category}|${alert.severity}`;
      alertCounts.set(key, (alertCounts.get(key) ?? 0) + 1);
    }

    const lines: string[] = [
      apiRequestMetricsService.renderPrometheusMetrics().trimEnd(),
      "# HELP stb_operations_workers_total Current worker counts by health status.",
      "# TYPE stb_operations_workers_total gauge",
      formatPrometheusLine(
        "stb_operations_workers_total",
        snapshot.workerHealth.healthyWorkers,
        { health_status: "healthy" }
      ),
      formatPrometheusLine(
        "stb_operations_workers_total",
        snapshot.workerHealth.degradedWorkers,
        { health_status: "degraded" }
      ),
      formatPrometheusLine(
        "stb_operations_workers_total",
        snapshot.workerHealth.staleWorkers,
        { health_status: "stale" }
      ),
      "# HELP stb_operations_queue_intents_total Current queued intent backlog by intent type.",
      "# TYPE stb_operations_queue_intents_total gauge",
      formatPrometheusLine(
        "stb_operations_queue_intents_total",
        snapshot.queueHealth.queuedDepositCount,
        { intent_type: "deposit" }
      ),
      formatPrometheusLine(
        "stb_operations_queue_intents_total",
        snapshot.queueHealth.queuedWithdrawalCount,
        { intent_type: "withdrawal" }
      ),
      "# HELP stb_operations_queue_aged_total Current queued intents older than the warning threshold.",
      "# TYPE stb_operations_queue_aged_total gauge",
      formatPrometheusLine(
        "stb_operations_queue_aged_total",
        snapshot.queueHealth.agedQueuedCount
      ),
      "# HELP stb_operations_manual_withdrawal_backlog_total Current manual withdrawal backlog for managed execution.",
      "# TYPE stb_operations_manual_withdrawal_backlog_total gauge",
      formatPrometheusLine(
        "stb_operations_manual_withdrawal_backlog_total",
        snapshot.queueHealth.manualWithdrawalBacklogCount
      ),
      "# HELP stb_operations_chain_lagging_broadcasts_total Current lagging blockchain broadcasts by severity window.",
      "# TYPE stb_operations_chain_lagging_broadcasts_total gauge",
      formatPrometheusLine(
        "stb_operations_chain_lagging_broadcasts_total",
        snapshot.chainHealth.laggingBroadcastCount,
        { severity_window: "warning" }
      ),
      formatPrometheusLine(
        "stb_operations_chain_lagging_broadcasts_total",
        snapshot.chainHealth.criticalLaggingBroadcastCount,
        { severity_window: "critical" }
      ),
      "# HELP stb_operations_chain_failed_transactions_recent_total Recent failed blockchain transactions inside the monitoring window.",
      "# TYPE stb_operations_chain_failed_transactions_recent_total gauge",
      formatPrometheusLine(
        "stb_operations_chain_failed_transactions_recent_total",
        snapshot.chainHealth.recentFailedTransactionCount
      ),
      "# HELP stb_operations_treasury_wallets_total Active treasury wallet counts by kind.",
      "# TYPE stb_operations_treasury_wallets_total gauge",
      formatPrometheusLine(
        "stb_operations_treasury_wallets_total",
        snapshot.treasuryHealth.activeTreasuryWalletCount,
        { kind: "treasury" }
      ),
      formatPrometheusLine(
        "stb_operations_treasury_wallets_total",
        snapshot.treasuryHealth.activeOperationalWalletCount,
        { kind: "operational" }
      ),
      "# HELP stb_operations_managed_wallet_coverage_missing Whether managed execution is missing treasury or operational wallet coverage.",
      "# TYPE stb_operations_managed_wallet_coverage_missing gauge",
      formatPrometheusLine(
        "stb_operations_managed_wallet_coverage_missing",
        snapshot.treasuryHealth.missingManagedWalletCoverage ? 1 : 0
      ),
      "# HELP stb_operations_reconciliation_mismatches_total Current open reconciliation mismatches by severity view.",
      "# TYPE stb_operations_reconciliation_mismatches_total gauge",
      formatPrometheusLine(
        "stb_operations_reconciliation_mismatches_total",
        snapshot.reconciliationHealth.openMismatchCount,
        { severity_view: "all" }
      ),
      formatPrometheusLine(
        "stb_operations_reconciliation_mismatches_total",
        snapshot.reconciliationHealth.criticalMismatchCount,
        { severity_view: "critical" }
      ),
      "# HELP stb_operations_reconciliation_failed_scans_recent_total Recent failed reconciliation scans inside the monitoring window.",
      "# TYPE stb_operations_reconciliation_failed_scans_recent_total gauge",
      formatPrometheusLine(
        "stb_operations_reconciliation_failed_scans_recent_total",
        snapshot.reconciliationHealth.recentFailedScanCount
      ),
      "# HELP stb_operations_incident_open_total Current incident and review pressure.",
      "# TYPE stb_operations_incident_open_total gauge",
      formatPrometheusLine(
        "stb_operations_incident_open_total",
        snapshot.incidentSafety.openReviewCaseCount,
        { incident_type: "review_case" }
      ),
      formatPrometheusLine(
        "stb_operations_incident_open_total",
        snapshot.incidentSafety.openOversightIncidentCount,
        { incident_type: "oversight_incident" }
      ),
      formatPrometheusLine(
        "stb_operations_incident_open_total",
        snapshot.incidentSafety.activeRestrictedAccountCount,
        { incident_type: "restricted_account" }
      ),
      "# HELP stb_platform_alerts_open_total Current open platform alerts by category and severity.",
      "# TYPE stb_platform_alerts_open_total gauge"
    ];

    for (const [key, count] of alertCounts.entries()) {
      const [category, severity] = key.split("|");
      lines.push(
        formatPrometheusLine("stb_platform_alerts_open_total", count, {
          category,
          severity
        })
      );
    }

    lines.push(
      "# HELP stb_worker_runtime_heartbeat_age_seconds Current heartbeat age per worker.",
      "# TYPE stb_worker_runtime_heartbeat_age_seconds gauge",
      "# HELP stb_worker_latest_iteration_metric Latest worker iteration metric value per worker.",
      "# TYPE stb_worker_latest_iteration_metric gauge"
    );

    for (const worker of snapshot.workers) {
      const heartbeatAgeSeconds = Math.max(
        0,
        (Date.now() - new Date(worker.lastHeartbeatAt).getTime()) / 1000
      );

      lines.push(
        formatPrometheusLine(
          "stb_worker_runtime_heartbeat_age_seconds",
          heartbeatAgeSeconds,
          {
            worker_id: worker.workerId,
            environment: worker.environment,
            execution_mode: worker.executionMode,
            health_status: worker.healthStatus
          }
        )
      );

      for (const metricKey of WORKER_ITERATION_METRIC_KEYS) {
        lines.push(
          formatPrometheusLine(
            "stb_worker_latest_iteration_metric",
            readJsonNumber(worker.latestIterationMetrics, metricKey),
            {
              worker_id: worker.workerId,
              execution_mode: worker.executionMode,
              metric: metricKey
            }
          )
        );
      }
    }

    return `${lines.join("\n")}\n`;
  }
}
