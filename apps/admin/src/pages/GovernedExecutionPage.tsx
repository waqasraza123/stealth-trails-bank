import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveGovernedExecutionOverride,
  getGovernedExecutionWorkspace,
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

type OverrideDraft = {
  reasonCode: string;
  requestNote: string;
  expiresInHours: string;
  allowUnsafeWithdrawalExecution: boolean;
  allowDirectLoanFunding: boolean;
  allowDirectStakingWrites: boolean;
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

export function GovernedExecutionPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OverrideDraft>(createOverrideDraft);
  const [draftError, setDraftError] = useState<string | null>(null);

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
      </WorkspaceLayout>
    </div>
  );
}
