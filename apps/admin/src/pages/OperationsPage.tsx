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
import { AdminStage, AdminStagger, AdminStaggerItem } from "@/components/motion/primitives";
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
    <AdminStage className="admin-page-grid">
      <SectionPanel
        title="Operations overview"
        description="Backlog, health, incidents, and launch posture in one command surface."
      >
        <AdminStagger className="admin-metrics-grid" delay={0.08}>
          <AdminStaggerItem>
            <MetricCard
              label="Open alerts"
              value={formatCount(operations.alertSummary.openCount)}
              detail={`${formatCount(operations.alertSummary.criticalCount)} critical`}
            />
          </AdminStaggerItem>
          <AdminStaggerItem>
            <MetricCard
              label="Queued work"
              value={formatCount(operations.queueHealth.totalQueuedCount)}
              detail={`${formatCount(operations.queueHealth.agedQueuedCount)} aged`}
            />
          </AdminStaggerItem>
          <AdminStaggerItem>
            <MetricCard
              label="Withdrawal rail"
              value={formatCount(
                operations.withdrawalExecutionHealth.pendingConfirmationWithdrawalCount
              )}
              detail={`${formatCount(
                operations.withdrawalExecutionHealth.manualInterventionWithdrawalCount
              )} manual`}
            />
          </AdminStaggerItem>
          <AdminStaggerItem>
            <MetricCard
              label="Open mismatches"
              value={formatCount(operations.reconciliationHealth.openMismatchCount)}
              detail={`${formatCount(operations.reconciliationHealth.criticalMismatchCount)} critical`}
            />
          </AdminStaggerItem>
          <AdminStaggerItem>
            <MetricCard
              label="Restricted accounts"
              value={formatCount(operations.incidentSafety.activeRestrictedAccountCount)}
              detail={`${formatCount(operations.incidentSafety.openReviewCaseCount)} review cases`}
            />
          </AdminStaggerItem>
          <AdminStaggerItem>
            <MetricCard
              label="Vault release rail"
              value={formatCount(operations.retirementVaultHealth.pendingReviewCount)}
              detail={`${formatCount(
                operations.retirementVaultHealth.staleCooldownCount +
                  operations.retirementVaultHealth.staleReadyForReleaseCount +
                  operations.retirementVaultHealth.staleExecutingCount +
                  operations.retirementVaultHealth.failedReleaseCount
              )} stale or failed`}
            />
          </AdminStaggerItem>
          <AdminStaggerItem>
            <MetricCard
              label="Vault rule rail"
              value={formatCount(
                operations.retirementVaultHealth.pendingRuleChangeReviewCount,
              )}
              detail={`${formatCount(
                operations.retirementVaultHealth.staleRuleChangeCooldownCount +
                  operations.retirementVaultHealth.staleRuleChangeReadyCount +
                  operations.retirementVaultHealth.staleRuleChangeApplyingCount +
                  operations.retirementVaultHealth.failedRuleChangeCount,
              )} stale or failed`}
            />
          </AdminStaggerItem>
        </AdminStagger>
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
            <p className="admin-copy">
              Managed withdrawals: {formatCount(operations.withdrawalExecutionHealth.queuedManagedWithdrawalCount)}{" "}
              queued / {formatCount(operations.withdrawalExecutionHealth.signedWithdrawalCount)} signed /{" "}
              {formatCount(operations.withdrawalExecutionHealth.broadcastingWithdrawalCount)}{" "}
              broadcasting / {formatCount(operations.withdrawalExecutionHealth.pendingConfirmationWithdrawalCount)} pending confirmation /{" "}
              {formatCount(operations.withdrawalExecutionHealth.failedManagedWithdrawalCount)} failed /{" "}
              {formatCount(operations.withdrawalExecutionHealth.retryableWithdrawalFailureCount)} retryable /{" "}
              {formatCount(operations.withdrawalExecutionHealth.manualInterventionWithdrawalCount)} manual /{" "}
              {formatCount(operations.withdrawalExecutionHealth.unresolvedReserveMismatchCount)} reserve mismatches
            </p>
            <p className="admin-copy">
              Retirement vaults: {formatCount(operations.retirementVaultHealth.activeVaultCount)} active /{" "}
              {formatCount(operations.retirementVaultHealth.pendingReviewCount)} review required /{" "}
              {formatCount(operations.retirementVaultHealth.cooldownActiveCount)} cooling down /{" "}
              {formatCount(operations.retirementVaultHealth.blockedReleaseCount)} blocked by restriction /{" "}
              {formatCount(operations.retirementVaultHealth.failedReleaseCount)} failed
            </p>
            <p className="admin-copy">
              Rule changes: {formatCount(operations.retirementVaultHealth.pendingRuleChangeReviewCount)} review required /{" "}
              {formatCount(operations.retirementVaultHealth.ruleChangeCooldownCount)} cooling down /{" "}
              {formatCount(operations.retirementVaultHealth.blockedRuleChangeCount)} blocked /{" "}
              {formatCount(operations.retirementVaultHealth.failedRuleChangeCount)} failed
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
    </AdminStage>
  );
}
