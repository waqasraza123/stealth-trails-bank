export type SystemHealthStatus =
  | "healthy"
  | "degraded"
  | "blocked"
  | "launch_ineligible";

export type PresentationLocale = "en" | "ar";

export type TransactionConfidenceStatus =
  | "submitted"
  | "under_review"
  | "queued"
  | "sent_to_network"
  | "confirming"
  | "complete"
  | "failed"
  | "action_needed";

export type TimelineEventTone =
  | "neutral"
  | "positive"
  | "warning"
  | "critical"
  | "technical";

export type TimelineEvent = {
  id: string;
  label: string;
  description?: string;
  timestamp?: string | null;
  tone?: TimelineEventTone;
  metadata?: Array<{
    label: string;
    value: string;
  }>;
};

const confidenceLabelCatalog = {
  en: {
    submitted: "Submitted",
    under_review: "Under review",
    queued: "Queued",
    sent_to_network: "Sent to network",
    confirming: "Confirming",
    complete: "Complete",
    failed: "Failed",
    action_needed: "Action needed"
  },
  ar: {
    submitted: "تم الإرسال",
    under_review: "قيد المراجعة",
    queued: "في قائمة الانتظار",
    sent_to_network: "أُرسل إلى الشبكة",
    confirming: "قيد التأكيد",
    complete: "مكتمل",
    failed: "فشل",
    action_needed: "يتطلب إجراء"
  }
} as const;

const systemHealthLabelCatalog = {
  en: {
    healthy: "Healthy",
    degraded: "Degraded",
    blocked: "Blocked",
    launch_ineligible: "Launch ineligible"
  },
  ar: {
    healthy: "سليم",
    degraded: "متدهور",
    blocked: "محجوب",
    launch_ineligible: "غير مؤهل للإطلاق"
  }
} as const;

export function mapIntentStatusToConfidence(
  status: string
): TransactionConfidenceStatus {
  switch (status) {
    case "requested":
      return "submitted";
    case "review_required":
    case "approved":
      return "under_review";
    case "queued":
      return "queued";
    case "broadcast":
      return "sent_to_network";
    case "confirmed":
      return "confirming";
    case "settled":
    case "manually_resolved":
      return "complete";
    case "failed":
    case "cancelled":
      return "failed";
    default:
      return "action_needed";
  }
}

export function getTransactionConfidenceLabel(
  status: TransactionConfidenceStatus,
  locale: "en" | "ar" = "en"
): string {
  return confidenceLabelCatalog[locale][status];
}

export function getTransactionConfidenceTone(
  status: TransactionConfidenceStatus
): TimelineEventTone {
  switch (status) {
    case "complete":
      return "positive";
    case "failed":
    case "action_needed":
      return "critical";
    case "under_review":
    case "queued":
    case "confirming":
      return "warning";
    case "sent_to_network":
      return "technical";
    default:
      return "neutral";
  }
}

export function inferSystemHealthStatus(input: {
  releaseBlocked?: boolean;
  blockedWorkflows?: number;
  degradedServices?: number;
}): SystemHealthStatus {
  if (input.releaseBlocked) {
    return "launch_ineligible";
  }

  if ((input.blockedWorkflows ?? 0) > 0) {
    return "blocked";
  }

  if ((input.degradedServices ?? 0) > 0) {
    return "degraded";
  }

  return "healthy";
}

export function getSystemHealthLabel(
  status: SystemHealthStatus,
  locale: PresentationLocale = "en"
): string {
  return systemHealthLabelCatalog[locale][status];
}

export function getSystemHealthTone(
  status: SystemHealthStatus
): TimelineEventTone {
  switch (status) {
    case "healthy":
      return "positive";
    case "degraded":
      return "warning";
    case "blocked":
    case "launch_ineligible":
      return "critical";
  }
}

export function formatReferenceValue(
  value: string | null | undefined,
  fallback = "Not available",
  size = 8
): string {
  if (!value) {
    return fallback;
  }

  if (value.length <= size * 2) {
    return value;
  }

  return `${value.slice(0, size)}...${value.slice(-size)}`;
}

export function isTimestampOlderThan(
  value: string | null | undefined,
  maxAgeHours: number,
  now = Date.now()
): boolean {
  if (!value) {
    return false;
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return false;
  }

  return now - parsed > maxAgeHours * 60 * 60 * 1000;
}

export function formatRelativeTimeLabel(
  value: string | null | undefined,
  locale: PresentationLocale = "en",
  now = Date.now()
): string {
  if (!value) {
    return locale === "ar" ? "غير متاح" : "Not available";
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return locale === "ar" ? "غير متاح" : "Not available";
  }

  const deltaMinutes = Math.max(0, Math.round((now - parsed) / 60000));

  if (deltaMinutes < 1) {
    return locale === "ar" ? "الآن" : "Just now";
  }

  if (deltaMinutes < 60) {
    return locale === "ar"
      ? `منذ ${deltaMinutes} دقيقة`
      : `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);

  if (deltaHours < 24) {
    return locale === "ar"
      ? `منذ ${deltaHours} ساعة`
      : `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);

  return locale === "ar" ? `منذ ${deltaDays} يوم` : `${deltaDays}d ago`;
}

export function buildIntentTimeline(input: {
  id: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  txHash?: string | null;
}): TimelineEvent[] {
  const confidence = mapIntentStatusToConfidence(input.status);
  const events: TimelineEvent[] = [
    {
      id: `${input.id}-submitted`,
      label: "Intent recorded",
      description: "The workflow accepted the request and assigned a reference.",
      timestamp: input.createdAt,
      tone: "neutral"
    }
  ];

  if (confidence === "under_review") {
    events.push({
      id: `${input.id}-review`,
      label: "Review path engaged",
      description: "Controls are checking policy, balances, and destination context.",
      timestamp: input.updatedAt,
      tone: "warning"
    });
  }

  if (confidence === "queued" || confidence === "sent_to_network") {
    events.push({
      id: `${input.id}-queue`,
      label: "Queued for execution",
      description: "The workflow is prepared for managed custody execution.",
      timestamp: input.updatedAt,
      tone: "warning"
    });
  }

  if (input.txHash) {
    events.push({
      id: `${input.id}-network`,
      label: "Network reference issued",
      description: "A blockchain transaction reference is available for traceability.",
      timestamp: input.updatedAt,
      tone: "technical",
      metadata: [{ label: "Hash", value: input.txHash }]
    });
  }

  if (confidence === "confirming" || confidence === "complete") {
    events.push({
      id: `${input.id}-confirming`,
      label: confidence === "complete" ? "Settled" : "Confirming",
      description:
        confidence === "complete"
          ? "The workflow reached a completed money-state outcome."
          : "The transaction is awaiting final settlement confirmation.",
      timestamp: input.updatedAt,
      tone: confidence === "complete" ? "positive" : "warning"
    });
  }

  if (confidence === "failed" || confidence === "action_needed") {
    events.push({
      id: `${input.id}-exception`,
      label: confidence === "failed" ? "Workflow failed" : "Action required",
      description:
        confidence === "failed"
          ? "The request did not complete and needs review."
          : "The workflow needs more information or intervention.",
      timestamp: input.updatedAt,
      tone: "critical"
    });
  }

  return events;
}

export * from "./motion";
