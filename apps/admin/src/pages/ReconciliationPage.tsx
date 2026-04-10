import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  dismissLedgerReconciliationMismatch,
  getLedgerReconciliationWorkspace,
  listLedgerReconciliationMismatches,
  listLedgerReconciliationRuns,
  openLedgerReconciliationReviewCase,
  repairLedgerCustomerBalance,
  replayConfirmMismatch,
  replaySettleMismatch
} from "@/lib/api";
import { formatDateTime, readApiErrorMessage, shortenValue, toTitleCase, trimToUndefined } from "@/lib/format";
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
import { mapAuditEntriesToTimeline, mapStatusToTone, useConfiguredSessionGuard } from "./shared";

export function ReconciliationPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedMismatchId = searchParams.get("mismatch");
  const [actionNote, setActionNote] = useState("");
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const mismatchesQuery = useQuery({
    queryKey: ["ledger-mismatches", session?.baseUrl],
    queryFn: () => listLedgerReconciliationMismatches(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const runsQuery = useQuery({
    queryKey: ["ledger-runs", session?.baseUrl],
    queryFn: () => listLedgerReconciliationRuns(session!, { limit: 10 }),
    enabled: Boolean(session)
  });

  const workspaceQuery = useQuery({
    queryKey: ["ledger-workspace", session?.baseUrl, selectedMismatchId],
    queryFn: () => getLedgerReconciliationWorkspace(session!, selectedMismatchId!, 10),
    enabled: Boolean(session && selectedMismatchId)
  });

  useEffect(() => {
    const firstId = mismatchesQuery.data?.mismatches[0]?.id;
    if (firstId && !selectedMismatchId) {
      setSearchParams({ mismatch: firstId });
    }
  }, [mismatchesQuery.data, selectedMismatchId, setSearchParams]);

  async function refreshWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ledger-mismatches", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["ledger-runs", session?.baseUrl] }),
      queryClient.invalidateQueries({
        queryKey: ["ledger-workspace", session?.baseUrl, selectedMismatchId]
      })
    ]);
  }

  function buildMutation<T>(mutationFn: () => Promise<T>, successMessage: string, failureMessage: string) {
    return useMutation({
      mutationFn,
      onSuccess: async () => {
        setFlash(successMessage);
        setActionError(null);
        setGovernedConfirm(false);
        await refreshWorkspace();
      },
      onError: (error) => {
        setActionError(readApiErrorMessage(error, failureMessage));
      }
    });
  }

  const replayConfirmMutation = buildMutation(
    () => replayConfirmMismatch(session!, selectedMismatchId!, trimToUndefined(actionNote)),
    "Replay confirm requested.",
    "Failed to replay confirm the mismatch."
  );
  const replaySettleMutation = buildMutation(
    () => replaySettleMismatch(session!, selectedMismatchId!, trimToUndefined(actionNote)),
    "Replay settle requested.",
    "Failed to replay settle the mismatch."
  );
  const openReviewCaseMutation = buildMutation(
    () => openLedgerReconciliationReviewCase(session!, selectedMismatchId!, trimToUndefined(actionNote)),
    "Review case opened for mismatch.",
    "Failed to open a review case for the mismatch."
  );
  const repairBalanceMutation = buildMutation(
    () => repairLedgerCustomerBalance(session!, selectedMismatchId!, trimToUndefined(actionNote)),
    "Balance repair requested.",
    "Failed to request balance repair."
  );
  const dismissMismatchMutation = buildMutation(
    () => dismissLedgerReconciliationMismatch(session!, selectedMismatchId!, trimToUndefined(actionNote)),
    "Mismatch dismissed.",
    "Failed to dismiss mismatch."
  );

  if (fallback) {
    return fallback;
  }

  if (mismatchesQuery.isLoading || runsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading reconciliation workspaces"
        description="Mismatch summaries, recent runs, and repair context are loading."
      />
    );
  }

  if (mismatchesQuery.isError || runsQuery.isError) {
    return (
      <ErrorState
        title="Reconciliation data unavailable"
        description="Mismatch state and scan history could not be loaded."
      />
    );
  }

  const workspace = workspaceQuery.data;
  const mutationPending =
    replayConfirmMutation.isPending ||
    replaySettleMutation.isPending ||
    openReviewCaseMutation.isPending ||
    repairBalanceMutation.isPending ||
    dismissMismatchMutation.isPending;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Reconciliation"
        description="Mismatch evidence, repair decisions, and governed replay actions."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Open mismatches">
                <div className="admin-list">
                  {mismatchesQuery.data!.mismatches.map((mismatch) => (
                    <button
                      key={mismatch.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedMismatchId === mismatch.id ? "selected" : ""
                      }`}
                      onClick={() => setSearchParams({ mismatch: mismatch.id })}
                    >
                      <strong>{mismatch.summary}</strong>
                      <span>{toTitleCase(mismatch.scope)}</span>
                      <span>{toTitleCase(mismatch.recommendedAction)}</span>
                      <AdminStatusBadge
                        label={toTitleCase(mismatch.severity)}
                        tone={mapStatusToTone(mismatch.severity)}
                      />
                    </button>
                  ))}
                </div>
              </ListCard>

              <ListCard title="Recent scan runs">
                <div className="admin-list">
                  {runsQuery.data!.runs.map((run) => (
                    <div key={run.id} className="admin-list-row">
                      <strong>{shortenValue(run.id)}</strong>
                      <span>{toTitleCase(run.status)}</span>
                      <span>{toTitleCase(run.triggerSource)}</span>
                      <span>{formatDateTime(run.startedAt)}</span>
                    </div>
                  ))}
                </div>
              </ListCard>
            </>
          }
          main={
            workspace ? (
              <>
                <ListCard title="Mismatch workspace">
                  <DetailList
                    items={[
                      { label: "Mismatch reference", value: workspace.mismatch.id, mono: true },
                      { label: "Mismatch key", value: workspace.mismatch.mismatchKey, mono: true },
                      { label: "Summary", value: workspace.mismatch.summary },
                      {
                        label: "Status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(workspace.mismatch.status)}
                            tone={mapStatusToTone(workspace.mismatch.status)}
                          />
                        )
                      },
                      {
                        label: "Recommended action",
                        value: toTitleCase(workspace.mismatch.recommendedAction)
                      },
                      {
                        label: "Detected",
                        value: `${workspace.mismatch.detectionCount} times since ${formatDateTime(
                          workspace.mismatch.firstDetectedAt
                        )}`
                      }
                    ]}
                  />
                  <InlineNotice
                    tone={mapStatusToTone(workspace.mismatch.severity)}
                    title="Repair posture"
                    description={`Severity is ${workspace.mismatch.severity}. Latest detection was ${formatDateTime(
                      workspace.mismatch.lastDetectedAt
                    )}.`}
                  />
                </ListCard>

                <ListCard title="Expected versus actual">
                  <DetailList
                    items={[
                      {
                        label: "Asset",
                        value: workspace.mismatch.asset
                          ? `${workspace.mismatch.asset.displayName} (${workspace.mismatch.asset.symbol})`
                          : "Not available"
                      },
                      {
                        label: "Customer",
                        value: workspace.mismatch.customer?.email ?? "Not available"
                      },
                      {
                        label: "Review case link",
                        value: workspace.mismatch.linkedReviewCase?.reviewCaseId ?? "Not linked"
                      },
                      {
                        label: "Resolution note",
                        value: workspace.mismatch.resolutionNote ?? "No resolution note"
                      }
                    ]}
                  />
                </ListCard>

                <TimelinePanel
                  title="Audit evidence"
                  description="Recent audit history attached to the selected mismatch."
                  events={mapAuditEntriesToTimeline(workspace.recentAuditEvents)}
                  emptyState={{
                    title: "No audit events",
                    description: "Audit evidence will appear here when repair attempts or follow-up actions are logged."
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="Select a mismatch"
                description="Choose a mismatch to inspect evidence, audit events, and the recommended repair path."
              />
            )
          }
          rail={
            <ActionRail
              title="Repair controls"
              description="Reconciliation actions are governed because they can change customer ledger state."
            >
              {workspace ? (
                <>
                  <div className="admin-field">
                    <span>Operator note</span>
                    <textarea
                      aria-label="Reconciliation note"
                      placeholder="Record the evidence, expected outcome, and rollback path."
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
                      I reviewed the mismatch snapshot, recent audit evidence, and the recommended repair path.
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
                      className="admin-secondary-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => replayConfirmMutation.mutate()}
                    >
                      {replayConfirmMutation.isPending ? "Submitting..." : "Replay confirm"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => replaySettleMutation.mutate()}
                    >
                      {replaySettleMutation.isPending ? "Submitting..." : "Replay settle"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => openReviewCaseMutation.mutate()}
                    >
                      {openReviewCaseMutation.isPending ? "Opening..." : "Open review case"}
                    </button>
                    <button
                      type="button"
                      className="admin-primary-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => repairBalanceMutation.mutate()}
                    >
                      {repairBalanceMutation.isPending ? "Repairing..." : "Repair balance"}
                    </button>
                    <button
                      type="button"
                      className="admin-danger-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => dismissMismatchMutation.mutate()}
                    >
                      {dismissMismatchMutation.isPending ? "Dismissing..." : "Dismiss mismatch"}
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No mismatch selected"
                  description="Select a mismatch to unlock replay and repair controls."
                />
              )}
            </ActionRail>
          }
        />
      </SectionPanel>
    </div>
  );
}
