import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  approveRetirementVaultRuleChangeRequest,
  approveRetirementVaultReleaseRequest,
  getRetirementVaultWorkspace,
  listRetirementVaults,
  rejectRetirementVaultRuleChangeRequest,
  rejectRetirementVaultReleaseRequest,
  releaseRetirementVaultRestriction,
  restrictRetirementVault,
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
  MetricCard,
  SectionPanel,
  TimelinePanel,
  WorkspaceLayout,
} from "@/components/console/primitives";
import {
  mapAuditEntriesToTimeline,
  mapCustomerAccountTimelineEntriesToTimeline,
  mapStatusToTone,
  useConfiguredSessionGuard,
} from "./shared";

const vaultStatusOptions = [
  { value: "all", label: "All vaults" },
  { value: "active", label: "Active" },
  { value: "restricted", label: "Restricted" },
  { value: "released", label: "Released" },
] as const;

const releaseStatusOptions = [
  { value: "all", label: "Any release posture" },
  { value: "review_required", label: "Review required" },
  { value: "cooldown_active", label: "Cooldown active" },
  { value: "ready_for_release", label: "Ready for release" },
  { value: "executing", label: "Executing" },
  { value: "failed", label: "Failed" },
] as const;

const restrictionReasonOptions = [
  { value: "suspicious_unlock_activity", label: "Suspicious unlock activity" },
  { value: "incident_protective_lock", label: "Incident protective lock" },
  { value: "operator_safety_lock", label: "Operator safety lock" },
] as const;

function mapVaultEventsToTimeline(
  events: Awaited<ReturnType<typeof getRetirementVaultWorkspace>>["vaultEvents"],
) {
  return events.map((event) => ({
    id: event.id,
    label: toTitleCase(event.eventType),
    description: `Vault activity recorded by ${toTitleCase(event.actorType)} ${
      event.actorId ?? "system"
    }.`,
    timestamp: event.createdAt,
    tone: mapStatusToTone(event.eventType),
    metadata: [{ label: "Actor", value: event.actorId ?? "system" }],
  }));
}

export function VaultsPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVaultId = searchParams.get("vault");
  const [vaultStatusFilter, setVaultStatusFilter] =
    useState<(typeof vaultStatusOptions)[number]["value"]>("all");
  const [releaseStatusFilter, setReleaseStatusFilter] =
    useState<(typeof releaseStatusOptions)[number]["value"]>("all");
  const [restrictionReasonCode, setRestrictionReasonCode] = useState(
    restrictionReasonOptions[0]!.value,
  );
  const [oversightIncidentId, setOversightIncidentId] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const vaultsQuery = useQuery({
    queryKey: [
      "retirement-vaults",
      session?.baseUrl,
      vaultStatusFilter,
      releaseStatusFilter,
    ],
    queryFn: () =>
      listRetirementVaults(session!, {
        limit: 30,
        status: vaultStatusFilter === "all" ? undefined : vaultStatusFilter,
        releaseRequestStatus:
          releaseStatusFilter === "all" ? undefined : releaseStatusFilter,
      }),
    enabled: Boolean(session),
  });

  const workspaceQuery = useQuery({
    queryKey: ["retirement-vault-workspace", session?.baseUrl, selectedVaultId],
    queryFn: () => getRetirementVaultWorkspace(session!, selectedVaultId!, { recentLimit: 12 }),
    enabled: Boolean(session && selectedVaultId),
  });

  useEffect(() => {
    const firstVaultId = vaultsQuery.data?.vaults[0]?.id;
    if (firstVaultId && !selectedVaultId) {
      setSearchParams({ vault: firstVaultId });
    }
  }, [vaultsQuery.data, selectedVaultId, setSearchParams]);

  useEffect(() => {
    setActionNote("");
    setOversightIncidentId("");
    setFlash(null);
    setActionError(null);
  }, [selectedVaultId]);

  async function refreshWorkspace() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["retirement-vaults", session?.baseUrl],
      }),
      queryClient.invalidateQueries({
        queryKey: ["retirement-vault-workspace", session?.baseUrl, selectedVaultId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["retirement-vault-release-requests", session?.baseUrl],
      }),
      queryClient.invalidateQueries({
        queryKey: ["customer-account-timeline", session?.baseUrl],
      }),
    ]);
  }

  function clearActionState() {
    setFlash(null);
    setActionError(null);
  }

  const selectedVault =
    workspaceQuery.data?.vault ??
    vaultsQuery.data?.vaults.find((vault) => vault.id === selectedVaultId) ??
    null;

  const selectedActionableReleaseRequest = useMemo(() => {
    if (!selectedVault) {
      return null;
    }

    return (
      selectedVault.releaseRequests.find((request) => request.status === "review_required") ??
      selectedVault.releaseRequests.find((request) =>
        ["cooldown_active", "ready_for_release", "executing"].includes(request.status),
      ) ??
      null
    );
  }, [selectedVault]);

  const selectedActionableRuleChangeRequest = useMemo(() => {
    if (!selectedVault) {
      return null;
    }

    return (
      selectedVault.ruleChangeRequests.find(
        (request) => request.status === "review_required",
      ) ??
      selectedVault.ruleChangeRequests.find((request) =>
        ["cooldown_active", "ready_to_apply", "applying"].includes(request.status),
      ) ??
      null
    );
  }, [selectedVault]);

  const restrictMutation = useMutation({
    mutationFn: () =>
      restrictRetirementVault(session!, selectedVaultId!, {
        reasonCode: restrictionReasonCode,
        note: trimToUndefined(actionNote),
        oversightIncidentId: trimToUndefined(oversightIncidentId),
      }),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Retirement vault restricted.");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to restrict retirement vault."));
    },
  });

  const releaseRestrictionMutation = useMutation({
    mutationFn: () =>
      releaseRetirementVaultRestriction(session!, selectedVaultId!, {
        note: trimToUndefined(actionNote),
      }),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Retirement vault restriction released.");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(
        readApiErrorMessage(error, "Failed to release retirement vault restriction."),
      );
    },
  });

  const approveReleaseMutation = useMutation({
    mutationFn: () =>
      approveRetirementVaultReleaseRequest(
        session!,
        selectedActionableReleaseRequest!.id,
        { note: trimToUndefined(actionNote) },
      ),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Retirement vault release request approved into cooldown.");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to approve release request."));
    },
  });

  const rejectReleaseMutation = useMutation({
    mutationFn: () =>
      rejectRetirementVaultReleaseRequest(
        session!,
        selectedActionableReleaseRequest!.id,
        { note: trimToUndefined(actionNote) },
      ),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Retirement vault release request rejected.");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to reject release request."));
    },
  });

  const approveRuleChangeMutation = useMutation({
    mutationFn: () =>
      approveRetirementVaultRuleChangeRequest(
        session!,
        selectedActionableRuleChangeRequest!.id,
        { note: trimToUndefined(actionNote) },
      ),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Retirement vault rule change approved into cooldown.");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to approve rule change request."));
    },
  });

  const rejectRuleChangeMutation = useMutation({
    mutationFn: () =>
      rejectRetirementVaultRuleChangeRequest(
        session!,
        selectedActionableRuleChangeRequest!.id,
        { note: trimToUndefined(actionNote) },
      ),
    onMutate: clearActionState,
    onSuccess: async () => {
      setFlash("Retirement vault rule change rejected.");
      await refreshWorkspace();
    },
    onError: (error) => {
      setActionError(readApiErrorMessage(error, "Failed to reject rule change request."));
    },
  });

  if (fallback) {
    return fallback;
  }

  if (vaultsQuery.isLoading) {
    return (
      <LoadingState
        title="Loading vault operations"
        description="Retirement vault overview, release posture, and restriction state are loading."
      />
    );
  }

  if (vaultsQuery.isError) {
    return (
      <ErrorState
        title="Vault operations unavailable"
        description="The retirement vault workspace could not be loaded. Recheck the operator session or retry the request."
      />
    );
  }

  const vaults = vaultsQuery.data!.vaults;
  const restrictedVaults = vaults.filter((vault) => vault.status === "restricted");
  const pendingReviewVaults = vaults.filter((vault) =>
    vault.releaseRequests.some((request) => request.status === "review_required"),
  );
  const pendingRuleChangeVaults = vaults.filter((vault) =>
    vault.ruleChangeRequests.some((request) => request.status === "review_required"),
  );
  const cooldownVaults = vaults.filter((vault) =>
    vault.releaseRequests.some((request) => request.status === "cooldown_active"),
  );
  const railPending =
    restrictMutation.isPending ||
    releaseRestrictionMutation.isPending ||
    approveReleaseMutation.isPending ||
    rejectReleaseMutation.isPending ||
    approveRuleChangeMutation.isPending ||
    rejectRuleChangeMutation.isPending;

  return (
    <div className="admin-page-grid">
      <SectionPanel
        title="Retirement vaults"
        description="Protected-funds overview, governed unlock posture, and vault restriction controls."
        action={
          <div className="admin-field-grid">
            <div className="admin-field">
              <span>Vault status</span>
              <select
                aria-label="Vault status filter"
                value={vaultStatusFilter}
                onChange={(event) =>
                  setVaultStatusFilter(
                    event.target.value as (typeof vaultStatusOptions)[number]["value"],
                  )
                }
              >
                {vaultStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="admin-field">
              <span>Release posture</span>
              <select
                aria-label="Vault release status filter"
                value={releaseStatusFilter}
                onChange={(event) =>
                  setReleaseStatusFilter(
                    event.target.value as (typeof releaseStatusOptions)[number]["value"],
                  )
                }
              >
                {releaseStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        }
      >
        <div className="admin-metric-grid">
          <MetricCard
            label="Visible vaults"
            value={`${vaults.length}`}
            detail="Filtered retirement vaults visible to the current operator session."
          />
          <MetricCard
            label="Pending review"
            value={`${pendingReviewVaults.length} / ${pendingRuleChangeVaults.length}`}
            detail="Unlock review count versus rule-change review count."
          />
          <MetricCard
            label="Cooldown / restricted"
            value={`${cooldownVaults.length} / ${restrictedVaults.length}`}
            detail="Vaults currently cooling down versus vaults under operator or incident protection."
          />
        </div>

        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Vaults">
                <div className="admin-list">
                  {vaults.length > 0 ? (
                    vaults.map((vault) => (
                      <button
                        key={vault.id}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedVaultId === vault.id ? "selected" : ""
                        }`}
                        onClick={() => setSearchParams({ vault: vault.id })}
                      >
                        <strong>{vault.customerAccount.customer.email}</strong>
                        <span>
                          {vault.asset.symbol} · {vault.lockedBalance}
                        </span>
                        <span>{toTitleCase(vault.status)}</span>
                        <AdminStatusBadge
                          label={toTitleCase(vault.status)}
                          tone={mapStatusToTone(vault.status)}
                        />
                      </button>
                    ))
                  ) : (
                    <EmptyState
                      title="No vaults found"
                      description="Retirement vaults matching the selected filters will appear here."
                    />
                  )}
                </div>
              </ListCard>

              <ListCard title="Pending unlock work">
                <div className="admin-list">
                  {[...pendingReviewVaults, ...cooldownVaults]
                    .slice(0, 12)
                    .map((vault) => {
                      const releaseRequest =
                        vault.releaseRequests.find(
                          (request) => request.status === "review_required",
                        ) ??
                        vault.releaseRequests.find(
                          (request) => request.status === "cooldown_active",
                        );

                      if (!releaseRequest) {
                        return null;
                      }

                      return (
                        <button
                          key={`${vault.id}:${releaseRequest.id}`}
                          type="button"
                          className={`admin-list-row selectable ${
                            selectedVaultId === vault.id ? "selected" : ""
                          }`}
                          onClick={() => setSearchParams({ vault: vault.id })}
                        >
                          <strong>{vault.asset.symbol}</strong>
                          <span>{toTitleCase(releaseRequest.status)}</span>
                          <span>{releaseRequest.requestedAmount}</span>
                          <AdminStatusBadge
                            label={toTitleCase(releaseRequest.status)}
                            tone={mapStatusToTone(releaseRequest.status)}
                          />
                        </button>
                      );
                    })
                    .filter(Boolean)}
                  {pendingReviewVaults.length === 0 && cooldownVaults.length === 0 ? (
                    <EmptyState
                      title="No pending unlock work"
                      description="Review-required and cooldown-active vaults will appear here."
                    />
                  ) : null}
                </div>
              </ListCard>

              <ListCard title="Pending rule changes">
                <div className="admin-list">
                  {pendingRuleChangeVaults.slice(0, 12).map((vault) => {
                    const ruleChangeRequest = vault.ruleChangeRequests.find(
                      (request) => request.status === "review_required",
                    );

                    if (!ruleChangeRequest) {
                      return null;
                    }

                    return (
                      <button
                        key={`${vault.id}:${ruleChangeRequest.id}`}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedVaultId === vault.id ? "selected" : ""
                        }`}
                        onClick={() => setSearchParams({ vault: vault.id })}
                      >
                        <strong>{vault.asset.symbol}</strong>
                        <span>{toTitleCase(ruleChangeRequest.status)}</span>
                        <span>
                          {formatDateTime(ruleChangeRequest.requestedUnlockAt)}
                        </span>
                        <AdminStatusBadge
                          label={toTitleCase(ruleChangeRequest.status)}
                          tone={mapStatusToTone(ruleChangeRequest.status)}
                        />
                      </button>
                    );
                  })}
                  {pendingRuleChangeVaults.length === 0 ? (
                    <EmptyState
                      title="No pending rule changes"
                      description="Protection-weakening rule changes awaiting review will appear here."
                    />
                  ) : null}
                </div>
              </ListCard>
            </>
          }
          main={
            selectedVault ? (
              <>
                <ListCard title="Vault detail">
                  <DetailList
                    items={[
                      {
                        label: "Vault reference",
                        value: selectedVault.id,
                        mono: true,
                      },
                      {
                        label: "Customer",
                        value: formatName(
                          selectedVault.customerAccount.customer.firstName,
                          selectedVault.customerAccount.customer.lastName,
                        ),
                      },
                      {
                        label: "Customer email",
                        value: selectedVault.customerAccount.customer.email,
                      },
                      {
                        label: "Status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(selectedVault.status)}
                            tone={mapStatusToTone(selectedVault.status)}
                          />
                        ),
                      },
                      {
                        label: "Locked balance",
                        value: `${selectedVault.lockedBalance} ${selectedVault.asset.symbol}`,
                      },
                      {
                        label: "Unlock date",
                        value: formatDateTime(selectedVault.unlockAt),
                      },
                      {
                        label: "Strict mode",
                        value: selectedVault.strictMode ? "Strict" : "Standard",
                      },
                      {
                        label: "Customer account",
                        value: shortenValue(selectedVault.customerAccount.id),
                        mono: true,
                      },
                    ]}
                  />
                  {selectedVault.status === "restricted" ? (
                    <InlineNotice
                      title="Vault restriction is active"
                      description={
                        selectedVault.restriction.restrictionNote ??
                        "This vault is protected from cooldown progression and release execution until the restriction is released."
                      }
                      tone="critical"
                    />
                  ) : (
                    <InlineNotice
                      title="Protection posture"
                      description="This vault remains outside ordinary wallet withdrawals and can only release funds through governed unlock workflow."
                      tone="neutral"
                    />
                  )}
                </ListCard>

                <ListCard title="Restriction and incident context">
                  <DetailList
                    items={[
                      {
                        label: "Restriction reason",
                        value:
                          selectedVault.restriction.restrictionReasonCode
                            ? toTitleCase(selectedVault.restriction.restrictionReasonCode)
                            : "Not restricted",
                      },
                      {
                        label: "Restricted at",
                        value: formatDateTime(selectedVault.restriction.restrictedAt),
                      },
                      {
                        label: "Restricted by",
                        value:
                          selectedVault.restriction.restrictedByOperatorId ??
                          "No active operator restriction",
                      },
                      {
                        label: "Oversight incident",
                        value: workspaceQuery.data?.linkedOversightIncident
                          ? shortenValue(workspaceQuery.data.linkedOversightIncident.id)
                          : "Not linked",
                        mono: Boolean(workspaceQuery.data?.linkedOversightIncident),
                      },
                    ]}
                  />
                  {workspaceQuery.data?.linkedOversightIncident ? (
                    <InlineNotice
                      title="Linked oversight incident"
                      description={`${toTitleCase(
                        workspaceQuery.data.linkedOversightIncident.incidentType,
                      )} · ${toTitleCase(
                        workspaceQuery.data.linkedOversightIncident.status,
                      )}`}
                      tone="warning"
                    />
                  ) : null}
                </ListCard>

                <ListCard title="Release workflow">
                  {selectedVault.releaseRequests.length > 0 ? (
                    <div className="admin-list">
                      {selectedVault.releaseRequests.map((request) => (
                        <div key={request.id} className="admin-list-row">
                          <strong>{request.requestedAmount}</strong>
                          <span>{toTitleCase(request.requestKind)}</span>
                          <span>{formatDateTime(request.requestedAt)}</span>
                          <AdminStatusBadge
                            label={toTitleCase(request.status)}
                            tone={mapStatusToTone(request.status)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No release requests"
                      description="Unlock requests, cooldown transitions, and release execution will appear here."
                    />
                  )}
                </ListCard>

                <ListCard title="Rule governance">
                  {selectedVault.ruleChangeRequests.length > 0 ? (
                    <div className="admin-list">
                      {selectedVault.ruleChangeRequests.map((request) => (
                        <div key={request.id} className="admin-list-row">
                          <strong>
                            {formatDateTime(request.currentUnlockAt)} to{" "}
                            {formatDateTime(request.requestedUnlockAt)}
                          </strong>
                          <span>
                            {request.currentStrictMode ? "Strict" : "Standard"} to{" "}
                            {request.requestedStrictMode ? "Strict" : "Standard"}
                          </span>
                          <span>
                            {request.weakensProtection ? "Weakens protection" : "Strengthens protection"}
                          </span>
                          <AdminStatusBadge
                            label={toTitleCase(request.status)}
                            tone={mapStatusToTone(request.status)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No rule changes"
                      description="Governed lock-rule changes will appear here."
                    />
                  )}
                </ListCard>

                {workspaceQuery.isLoading ? (
                  <LoadingState
                    title="Loading vault workspace"
                    description="Vault events, audit trail, and customer account timeline are loading."
                  />
                ) : workspaceQuery.isError ? (
                  <ErrorState
                    title="Vault workspace unavailable"
                    description="The selected retirement vault workspace could not be loaded."
                  />
                ) : workspaceQuery.data ? (
                  <>
                    <TimelinePanel
                      title="Vault timeline"
                      description="Vault events directly attached to this protected-funds workflow."
                      events={mapVaultEventsToTimeline(workspaceQuery.data.vaultEvents)}
                      emptyState={{
                        title: "No vault events",
                        description:
                          "Funding, restriction, review, cooldown, and release events will appear here.",
                      }}
                    />
                    <TimelinePanel
                      title="Audit trail"
                      description="Audit events linked to the vault and its governed unlock workflow."
                      events={mapAuditEntriesToTimeline(
                        workspaceQuery.data.relatedAuditEvents,
                      )}
                      emptyState={{
                        title: "No audit trail",
                        description:
                          "Audit events will appear here as operators and workers act on this vault.",
                      }}
                    />
                    <TimelinePanel
                      title="Customer account timeline"
                      description="Unified account operations context, including vault activity, reviews, restrictions, and incidents."
                      events={mapCustomerAccountTimelineEntriesToTimeline(
                        workspaceQuery.data.customerAccountTimeline.timeline,
                      )}
                      emptyState={{
                        title: "No account timeline",
                        description:
                          "Customer-account operational activity will appear here when present.",
                      }}
                    />
                  </>
                ) : null}
              </>
            ) : (
              <EmptyState
                title="No vault selected"
                description="Choose a retirement vault to inspect its protection posture and governed release workflow."
              />
            )
          }
          rail={
            <ActionRail
              title="Vault controls"
              description="Use operator note and incident context before changing vault restriction posture or deciding an unlock or rule-change request."
            >
              {flash ? (
                <InlineNotice title="Action recorded" description={flash} tone="positive" />
              ) : null}
              {actionError ? (
                <InlineNotice title="Action failed" description={actionError} tone="critical" />
              ) : null}
              <div className="admin-field">
                <span>Restriction reason</span>
                <select
                  aria-label="Vault restriction reason"
                  value={restrictionReasonCode}
                  onChange={(event) => setRestrictionReasonCode(event.target.value)}
                >
                  {restrictionReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-field">
                <span>Oversight incident</span>
                <input
                  aria-label="Linked oversight incident"
                  type="text"
                  placeholder="Optional incident id"
                  value={oversightIncidentId}
                  onChange={(event) => setOversightIncidentId(event.target.value)}
                />
              </div>
              <textarea
                className="admin-textarea"
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                placeholder="Operator note or vault governance rationale"
              />
              <div className="admin-action-group">
                <button
                  type="button"
                  className="admin-button admin-button--critical"
                  disabled={!selectedVaultId || railPending || selectedVault?.status === "restricted"}
                  onClick={() => void restrictMutation.mutate()}
                >
                  Restrict vault
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--positive"
                  disabled={!selectedVaultId || railPending || selectedVault?.status !== "restricted"}
                  onClick={() => void releaseRestrictionMutation.mutate()}
                >
                  Release restriction
                </button>
              </div>
              <div className="admin-action-group">
                <button
                  type="button"
                  className="admin-button admin-button--positive"
                  disabled={
                    !selectedActionableReleaseRequest ||
                    railPending ||
                    selectedActionableReleaseRequest.status !== "review_required"
                  }
                  onClick={() => void approveReleaseMutation.mutate()}
                >
                  Approve unlock
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--critical"
                  disabled={
                    !selectedActionableReleaseRequest ||
                    railPending ||
                    selectedActionableReleaseRequest.status !== "review_required"
                  }
                  onClick={() => void rejectReleaseMutation.mutate()}
                >
                  Reject unlock
                </button>
              </div>
              <div className="admin-action-group">
                <button
                  type="button"
                  className="admin-button admin-button--positive"
                  disabled={
                    !selectedActionableRuleChangeRequest ||
                    railPending ||
                    selectedActionableRuleChangeRequest.status !== "review_required"
                  }
                  onClick={() => void approveRuleChangeMutation.mutate()}
                >
                  Approve rule change
                </button>
                <button
                  type="button"
                  className="admin-button admin-button--critical"
                  disabled={
                    !selectedActionableRuleChangeRequest ||
                    railPending ||
                    selectedActionableRuleChangeRequest.status !== "review_required"
                  }
                  onClick={() => void rejectRuleChangeMutation.mutate()}
                >
                  Reject rule change
                </button>
              </div>
              {selectedActionableReleaseRequest ? (
                <InlineNotice
                  title="Selected release posture"
                  description={`${selectedActionableReleaseRequest.requestedAmount} ${
                    selectedVault?.asset.symbol ?? ""
                  } · ${toTitleCase(selectedActionableReleaseRequest.status)}`}
                  tone={mapStatusToTone(selectedActionableReleaseRequest.status)}
                />
              ) : null}
              {selectedActionableRuleChangeRequest ? (
                <InlineNotice
                  title="Selected rule change posture"
                  description={`${formatDateTime(
                    selectedActionableRuleChangeRequest.currentUnlockAt,
                  )} to ${formatDateTime(
                    selectedActionableRuleChangeRequest.requestedUnlockAt,
                  )} · ${toTitleCase(selectedActionableRuleChangeRequest.status)}`}
                  tone={mapStatusToTone(selectedActionableRuleChangeRequest.status)}
                />
              ) : null}
            </ActionRail>
          }
        />
      </SectionPanel>
    </div>
  );
}
