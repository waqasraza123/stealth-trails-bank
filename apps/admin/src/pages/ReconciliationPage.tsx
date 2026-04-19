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
  requestLedgerReconciliationReplayApproval,
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

  useEffect(() => {
    setFlash(null);
    setActionError(null);
  }, [selectedMismatchId]);

  async function refreshWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["ledger-mismatches", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["ledger-runs", session?.baseUrl] }),
      queryClient.invalidateQueries({
        queryKey: ["ledger-workspace", session?.baseUrl, selectedMismatchId]
      })
    ]);
  }

  function buildMutation<T>(
    mutationFn: () => Promise<T>,
    successMessage: string | ((result: T) => string),
    failureMessage: string
  ) {
    return useMutation({
      mutationFn,
      onSuccess: async (result) => {
        setFlash(
          typeof successMessage === "function"
            ? successMessage(result)
            : successMessage
        );
        setActionError(null);
        setGovernedConfirm(false);
        await refreshWorkspace();
      },
      onError: (error) => {
        setActionError(readApiErrorMessage(error, failureMessage));
      }
    });
  }

  const requestConfirmApprovalMutation = buildMutation(
    () =>
      requestLedgerReconciliationReplayApproval(
        session!,
        selectedMismatchId!,
        "confirm",
        trimToUndefined(actionNote)
      ),
    (result) =>
      result.stateReused
        ? `Confirm replay approval request reused (${shortenValue(result.request.id)}).`
        : `Confirm replay approval requested (${shortenValue(result.request.id)}).`,
    "Failed to request confirm replay approval."
  );
  const requestSettleApprovalMutation = buildMutation(
    () =>
      requestLedgerReconciliationReplayApproval(
        session!,
        selectedMismatchId!,
        "settle",
        trimToUndefined(actionNote)
      ),
    (result) =>
      result.stateReused
        ? `Settle replay approval request reused (${shortenValue(result.request.id)}).`
        : `Settle replay approval requested (${shortenValue(result.request.id)}).`,
    "Failed to request settle replay approval."
  );
  const replayConfirmMutation = buildMutation(
    () =>
      replayConfirmMismatch(
        session!,
        selectedMismatchId!,
        confirmReplayApprovalRequest!.id,
        trimToUndefined(actionNote)
      ),
    "Replay confirm completed.",
    "Failed to replay confirm the mismatch."
  );
  const replaySettleMutation = buildMutation(
    () =>
      replaySettleMismatch(
        session!,
        selectedMismatchId!,
        settleReplayApprovalRequest!.id,
        trimToUndefined(actionNote)
      ),
    "Replay settle completed.",
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
  const replayApprovalRequests = workspace?.replayApprovalRequests ?? [];
  const confirmReplayApprovalRequest =
    replayApprovalRequests.find((request) => request.replayAction === "confirm") ??
    null;
  const settleReplayApprovalRequest =
    replayApprovalRequests.find((request) => request.replayAction === "settle") ??
    null;

  function formatReplayApprovalSummary(
    request:
      | (typeof replayApprovalRequests)[number]
      | null
  ) {
    if (!request) {
      return "No open governed replay approval request.";
    }

    const status = toTitleCase(request.status.replaceAll("_", " "));
    const requestedAt = formatDateTime(request.requestedAt);
    const approvedBy = request.approvedByOperatorId
      ? ` Approved by ${request.approvedByOperatorId}.`
      : "";

    return `${status} request ${shortenValue(request.id)} submitted ${requestedAt} by ${request.requestedByOperatorId}.${approvedBy}`;
  }

  function canExecuteReplayApproval(
    request: (typeof replayApprovalRequests)[number] | null
  ) {
    return Boolean(
      request && request.requestedByOperatorId !== session?.operatorId
    );
  }

  const mutationPending =
    requestConfirmApprovalMutation.isPending ||
    requestSettleApprovalMutation.isPending ||
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

                <ListCard title="Governed replay approvals">
                  <DetailList
                    items={[
                      {
                        label: "Confirm replay",
                        value: formatReplayApprovalSummary(confirmReplayApprovalRequest)
                      },
                      {
                        label: "Settle replay",
                        value: formatReplayApprovalSummary(settleReplayApprovalRequest)
                      }
                    ]}
                  />
                  <InlineNotice
                    tone="warning"
                    title="Dual-control replay"
                    description="Replay execution requires a governed approval request from one operator and replay execution by a different authorized operator."
                  />
                  {confirmReplayApprovalRequest?.requestedByOperatorId ===
                  session?.operatorId ? (
                    <InlineNotice
                      tone="warning"
                      title="Confirm replay awaiting second operator"
                      description="The current operator requested the confirm replay approval, so a different authorized operator must execute the replay."
                    />
                  ) : null}
                  {settleReplayApprovalRequest?.requestedByOperatorId ===
                  session?.operatorId ? (
                    <InlineNotice
                      tone="warning"
                      title="Settle replay awaiting second operator"
                      description="The current operator requested the settle replay approval, so a different authorized operator must execute the replay."
                    />
                  ) : null}
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
                      disabled={
                        !governedConfirm ||
                        mutationPending ||
                        Boolean(confirmReplayApprovalRequest)
                      }
                      onClick={() => requestConfirmApprovalMutation.mutate()}
                    >
                      {requestConfirmApprovalMutation.isPending
                        ? "Requesting..."
                        : "Request confirm approval"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={
                        !governedConfirm ||
                        mutationPending ||
                        Boolean(settleReplayApprovalRequest)
                      }
                      onClick={() => requestSettleApprovalMutation.mutate()}
                    >
                      {requestSettleApprovalMutation.isPending
                        ? "Requesting..."
                        : "Request settle approval"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={
                        !governedConfirm ||
                        mutationPending ||
                        !canExecuteReplayApproval(confirmReplayApprovalRequest)
                      }
                      onClick={() => replayConfirmMutation.mutate()}
                    >
                      {replayConfirmMutation.isPending ? "Submitting..." : "Replay confirm"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={
                        !governedConfirm ||
                        mutationPending ||
                        !canExecuteReplayApproval(settleReplayApprovalRequest)
                      }
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
