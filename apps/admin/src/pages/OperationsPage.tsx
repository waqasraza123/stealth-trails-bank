import { useQuery } from "@tanstack/react-query";
import { getOperationsStatus, getReleaseReadinessSummary } from "@/lib/api";
import { formatCount, formatDateTime } from "@/lib/format";
import {
  AdminStatusBadge,
  ErrorState,
  InlineNotice,
  LoadingState,
  MetricCard,
  SectionPanel
} from "@/components/console/primitives";
import { mapStatusToTone, useConfiguredSessionGuard } from "./shared";

export function OperationsPage() {
  const { session, fallback } = useConfiguredSessionGuard();

  const operationsQuery = useQuery({
    queryKey: ["operations-status", session?.baseUrl],
    queryFn: () => getOperationsStatus(session!, { recentAlertLimit: 6 }),
    enabled: Boolean(session)
  });

  const releaseReadinessQuery = useQuery({
    queryKey: ["release-summary", session?.baseUrl],
    queryFn: () => getReleaseReadinessSummary(session!),
    enabled: Boolean(session)
  });

  if (fallback) {
    return fallback;
  }

  if (operationsQuery.isLoading || releaseReadinessQuery.isLoading) {
    return (
      <LoadingState
        title="Loading operator overview"
        description="Backlog, health, incident, and launch-readiness summaries are loading."
      />
    );
  }

  if (operationsQuery.isError || releaseReadinessQuery.isError) {
    return (
      <ErrorState
        title="Operations overview unavailable"
        description="The command surface could not load its latest health and readiness summaries."
      />
    );
  }

  const operations = operationsQuery.data!;
  const release = releaseReadinessQuery.data!;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Operations overview"
        description="Backlog, health, incidents, and launch posture in one command surface."
      >
        <div className="admin-metrics-grid">
          <MetricCard
            label="Open alerts"
            value={formatCount(operations.alertSummary.openCount)}
            detail={`${formatCount(operations.alertSummary.criticalCount)} critical`}
          />
          <MetricCard
            label="Queued work"
            value={formatCount(operations.queueHealth.totalQueuedCount)}
            detail={`${formatCount(operations.queueHealth.agedQueuedCount)} aged`}
          />
          <MetricCard
            label="Open mismatches"
            value={formatCount(operations.reconciliationHealth.openMismatchCount)}
            detail={`${formatCount(operations.reconciliationHealth.criticalMismatchCount)} critical`}
          />
          <MetricCard
            label="Restricted accounts"
            value={formatCount(operations.incidentSafety.activeRestrictedAccountCount)}
            detail={`${formatCount(operations.incidentSafety.openReviewCaseCount)} review cases`}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Launch gate"
        description="Current release readiness signal and recent proof posture."
      >
        <div className="admin-two-column">
          <div className="admin-list-card">
            <h3>Readiness summary</h3>
            <p>
              <AdminStatusBadge
                label={release.overallStatus}
                tone={mapStatusToTone(release.overallStatus)}
              />
            </p>
            <p className="admin-copy">
              {formatCount(release.summary.passedCheckCount)} passed /{" "}
              {formatCount(release.summary.failedCheckCount)} failed /{" "}
              {formatCount(release.summary.pendingCheckCount)} pending
            </p>
            {release.overallStatus === "critical" ? (
              <InlineNotice
                title="Launch gate is blocked"
                description="Evidence failures currently prevent a clean release decision."
                tone="critical"
              />
            ) : null}
          </div>
          <div className="admin-list-card">
            <h3>Recent alerts</h3>
            <div className="admin-list">
              {operations.recentAlerts.map((alert) => (
                <div key={alert.id} className="admin-list-row">
                  <strong>{alert.summary}</strong>
                  <span>{alert.severity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel
        title="Queue aging"
        description="Oldest pending operational backlog and recent chain lag markers."
      >
        <div className="admin-two-column">
          <div className="admin-list-card">
            <h3>Queue health</h3>
            <p className="admin-copy">
              Oldest queued intent: {formatDateTime(operations.queueHealth.oldestQueuedIntentCreatedAt)}
            </p>
          </div>
          <div className="admin-list-card">
            <h3>Chain health</h3>
            <p className="admin-copy">
              Oldest lagging broadcast: {formatDateTime(operations.chainHealth.oldestLaggingBroadcastCreatedAt)}
            </p>
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
