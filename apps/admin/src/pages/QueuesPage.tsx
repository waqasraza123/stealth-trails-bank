import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  addReviewCaseNote,
  dismissReviewCase,
  getReviewCaseWorkspace,
  listPendingAccountReleaseReviews,
  listReviewCases,
  requestAccountRelease,
  resolveReviewCase,
  startReviewCase
} from "@/lib/api";
import { formatDateTime, formatName, readApiErrorMessage, toTitleCase, trimToUndefined } from "@/lib/format";
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
  mapAuditEntriesToTimeline,
  mapIntentToTimeline,
  mapReviewCaseEventsToTimeline,
  mapStatusToTone,
  useConfiguredSessionGuard
} from "./shared";

export function QueuesPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedReviewCaseId = searchParams.get("reviewCase");
  const [actionNote, setActionNote] = useState("");
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reviewCasesQuery = useQuery({
    queryKey: ["review-cases", session?.baseUrl],
    queryFn: () => listReviewCases(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const accountReleaseReviewsQuery = useQuery({
    queryKey: ["account-release-reviews", session?.baseUrl],
    queryFn: () => listPendingAccountReleaseReviews(session!, { limit: 20 }),
    enabled: Boolean(session)
  });

  const reviewWorkspaceQuery = useQuery({
    queryKey: ["review-workspace", session?.baseUrl, selectedReviewCaseId],
    queryFn: () => getReviewCaseWorkspace(session!, selectedReviewCaseId!, 10),
    enabled: Boolean(session && selectedReviewCaseId)
  });

  useEffect(() => {
    const firstId = reviewCasesQuery.data?.reviewCases[0]?.id;
    if (firstId && !selectedReviewCaseId) {
      setSearchParams({ reviewCase: firstId });
    }
  }, [reviewCasesQuery.data, selectedReviewCaseId, setSearchParams]);

  async function refreshWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["review-cases", session?.baseUrl] }),
      queryClient.invalidateQueries({
        queryKey: ["review-workspace", session?.baseUrl, selectedReviewCaseId]
      }),
      queryClient.invalidateQueries({
        queryKey: ["account-release-reviews", session?.baseUrl]
      })
    ]);
  }

  const startCaseMutation = useMutation({
    mutationFn: () => startReviewCase(session!, selectedReviewCaseId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Review case started.");
      setActionError(null);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to start review case."));
    }
  });

  const addNoteMutation = useMutation({
    mutationFn: () => addReviewCaseNote(session!, selectedReviewCaseId!, actionNote.trim()),
    onSuccess: async () => {
      setFlash("Workspace note recorded.");
      setActionError(null);
      setActionNote("");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to record workspace note."));
    }
  });

  const requestReleaseMutation = useMutation({
    mutationFn: () =>
      requestAccountRelease(session!, selectedReviewCaseId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Account release review requested.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to request account release."));
    }
  });

  const resolveCaseMutation = useMutation({
    mutationFn: () => resolveReviewCase(session!, selectedReviewCaseId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Review case resolved.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to resolve review case."));
    }
  });

  const dismissCaseMutation = useMutation({
    mutationFn: () => dismissReviewCase(session!, selectedReviewCaseId!, trimToUndefined(actionNote)),
    onSuccess: async () => {
      setFlash("Review case dismissed.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to dismiss review case."));
    }
  });

  if (fallback) {
    return fallback;
  }

  if (reviewCasesQuery.isLoading || accountReleaseReviewsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading queues"
        description="Review cases, release reviews, and the selected workspace are loading."
      />
    );
  }

  if (reviewCasesQuery.isError || accountReleaseReviewsQuery.isError) {
    return (
      <ErrorState
        title="Queue state unavailable"
        description="The operational queue feed could not be loaded. Recheck the operator session or retry the request."
      />
    );
  }

  const workspace = reviewWorkspaceQuery.data;
  const selectedReviewCase =
    workspace?.reviewCase ??
    reviewCasesQuery.data!.reviewCases.find((reviewCase) => reviewCase.id === selectedReviewCaseId) ??
    null;
  const guardedActionPending =
    requestReleaseMutation.isPending ||
    resolveCaseMutation.isPending ||
    dismissCaseMutation.isPending;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Operational queues"
        description="Queue aging, review context, and governed operator actions."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Review cases">
                <div className="admin-list">
                  {reviewCasesQuery.data!.reviewCases.map((reviewCase) => (
                    <button
                      key={reviewCase.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedReviewCaseId === reviewCase.id ? "selected" : ""
                      }`}
                      onClick={() => setSearchParams({ reviewCase: reviewCase.id })}
                    >
                      <strong>
                        {formatName(
                          reviewCase.customer.firstName,
                          reviewCase.customer.lastName
                        )}
                      </strong>
                      <span>{toTitleCase(reviewCase.type)}</span>
                      <span>{toTitleCase(reviewCase.reasonCode)}</span>
                      <AdminStatusBadge
                        label={toTitleCase(reviewCase.status)}
                        tone={mapStatusToTone(reviewCase.status)}
                      />
                    </button>
                  ))}
                </div>
              </ListCard>

              <ListCard title="Pending release reviews">
                <div className="admin-list">
                  {accountReleaseReviewsQuery.data!.reviews.length > 0 ? (
                    accountReleaseReviewsQuery.data!.reviews.map((review) => (
                      <div key={review.reviewCase.id} className="admin-list-row">
                        <strong>{review.customer.email}</strong>
                        <span>{toTitleCase(review.restriction.releaseDecisionStatus)}</span>
                        <span>{toTitleCase(review.oversightIncident.status)}</span>
                        <span>{formatDateTime(review.restriction.releaseRequestedAt)}</span>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      title="No pending release reviews"
                      description="Governed account release decisions will appear here when they need approval."
                    />
                  )}
                </div>
              </ListCard>
            </>
          }
          main={
            workspace ? (
              <>
                <ListCard title="Selected workspace">
                  <DetailList
                    items={[
                      {
                        label: "Case reference",
                        value: workspace.reviewCase.id,
                        mono: true
                      },
                      {
                        label: "Customer",
                        value: formatName(
                          workspace.reviewCase.customer.firstName,
                          workspace.reviewCase.customer.lastName
                        )
                      },
                      {
                        label: "Status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(workspace.reviewCase.status)}
                            tone={mapStatusToTone(workspace.reviewCase.status)}
                          />
                        )
                      },
                      {
                        label: "Eligibility",
                        value: workspace.manualResolutionEligibility.recommendedAction
                      },
                      {
                        label: "Assigned operator",
                        value: workspace.reviewCase.assignedOperatorId ?? "Not assigned"
                      },
                      {
                        label: "Opened",
                        value: formatDateTime(workspace.reviewCase.createdAt)
                      }
                    ]}
                  />
                  <InlineNotice
                    tone={workspace.manualResolutionEligibility.eligible ? "warning" : "neutral"}
                    title="Manual resolution posture"
                    description={workspace.manualResolutionEligibility.reason}
                  />
                </ListCard>

                <ListCard title="Balances and intent context">
                  {workspace.balances.length > 0 ? (
                    <div className="admin-list">
                      {workspace.balances.map((balance) => (
                        <div key={balance.asset.id} className="admin-list-row">
                          <strong>{balance.asset.symbol}</strong>
                          <span>{balance.availableBalance} available</span>
                          <span>{balance.pendingBalance} pending</span>
                          <span>{formatDateTime(balance.updatedAt)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No balance context"
                      description="Customer balances were not returned for this review case."
                    />
                  )}
                </ListCard>

                <TimelinePanel
                  title="Review timeline"
                  description="Case events and operator-authored notes for the selected review."
                  events={mapReviewCaseEventsToTimeline(workspace.caseEvents)}
                  emptyState={{
                    title: "No review events",
                    description: "Case events will appear here as the workspace changes state."
                  }}
                />

                <TimelinePanel
                  title="Transaction audit trace"
                  description="Related transaction audit history for the linked intent."
                  events={
                    workspace.reviewCase.transactionIntent
                      ? [
                          ...mapIntentToTimeline(workspace.reviewCase.transactionIntent),
                          ...mapAuditEntriesToTimeline(workspace.relatedTransactionAuditEvents)
                        ]
                      : mapAuditEntriesToTimeline(workspace.relatedTransactionAuditEvents)
                  }
                  emptyState={{
                    title: "No audit trace",
                    description: "Audit entries will appear when the review case links to transaction activity."
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="Select a review case"
                description="Choose a queue item to inspect balances, notes, and recent audit context."
              />
            )
          }
          rail={
            <ActionRail
              title="Governed actions"
              description="Operator actions require evidence review, optional notes, and deliberate confirmation for state-changing outcomes."
            >
              {selectedReviewCase ? (
                <>
                  <div className="admin-field">
                    <span>Operator note</span>
                    <textarea
                      aria-label="Operator note"
                      placeholder="Summarize the rationale, evidence, or handoff context."
                      value={actionNote}
                      onChange={(event) => setActionNote(event.target.value)}
                    />
                    <p className="admin-field-help">
                      Notes are attached to review-case actions and remain visible in the audit trail.
                    </p>
                  </div>

                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={governedConfirm}
                      onChange={(event) => setGovernedConfirm(event.target.checked)}
                    />
                    <span>
                      I reviewed balances, timeline, and audit context before taking a governed action.
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
                      disabled={startCaseMutation.isPending}
                      onClick={() => startCaseMutation.mutate()}
                    >
                      {startCaseMutation.isPending ? "Starting..." : "Start case"}
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
                      disabled={!governedConfirm || guardedActionPending}
                      onClick={() => requestReleaseMutation.mutate()}
                    >
                      {requestReleaseMutation.isPending
                        ? "Requesting..."
                        : "Request account release review"}
                    </button>
                    <button
                      type="button"
                      className="admin-secondary-button"
                      disabled={!governedConfirm || guardedActionPending}
                      onClick={() => resolveCaseMutation.mutate()}
                    >
                      {resolveCaseMutation.isPending ? "Resolving..." : "Resolve case"}
                    </button>
                    <button
                      type="button"
                      className="admin-danger-button"
                      disabled={!governedConfirm || guardedActionPending}
                      onClick={() => dismissCaseMutation.mutate()}
                    >
                      {dismissCaseMutation.isPending ? "Dismissing..." : "Dismiss case"}
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No action target"
                  description="Select a review case to unlock governed actions."
                />
              )}
            </ActionRail>
          }
        />
      </SectionPanel>
    </div>
  );
}
