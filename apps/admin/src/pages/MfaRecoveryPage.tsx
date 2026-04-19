import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  approveCustomerMfaRecoveryRequest,
  executeCustomerMfaRecoveryRequest,
  listCustomerMfaRecoveryRequests,
  rejectCustomerMfaRecoveryRequest,
  requestCustomerMfaRecovery
} from "@/lib/api";
import {
  formatCount,
  formatDateTime,
  formatName,
  readApiErrorMessage,
  shortenValue,
  toTitleCase,
  trimToUndefined
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

const requestTypeOptions = [
  {
    value: "release_lockout" as const,
    label: "Release lockout",
    description:
      "Clear failed-attempt lockout state, remove active challenges, and revoke current sessions."
  },
  {
    value: "reset_mfa" as const,
    label: "Reset MFA",
    description:
      "Remove enrolled factors, clear lockout and challenge state, and force fresh MFA enrollment."
  }
];

export function MfaRecoveryPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedRequestId = searchParams.get("request");
  const [actionNote, setActionNote] = useState("");
  const [requestSupabaseUserId, setRequestSupabaseUserId] = useState("");
  const [requestType, setRequestType] = useState<(typeof requestTypeOptions)[number]["value"]>(
    "release_lockout"
  );
  const [requestNote, setRequestNote] = useState("");
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["customer-mfa-recovery-requests", session?.baseUrl],
    queryFn: () => listCustomerMfaRecoveryRequests(session!, { limit: 25 }),
    enabled: Boolean(session)
  });

  useEffect(() => {
    const firstRequestId = requestsQuery.data?.requests[0]?.id;

    if (firstRequestId && !selectedRequestId) {
      setSearchParams({ request: firstRequestId });
      return;
    }

    if (
      selectedRequestId &&
      requestsQuery.data &&
      !requestsQuery.data.requests.some((request) => request.id === selectedRequestId) &&
      firstRequestId
    ) {
      setSearchParams({ request: firstRequestId });
    }
  }, [requestsQuery.data, selectedRequestId, setSearchParams]);

  useEffect(() => {
    setActionError(null);
    setActionNote("");
    setGovernedConfirm(false);
  }, [selectedRequestId]);

  async function refreshRequests() {
    await queryClient.invalidateQueries({
      queryKey: ["customer-mfa-recovery-requests", session?.baseUrl]
    });
  }

  const selectedRequest =
    requestsQuery.data?.requests.find((request) => request.id === selectedRequestId) ?? null;
  const selectedRequestType =
    requestTypeOptions.find((option) => option.value === selectedRequest?.requestType) ?? null;

  const requestRecoveryMutation = useMutation({
    mutationFn: () =>
      requestCustomerMfaRecovery(session!, requestSupabaseUserId.trim(), {
        requestType,
        note: trimToUndefined(requestNote)
      }),
    onSuccess: async (result) => {
      setFlash(
        result.stateReused
          ? `Recovery request already open (${shortenValue(result.request.id)}).`
          : `Recovery request created (${shortenValue(result.request.id)}).`
      );
      setActionError(null);
      setRequestSupabaseUserId("");
      setRequestNote("");
      setRequestType("release_lockout");
      setSearchParams({ request: result.request.id });
      await refreshRequests();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to open the MFA recovery request."));
    }
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      approveCustomerMfaRecoveryRequest(session!, selectedRequest!.id, {
        note: trimToUndefined(actionNote)
      }),
    onSuccess: async (result) => {
      setFlash(
        result.stateReused
          ? `Recovery request already approved (${shortenValue(result.request.id)}).`
          : `Recovery request approved (${shortenValue(result.request.id)}).`
      );
      setActionError(null);
      setGovernedConfirm(false);
      await refreshRequests();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to approve the MFA recovery request."));
    }
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      rejectCustomerMfaRecoveryRequest(session!, selectedRequest!.id, {
        note: actionNote.trim()
      }),
    onSuccess: async (result) => {
      setFlash(
        result.stateReused
          ? `Recovery request already rejected (${shortenValue(result.request.id)}).`
          : `Recovery request rejected (${shortenValue(result.request.id)}).`
      );
      setActionError(null);
      setGovernedConfirm(false);
      await refreshRequests();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to reject the MFA recovery request."));
    }
  });

  const executeMutation = useMutation({
    mutationFn: () =>
      executeCustomerMfaRecoveryRequest(session!, selectedRequest!.id, {
        note: trimToUndefined(actionNote)
      }),
    onSuccess: async (result) => {
      setFlash(
        result.stateReused
          ? `Recovery execution already completed (${shortenValue(result.request.id)}).`
          : `Recovery execution completed (${shortenValue(result.request.id)}).`
      );
      setActionError(null);
      setGovernedConfirm(false);
      await refreshRequests();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to execute the MFA recovery request."));
    }
  });

  if (fallback) {
    return fallback;
  }

  if (requestsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading MFA recovery queue"
        description="Recovery requests, operator decisions, and customer reset posture are loading."
      />
    );
  }

  if (requestsQuery.isError) {
    return (
      <ErrorState
        title="MFA recovery queue unavailable"
        description="Customer recovery requests could not be loaded."
      />
    );
  }

  const statusCount = (status: "pending_approval" | "approved" | "executed" | "rejected") =>
    requestsQuery.data?.summary.byStatus.find((entry) => entry.status === status)?.count ?? 0;

  const canApprove =
    Boolean(selectedRequest) &&
    selectedRequest!.status === "pending_approval" &&
    selectedRequest!.requestedByOperatorId !== session?.operatorId;
  const canReject =
    Boolean(selectedRequest) &&
    selectedRequest!.status === "pending_approval" &&
    selectedRequest!.requestedByOperatorId !== session?.operatorId;
  const canExecute =
    Boolean(selectedRequest) &&
    selectedRequest!.status === "approved" &&
    selectedRequest!.requestedByOperatorId !== session?.operatorId;

  const mutationPending =
    requestRecoveryMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    executeMutation.isPending;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Customer MFA Recovery"
        description="Governed support workflow for lockout release, MFA reset, and dual-control execution."
      >
        <div className="admin-metric-grid">
          <MetricCard
            label="Pending approval"
            value={formatCount(statusCount("pending_approval"))}
            detail="Requests waiting for second-operator review."
          />
          <MetricCard
            label="Approved"
            value={formatCount(statusCount("approved"))}
            detail="Approved requests waiting for execution."
          />
          <MetricCard
            label="Executed"
            value={formatCount(statusCount("executed"))}
            detail="Completed operator recoveries in the current queue."
          />
          <MetricCard
            label="Rejected"
            value={formatCount(statusCount("rejected"))}
            detail="Requests closed with a rejection decision."
          />
        </div>

        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Recovery inbox">
                <div className="admin-list">
                  {requestsQuery.data!.requests.length > 0 ? (
                    requestsQuery.data!.requests.map((request) => (
                      <button
                        key={request.id}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedRequestId === request.id ? "selected" : ""
                        }`}
                        onClick={() => setSearchParams({ request: request.id })}
                      >
                        <strong>{formatName(request.customer.firstName, request.customer.lastName)}</strong>
                        <span>{request.customer.email}</span>
                        <span>{toTitleCase(request.requestType)}</span>
                        <AdminStatusBadge
                          label={toTitleCase(request.status.replaceAll("_", " "))}
                          tone={mapStatusToTone(request.status)}
                        />
                      </button>
                    ))
                  ) : (
                    <div className="admin-list-row">
                      <strong>No recovery requests</strong>
                      <span>Open a governed request from the rail to begin support handling.</span>
                    </div>
                  )}
                </div>
              </ListCard>

              <ListCard title="Queue guidance">
                <InlineNotice
                  tone="warning"
                  title="Dual control required"
                  description="The requester cannot approve or execute the same customer MFA recovery request."
                />
                <InlineNotice
                  tone="technical"
                  title="Execution posture"
                  description="Recovery execution clears active challenge state and revokes current customer sessions."
                />
              </ListCard>
            </>
          }
          main={
            selectedRequest ? (
              <>
                <ListCard title="Recovery request">
                  <DetailList
                    items={[
                      { label: "Request reference", value: selectedRequest.id, mono: true },
                      {
                        label: "Request type",
                        value: selectedRequestType?.label ?? toTitleCase(selectedRequest.requestType)
                      },
                      {
                        label: "Status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(selectedRequest.status.replaceAll("_", " "))}
                            tone={mapStatusToTone(selectedRequest.status)}
                          />
                        )
                      },
                      {
                        label: "Requested at",
                        value: formatDateTime(selectedRequest.requestedAt)
                      },
                      {
                        label: "Requested by",
                        value: `${selectedRequest.requestedByOperatorId} · ${selectedRequest.requestedByOperatorRole}`
                      }
                    ]}
                  />
                  <InlineNotice
                    tone={selectedRequest.requestType === "reset_mfa" ? "critical" : "warning"}
                    title={selectedRequestType?.label ?? "Recovery action"}
                    description={
                      selectedRequestType?.description ??
                      "This request changes customer MFA posture and requires governed operator handling."
                    }
                  />
                </ListCard>

                <ListCard title="Customer impact">
                  <DetailList
                    items={[
                      {
                        label: "Customer",
                        value: formatName(
                          selectedRequest.customer.firstName,
                          selectedRequest.customer.lastName
                        )
                      },
                      { label: "Email", value: selectedRequest.customer.email },
                      {
                        label: "Supabase user",
                        value: selectedRequest.customer.supabaseUserId,
                        mono: true
                      },
                      {
                        label: "Account reference",
                        value: selectedRequest.customer.customerAccountId ?? "Not linked",
                        mono: Boolean(selectedRequest.customer.customerAccountId)
                      },
                      {
                        label: "Account status",
                        value: selectedRequest.customer.accountStatus
                          ? toTitleCase(selectedRequest.customer.accountStatus)
                          : "Not available"
                      }
                    ]}
                  />
                </ListCard>

                <ListCard title="Decision history">
                  <DetailList
                    items={[
                      {
                        label: "Request note",
                        value: selectedRequest.requestNote ?? "No request note recorded"
                      },
                      {
                        label: "Approval",
                        value: selectedRequest.approvedAt
                          ? `${formatDateTime(selectedRequest.approvedAt)} by ${selectedRequest.approvedByOperatorId ?? "unknown"}`
                          : "Pending approval"
                      },
                      {
                        label: "Approval note",
                        value: selectedRequest.approvalNote ?? "No approval note recorded"
                      },
                      {
                        label: "Rejection",
                        value: selectedRequest.rejectedAt
                          ? `${formatDateTime(selectedRequest.rejectedAt)} by ${selectedRequest.rejectedByOperatorId ?? "unknown"}`
                          : "Not rejected"
                      },
                      {
                        label: "Rejection note",
                        value: selectedRequest.rejectionNote ?? "No rejection note recorded"
                      },
                      {
                        label: "Execution",
                        value: selectedRequest.executedAt
                          ? `${formatDateTime(selectedRequest.executedAt)} by ${selectedRequest.executedByOperatorId ?? "unknown"}`
                          : "Not executed"
                      },
                      {
                        label: "Execution note",
                        value: selectedRequest.executionNote ?? "No execution note recorded"
                      }
                    ]}
                  />
                  {selectedRequest.requestedByOperatorId === session?.operatorId ? (
                    <InlineNotice
                      tone="warning"
                      title="Second operator required"
                      description="This operator requested the recovery action, so another authorized operator must approve or execute it."
                    />
                  ) : null}
                </ListCard>
              </>
            ) : (
              <EmptyState
                title="No recovery request selected"
                description="Choose a request from the inbox or open a new governed request from the recovery rail."
              />
            )
          }
          rail={
            <ActionRail
              title="Recovery controls"
              description="Approval and execution controls are separated to preserve operator dual control."
            >
              {selectedRequest ? (
                <>
                  <div className="admin-field">
                    <span>Operator note</span>
                    <textarea
                      aria-label="Recovery action note"
                      placeholder="Record support evidence, identity checks, and why the recovery action is justified."
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
                      I verified the support evidence, recovery type, customer impact, and dual-control requirement.
                    </span>
                  </label>
                </>
              ) : null}

              {flash ? <InlineNotice title="Last action" description={flash} tone="positive" /> : null}
              {actionError ? (
                <InlineNotice title="Action failed" description={actionError} tone="critical" />
              ) : null}

              <div className="admin-action-buttons">
                <button
                  type="button"
                  className="admin-secondary-button"
                  disabled={!selectedRequest || !governedConfirm || mutationPending || !canApprove}
                  onClick={() => approveMutation.mutate()}
                >
                  {approveMutation.isPending ? "Approving..." : "Approve request"}
                </button>
                <button
                  type="button"
                  className="admin-secondary-button"
                  disabled={
                    !selectedRequest ||
                    !governedConfirm ||
                    mutationPending ||
                    !canReject ||
                    actionNote.trim().length === 0
                  }
                  onClick={() => rejectMutation.mutate()}
                >
                  {rejectMutation.isPending ? "Rejecting..." : "Reject request"}
                </button>
                <button
                  type="button"
                  className="admin-secondary-button"
                  disabled={!selectedRequest || !governedConfirm || mutationPending || !canExecute}
                  onClick={() => executeMutation.mutate()}
                >
                  {executeMutation.isPending ? "Executing..." : "Execute recovery"}
                </button>
              </div>

              <div className="stack-md">
                <h4>Open new request</h4>
                <div className="admin-form-grid">
                  <label className="admin-field">
                    <span>Customer Supabase user ID</span>
                    <input
                      aria-label="Customer Supabase user ID"
                      placeholder="supabase_user_id"
                      value={requestSupabaseUserId}
                      onChange={(event) => setRequestSupabaseUserId(event.target.value)}
                    />
                  </label>

                  <label className="admin-field">
                    <span>Recovery type</span>
                    <select
                      aria-label="Recovery type"
                      value={requestType}
                      onChange={(event) =>
                        setRequestType(
                          event.target.value as (typeof requestTypeOptions)[number]["value"]
                        )
                      }
                    >
                      {requestTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="admin-field">
                    <span>Request note</span>
                    <textarea
                      aria-label="Recovery request note"
                      placeholder="Describe the support case, customer verification evidence, and why this recovery path is needed."
                      rows={3}
                      value={requestNote}
                      onChange={(event) => setRequestNote(event.target.value)}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className="admin-button"
                  disabled={mutationPending || requestSupabaseUserId.trim().length === 0}
                  onClick={() => requestRecoveryMutation.mutate()}
                >
                  {requestRecoveryMutation.isPending ? "Opening..." : "Open recovery request"}
                </button>
              </div>
            </ActionRail>
          }
        />
      </SectionPanel>
    </div>
  );
}
