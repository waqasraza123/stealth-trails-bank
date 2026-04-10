import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  addOversightIncidentNote,
  applyAccountRestriction,
  dismissOversightIncident,
  getAccountHoldSummary,
  getOversightIncidentWorkspace,
  listActiveAccountHolds,
  listOversightIncidents,
  resolveOversightIncident,
  startOversightIncident
} from "@/lib/api";
import { formatDateTime, formatName, readApiErrorMessage, shortenValue, toTitleCase, trimToUndefined } from "@/lib/format";
import {
  ActionRail,
  AdminStatusBadge,
  DetailList,
  EmptyState,
  ErrorState,
  InlineNotice,
  ListCard,
  LoadingState,
  SectionPanel,
  TimelinePanel,
  WorkspaceLayout
} from "@/components/console/primitives";
import {
  mapOversightEventsToTimeline,
  mapStatusToTone,
  useConfiguredSessionGuard
} from "./shared";

export function AccountsPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIncidentId = searchParams.get("incident");
  const [actionNote, setActionNote] = useState("");
  const [restrictionReasonCode, setRestrictionReasonCode] = useState("manual_review_hold");
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const incidentsQuery = useQuery({
    queryKey: ["oversight-incidents", session?.baseUrl],
    queryFn: () => listOversightIncidents(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const activeAccountHoldsQuery = useQuery({
    queryKey: ["active-account-holds", session?.baseUrl],
    queryFn: () => listActiveAccountHolds(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const accountHoldSummaryQuery = useQuery({
    queryKey: ["account-hold-summary", session?.baseUrl],
    queryFn: () => getAccountHoldSummary(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const workspaceQuery = useQuery({
    queryKey: ["oversight-workspace", session?.baseUrl, selectedIncidentId],
    queryFn: () => getOversightIncidentWorkspace(session!, selectedIncidentId!, 8),
    enabled: Boolean(session && selectedIncidentId)
  });

  useEffect(() => {
    const firstId = incidentsQuery.data?.oversightIncidents[0]?.id;
    if (firstId && !selectedIncidentId) {
      setSearchParams({ incident: firstId });
    }
  }, [incidentsQuery.data, selectedIncidentId, setSearchParams]);

  async function refreshWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["oversight-incidents", session?.baseUrl] }),
      queryClient.invalidateQueries({
        queryKey: ["oversight-workspace", session?.baseUrl, selectedIncidentId]
      }),
      queryClient.invalidateQueries({ queryKey: ["active-account-holds", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["account-hold-summary", session?.baseUrl] })
    ]);
  }

  const startIncidentMutation = useMutation({
    mutationFn: () => startOversightIncident(session!, selectedIncidentId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Oversight incident started.");
      setActionError(null);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to start oversight incident."));
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: () => addOversightIncidentNote(session!, selectedIncidentId!, actionNote.trim()),
    onSuccess: async () => {
      setFlash("Oversight note recorded.");
      setActionError(null);
      setActionNote("");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to record oversight note."));
    }
  });

  const applyRestrictionMutation = useMutation({
    mutationFn: () =>
      applyAccountRestriction(
        session!,
        selectedIncidentId!,
        restrictionReasonCode,
        trimToUndefined(actionNote)
      ),
    onSuccess: async () => {
      setFlash("Account hold applied.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to apply account restriction."));
    }
  });

  const resolveIncidentMutation = useMutation({
    mutationFn: () =>
      resolveOversightIncident(session!, selectedIncidentId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Oversight incident resolved.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to resolve oversight incident."));
    }
  });

  const dismissIncidentMutation = useMutation({
    mutationFn: () =>
      dismissOversightIncident(session!, selectedIncidentId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Oversight incident dismissed.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to dismiss oversight incident."));
    }
  });

  if (fallback) {
    return fallback;
  }

  if (
    incidentsQuery.isLoading ||
    activeAccountHoldsQuery.isLoading ||
    accountHoldSummaryQuery.isLoading
  ) {
    return (
      <LoadingState
        title="Loading account workspaces"
        description="Incident context, holds, and review posture are loading."
      />
    );
  }

  if (
    incidentsQuery.isError ||
    activeAccountHoldsQuery.isError ||
    accountHoldSummaryQuery.isError
  ) {
    return (
      <ErrorState
        title="Account review state unavailable"
        description="Customer restrictions and oversight context could not be loaded."
      />
    );
  }

  const workspace = workspaceQuery.data;
  const pendingGovernedAction =
    applyRestrictionMutation.isPending ||
    resolveIncidentMutation.isPending ||
    dismissIncidentMutation.isPending;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Accounts and reviews"
        description="Customer restriction posture, incident evidence, and governed hold actions."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Oversight incidents">
                <div className="admin-list">
                  {incidentsQuery.data!.oversightIncidents.map((incident) => (
                    <button
                      key={incident.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedIncidentId === incident.id ? "selected" : ""
                      }`}
                      onClick={() => setSearchParams({ incident: incident.id })}
                    >
                      <strong>
                        {formatName(
                          incident.subjectCustomer.firstName,
                          incident.subjectCustomer.lastName
                        )}
                      </strong>
                      <span>{toTitleCase(incident.incidentType)}</span>
                      <span>{toTitleCase(incident.reasonCode)}</span>
                      <AdminStatusBadge
                        label={toTitleCase(incident.status)}
                        tone={mapStatusToTone(incident.status)}
                      />
                    </button>
                  ))}
                </div>
              </ListCard>

              <ListCard title="Active account holds">
                {activeAccountHoldsQuery.data!.holds.length > 0 ? (
                  <div className="admin-list">
                    {activeAccountHoldsQuery.data!.holds.map((hold) => (
                      <div key={hold.hold.id} className="admin-list-row">
                        <strong>{hold.customer.email}</strong>
                        <span>{toTitleCase(hold.hold.restrictionReasonCode)}</span>
                        <span>{toTitleCase(hold.releaseReview.decisionStatus)}</span>
                        <span>{formatDateTime(hold.hold.appliedAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No active account holds"
                    description="Live restrictions will appear here when customer accounts are actively constrained."
                  />
                )}
              </ListCard>
            </>
          }
          main={
            workspace ? (
              <>
                <ListCard title="Incident workspace">
                  <DetailList
                    items={[
                      {
                        label: "Incident reference",
                        value: workspace.oversightIncident.id,
                        mono: true
                      },
                      {
                        label: "Customer",
                        value: formatName(
                          workspace.oversightIncident.subjectCustomer.firstName,
                          workspace.oversightIncident.subjectCustomer.lastName
                        )
                      },
                      {
                        label: "Current status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(workspace.oversightIncident.status)}
                            tone={mapStatusToTone(workspace.oversightIncident.status)}
                          />
                        )
                      },
                      {
                        label: "Restriction state",
                        value: workspace.accountRestriction.active ? "Restricted" : "Not restricted"
                      },
                      {
                        label: "Restriction reason",
                        value: toTitleCase(workspace.accountRestriction.restrictionReasonCode)
                      },
                      {
                        label: "Opened",
                        value: formatDateTime(workspace.oversightIncident.openedAt)
                      }
                    ]}
                  />
                  <InlineNotice
                    tone={workspace.accountRestriction.active ? "critical" : "warning"}
                    title={
                      workspace.accountRestriction.active
                        ? "Account is currently restricted"
                        : "Account hold governance available"
                    }
                    description={
                      workspace.accountRestriction.active
                        ? "Customer movement is constrained until the hold is released through governed review."
                        : "This workspace can place an account hold when evidence supports it."
                    }
                  />
                </ListCard>

                <ListCard title="Linked reviews and manual resolutions">
                  <div className="admin-list">
                    {workspace.recentReviewCases.map((reviewCase) => (
                      <div key={reviewCase.id} className="admin-list-row">
                        <strong>{reviewCase.id}</strong>
                        <span>{toTitleCase(reviewCase.type)}</span>
                        <span>{toTitleCase(reviewCase.status)}</span>
                        <span>{formatDateTime(reviewCase.updatedAt)}</span>
                      </div>
                    ))}
                    {workspace.recentManuallyResolvedIntents.map((intent) => (
                      <div key={intent.id} className="admin-list-row">
                        <strong>{intent.customer.email}</strong>
                        <span>{toTitleCase(intent.intentType)}</span>
                        <span>{toTitleCase(intent.manualResolutionReasonCode)}</span>
                        <span>{formatDateTime(intent.manuallyResolvedAt)}</span>
                      </div>
                    ))}
                  </div>
                </ListCard>

                <TimelinePanel
                  title="Incident timeline"
                  description="Incident events, operator notes, and state changes."
                  events={mapOversightEventsToTimeline(workspace.events)}
                  emptyState={{
                    title: "No incident activity",
                    description: "Timeline entries will appear as the oversight workflow progresses."
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="Select an incident"
                description="Choose an incident to inspect restriction state and linked review activity."
              />
            )
          }
          rail={
            <ActionRail
              title="Restriction controls"
              description="These actions affect customer access and should only follow evidence review."
            >
              {workspace ? (
                <>
                  <div className="admin-field">
                    <span>Restriction reason</span>
                    <select
                      aria-label="Restriction reason"
                      value={restrictionReasonCode}
                      onChange={(event) => setRestrictionReasonCode(event.target.value)}
                    >
                      <option value="manual_review_hold">Manual review hold</option>
                      <option value="oversight_incident">Oversight incident</option>
                      <option value="risk_control">Risk control</option>
                    </select>
                  </div>

                  <div className="admin-field">
                    <span>Operator note</span>
                    <textarea
                      aria-label="Oversight note"
                      placeholder="Summarize the evidence, customer impact, and expected next step."
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
                      I reviewed the incident timeline, related cases, and current restriction state.
                    </span>
                  </label>

                  <InlineNotice
                    title="Hold summary"
                    description={`Open holds: ${accountHoldSummaryQuery.data?.activeHolds ?? 0}. Latest hold ${
                      activeAccountHoldsQuery.data!.holds[0]
                        ? `belongs to ${activeAccountHoldsQuery.data!.holds[0].customer.email}.`
                        : "is not currently present."
                    }`}
                    tone="neutral"
                  />
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
                      disabled={startIncidentMutation.isPending}
                      onClick={() => startIncidentMutation.mutate()}
                    >
                      {startIncidentMutation.isPending ? "Starting..." : "Start incident"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={addNoteMutation.isPending || actionNote.trim().length === 0}
                      onClick={() => addNoteMutation.mutate()}
                    >
                      {addNoteMutation.isPending ? "Recording..." : "Record note"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={
                        !workspace.accountHoldGovernance.canApplyAccountHold ||
                        !governedConfirm ||
                        pendingGovernedAction
                      }
                      onClick={() => applyRestrictionMutation.mutate()}
                    >
                      {applyRestrictionMutation.isPending ? "Applying..." : "Apply account hold"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || pendingGovernedAction}
                      onClick={() => resolveIncidentMutation.mutate()}
                    >
                      {resolveIncidentMutation.isPending ? "Resolving..." : "Resolve incident"}
                    </button>
                    <button
                      type="button"
                      className="admin-danger-button"
                      disabled={!governedConfirm || pendingGovernedAction}
                      onClick={() => dismissIncidentMutation.mutate()}
                    >
                      {dismissIncidentMutation.isPending ? "Dismissing..." : "Dismiss incident"}
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No incident selected"
                  description="Select an oversight incident to unlock restriction controls."
                />
              )}
            </ActionRail>
          }
        />
      </SectionPanel>

      <SectionPanel
        title="Hold distribution"
        description="Recent hold posture by reason and operator."
      >
        <div className="admin-two-column">
          <ListCard title="By reason">
            <div className="admin-list">
              {accountHoldSummaryQuery.data!.byReasonCode.map((entry) => (
                <div key={entry.restrictionReasonCode} className="admin-list-row">
                  <strong>{toTitleCase(entry.restrictionReasonCode)}</strong>
                  <span>{entry.count}</span>
                  <span>-</span>
                  <span>-</span>
                </div>
              ))}
            </div>
          </ListCard>
          <ListCard title="By applied operator">
            <div className="admin-list">
              {accountHoldSummaryQuery.data!.byAppliedOperator.map((entry) => (
                <div key={entry.appliedByOperatorId} className="admin-list-row">
                  <strong>{entry.appliedByOperatorId}</strong>
                  <span>{toTitleCase(entry.appliedByOperatorRole)}</span>
                  <span>{entry.count}</span>
                  <span>{shortenValue(entry.appliedByOperatorId)}</span>
                </div>
              ))}
            </div>
          </ListCard>
        </div>
      </SectionPanel>
    </div>
  );
}
