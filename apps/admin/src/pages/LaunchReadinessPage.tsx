import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  approveReleaseReadinessApproval,
  getReleaseReadinessSummary,
  listPendingReleases,
  listReleaseReadinessApprovals,
  listReleaseReadinessEvidence,
  listReleasedReleases,
  rejectReleaseReadinessApproval
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
  buildApprovalGateNotice,
  isEvidenceStale,
  mapReleaseEvidenceToTimeline,
  mapStatusToTone,
  useConfiguredSessionGuard
} from "./shared";

export function LaunchReadinessPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedApprovalId = searchParams.get("approval");
  const [actionNote, setActionNote] = useState("");
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const releaseSummaryQuery = useQuery({
    queryKey: ["launch-release-summary", session?.baseUrl],
    queryFn: () => getReleaseReadinessSummary(session!),
    enabled: Boolean(session)
  });

  const evidenceQuery = useQuery({
    queryKey: ["launch-evidence", session?.baseUrl],
    queryFn: () => listReleaseReadinessEvidence(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const approvalsQuery = useQuery({
    queryKey: ["launch-approvals", session?.baseUrl],
    queryFn: () => listReleaseReadinessApprovals(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const pendingReleasesQuery = useQuery({
    queryKey: ["pending-releases", session?.baseUrl],
    queryFn: () => listPendingReleases(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const releasedReleasesQuery = useQuery({
    queryKey: ["released-releases", session?.baseUrl],
    queryFn: () => listReleasedReleases(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  useEffect(() => {
    const firstId = approvalsQuery.data?.approvals[0]?.id;
    if (firstId && !selectedApprovalId) {
      setSearchParams({ approval: firstId });
    }
  }, [approvalsQuery.data, selectedApprovalId, setSearchParams]);

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["launch-release-summary", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["launch-evidence", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["launch-approvals", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["pending-releases", session?.baseUrl] }),
      queryClient.invalidateQueries({ queryKey: ["released-releases", session?.baseUrl] })
    ]);
  }

  const approveMutation = useMutation({
    mutationFn: () =>
      approveReleaseReadinessApproval(session!, selectedApprovalId!, {
        approvalNote: trimToUndefined(actionNote)
      }),
    onSuccess: async () => {
      setFlash("Approval recorded.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to approve release readiness item."));
    }
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      rejectReleaseReadinessApproval(session!, selectedApprovalId!, {
        rejectionNote: actionNote.trim() || "Rejected from operator console."
      }),
    onSuccess: async () => {
      setFlash("Rejection recorded.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to reject release readiness item."));
    }
  });

  if (fallback) {
    return fallback;
  }

  if (
    releaseSummaryQuery.isLoading ||
    evidenceQuery.isLoading ||
    approvalsQuery.isLoading ||
    pendingReleasesQuery.isLoading ||
    releasedReleasesQuery.isLoading
  ) {
    return (
      <LoadingState
        title="Loading launch readiness"
        description="Evidence posture, approvals, and release workflow state are loading."
      />
    );
  }

  if (
    releaseSummaryQuery.isError ||
    evidenceQuery.isError ||
    approvalsQuery.isError ||
    pendingReleasesQuery.isError ||
    releasedReleasesQuery.isError
  ) {
    return (
      <ErrorState
        title="Launch readiness unavailable"
        description="Evidence or approval state could not be loaded for the current environment."
      />
    );
  }

  const summary = releaseSummaryQuery.data!;
  const selectedApproval =
    approvalsQuery.data!.approvals.find((approval) => approval.id === selectedApprovalId) ?? null;
  const gateNotice = buildApprovalGateNotice(selectedApproval);
  const mutationPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Launch readiness"
        description="Evidence posture, approval chain, and stale-proof visibility."
      >
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Required checks"
            value={formatCount(summary.summary.requiredCheckCount)}
            detail={`${formatCount(summary.summary.passedCheckCount)} passed`}
          />
          <MetricCard
            label="Approvals"
            value={formatCount(approvalsQuery.data!.approvals.length)}
            detail={`${formatCount(pendingReleasesQuery.data!.releases.length)} pending releases`}
          />
          <MetricCard
            label="Recorded evidence"
            value={formatCount(evidenceQuery.data!.evidence.length)}
            detail={`${formatCount(releasedReleasesQuery.data!.releases.length)} released artifacts`}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Approval workspace"
        description="Approval-chain detail, stale evidence warnings, and governed launch decisions."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Approval chain">
                <div className="admin-list">
                  {approvalsQuery.data!.approvals.map((approval) => (
                    <button
                      key={approval.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedApprovalId === approval.id ? "selected" : ""
                      }`}
                      onClick={() => setSearchParams({ approval: approval.id })}
                    >
                      <strong>{approval.releaseIdentifier}</strong>
                      <span>{approval.environment}</span>
                      <span>{toTitleCase(approval.gate.overallStatus)}</span>
                      <AdminStatusBadge
                        label={toTitleCase(approval.status)}
                        tone={mapStatusToTone(approval.status)}
                      />
                    </button>
                  ))}
                </div>
              </ListCard>

              <ListCard title="Pending releases">
                <div className="admin-list">
                  {pendingReleasesQuery.data!.releases.map((release) => (
                    <div key={release.id} className="admin-list-row">
                      <strong>{release.customer.email}</strong>
                      <span>{toTitleCase(release.status)}</span>
                      <span>{release.releaseTarget}</span>
                      <span>{formatDateTime(release.requestedAt)}</span>
                    </div>
                  ))}
                </div>
              </ListCard>
            </>
          }
          main={
            selectedApproval ? (
              <>
                <ListCard title="Selected approval">
                  <DetailList
                    items={[
                      { label: "Approval reference", value: selectedApproval.id, mono: true },
                      { label: "Release identifier", value: selectedApproval.releaseIdentifier, mono: true },
                      {
                        label: "Approval status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(selectedApproval.status)}
                            tone={mapStatusToTone(selectedApproval.status)}
                          />
                        )
                      },
                      { label: "Gate state", value: toTitleCase(selectedApproval.gate.overallStatus) },
                      {
                        label: "Stale evidence",
                        value:
                          selectedApproval.gate.staleEvidenceTypes.length > 0
                            ? selectedApproval.gate.staleEvidenceTypes.join(", ")
                            : "None"
                      },
                      { label: "Requested", value: formatDateTime(selectedApproval.requestedAt) }
                    ]}
                  />
                  {gateNotice ? (
                    <InlineNotice
                      title={gateNotice.title}
                      description={gateNotice.description}
                      tone={gateNotice.tone}
                    />
                  ) : null}
                </ListCard>

                <ListCard title="Required checks">
                  <div className="admin-list">
                    {summary.requiredChecks.map((check) => {
                      const latestEvidence = check.latestEvidence;
                      const stale = latestEvidence
                        ? isEvidenceStale(
                            latestEvidence.observedAt,
                            selectedApproval.gate.maximumEvidenceAgeHours
                          )
                        : false;

                      return (
                        <div key={check.evidenceType} className="admin-list-row">
                          <strong>{check.label}</strong>
                          <span>{toTitleCase(check.status)}</span>
                          <span>{latestEvidence?.releaseIdentifier ?? "No release"}</span>
                          <span>{stale ? "Stale evidence" : formatDateTime(latestEvidence?.observedAt)}</span>
                        </div>
                      );
                    })}
                  </div>
                </ListCard>

                <TimelinePanel
                  title="Recent evidence timeline"
                  description="Latest proof artifacts used by the current release approval workflow."
                  events={mapReleaseEvidenceToTimeline(summary.recentEvidence)}
                  emptyState={{
                    title: "No recent evidence",
                    description: "Evidence artifacts will appear here when proof runners and operators submit them."
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="Select an approval"
                description="Choose an approval request to inspect gate posture and stale evidence."
              />
            )
          }
          rail={
            <ActionRail
              title="Governed approval actions"
              description="Approvals and rejections should capture rationale and evidence freshness."
            >
              {selectedApproval ? (
                <>
                  <div className="admin-field">
                    <span>Approval note</span>
                    <textarea
                      aria-label="Approval note"
                      placeholder="Document why this release is approved or rejected."
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
                      I reviewed failed checks, stale evidence, and open blockers before deciding.
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
                      onClick={() => approveMutation.mutate()}
                    >
                      {approveMutation.isPending ? "Approving..." : "Approve release"}
                    </button>
                    <button
                      type="button"
                      className="admin-danger-button"
                      disabled={!governedConfirm || mutationPending}
                      onClick={() => rejectMutation.mutate()}
                    >
                      {rejectMutation.isPending ? "Rejecting..." : "Reject release"}
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No approval selected"
                  description="Select an approval request to unlock governed launch actions."
                />
              )}
            </ActionRail>
          }
        />
      </SectionPanel>

      <SectionPanel
        title="Released artifacts"
        description="Recently released governed packages and evidence-linked outputs."
      >
        <div className="admin-list-card">
          <div className="admin-list">
            {releasedReleasesQuery.data!.releases.map((release) => (
              <div key={release.id} className="admin-list-row">
                <strong>{release.customer.email}</strong>
                <span>{toTitleCase(release.status)}</span>
                <span>{release.releaseTarget}</span>
                <span>{formatDateTime(release.releasedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
