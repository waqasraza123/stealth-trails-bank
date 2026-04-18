import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveGovernedExecutionOverride,
  getGovernedExecutionWorkspace,
  publishGovernedTreasuryExecutionPackage,
  recordGovernedTreasuryExecutionFailure,
  recordGovernedTreasuryExecutionSuccess,
  rejectGovernedExecutionOverride,
  requestGovernedExecutionOverride
} from "@/lib/api";
import {
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
import type { GovernedTreasuryExecutionRequest } from "@/lib/types";

type OverrideDraft = {
  reasonCode: string;
  requestNote: string;
  expiresInHours: string;
  allowUnsafeWithdrawalExecution: boolean;
  allowDirectLoanFunding: boolean;
  allowDirectStakingWrites: boolean;
};

type ExecutionDraft = {
  executionNote: string;
  blockchainTransactionHash: string;
  externalExecutionReference: string;
  contractLoanId: string;
  contractAddress: string;
  failureReason: string;
};

function createOverrideDraft(): OverrideDraft {
  return {
    reasonCode: "temporary_governance_override",
    requestNote: "",
    expiresInHours: "4",
    allowUnsafeWithdrawalExecution: false,
    allowDirectLoanFunding: true,
    allowDirectStakingWrites: true
  };
}

function createExecutionDraft(): ExecutionDraft {
  return {
    executionNote: "",
    blockchainTransactionHash: "",
    externalExecutionReference: "",
    contractLoanId: "",
    contractAddress: "",
    failureReason: ""
  };
}

export function GovernedExecutionPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OverrideDraft>(createOverrideDraft);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [executionDrafts, setExecutionDrafts] = useState<
    Record<string, ExecutionDraft>
  >({});

  const workspaceQuery = useQuery({
    queryKey: ["governed-execution-workspace", session?.baseUrl],
    queryFn: () => getGovernedExecutionWorkspace(session!),
    enabled: Boolean(session)
  });

  const requestOverrideMutation = useMutation({
    mutationFn: () =>
      requestGovernedExecutionOverride(session!, {
        reasonCode: draft.reasonCode.trim(),
        requestNote: draft.requestNote.trim() || undefined,
        expiresInHours: Number.parseInt(draft.expiresInHours.trim(), 10),
        allowUnsafeWithdrawalExecution: draft.allowUnsafeWithdrawalExecution,
        allowDirectLoanFunding: draft.allowDirectLoanFunding,
        allowDirectStakingWrites: draft.allowDirectStakingWrites
      }),
    onSuccess: () => {
      setDraft(createOverrideDraft());
      setDraftError(null);
      void queryClient.invalidateQueries({
        queryKey: ["governed-execution-workspace", session?.baseUrl]
      });
    }
  });

  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      approveGovernedExecutionOverride(session!, requestId, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["governed-execution-workspace", session?.baseUrl]
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) =>
      rejectGovernedExecutionOverride(session!, requestId, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["governed-execution-workspace", session?.baseUrl]
      });
    }
  });

  const recordExecutionSuccessMutation = useMutation({
    mutationFn: ({
      requestId,
      draft
    }: {
      requestId: string;
      draft: ExecutionDraft;
    }) =>
      recordGovernedTreasuryExecutionSuccess(session!, requestId, {
        executionNote: draft.executionNote.trim() || undefined,
        blockchainTransactionHash:
          draft.blockchainTransactionHash.trim() || undefined,
        externalExecutionReference:
          draft.externalExecutionReference.trim() || undefined,
        contractLoanId: draft.contractLoanId.trim() || undefined,
        contractAddress: draft.contractAddress.trim() || undefined
      }),
    onSuccess: (_, variables) => {
      setExecutionDrafts((current) => ({
        ...current,
        [variables.requestId]: createExecutionDraft()
      }));
      void queryClient.invalidateQueries({
        queryKey: ["governed-execution-workspace", session?.baseUrl]
      });
    }
  });

  const recordExecutionFailureMutation = useMutation({
    mutationFn: ({
      requestId,
      draft
    }: {
      requestId: string;
      draft: ExecutionDraft;
    }) =>
      recordGovernedTreasuryExecutionFailure(session!, requestId, {
        failureReason: draft.failureReason.trim(),
        executionNote: draft.executionNote.trim() || undefined,
        blockchainTransactionHash:
          draft.blockchainTransactionHash.trim() || undefined,
        externalExecutionReference:
          draft.externalExecutionReference.trim() || undefined
      }),
    onSuccess: (_, variables) => {
      setExecutionDrafts((current) => ({
        ...current,
        [variables.requestId]: createExecutionDraft()
      }));
      void queryClient.invalidateQueries({
        queryKey: ["governed-execution-workspace", session?.baseUrl]
      });
    }
  });

  const publishExecutionPackageMutation = useMutation({
    mutationFn: (requestId: string) =>
      publishGovernedTreasuryExecutionPackage(session!, requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["governed-execution-workspace", session?.baseUrl]
      });
    }
  });

  const selectedUnsafeWallets = useMemo(
    () =>
      workspaceQuery.data?.reserveWallets.filter(
        (wallet) => wallet.governanceStatus === "unsafe"
      ) ?? [],
    [workspaceQuery.data]
  );

  if (fallback) {
    return fallback;
  }

  if (workspaceQuery.isLoading) {
    return (
      <LoadingState
        title="Loading governed execution workspace"
        description="Treasury custody posture and override governance are loading."
      />
    );
  }

  if (workspaceQuery.isError) {
    return (
      <ErrorState
        title="Governed execution workspace unavailable"
        description={readApiErrorMessage(
          workspaceQuery.error,
          "Governed execution posture could not be loaded."
        )}
      />
    );
  }

  const workspace = workspaceQuery.data!;

  function submitOverrideRequest() {
    if (
      !draft.allowUnsafeWithdrawalExecution &&
      !draft.allowDirectLoanFunding &&
      !draft.allowDirectStakingWrites
    ) {
      setDraftError("Select at least one governed execution override scope.");
      return;
    }

    if (!draft.reasonCode.trim()) {
      setDraftError("Reason code is required.");
      return;
    }

    const expiresInHours = Number.parseInt(draft.expiresInHours.trim(), 10);

    if (!Number.isFinite(expiresInHours) || expiresInHours <= 0) {
      setDraftError("Override expiry must be a positive number of hours.");
      return;
    }

    setDraftError(null);
    requestOverrideMutation.mutate();
  }

  function getExecutionDraft(requestId: string): ExecutionDraft {
    return executionDrafts[requestId] ?? createExecutionDraft();
  }

  function updateExecutionDraft(
    requestId: string,
    updater: (current: ExecutionDraft) => ExecutionDraft
  ) {
    setExecutionDrafts((current) => ({
      ...current,
      [requestId]: updater(current[requestId] ?? createExecutionDraft())
    }));
  }

  function renderExecutionActions(request: GovernedTreasuryExecutionRequest) {
    if (
      request.status !== "pending_execution" &&
      request.status !== "execution_failed"
    ) {
      return null;
    }

    const draft = getExecutionDraft(request.id);

    return (
      <div className="stack-sm">
        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Execution note</span>
            <textarea
              rows={2}
              value={draft.executionNote}
              onChange={(event) =>
                updateExecutionDraft(request.id, (current) => ({
                  ...current,
                  executionNote: event.target.value
                }))
              }
            />
          </label>
          <label className="admin-field">
            <span>Transaction hash</span>
            <input
              value={draft.blockchainTransactionHash}
              onChange={(event) =>
                updateExecutionDraft(request.id, (current) => ({
                  ...current,
                  blockchainTransactionHash: event.target.value
                }))
              }
            />
          </label>
          <label className="admin-field">
            <span>External reference</span>
            <input
              value={draft.externalExecutionReference}
              onChange={(event) =>
                updateExecutionDraft(request.id, (current) => ({
                  ...current,
                  externalExecutionReference: event.target.value
                }))
              }
            />
          </label>
          {request.executionType === "loan_contract_creation" ? (
            <>
              <label className="admin-field">
                <span>Contract loan ID</span>
                <input
                  value={draft.contractLoanId}
                  onChange={(event) =>
                    updateExecutionDraft(request.id, (current) => ({
                      ...current,
                      contractLoanId: event.target.value
                    }))
                  }
                />
              </label>
              <label className="admin-field">
                <span>Contract address</span>
                <input
                  value={draft.contractAddress}
                  onChange={(event) =>
                    updateExecutionDraft(request.id, (current) => ({
                      ...current,
                      contractAddress: event.target.value
                    }))
                  }
                />
              </label>
            </>
          ) : null}
          <label className="admin-field">
            <span>Failure reason</span>
            <input
              value={draft.failureReason}
              onChange={(event) =>
                updateExecutionDraft(request.id, (current) => ({
                  ...current,
                  failureReason: event.target.value
                }))
              }
            />
          </label>
        </div>
        <ActionRail
          title="Execution recording"
          description="Record durable external execution evidence before sensitive flows continue."
          actions={[
            {
              label: recordExecutionSuccessMutation.isPending
                ? "Recording success…"
                : "Record executed",
              onClick: () =>
                recordExecutionSuccessMutation.mutate({
                  requestId: request.id,
                  draft
                }),
              disabled: recordExecutionSuccessMutation.isPending
            },
            {
              label: recordExecutionFailureMutation.isPending
                ? "Recording failure…"
                : "Record failed",
              onClick: () =>
                recordExecutionFailureMutation.mutate({
                  requestId: request.id,
                  draft
                }),
              disabled:
                recordExecutionFailureMutation.isPending ||
                !draft.failureReason.trim()
            }
          ]}
        />
      </div>
    );
  }

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Governed execution"
        description="Production custody posture, direct-key execution exposure, and dual-control overrides."
      >
        <InlineNotice
          title="Execution posture"
          description={`Environment ${toTitleCase(
            workspace.environment
          )}. Generated ${formatDateTime(workspace.generatedAt)}.`}
          tone={mapStatusToTone(workspace.posture.status)}
        />
        <div className="admin-metrics-grid compact">
          <MetricCard
            label="Reserve wallets"
            value={String(workspace.posture.totalReserveWalletCount)}
            detail={`${workspace.posture.governedReserveWalletCount} governed / ${workspace.posture.unsafeReserveWalletCount} unsafe`}
          />
          <MetricCard
            label="Managed workers"
            value={String(workspace.posture.managedWorkerCount)}
            detail={`${workspace.posture.policyControlledReadyWorkerCount} policy-controlled ready`}
          />
          <MetricCard
            label="Loan funding mode"
            value={toTitleCase(workspace.policy.loanFundingExecutionMode)}
            detail="Production funding should avoid direct app-held keys."
          />
          <MetricCard
            label="Staking write mode"
            value={toTitleCase(workspace.policy.stakingWriteExecutionMode)}
            detail="Production staking should avoid direct app-held keys."
          />
        </div>
      </SectionPanel>

      <WorkspaceLayout
        sidebar={
          <ActionRail
            title="Override governance"
            description="Request a time-bounded override only when governed execution cannot be satisfied immediately."
            actions={[
              {
                label: requestOverrideMutation.isPending
                  ? "Submitting…"
                  : "Request override",
                onClick: submitOverrideRequest,
                disabled:
                  !workspace.governance.currentOperator.canRequestOverride ||
                  requestOverrideMutation.isPending
              }
            ]}
          />
        }
      >
        <SectionPanel
          title="Critical reasons"
          description="These reasons determine whether custody posture is production-safe."
        >
          {workspace.posture.reasons.length === 0 ? (
            <EmptyState
              title="No active governance issues"
              description="Current reserve custody and execution modes satisfy governed execution requirements."
            />
          ) : (
            <div className="stack-lg">
              {workspace.posture.reasons.map((reason) => (
                <ListCard
                  key={reason.code}
                  title={toTitleCase(reason.code.replaceAll("_", " "))}
                  description={reason.summary}
                  badge={
                    <AdminStatusBadge
                      label={toTitleCase(reason.severity)}
                      tone={mapStatusToTone(reason.severity)}
                    />
                  }
                />
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          title="Unsafe reserve wallets"
          description="Reserve-covering wallets that do not currently meet governed custody requirements."
        >
          {selectedUnsafeWallets.length === 0 ? (
            <EmptyState
              title="No unsafe reserve wallets"
              description="All active reserve wallets are currently under governed custody types."
            />
          ) : (
            <div className="stack-lg">
              {selectedUnsafeWallets.map((wallet) => (
                <ListCard
                  key={wallet.id}
                  title={`${toTitleCase(wallet.kind)} · ${shortenValue(wallet.address)}`}
                  description={wallet.governanceReason}
                  badge={
                    <AdminStatusBadge
                      label={toTitleCase(wallet.custodyType)}
                      tone="critical"
                    />
                  }
                />
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          title="Override request"
          description={`Maximum override window is ${workspace.policy.overrideMaxHours} hours.`}
        >
          <div className="admin-form-grid">
            <label className="admin-field">
              <span>Reason code</span>
              <input
                value={draft.reasonCode}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    reasonCode: event.target.value
                  }))
                }
              />
            </label>
            <label className="admin-field">
              <span>Expires in hours</span>
              <input
                value={draft.expiresInHours}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    expiresInHours: event.target.value
                  }))
                }
              />
            </label>
            <label className="admin-field">
              <span>Request note</span>
              <textarea
                rows={3}
                value={draft.requestNote}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    requestNote: event.target.value
                  }))
                }
              />
            </label>
            <div className="stack-sm">
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={draft.allowUnsafeWithdrawalExecution}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      allowUnsafeWithdrawalExecution: event.target.checked
                    }))
                  }
                />
                <span>Allow unsafe managed withdrawal execution</span>
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={draft.allowDirectLoanFunding}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      allowDirectLoanFunding: event.target.checked
                    }))
                  }
                />
                <span>Allow direct-key loan funding</span>
              </label>
              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={draft.allowDirectStakingWrites}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      allowDirectStakingWrites: event.target.checked
                    }))
                  }
                />
                <span>Allow direct-key staking writes</span>
              </label>
            </div>
          </div>
          {draftError ? (
            <InlineNotice
              title="Override request invalid"
              description={draftError}
              tone="warning"
            />
          ) : null}
          {requestOverrideMutation.isError ? (
            <InlineNotice
              title="Override request failed"
              description={readApiErrorMessage(
                requestOverrideMutation.error,
                "Governed execution override request could not be submitted."
              )}
              tone="critical"
            />
          ) : null}
        </SectionPanel>

        <SectionPanel
          title="Latest pending request"
          description="Dual-control approval is required before an override takes effect."
        >
          {!workspace.latestPendingOverrideRequest ? (
            <EmptyState
              title="No pending override request"
              description="There is no governed execution override awaiting approval."
            />
          ) : (
            <ListCard
              title={workspace.latestPendingOverrideRequest.reasonCode}
              description={
                workspace.latestPendingOverrideRequest.requestNote ??
                "No request note recorded."
              }
              badge={
                <AdminStatusBadge
                  label={toTitleCase(workspace.latestPendingOverrideRequest.status)}
                  tone="warning"
                />
              }
              footer={
                <DetailList
                  items={[
                    {
                      label: "Requested by",
                      value: `${workspace.latestPendingOverrideRequest.requestedByOperatorId} · ${workspace.latestPendingOverrideRequest.requestedByOperatorRole}`
                    },
                    {
                      label: "Expires",
                      value: formatDateTime(
                        workspace.latestPendingOverrideRequest.expiresAt
                      )
                    }
                  ]}
                />
              }
            />
          )}
          {workspace.latestPendingOverrideRequest ? (
            <ActionRail
              title="Approval actions"
              description="Only approved oversight roles should clear production safeguards."
              actions={[
                {
                  label: approveMutation.isPending ? "Approving…" : "Approve",
                  onClick: () =>
                    approveMutation.mutate(
                      workspace.latestPendingOverrideRequest!.id
                    ),
                  disabled:
                    !workspace.governance.currentOperator.canApproveOverride ||
                    approveMutation.isPending
                },
                {
                  label: rejectMutation.isPending ? "Rejecting…" : "Reject",
                  onClick: () =>
                    rejectMutation.mutate(
                      workspace.latestPendingOverrideRequest!.id
                    ),
                  disabled:
                    !workspace.governance.currentOperator.canApproveOverride ||
                    rejectMutation.isPending
                }
              ]}
            />
          ) : null}
        </SectionPanel>

        <SectionPanel
          title="Recent overrides"
          description="Durable record of recent governed execution override actions."
        >
          {workspace.recentOverrideRequests.length === 0 ? (
            <EmptyState
              title="No override history"
              description="No governed execution overrides have been recorded."
            />
          ) : (
            <div className="stack-lg">
              {workspace.recentOverrideRequests.map((request) => (
                <ListCard
                  key={request.id}
                  title={`${request.reasonCode} · ${shortenValue(request.id)}`}
                  description={
                    request.requestNote ??
                    "No request note was recorded for this override."
                  }
                  badge={
                    <AdminStatusBadge
                      label={toTitleCase(request.status)}
                      tone={mapStatusToTone(
                        request.status === "approved"
                          ? "warning"
                          : request.status === "pending_approval"
                            ? "warning"
                            : request.status === "rejected"
                              ? "critical"
                              : "neutral"
                      )}
                    />
                  }
                />
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          title="Governed treasury execution"
          description="Durable queue of externalized treasury actions for loans and staking."
        >
          {workspace.recentExecutionRequests.length === 0 ? (
            <EmptyState
              title="No governed execution requests"
              description="No externalized treasury execution requests have been recorded yet."
            />
          ) : (
            <div className="stack-lg">
              {workspace.recentExecutionRequests.map((request) => (
                <ListCard
                  key={request.id}
                  title={`${toTitleCase(
                    request.executionType.replaceAll("_", " ")
                  )} · ${shortenValue(request.id)}`}
                  description={
                    request.requestNote ??
                    `${request.targetType} ${shortenValue(
                      request.targetId
                    )} queued for governed execution.`
                  }
                  badge={
                    <AdminStatusBadge
                      label={toTitleCase(request.status.replaceAll("_", " "))}
                      tone={mapStatusToTone(
                        request.status === "executed"
                          ? "positive"
                          : request.status === "execution_failed"
                            ? "critical"
                            : "warning"
                      )}
                    />
                  }
                  footer={
                    <div className="stack-sm">
                      <DetailList
                        items={[
                          {
                            label: "Target",
                            value: `${request.targetType} · ${shortenValue(
                              request.targetId
                            )}`
                          },
                          {
                            label: "Requested by",
                            value: `${request.requestedByActorId} · ${
                              request.requestedByActorRole ?? "unknown"
                            }`
                          },
                          {
                            label: "Evidence",
                            value:
                              request.blockchainTransactionHash ??
                              request.executionPackageHash ??
                              request.externalExecutionReference ??
                              request.failureReason ??
                              "Pending evidence"
                          },
                          {
                            label: "Package",
                            value:
                              request.executionPackageHash
                                ? `${shortenValue(
                                    request.executionPackageHash
                                  )} · ${formatDateTime(
                                    request.executionPackagePublishedAt ??
                                      request.requestedAt
                                  )}`
                                : "Not yet published"
                          },
                          {
                            label: "Claim",
                            value: request.claimedByWorkerId
                              ? `${request.claimedByWorkerId} until ${formatDateTime(
                                  request.claimExpiresAt ?? request.claimedAt ?? request.requestedAt
                                )}`
                              : "Unclaimed"
                          },
                          {
                            label: "Dispatch",
                            value:
                              request.dispatchStatus === "dispatched"
                                ? `${request.dispatchedByWorkerId ?? "worker"} · ${
                                    request.dispatchReference
                                      ? shortenValue(request.dispatchReference)
                                      : "no reference"
                                  }`
                                : request.dispatchStatus === "dispatch_failed"
                                  ? request.dispatchFailureReason ??
                                    "Dispatch verification failed"
                                  : "Not yet dispatched"
                          }
                        ]}
                      />
                      {!request.executionPackageHash &&
                      (request.status === "pending_execution" ||
                        request.status === "execution_failed") ? (
                        <ActionRail
                          title="Execution package"
                          description={`Publish a signed canonical package before a governed executor claims this request. Lease window ${workspace.policy.executionClaimLeaseSeconds} seconds.`}
                          actions={[
                            {
                              label: publishExecutionPackageMutation.isPending
                                ? "Publishing…"
                                : "Publish package",
                              onClick: () =>
                                publishExecutionPackageMutation.mutate(request.id),
                              disabled: publishExecutionPackageMutation.isPending
                            }
                          ]}
                        />
                      ) : null}
                      {renderExecutionActions(request)}
                    </div>
                  }
                />
              ))}
            </div>
          )}
          {recordExecutionSuccessMutation.isError ? (
            <InlineNotice
              title="Execution success recording failed"
              description={readApiErrorMessage(
                recordExecutionSuccessMutation.error,
                "Governed execution success could not be recorded."
              )}
              tone="critical"
            />
          ) : null}
          {recordExecutionFailureMutation.isError ? (
            <InlineNotice
              title="Execution failure recording failed"
              description={readApiErrorMessage(
                recordExecutionFailureMutation.error,
                "Governed execution failure could not be recorded."
              )}
              tone="critical"
            />
          ) : null}
          {publishExecutionPackageMutation.isError ? (
            <InlineNotice
              title="Execution package publish failed"
              description={readApiErrorMessage(
                publishExecutionPackageMutation.error,
                "Governed execution package could not be published."
              )}
              tone="critical"
            />
          ) : null}
        </SectionPanel>
      </WorkspaceLayout>
    </div>
  );
}
