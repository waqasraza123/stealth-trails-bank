import {
  formatReferenceValue,
  getSystemHealthTone,
  getTransactionConfidenceTone,
  inferSystemHealthStatus,
  isTimestampOlderThan,
  mapIntentStatusToConfidence,
  type TimelineEvent
} from "@stealth-trails-bank/ui-foundation";
import type {
  AuditTimelineEntry,
  OperationsStatus,
  OversightIncidentEvent,
  PlatformAlert,
  ReleaseReadinessApproval,
  ReleaseReadinessEvidence,
  ReviewCaseEvent,
  TransactionIntent
} from "@/lib/types";
import { useOperatorSession } from "@/state/operator-session";
import { EmptyState } from "@/components/console/primitives";
import { formatDateTime, shortenValue, toTitleCase } from "@/lib/format";

export function useConfiguredSessionGuard() {
  const { configuredSession } = useOperatorSession();

  if (!configuredSession) {
    return {
      session: null,
      fallback: (
        <EmptyState
          title="Credentials required"
          description="Save an operator session to load queues, reconciliation workspaces, treasury visibility, and launch readiness evidence."
        />
      )
    };
  }

  return {
    session: configuredSession,
    fallback: null
  };
}

type Tone = "neutral" | "positive" | "warning" | "critical" | "technical";

export function mapStatusToTone(value: string | null | undefined): Tone {
  const normalized = value?.toLowerCase() ?? "";

  if (
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("dismiss") ||
    normalized.includes("blocked") ||
    normalized.includes("critical")
  ) {
    return "critical";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("review") ||
    normalized.includes("queued") ||
    normalized.includes("warning") ||
    normalized.includes("paused")
  ) {
    return "warning";
  }

  if (
    normalized.includes("confirm") ||
    normalized.includes("broadcast") ||
    normalized.includes("technical")
  ) {
    return "technical";
  }

  if (
    normalized.includes("healthy") ||
    normalized.includes("active") ||
    normalized.includes("ready") ||
    normalized.includes("approved") ||
    normalized.includes("resolved") ||
    normalized.includes("complete") ||
    normalized.includes("pass")
  ) {
    return "positive";
  }

  return "neutral";
}

export function buildSystemHealthTone(operations: OperationsStatus | undefined, releaseBlocked: boolean) {
  const status = inferSystemHealthStatus({
    releaseBlocked,
    blockedWorkflows:
      (operations?.alertSummary.criticalCount ?? 0) +
      ((operations?.queueHealth.agedQueuedCount ?? 0) > 0 ? 1 : 0),
    degradedServices: [
      operations?.workerHealth.status,
      operations?.queueHealth.status,
      operations?.chainHealth.status,
      operations?.treasuryHealth.status,
      operations?.reconciliationHealth.status,
      operations?.incidentSafety.status
    ].filter((value) => value === "warning" || value === "critical").length
  });

  return getSystemHealthTone(status);
}

export function mapAuditEntriesToTimeline(entries: AuditTimelineEntry[]): TimelineEvent[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: toTitleCase(entry.action),
    description: `${toTitleCase(entry.targetType)} ${formatReferenceValue(
      entry.targetId,
      "Not available",
      6
    )} by ${toTitleCase(entry.actorType)} ${entry.actorId ?? "system"}.`,
    timestamp: entry.createdAt,
    tone: mapStatusToTone(entry.action),
    metadata: [
      { label: "Actor", value: entry.actorId ?? "system" },
      { label: "Target", value: shortenValue(entry.targetId) }
    ]
  }));
}

export function mapReviewCaseEventsToTimeline(entries: ReviewCaseEvent[]): TimelineEvent[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: toTitleCase(entry.eventType),
    description:
      entry.note ?? `Event recorded by ${toTitleCase(entry.actorType)} ${entry.actorId ?? "system"}.`,
    timestamp: entry.createdAt,
    tone: mapStatusToTone(entry.eventType),
    metadata: [{ label: "Actor", value: entry.actorId ?? "system" }]
  }));
}

export function mapOversightEventsToTimeline(entries: OversightIncidentEvent[]): TimelineEvent[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: toTitleCase(entry.eventType),
    description:
      entry.note ?? `Oversight activity recorded by ${toTitleCase(entry.actorType)} ${entry.actorId ?? "system"}.`,
    timestamp: entry.createdAt,
    tone: mapStatusToTone(entry.eventType),
    metadata: [{ label: "Actor", value: entry.actorId ?? "system" }]
  }));
}

export function mapIntentToTimeline(intent: TransactionIntent): TimelineEvent[] {
  const confidence = mapIntentStatusToConfidence(intent.status);
  const events: TimelineEvent[] = [
    {
      id: `${intent.id}-recorded`,
      label: "Intent recorded",
      description: `${toTitleCase(intent.intentType)} intent entered the managed workflow.`,
      timestamp: intent.createdAt,
      tone: "neutral",
      metadata: [{ label: "Reference", value: intent.id }]
    },
    {
      id: `${intent.id}-state`,
      label: toTitleCase(intent.status),
      description: `Policy decision: ${toTitleCase(intent.policyDecision)}.`,
      timestamp: intent.updatedAt,
      tone: getTransactionConfidenceTone(confidence)
    }
  ];

  if (intent.latestBlockchainTransaction?.txHash) {
    events.push({
      id: `${intent.id}-tx`,
      label: "Chain trace available",
      description: "A blockchain transaction reference is attached to the intent.",
      timestamp: intent.latestBlockchainTransaction.updatedAt,
      tone: "technical",
      metadata: [{ label: "Hash", value: intent.latestBlockchainTransaction.txHash }]
    });
  }

  if (intent.failureReason) {
    events.push({
      id: `${intent.id}-failure`,
      label: "Failure context",
      description: intent.failureReason,
      timestamp: intent.updatedAt,
      tone: "critical"
    });
  }

  return events;
}

export function mapPlatformAlertToTimeline(alert: PlatformAlert): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: `${alert.id}-detected`,
      label: "Alert detected",
      description: alert.summary,
      timestamp: alert.firstDetectedAt,
      tone: mapStatusToTone(alert.severity),
      metadata: [{ label: "Code", value: alert.code }]
    }
  ];

  if (alert.ownerOperatorId) {
    events.push({
      id: `${alert.id}-owner`,
      label: "Owner assigned",
      description: `Owned by ${alert.ownerOperatorId}.`,
      timestamp: alert.ownerAssignedAt,
      tone: "warning"
    });
  }

  if (alert.acknowledgedAt) {
    events.push({
      id: `${alert.id}-ack`,
      label: "Alert acknowledged",
      description: alert.acknowledgementNote ?? "Acknowledged by an operator.",
      timestamp: alert.acknowledgedAt,
      tone: "technical"
    });
  }

  if (alert.hasActiveSuppression) {
    events.push({
      id: `${alert.id}-suppression`,
      label: "Suppression active",
      description: alert.suppressionNote ?? "Alert is currently suppressed.",
      timestamp: alert.suppressedUntil,
      tone: "warning"
    });
  }

  return events;
}

export function mapReleaseEvidenceToTimeline(
  evidence: ReleaseReadinessEvidence[]
): TimelineEvent[] {
  return evidence.map((item) => ({
    id: item.id,
    label: toTitleCase(item.evidenceType),
    description: item.summary,
    timestamp: item.observedAt,
    tone: mapStatusToTone(item.status),
    metadata: [
      { label: "Environment", value: item.environment },
      { label: "Release", value: item.releaseIdentifier ?? "none" }
    ]
  }));
}

export function buildApprovalGateNotice(approval: ReleaseReadinessApproval | null) {
  if (!approval) {
    return null;
  }

  if (approval.gate.staleEvidenceTypes.length > 0) {
    return {
      tone: "warning" as const,
      title: "Stale evidence requires attention",
      description: `Refresh ${approval.gate.staleEvidenceTypes.join(", ")} before approving this release.`
    };
  }

  if (approval.gate.failedEvidenceTypes.length > 0 || approval.gate.openBlockers.length > 0) {
    return {
      tone: "critical" as const,
      title: "Approval is currently blocked",
      description: "Failed evidence or open blockers are preventing a clean approval decision."
    };
  }

  return {
    tone: "positive" as const,
    title: "Approval gate is review-ready",
    description: "Evidence and checklist posture allow a governed approval decision."
  };
}

export function isEvidenceStale(observedAt: string | null | undefined, maxAgeHours: number) {
  return isTimestampOlderThan(observedAt, maxAgeHours);
}

export function buildObservedAtLabel(value: string | null | undefined) {
  return value ? formatDateTime(value) : "Not available";
}
