import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  acknowledgePlatformAlert,
  listPlatformAlertDeliveryTargetHealth,
  listPlatformAlerts,
  listOversightAlerts,
  retryPlatformAlertDeliveries,
  routePlatformAlertToReviewCase
} from "@/lib/api";
import { formatCount, formatDateTime, readApiErrorMessage, toTitleCase, trimToUndefined } from "@/lib/format";
import {
  ActionRail,
  AdminStatusBadge,
  DetailList,
  EmptyState,
  ErrorState,
  InlineNotice,
  ListCard,
  LoadingState,
  MetricCard,
  SectionPanel,
  TimelinePanel,
  WorkspaceLayout
} from "@/components/console/primitives";
import {
  mapPlatformAlertToTimeline,
  mapStatusToTone,
  useConfiguredSessionGuard
} from "./shared";

export function AlertsPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedAlertId = searchParams.get("alert");
  const [actionNote, setActionNote] = useState("");
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const platformAlertsQuery = useQuery({
    queryKey: ["platform-alerts", session?.baseUrl],
    queryFn: () => listPlatformAlerts(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const deliveryHealthQuery = useQuery({
    queryKey: ["delivery-health", session?.baseUrl],
    queryFn: () => listPlatformAlertDeliveryTargetHealth(session!, { lookbackHours: 24 }),
    enabled: Boolean(session)
  });

  const oversightAlertsQuery = useQuery({
    queryKey: ["oversight-alerts", session?.baseUrl],
    queryFn: () => listOversightAlerts(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  useEffect(() => {
    const firstId = platformAlertsQuery.data?.alerts[0]?.id;
    if (firstId && !selectedAlertId) {
      setSearchParams({ alert: firstId });
    }
  }, [platformAlertsQuery.data, selectedAlertId, setSearchParams]);

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["platform-alerts", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["delivery-health", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["oversight-alerts", session?.baseUrl] })
    ]);
  }

  function buildMutation<T>(mutationFn: () => Promise<T>, successMessage: string, failureMessage: string) {
    return useMutation({
      mutationFn,
      onSuccess: async () => {
        setFlash(successMessage);
        setActionError(null);
        setGovernedConfirm(false);
        await refreshData();
      },
      onError: (error) => {
        setActionError(readApiErrorMessage(error, failureMessage));
      }
    });
  }

  const acknowledgeMutation = buildMutation(
    () => acknowledgePlatformAlert(session!, selectedAlertId!, trimToUndefined(actionNote)),
    "Alert acknowledged.",
    "Failed to acknowledge alert."
  );
  const routeMutation = buildMutation(
    () => routePlatformAlertToReviewCase(session!, selectedAlertId!, trimToUndefined(actionNote)),
    "Alert routed to review case.",
    "Failed to route alert to review case."
  );
  const retryMutation = buildMutation(
    () => retryPlatformAlertDeliveries(session!, selectedAlertId!, trimToUndefined(actionNote)),
    "Delivery retry requested.",
    "Failed to retry alert deliveries."
  );

  if (fallback) {
    return fallback;
  }

  if (
    platformAlertsQuery.isLoading ||
    deliveryHealthQuery.isLoading ||
    oversightAlertsQuery.isLoading
  ) {
    return (
      <LoadingState
        title="Loading alerts and incidents"
        description="Platform alerts, delivery health, and oversight alert activity are loading."
      />
    );
  }

  if (
    platformAlertsQuery.isError ||
    deliveryHealthQuery.isError ||
    oversightAlertsQuery.isError
  ) {
    return (
      <ErrorState
        title="Alert state unavailable"
        description="Platform alerts or delivery-health data could not be loaded."
      />
    );
  }

  const selectedAlert =
    platformAlertsQuery.data!.alerts.find((alert) => alert.id === selectedAlertId) ?? null;
  const mutationPending =
    acknowledgeMutation.isPending || routeMutation.isPending || retryMutation.isPending;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Alerts and incidents"
        description="Alert ownership, escalation posture, and governed routing actions."
      >
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Platform alerts"
            value={formatCount(platformAlertsQuery.data!.alerts.length)}
            detail="Current alert list"
          />
          <MetricCard
            label="Critical targets"
            value={formatCount(deliveryHealthQuery.data!.summary.criticalTargetCount)}
            detail={`${formatCount(deliveryHealthQuery.data!.summary.warningTargetCount)} warning`}
          />
          <MetricCard
            label="Oversight alerts"
            value={formatCount(oversightAlertsQuery.data!.alerts.length)}
            detail="Incident monitoring feed"
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Platform alert workspace"
        description="Select an alert to inspect delivery posture and route governed follow-up."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Platform alerts">
                <div className="admin-list">
                  {platformAlertsQuery.data!.alerts.map((alert) => (
                    <button
                      key={alert.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedAlertId === alert.id ? "selected" : ""
                      }`}
                      onClick={() => setSearchParams({ alert: alert.id })}
                    >
                      <strong>{alert.summary}</strong>
                      <span>{toTitleCase(alert.category)}</span>
                      <span>{toTitleCase(alert.routingStatus)}</span>
                      <AdminStatusBadge
                        label={toTitleCase(alert.severity)}
                        tone={mapStatusToTone(alert.severity)}
                      />
                    </button>
                  ))}
                </div>
              </ListCard>

              <ListCard title="Delivery health">
                <div className="admin-list">
                  {deliveryHealthQuery.data!.targets.map((target) => (
                    <div key={target.targetName} className="admin-list-row">
                      <strong>{target.targetName}</strong>
                      <span>{toTitleCase(target.healthStatus)}</span>
                      <span>{formatCount(target.recentDeliveryCount)} deliveries</span>
                      <span>{formatDateTime(target.lastAttemptedAt)}</span>
                    </div>
                  ))}
                </div>
              </ListCard>
            </>
          }
          main={
            selectedAlert ? (
              <>
                <ListCard title="Selected alert">
                  <DetailList
                    items={[
                      { label: "Alert reference", value: selectedAlert.id, mono: true },
                      { label: "Code", value: selectedAlert.code, mono: true },
                      {
                        label: "Severity",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(selectedAlert.severity)}
                            tone={mapStatusToTone(selectedAlert.severity)}
                          />
                        )
                      },
                      { label: "Status", value: toTitleCase(selectedAlert.status) },
                      { label: "Owner", value: selectedAlert.ownerOperatorId ?? "Unassigned" },
                      { label: "Last detected", value: formatDateTime(selectedAlert.lastDetectedAt) }
                    ]}
                  />
                  <InlineNotice
                    tone={selectedAlert.hasActiveSuppression ? "warning" : "critical"}
                    title={
                      selectedAlert.hasActiveSuppression
                        ? "Suppression is active"
                        : "Operator attention required"
                    }
                    description={
                      selectedAlert.hasActiveSuppression
                        ? `Suppressed until ${formatDateTime(selectedAlert.suppressedUntil)}.`
                        : "Alert remains active until it is acknowledged, routed, or resolved."
                    }
                  />
                </ListCard>

                <TimelinePanel
                  title="Alert timeline"
                  description="Alert detection, ownership, acknowledgement, and suppression state."
                  events={mapPlatformAlertToTimeline(selectedAlert)}
                  emptyState={{
                    title: "No alert history",
                    description: "Timeline data will appear when the alert changes state."
                  }}
                />

                <ListCard title="Oversight alert feed">
                  <div className="admin-list">
                    {oversightAlertsQuery.data!.alerts.map((alert) => (
                      <div
                        key={`${alert.incidentType}-${alert.subjectCustomer?.customerId ?? alert.subjectOperatorId ?? "global"}`}
                        className="admin-list-row"
                      >
                        <strong>{toTitleCase(alert.incidentType)}</strong>
                        <span>{alert.subjectCustomer?.email ?? alert.subjectOperatorId ?? "Unknown"}</span>
                        <span>{alert.count} hits</span>
                        <span>{toTitleCase(alert.recommendedAction)}</span>
                      </div>
                    ))}
                  </div>
                </ListCard>
              </>
            ) : (
              <EmptyState
                title="Select an alert"
                description="Choose a platform alert to inspect delivery posture and routing state."
              />
            )
          }
          rail={
            <ActionRail
              title="Alert controls"
              description="Alert actions should capture rationale because they influence downstream ownership and response."
            >
              {selectedAlert ? (
                <>
                  <div className="admin-field">
                    <span>Operator note</span>
                    <textarea
                      aria-label="Alert note"
                      placeholder="Capture why the alert was acknowledged, routed, or retried."
                      value={actionNote}
                      onChange={(event) => setActionNote(event.target.value)}
                    />
                  </div>

                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={governedConfirm}
                      onChange={(event) => setGovernedConfirm(event.target.checked)}
                    />
                    <span>
                      I reviewed severity, delivery failures, and whether the alert should create review work.
                    </span>
                  </label>

                  {flash ? (
                    <InlineNotice title="Last action" description={flash} tone="positive" />
                  ) : null}
                  {actionError ? (
                    <InlineNotice title="Action failed" description={actionError} tone="critical" />
                  ) : null}

                  <div className="admin-action-buttons">
                    <button
                      type="button"
                      className="admin-primary-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => acknowledgeMutation.mutate()}
                    >
                      {acknowledgeMutation.isPending ? "Acknowledging..." : "Acknowledge alert"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => routeMutation.mutate()}
                    >
                      {routeMutation.isPending ? "Routing..." : "Route to review case"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => retryMutation.mutate()}
                    >
                      {retryMutation.isPending ? "Retrying..." : "Retry deliveries"}
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No alert selected"
                  description="Select an alert to unlock routing and acknowledgement controls."
                />
              )}
            </ActionRail>
          }
        />
      </SectionPanel>
    </div>
  );
}
