import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  approveSolvencyPolicyResume,
  getSolvencySnapshotDetail,
  getSolvencyWorkspace,
  requestSolvencyPolicyResume,
  rejectSolvencyPolicyResume,
  runSolvencySnapshot
} from "@/lib/api";
import {
  formatCount,
  formatDateTime,
  readApiErrorMessage,
  shortenValue,
  toTitleCase
} from "@/lib/format";
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
  WorkspaceLayout
} from "@/components/console/primitives";
import { mapStatusToTone, useConfiguredSessionGuard } from "./shared";

export function SolvencyPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const selectedSnapshotId = searchParams.get("snapshot");

  const workspaceQuery = useQuery({
    queryKey: ["solvency-workspace", session?.baseUrl, searchParams.toString()],
    queryFn: () => getSolvencyWorkspace(session!, { limit: 10 }),
    enabled: Boolean(session)
  });

  const snapshotDetailQuery = useQuery({
    queryKey: ["solvency-snapshot-detail", session?.baseUrl, selectedSnapshotId],
    queryFn: () => getSolvencySnapshotDetail(session!, selectedSnapshotId!),
    enabled: Boolean(session && selectedSnapshotId)
  });

  const runSnapshotMutation = useMutation({
    mutationFn: () => runSolvencySnapshot(session!),
    onSuccess: (result) => {
      setFlash(
        `Solvency snapshot ${shortenValue(result.snapshot?.id ?? "generated")} completed with ${toTitleCase(
          result.snapshot?.status ?? "unknown"
        )} status.`
      );
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["solvency-workspace", session?.baseUrl] });
      if (result.snapshot?.id) {
        setSearchParams({ snapshot: result.snapshot.id });
      }
    },
    onError: (error) => {
      setActionError(
        readApiErrorMessage(error, "Failed to generate a solvency snapshot.")
      );
      setFlash(null);
    }
  });
  const requestResumeMutation = useMutation({
    mutationFn: () =>
      requestSolvencyPolicyResume(session!, {
        snapshotId: workspaceQuery.data!.latestSnapshot!.id,
        expectedPolicyUpdatedAt: workspaceQuery.data!.policyState.updatedAt
      }),
    onSuccess: (result) => {
      setFlash(
        `Governed resume request ${shortenValue(
          result.request.id
        )} was created for snapshot ${shortenValue(result.request.snapshotId)}.`
      );
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["solvency-workspace", session?.baseUrl] });
      if (selectedSnapshotId) {
        void queryClient.invalidateQueries({
          queryKey: ["solvency-snapshot-detail", session?.baseUrl, selectedSnapshotId]
        });
      }
    },
    onError: (error) => {
      setActionError(
        readApiErrorMessage(error, "Failed to request governed solvency resume.")
      );
      setFlash(null);
    }
  });
  const approveResumeMutation = useMutation({
    mutationFn: () =>
      approveSolvencyPolicyResume(
        session!,
        workspaceQuery.data!.latestPendingResumeRequest!.id,
        {}
      ),
    onSuccess: (result) => {
      setFlash(
        `Governed resume request ${shortenValue(result.request.id)} was approved and policy controls were cleared.`
      );
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["solvency-workspace", session?.baseUrl] });
      if (selectedSnapshotId) {
        void queryClient.invalidateQueries({
          queryKey: ["solvency-snapshot-detail", session?.baseUrl, selectedSnapshotId]
        });
      }
    },
    onError: (error) => {
      setActionError(
        readApiErrorMessage(error, "Failed to approve governed solvency resume.")
      );
      setFlash(null);
    }
  });
  const rejectResumeMutation = useMutation({
    mutationFn: () =>
      rejectSolvencyPolicyResume(
        session!,
        workspaceQuery.data!.latestPendingResumeRequest!.id,
        {}
      ),
    onSuccess: (result) => {
      setFlash(
        `Governed resume request ${shortenValue(result.request.id)} was rejected.`
      );
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ["solvency-workspace", session?.baseUrl] });
      if (selectedSnapshotId) {
        void queryClient.invalidateQueries({
          queryKey: ["solvency-snapshot-detail", session?.baseUrl, selectedSnapshotId]
        });
      }
    },
    onError: (error) => {
      setActionError(
        readApiErrorMessage(error, "Failed to reject governed solvency resume.")
      );
      setFlash(null);
    }
  });

  useEffect(() => {
    const latestSnapshotId = workspaceQuery.data?.latestSnapshot?.id ?? null;

    if (!selectedSnapshotId && latestSnapshotId) {
      setSearchParams({ snapshot: latestSnapshotId });
    }
  }, [selectedSnapshotId, setSearchParams, workspaceQuery.data?.latestSnapshot?.id]);

  if (fallback) {
    return fallback;
  }

  if (workspaceQuery.isLoading) {
    return (
      <LoadingState
        title="Loading solvency workspace"
        description="Latest solvency status, reserve evidence, and safety controls are loading."
      />
    );
  }

  if (workspaceQuery.isError) {
    return (
      <ErrorState
        title="Solvency workspace unavailable"
        description={readApiErrorMessage(
          workspaceQuery.error,
          "Solvency state could not be loaded."
        )}
      />
    );
  }

  const workspace = workspaceQuery.data!;
  const detail = snapshotDetailQuery.data;

  return (
    <WorkspaceLayout
      main={
        <>
          <SectionPanel
            title="Solvency control plane"
            description="Authoritative liabilities, usable reserves, evidence freshness, and policy safety controls."
            action={
              <ActionRail>
                {workspaceQuery.data?.policyState.manualResumeRequired &&
                workspaceQuery.data?.latestSnapshot?.status === "healthy" &&
                !workspaceQuery.data?.latestPendingResumeRequest &&
                workspaceQuery.data?.resumeGovernance.currentOperator.canRequestResume ? (
                  <button
                    className="admin-secondary-button"
                    onClick={() => {
                      void requestResumeMutation.mutateAsync();
                    }}
                    type="button"
                  >
                    {requestResumeMutation.isPending
                      ? "Requesting..."
                      : "Request manual resume"}
                  </button>
                ) : null}
                {workspaceQuery.data?.latestPendingResumeRequest &&
                workspaceQuery.data?.resumeGovernance.currentOperator.canApproveResume ? (
                  <>
                    <button
                      className="admin-secondary-button"
                      onClick={() => {
                        void approveResumeMutation.mutateAsync();
                      }}
                      type="button"
                    >
                      {approveResumeMutation.isPending ? "Approving..." : "Approve resume"}
                    </button>
                    <button
                      className="admin-secondary-button"
                      onClick={() => {
                        void rejectResumeMutation.mutateAsync();
                      }}
                      type="button"
                    >
                      {rejectResumeMutation.isPending ? "Rejecting..." : "Reject resume"}
                    </button>
                  </>
                ) : null}
                <button
                  className="admin-secondary-button"
                  onClick={() => {
                    void runSnapshotMutation.mutateAsync();
                  }}
                  type="button"
                >
                  {runSnapshotMutation.isPending ? "Running..." : "Run snapshot"}
                </button>
              </ActionRail>
            }
          >
            {flash ? (
              <InlineNotice title="Snapshot completed" description={flash} tone="positive" />
            ) : null}
            {actionError ? (
              <InlineNotice title="Snapshot failed" description={actionError} tone="critical" />
            ) : null}
            <div className="admin-metric-grid">
              <MetricCard
                label="Policy state"
                value={toTitleCase(workspace.policyState.status)}
                detail={workspace.policyState.reasonSummary ?? "No active solvency guard."}
              />
              <MetricCard
                label="Latest snapshot"
                value={toTitleCase(workspace.latestSnapshot?.status ?? "missing")}
                detail={
                  workspace.latestSnapshot
                    ? `Generated ${formatDateTime(workspace.latestSnapshot.generatedAt)}`
                    : "No solvency snapshot has been persisted yet."
                }
              />
              <MetricCard
                label="Latest healthy"
                value={workspace.latestHealthySnapshotAt ? "Available" : "Missing"}
                detail={
                  workspace.latestHealthySnapshotAt
                    ? formatDateTime(workspace.latestHealthySnapshotAt)
                    : "No healthy solvency snapshot has been recorded."
                }
              />
              <MetricCard
                label="Policy triggers"
                value={
                  formatCount(
                    [
                      workspace.policyState.pauseWithdrawalApprovals,
                      workspace.policyState.pauseManagedWithdrawalExecution,
                      workspace.policyState.pauseLoanFunding,
                      workspace.policyState.pauseStakingWrites,
                      workspace.policyState.requireManualOperatorReview
                    ].filter(Boolean).length
                  )
                }
                detail="Active withdrawal, lending, staking, and review controls."
              />
            </div>
            <DetailList
              items={[
                {
                  label: "Withdrawal approvals",
                  value: workspace.policyState.pauseWithdrawalApprovals ? "Paused" : "Allowed"
                },
                {
                  label: "Managed withdrawal execution",
                  value: workspace.policyState.pauseManagedWithdrawalExecution
                    ? "Paused"
                    : "Allowed"
                },
                {
                  label: "Loan funding",
                  value: workspace.policyState.pauseLoanFunding ? "Paused" : "Allowed"
                },
                {
                  label: "Staking writes",
                  value: workspace.policyState.pauseStakingWrites ? "Paused" : "Allowed"
                },
                {
                  label: "Manual operator review",
                  value: workspace.policyState.requireManualOperatorReview
                    ? "Required"
                    : "Not required"
                },
                {
                  label: "Manual resume required",
                  value: workspace.policyState.manualResumeRequired ? "Yes" : "No"
                },
                {
                  label: "Policy updated",
                  value: formatDateTime(workspace.policyState.updatedAt)
                }
              ]}
            />
            {workspace.latestPendingResumeRequest ? (
              <InlineNotice
                title="Pending manual resume request"
                description={`Request ${shortenValue(
                  workspace.latestPendingResumeRequest.id
                )} is awaiting approval for snapshot ${shortenValue(
                  workspace.latestPendingResumeRequest.snapshotId
                )}.`}
                tone="warning"
              />
            ) : null}
          </SectionPanel>

          {detail ? (
            <SectionPanel
              title="Selected snapshot"
              description={`Snapshot ${shortenValue(detail.snapshot.id)} with per-asset reserve and liability state.`}
            >
              <DetailList
                items={[
                  {
                    label: "Snapshot status",
                    value: (
                      <AdminStatusBadge
                        label={toTitleCase(detail.snapshot.status)}
                        tone={mapStatusToTone(detail.snapshot.status)}
                      />
                    )
                  },
                  {
                    label: "Evidence freshness",
                    value: (
                      <AdminStatusBadge
                        label={toTitleCase(detail.snapshot.evidenceFreshness)}
                        tone={mapStatusToTone(detail.snapshot.evidenceFreshness)}
                      />
                    )
                  },
                  { label: "Generated", value: formatDateTime(detail.snapshot.generatedAt) },
                  {
                    label: "Total liabilities",
                    value: detail.snapshot.totalLiabilityAmount,
                    mono: true
                  },
                  {
                    label: "Observed reserves",
                    value: detail.snapshot.totalObservedReserveAmount,
                    mono: true
                  },
                  {
                    label: "Usable reserves",
                    value: detail.snapshot.totalUsableReserveAmount,
                    mono: true
                  },
                  {
                    label: "Reserve delta",
                    value: detail.snapshot.totalReserveDeltaAmount,
                    mono: true
                  },
                  {
                    label: "Signed report",
                    value: detail.snapshot.report
                      ? shortenValue(detail.snapshot.report.reportHash)
                      : "Missing"
                  },
                  {
                    label: "Signer",
                    value: detail.snapshot.report?.signerAddress ?? "Missing",
                    mono: true
                  }
                ]}
              />
            </SectionPanel>
          ) : null}
        </>
      }
      sidebar={
        <>
          <ListCard title="Recent snapshots">
            {workspace.recentSnapshots.length === 0 ? (
              <EmptyState
                title="No snapshots"
                description="Run a solvency snapshot to create the first persisted reserve/liability view."
              />
            ) : (
              <div className="admin-list">
                {workspace.recentSnapshots.map((snapshot) => (
                  <button
                    key={snapshot.id}
                    className={`admin-list-row ${
                      snapshot.id === selectedSnapshotId ? "selected" : ""
                    }`}
                    onClick={() => setSearchParams({ snapshot: snapshot.id })}
                    type="button"
                  >
                    <strong>{formatDateTime(snapshot.generatedAt)}</strong>
                    <span>{shortenValue(snapshot.id)}</span>
                    <span>{snapshot.totalReserveDeltaAmount}</span>
                    <AdminStatusBadge
                      label={toTitleCase(snapshot.status)}
                      tone={mapStatusToTone(snapshot.status)}
                    />
                  </button>
                ))}
              </div>
            )}
          </ListCard>

          <ListCard title="Per-asset state">
            {!detail ? (
              <EmptyState
                title="Select a snapshot"
                description="Choose a persisted solvency snapshot to inspect per-asset liabilities and reserves."
              />
            ) : detail.assetSnapshots.length === 0 ? (
              <EmptyState
                title="No asset rows"
                description="This snapshot did not persist any per-asset solvency rows."
              />
            ) : (
              <div className="admin-list">
                {detail.assetSnapshots.map((assetRow) => (
                  <div key={assetRow.asset.id} className="admin-list-row">
                    <strong>{assetRow.asset.symbol}</strong>
                    <span>Liability: {assetRow.totalLiabilityAmount}</span>
                    <span>Usable reserve: {assetRow.usableReserveAmount}</span>
                    <span>Delta: {assetRow.reserveDeltaAmount}</span>
                    <span>
                      Merkle root: {assetRow.liabilityMerkleRoot ? shortenValue(assetRow.liabilityMerkleRoot) : "n/a"}
                    </span>
                    <AdminStatusBadge
                      label={toTitleCase(assetRow.status)}
                      tone={mapStatusToTone(assetRow.status)}
                    />
                  </div>
                ))}
              </div>
            )}
          </ListCard>

          <ListCard title="Snapshot issues">
            {!detail ? (
              <EmptyState
                title="No issue detail"
                description="Select a snapshot to inspect issue classification and recommended actions."
              />
            ) : detail.issues.length === 0 ? (
              <EmptyState
                title="No issues"
                description="The selected snapshot is healthy and did not persist solvency issues."
              />
            ) : (
              <div className="admin-list">
                {detail.issues.map((issue) => (
                  <div key={issue.id} className="admin-list-row">
                    <strong>{toTitleCase(issue.classification)}</strong>
                    <span>{issue.summary}</span>
                    <span>{issue.recommendedAction ?? "No action recorded"}</span>
                    <AdminStatusBadge
                      label={toTitleCase(issue.severity)}
                      tone={mapStatusToTone(issue.severity)}
                    />
                  </div>
                ))}
              </div>
            )}
          </ListCard>

          <ListCard title="Signed report">
            {!detail ? (
              <EmptyState
                title="No report selected"
                description="Select a snapshot to inspect the signed solvency report artifact."
              />
            ) : !detail.snapshot.report ? (
              <EmptyState
                title="No signed report"
                description="This snapshot does not have a published signed solvency report."
              />
            ) : (
              <div className="admin-list">
                <div className="admin-list-row">
                  <strong>{shortenValue(detail.snapshot.report.reportHash)}</strong>
                  <span>Signer: {shortenValue(detail.snapshot.report.signerAddress)}</span>
                  <span>Published: {formatDateTime(detail.snapshot.report.publishedAt)}</span>
                  <span>Checksum: {shortenValue(detail.snapshot.report.reportChecksumSha256)}</span>
                </div>
              </div>
            )}
          </ListCard>

          <ListCard title="Reserve evidence">
            {!detail ? (
              <EmptyState
                title="No reserve evidence"
                description="Select a snapshot to inspect wallet-level reserve evidence and read freshness."
              />
            ) : detail.reserveEvidence.length === 0 ? (
              <EmptyState
                title="No reserve evidence"
                description="This snapshot did not persist any reserve evidence rows."
              />
            ) : (
              <div className="admin-list">
                {detail.reserveEvidence.slice(0, 12).map((evidence) => (
                  <div key={evidence.id} className="admin-list-row">
                    <strong>
                      {evidence.assetId} · {shortenValue(evidence.walletAddress)}
                    </strong>
                    <span>
                      {toTitleCase(evidence.reserveSourceType)} /{" "}
                      {toTitleCase(evidence.evidenceFreshness)}
                    </span>
                    <span>Observed: {evidence.observedBalanceAmount ?? "n/a"}</span>
                    <span>Usable: {evidence.usableBalanceAmount ?? "n/a"}</span>
                    <AdminStatusBadge
                      label={toTitleCase(evidence.evidenceFreshness)}
                      tone={mapStatusToTone(evidence.evidenceFreshness)}
                    />
                  </div>
                ))}
              </div>
            )}
          </ListCard>
        </>
      }
    />
  );
}
