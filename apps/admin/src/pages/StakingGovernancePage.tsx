import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  approveStakingPoolGovernanceRequest,
  createStakingPoolGovernanceRequest,
  executeStakingPoolGovernanceRequest,
  getStakingPoolGovernanceRequest,
  listStakingPoolGovernanceRequests,
  rejectStakingPoolGovernanceRequest
} from "@/lib/api";
import {
  formatCount,
  formatDateTime,
  readApiErrorMessage,
  shortenValue,
  toTitleCase,
  trimToUndefined
} from "@/lib/format";
import type {
  StakingPoolGovernanceRequest,
  StakingPoolGovernanceRequestStatus
} from "@/lib/types";
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
import { mapStatusToTone, useConfiguredSessionGuard } from "./shared";

const stakingStatusOptions: Array<{
  value: "all" | StakingPoolGovernanceRequestStatus;
  label: string;
}> = [
  { value: "all", label: "All requests" },
  { value: "pending_approval", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "execution_failed", label: "Execution failed" },
  { value: "executed", label: "Executed" },
  { value: "rejected", label: "Rejected" }
];

function readRewardRate(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Reward rate must be a positive whole number.");
  }

  return parsed;
}

function readStatusFilter(
  value: string | null
): "all" | StakingPoolGovernanceRequestStatus {
  const matched = stakingStatusOptions.find((option) => option.value === value);
  return matched?.value ?? "all";
}

function matchesStatusFilter(
  request: StakingPoolGovernanceRequest,
  statusFilter: "all" | StakingPoolGovernanceRequestStatus
): boolean {
  return statusFilter === "all" ? true : request.status === statusFilter;
}

function buildStakingGovernanceTimeline(
  request: StakingPoolGovernanceRequest
) {
  const events = [
    {
      id: `${request.id}-requested`,
      label: "Request submitted",
      description:
        request.requestNote ??
        "A governed staking pool creation request was recorded for operator review.",
      timestamp: request.requestedAt,
      tone: "warning" as const,
      metadata: [
        { label: "Requester", value: request.requestedByOperatorId },
        { label: "Reward rate", value: `${request.rewardRate}%` }
      ]
    }
  ];

  if (request.approvedAt) {
    events.push({
      id: `${request.id}-approved`,
      label: "Request approved",
      description:
        request.approvalNote ??
        "A separate operator approved the governance request for execution.",
      timestamp: request.approvedAt,
      tone: "positive" as const,
      metadata: [{ label: "Approver", value: request.approvedByOperatorId ?? "unknown" }]
    });
  }

  if (request.rejectedAt) {
    events.push({
      id: `${request.id}-rejected`,
      label: "Request rejected",
      description:
        request.rejectionNote ??
        "The request was rejected and removed from the execution path.",
      timestamp: request.rejectedAt,
      tone: "critical" as const,
      metadata: [{ label: "Approver", value: request.rejectedByOperatorId ?? "unknown" }]
    });
  }

  if (request.status === "execution_failed") {
    events.push({
      id: `${request.id}-execution-failed`,
      label: "Execution failed",
      description:
        request.executionFailureReason ??
        "Execution failed and a governed retry remains available.",
      timestamp: request.updatedAt,
      tone: "critical" as const,
      metadata: [
        { label: "Executor", value: request.executedByOperatorId ?? "pending" },
        {
          label: "Pool ref",
          value: request.stakingPool ? String(request.stakingPool.id) : "not created"
        }
      ]
    });
  }

  if (request.executedAt) {
    events.push({
      id: `${request.id}-executed`,
      label: "Pool creation executed",
      description:
        request.executionNote ??
        "Execution completed and the pool state was recorded for operations.",
      timestamp: request.executedAt,
      tone: "technical" as const,
      metadata: [
        { label: "Executor", value: request.executedByOperatorId ?? "unknown" },
        {
          label: "Tx hash",
          value: request.blockchainTransactionHash
            ? shortenValue(request.blockchainTransactionHash, 10)
            : "not available"
        }
      ]
    });
  }

  if (request.stakingPool) {
    events.push({
      id: `${request.id}-pool-linked`,
      label: "Linked pool state",
      description: `Pool ${request.stakingPool.id} is currently ${toTitleCase(
        request.stakingPool.poolStatus
      )}.`,
      timestamp: request.stakingPool.updatedAt,
      tone: mapStatusToTone(request.stakingPool.poolStatus),
      metadata: [
        {
          label: "Blockchain pool",
          value:
            request.stakingPool.blockchainPoolId === null
              ? "pending"
              : String(request.stakingPool.blockchainPoolId)
        }
      ]
    });
  }

  return events;
}

function buildStatusNotice(request: StakingPoolGovernanceRequest) {
  if (request.status === "pending_approval") {
    return {
      title: "Dual control required",
      description:
        "This request is waiting for a different operator to approve or reject the reward-rate change.",
      tone: "warning" as const
    };
  }

  if (request.status === "approved") {
    return {
      title: "Ready for execution",
      description:
        "Approval is recorded. A governed execution can now create or activate the pool on chain.",
      tone: "positive" as const
    };
  }

  if (request.status === "execution_failed") {
    return {
      title: "Execution retry available",
      description:
        request.executionFailureReason ??
        "The execution attempt failed, and the preserved pool state can be retried.",
      tone: "critical" as const
    };
  }

  if (request.status === "executed") {
    return {
      title: "Execution completed",
      description:
        request.blockchainTransactionHash
          ? `Pool execution is recorded with transaction ${shortenValue(
              request.blockchainTransactionHash,
              10
            )}.`
          : "Pool execution is recorded and linked to the local staking pool state.",
      tone: "technical" as const
    };
  }

  return {
    title: "Request closed",
    description:
      request.rejectionNote ??
      "The governance request was rejected and remains available for historical review.",
    tone: "critical" as const
  };
}

export function StakingGovernancePage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRequestId = searchParams.get("request");
  const statusFilter = readStatusFilter(searchParams.get("status"));
  const [rewardRateDraft, setRewardRateDraft] = useState("12");
  const [requestNote, setRequestNote] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [requestConfirm, setRequestConfirm] = useState(false);
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["staking-governance-requests", session?.baseUrl],
    queryFn: () => listStakingPoolGovernanceRequests(session!, { limit: 50 }),
    enabled: Boolean(session)
  });

  const selectedRequestQuery = useQuery({
    queryKey: ["staking-governance-request", session?.baseUrl, selectedRequestId],
    queryFn: () => getStakingPoolGovernanceRequest(session!, selectedRequestId!),
    enabled: Boolean(session && selectedRequestId)
  });

  const filteredRequests =
    requestsQuery.data?.requests.filter((request) =>
      matchesStatusFilter(request, statusFilter)
    ) ?? [];

  useEffect(() => {
    if (selectedRequestId || filteredRequests.length === 0) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set("request", filteredRequests[0].id);
    setSearchParams(next);
  }, [filteredRequests, searchParams, selectedRequestId, setSearchParams]);

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["staking-governance-requests", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["staking-governance-request", session?.baseUrl, selectedRequestId]
      })
    ]);
  }

  const createRequestMutation = useMutation({
    mutationFn: () =>
      createStakingPoolGovernanceRequest(session!, {
        rewardRate: readRewardRate(rewardRateDraft),
        requestNote: trimToUndefined(requestNote)
      }),
    onSuccess: async (result) => {
      setFlash("Governance request created.");
      setRequestError(null);
      setActionError(null);
      setRequestConfirm(false);
      setRequestNote("");
      setRewardRateDraft(String(result.request.rewardRate));
      const next = new URLSearchParams(searchParams);
      next.set("request", result.request.id);
      setSearchParams(next);
      await refreshData();
    },
    onError: (error) => {
      setRequestError(
        readApiErrorMessage(error, "Failed to create staking governance request.")
      );
    }
  });

  const approveRequestMutation = useMutation({
    mutationFn: () =>
      approveStakingPoolGovernanceRequest(session!, selectedRequestId!, {
        approvalNote: trimToUndefined(actionNote)
      }),
    onSuccess: async () => {
      setFlash("Request approved.");
      setActionError(null);
      setGovernedConfirm(false);
      setActionNote("");
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to approve staking request."));
    }
  });

  const rejectRequestMutation = useMutation({
    mutationFn: () =>
      rejectStakingPoolGovernanceRequest(session!, selectedRequestId!, {
        rejectionNote: actionNote.trim()
      }),
    onSuccess: async () => {
      setFlash("Request rejected.");
      setActionError(null);
      setGovernedConfirm(false);
      setActionNote("");
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to reject staking request."));
    }
  });

  const executeRequestMutation = useMutation({
    mutationFn: () =>
      executeStakingPoolGovernanceRequest(session!, selectedRequestId!, {
        executionNote: trimToUndefined(actionNote)
      }),
    onSuccess: async () => {
      setFlash("Pool execution recorded.");
      setActionError(null);
      setGovernedConfirm(false);
      setActionNote("");
      await refreshData();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to execute staking request."));
    }
  });

  if (fallback) {
    return fallback;
  }

  if (requestsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading staking governance"
        description="Governed pool requests, linked pool state, and execution posture are loading."
      />
    );
  }

  if (requestsQuery.isError) {
    return (
      <ErrorState
        title="Staking governance unavailable"
        description={readApiErrorMessage(
          requestsQuery.error,
          "Staking governance requests could not be loaded."
        )}
      />
    );
  }

  const allRequests = requestsQuery.data?.requests ?? [];
  const selectedRequest =
    selectedRequestQuery.data?.request ??
    allRequests.find((request) => request.id === selectedRequestId) ??
    null;
  const linkedPools = allRequests.filter((request) => request.stakingPool !== null);
  const mutationPending =
    approveRequestMutation.isPending ||
    rejectRequestMutation.isPending ||
    executeRequestMutation.isPending;
  const allowApproveReject = selectedRequest?.status === "pending_approval";
  const allowExecute =
    selectedRequest?.status === "approved" ||
    selectedRequest?.status === "execution_failed";
  const requestCounts = {
    pending: allRequests.filter((request) => request.status === "pending_approval").length,
    approved: allRequests.filter((request) => request.status === "approved").length,
    failed: allRequests.filter((request) => request.status === "execution_failed").length,
    executed: allRequests.filter((request) => request.status === "executed").length
  };

  function updateRequestSearchParam(requestId: string | null) {
    const next = new URLSearchParams(searchParams);

    if (requestId) {
      next.set("request", requestId);
    } else {
      next.delete("request");
    }

    setSearchParams(next);
  }

  function updateStatusFilter(value: "all" | StakingPoolGovernanceRequestStatus) {
    const next = new URLSearchParams(searchParams);

    if (value === "all") {
      next.delete("status");
    } else {
      next.set("status", value);
    }

    setSearchParams(next);
  }

  function submitGovernanceRequest() {
    try {
      readRewardRate(rewardRateDraft);
      setFlash(null);
      setRequestError(null);
      void createRequestMutation.mutateAsync();
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Reward rate must be a positive whole number."
      );
    }
  }

  function approveRequest() {
    setFlash(null);
    void approveRequestMutation.mutateAsync();
  }

  function rejectRequest() {
    if (!trimToUndefined(actionNote)) {
      setActionError("A rejection note is required before rejecting the request.");
      return;
    }

    setFlash(null);
    setActionError(null);
    void rejectRequestMutation.mutateAsync();
  }

  function executeRequest() {
    setFlash(null);
    void executeRequestMutation.mutateAsync();
  }

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Staking governance"
        description="Governed staking pool creation requests, dual-control approval, and execution retry posture."
      >
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Pending approval"
            value={formatCount(requestCounts.pending)}
            detail="Requests waiting for dual control"
          />
          <MetricCard
            label="Approved"
            value={formatCount(requestCounts.approved)}
            detail="Ready for governed execution"
          />
          <MetricCard
            label="Execution failed"
            value={formatCount(requestCounts.failed)}
            detail="Requests that can be retried"
          />
          <MetricCard
            label="Executed"
            value={formatCount(requestCounts.executed)}
            detail={`${formatCount(linkedPools.length)} linked pool records`}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        title="Governance workspace"
        description="Filter requests, inspect linked pool state, and execute the full operator-controlled lifecycle."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Governance requests">
                <div className="admin-field">
                  <span>Status filter</span>
                  <select
                    aria-label="Staking governance status filter"
                    value={statusFilter}
                    onChange={(event) =>
                      updateStatusFilter(
                        event.target.value as "all" | StakingPoolGovernanceRequestStatus
                      )
                    }
                  >
                    {stakingStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-list">
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map((request) => (
                      <button
                        key={request.id}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedRequest?.id === request.id ? "selected" : ""
                        }`}
                        onClick={() => updateRequestSearchParam(request.id)}
                      >
                        <strong>{request.id}</strong>
                        <span>{request.rewardRate}% reward</span>
                        <span>{request.requestedByOperatorId}</span>
                        <AdminStatusBadge
                          label={toTitleCase(request.status)}
                          tone={mapStatusToTone(request.status)}
                        />
                      </button>
                    ))
                  ) : (
                    <EmptyState
                      title="No requests match this filter"
                      description="Change the status filter or create a new request from the action rail."
                    />
                  )}
                </div>
              </ListCard>

              <ListCard title="Linked pools">
                <div className="admin-list">
                  {linkedPools.length > 0 ? (
                    linkedPools.map((request) => (
                      <div key={`${request.id}-pool`} className="admin-list-row">
                        <strong>{request.stakingPool?.id}</strong>
                        <span>
                          Pool {request.stakingPool?.blockchainPoolId ?? "pending"} on chain
                        </span>
                        <span>{request.rewardRate}% reward</span>
                        <AdminStatusBadge
                          label={toTitleCase(request.stakingPool?.poolStatus)}
                          tone={mapStatusToTone(request.stakingPool?.poolStatus)}
                        />
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      title="No linked pools yet"
                      description="Pool detail will appear after approved requests are executed."
                    />
                  )}
                </div>
              </ListCard>
            </>
          }
          main={
            selectedRequest ? (
              <>
                <ListCard title="Selected request">
                  <DetailList
                    items={[
                      {
                        label: "Request reference",
                        value: selectedRequest.id,
                        mono: true
                      },
                      {
                        label: "Reward rate",
                        value: `${selectedRequest.rewardRate}%`
                      },
                      {
                        label: "Status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(selectedRequest.status)}
                            tone={mapStatusToTone(selectedRequest.status)}
                          />
                        )
                      },
                      {
                        label: "Requested by",
                        value: `${selectedRequest.requestedByOperatorId} · ${
                          selectedRequest.requestedByOperatorRole ?? "Unknown role"
                        }`
                      },
                      {
                        label: "Requested at",
                        value: formatDateTime(selectedRequest.requestedAt)
                      },
                      {
                        label: "Last updated",
                        value: formatDateTime(selectedRequest.updatedAt)
                      }
                    ]}
                  />
                  <InlineNotice {...buildStatusNotice(selectedRequest)} />
                </ListCard>

                <ListCard title="Linked staking pool">
                  {selectedRequest.stakingPool ? (
                    <DetailList
                      items={[
                        {
                          label: "Local pool id",
                          value: String(selectedRequest.stakingPool.id),
                          mono: true
                        },
                        {
                          label: "Blockchain pool id",
                          value:
                            selectedRequest.stakingPool.blockchainPoolId === null
                              ? "Pending assignment"
                              : String(selectedRequest.stakingPool.blockchainPoolId)
                        },
                        {
                          label: "Pool status",
                          value: (
                            <AdminStatusBadge
                              label={toTitleCase(selectedRequest.stakingPool.poolStatus)}
                              tone={mapStatusToTone(selectedRequest.stakingPool.poolStatus)}
                            />
                          )
                        },
                        {
                          label: "Transaction",
                          value:
                            selectedRequest.blockchainTransactionHash ??
                            "Not recorded",
                          mono: Boolean(selectedRequest.blockchainTransactionHash)
                        }
                      ]}
                    />
                  ) : (
                    <EmptyState
                      title="No pool linked yet"
                      description="Approval must complete before execution can attach or reuse a pool record."
                    />
                  )}
                </ListCard>

                <TimelinePanel
                  title="Governance timeline"
                  description="Request, approval, rejection, execution, and linked pool state for the selected change."
                  events={buildStakingGovernanceTimeline(selectedRequest)}
                  emptyState={{
                    title: "No governance history",
                    description: "Timeline entries will appear as the request changes state."
                  }}
                />
              </>
            ) : selectedRequestQuery.isError ? (
              <ErrorState
                title="Selected request unavailable"
                description={readApiErrorMessage(
                  selectedRequestQuery.error,
                  "The selected staking governance request could not be loaded."
                )}
              />
            ) : (
              <EmptyState
                title="Select a request"
                description="Choose a governed staking request to inspect its pool state and action history."
              />
            )
          }
          rail={
            <>
              <ActionRail
                title="Request pool creation"
                description="Create a new governed reward-rate request for later approval and execution."
              >
                {flash ? <p className="admin-flash success">{flash}</p> : null}
                {requestError ? (
                  <InlineNotice
                    title="Request failed"
                    description={requestError}
                    tone="critical"
                  />
                ) : null}
                <div className="admin-field">
                  <span>Reward rate</span>
                  <input
                    aria-label="New pool reward rate"
                    inputMode="numeric"
                    value={rewardRateDraft}
                    onChange={(event) => setRewardRateDraft(event.target.value)}
                  />
                  <p className="admin-field-help">
                    Reward rate is stored as a whole-number percentage.
                  </p>
                </div>
                <div className="admin-field">
                  <span>Request note</span>
                  <textarea
                    aria-label="Staking governance request note"
                    value={requestNote}
                    onChange={(event) => setRequestNote(event.target.value)}
                  />
                </div>
                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={requestConfirm}
                    onChange={(event) => setRequestConfirm(event.target.checked)}
                  />
                  I verified the reward-rate intent, operator ownership, and execution impact before creating this governed request.
                </label>
                <button
                  type="button"
                  className="admin-primary-button"
                  disabled={!requestConfirm || createRequestMutation.isPending}
                  onClick={submitGovernanceRequest}
                >
                  {createRequestMutation.isPending
                    ? "Creating..."
                    : "Create governance request"}
                </button>
              </ActionRail>

              <ActionRail
                title="Governed actions"
                description="Approve, reject, or execute the selected request using the required dual-control confirmations."
              >
                {actionError ? (
                  <InlineNotice
                    title="Action failed"
                    description={actionError}
                    tone="critical"
                  />
                ) : null}
                {selectedRequest ? (
                  <>
                    <DetailList
                      items={[
                        {
                          label: "Selected request",
                          value: selectedRequest.id,
                          mono: true
                        },
                        {
                          label: "Current state",
                          value: (
                            <AdminStatusBadge
                              label={toTitleCase(selectedRequest.status)}
                              tone={mapStatusToTone(selectedRequest.status)}
                            />
                          )
                        }
                      ]}
                    />
                    <div className="admin-field">
                      <span>Operator note</span>
                      <textarea
                        aria-label="Staking governance operator note"
                        value={actionNote}
                        onChange={(event) => setActionNote(event.target.value)}
                      />
                      <p className="admin-field-help">
                        Approval and execution notes are optional. Rejection requires a note.
                      </p>
                    </div>
                    <label className="admin-checkbox">
                      <input
                        type="checkbox"
                        checked={governedConfirm}
                        onChange={(event) => setGovernedConfirm(event.target.checked)}
                      />
                      I reviewed requester separation, reward-rate intent, and current pool state before taking a governed action.
                    </label>
                    <div className="admin-action-buttons">
                      <button
                        type="button"
                        className="admin-secondary-button"
                        disabled={!governedConfirm || mutationPending || !allowApproveReject}
                        onClick={approveRequest}
                      >
                        {approveRequestMutation.isPending
                          ? "Approving..."
                          : "Approve request"}
                      </button>
                      <button
                        type="button"
                        className="admin-danger-button"
                        disabled={!governedConfirm || mutationPending || !allowApproveReject}
                        onClick={rejectRequest}
                      >
                        {rejectRequestMutation.isPending
                          ? "Rejecting..."
                          : "Reject request"}
                      </button>
                      <button
                        type="button"
                        className="admin-primary-button"
                        disabled={!governedConfirm || mutationPending || !allowExecute}
                        onClick={executeRequest}
                      >
                        {executeRequestMutation.isPending
                          ? "Executing..."
                          : "Execute pool creation"}
                      </button>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="Select a request"
                    description="Choose a staking governance request to unlock governed actions."
                  />
                )}
              </ActionRail>
            </>
          }
        />
      </SectionPanel>
    </div>
  );
}
