import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  approveReleaseReadinessApproval,
  createReleaseReadinessEvidence,
  getReleaseReadinessSummary,
  listPendingReleases,
  listReleaseReadinessApprovals,
  listReleaseReadinessEvidence,
  listReleasedReleases,
  rejectReleaseReadinessApproval,
  requestReleaseReadinessApproval
} from "@/lib/api";
import {
  formatCount,
  formatDateTime,
  readApiErrorMessage,
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

const releaseReadinessEvidenceTypes = [
  "platform_alert_delivery_slo",
  "critical_alert_reescalation",
  "database_restore_drill",
  "api_rollback_drill",
  "worker_rollback_drill",
  "contract_invariant_suite",
  "backend_integration_suite",
  "end_to_end_finance_flows",
  "secret_handling_review",
  "role_review"
] as const;

const releaseReadinessEnvironments = [
  "development",
  "ci",
  "staging",
  "production_like",
  "production"
] as const;

const releaseReadinessEvidenceStatuses = [
  "pending",
  "passed",
  "failed"
] as const;

const approvalChecklistFields = [
  {
    key: "securityConfigurationComplete",
    label: "Security configuration complete"
  },
  {
    key: "accessAndGovernanceComplete",
    label: "Access and governance complete"
  },
  {
    key: "dataAndRecoveryComplete",
    label: "Data and recovery complete"
  },
  {
    key: "platformHealthComplete",
    label: "Platform health complete"
  },
  {
    key: "functionalProofComplete",
    label: "Functional proof complete"
  },
  {
    key: "contractAndChainProofComplete",
    label: "Contract and chain proof complete"
  },
  {
    key: "finalSignoffComplete",
    label: "Final signoff complete"
  },
  {
    key: "unresolvedRisksAccepted",
    label: "Residual risks explicitly accepted"
  }
] as const;

type EvidenceDraft = {
  evidenceType: (typeof releaseReadinessEvidenceTypes)[number];
  environment: (typeof releaseReadinessEnvironments)[number];
  status: (typeof releaseReadinessEvidenceStatuses)[number];
  releaseIdentifier: string;
  rollbackReleaseIdentifier: string;
  backupReference: string;
  runbookPath: string;
  summary: string;
  note: string;
  evidenceLinks: string;
};

type ApprovalDraft = {
  releaseIdentifier: string;
  environment: (typeof releaseReadinessEnvironments)[number];
  rollbackReleaseIdentifier: string;
  summary: string;
  requestNote: string;
  residualRiskNote: string;
  openBlockers: string;
} & Record<(typeof approvalChecklistFields)[number]["key"], boolean>;

function createEvidenceDraft(
  evidenceType: EvidenceDraft["evidenceType"] = releaseReadinessEvidenceTypes[0],
  environment: EvidenceDraft["environment"] = "production_like"
): EvidenceDraft {
  return {
    evidenceType,
    environment,
    status: "passed",
    releaseIdentifier: "",
    rollbackReleaseIdentifier: "",
    backupReference: "",
    runbookPath: "",
    summary: "",
    note: "",
    evidenceLinks: ""
  };
}

function createApprovalDraft(
  environment: ApprovalDraft["environment"] = "production_like"
): ApprovalDraft {
  return {
    releaseIdentifier: "",
    environment,
    rollbackReleaseIdentifier: "",
    summary: "",
    requestNote: "",
    residualRiskNote: "",
    openBlockers: "",
    securityConfigurationComplete: false,
    accessAndGovernanceComplete: false,
    dataAndRecoveryComplete: false,
    platformHealthComplete: false,
    functionalProofComplete: false,
    contractAndChainProofComplete: false,
    finalSignoffComplete: false,
    unresolvedRisksAccepted: false
  };
}

function parseListInput(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
}

export function LaunchReadinessPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEvidenceId = searchParams.get("evidence");
  const selectedApprovalId = searchParams.get("approval");
  const [evidenceDraft, setEvidenceDraft] = useState<EvidenceDraft>(
    createEvidenceDraft()
  );
  const [approvalDraft, setApprovalDraft] = useState<ApprovalDraft>(
    createApprovalDraft()
  );
  const [actionNote, setActionNote] = useState("");
  const [evidenceConfirm, setEvidenceConfirm] = useState(false);
  const [approvalRequestConfirm, setApprovalRequestConfirm] = useState(false);
  const [governedConfirm, setGovernedConfirm] = useState(false);
  const [evidenceFlash, setEvidenceFlash] = useState<string | null>(null);
  const [approvalRequestFlash, setApprovalRequestFlash] = useState<string | null>(
    null
  );
  const [decisionFlash, setDecisionFlash] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [approvalRequestError, setApprovalRequestError] = useState<string | null>(
    null
  );
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

  function updateSearchParam(
    key: "evidence" | "approval",
    value: string | null
  ) {
    const nextParams = new URLSearchParams(searchParams);

    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }

    setSearchParams(nextParams);
  }

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    let changed = false;
    const evidence = evidenceQuery.data?.evidence ?? [];
    const approvals = approvalsQuery.data?.approvals ?? [];

    if (evidence.length > 0) {
      const selectedEvidenceExists = evidence.some(
        (item) => item.id === selectedEvidenceId
      );

      if (!selectedEvidenceId || !selectedEvidenceExists) {
        nextParams.set("evidence", evidence[0].id);
        changed = true;
      }
    }

    if (approvals.length > 0) {
      const selectedApprovalExists = approvals.some(
        (approval) => approval.id === selectedApprovalId
      );

      if (!selectedApprovalId || !selectedApprovalExists) {
        nextParams.set("approval", approvals[0].id);
        changed = true;
      }
    }

    if (changed) {
      setSearchParams(nextParams);
    }
  }, [
    approvalsQuery.data,
    evidenceQuery.data,
    searchParams,
    selectedApprovalId,
    selectedEvidenceId,
    setSearchParams
  ]);

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["launch-release-summary", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["launch-evidence", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["launch-approvals", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["pending-releases", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["released-releases", session?.baseUrl]
      })
    ]);
  }

  const recordEvidenceMutation = useMutation({
    mutationFn: () =>
      createReleaseReadinessEvidence(session!, {
        evidenceType: evidenceDraft.evidenceType,
        environment: evidenceDraft.environment,
        status: evidenceDraft.status,
        releaseIdentifier: trimToUndefined(evidenceDraft.releaseIdentifier),
        rollbackReleaseIdentifier: trimToUndefined(
          evidenceDraft.rollbackReleaseIdentifier
        ),
        backupReference: trimToUndefined(evidenceDraft.backupReference),
        runbookPath: trimToUndefined(evidenceDraft.runbookPath),
        summary: evidenceDraft.summary.trim(),
        note: trimToUndefined(evidenceDraft.note),
        evidenceLinks: parseListInput(evidenceDraft.evidenceLinks)
      }),
    onSuccess: async (result) => {
      setEvidenceFlash("Evidence recorded.");
      setEvidenceError(null);
      setEvidenceConfirm(false);
      setEvidenceDraft(
        createEvidenceDraft(result.evidence.evidenceType, result.evidence.environment)
      );
      await refreshData();
      updateSearchParam("evidence", result.evidence.id);
    },
    onError: (error) => {
      setEvidenceError(
        readApiErrorMessage(error, "Failed to record release readiness evidence.")
      );
    }
  });

  const requestApprovalMutation = useMutation({
    mutationFn: () =>
      requestReleaseReadinessApproval(session!, {
        releaseIdentifier: approvalDraft.releaseIdentifier.trim(),
        environment: approvalDraft.environment,
        rollbackReleaseIdentifier: trimToUndefined(
          approvalDraft.rollbackReleaseIdentifier
        ),
        summary: approvalDraft.summary.trim(),
        requestNote: trimToUndefined(approvalDraft.requestNote),
        residualRiskNote: trimToUndefined(approvalDraft.residualRiskNote),
        openBlockers: parseListInput(approvalDraft.openBlockers),
        securityConfigurationComplete:
          approvalDraft.securityConfigurationComplete,
        accessAndGovernanceComplete:
          approvalDraft.accessAndGovernanceComplete,
        dataAndRecoveryComplete: approvalDraft.dataAndRecoveryComplete,
        platformHealthComplete: approvalDraft.platformHealthComplete,
        functionalProofComplete: approvalDraft.functionalProofComplete,
        contractAndChainProofComplete:
          approvalDraft.contractAndChainProofComplete,
        finalSignoffComplete: approvalDraft.finalSignoffComplete,
        unresolvedRisksAccepted: approvalDraft.unresolvedRisksAccepted
      }),
    onSuccess: async (result) => {
      setApprovalRequestFlash("Approval request created.");
      setApprovalRequestError(null);
      setApprovalRequestConfirm(false);
      setApprovalDraft(createApprovalDraft(result.approval.environment));
      await refreshData();
      updateSearchParam("approval", result.approval.id);
    },
    onError: (error) => {
      setApprovalRequestError(
        readApiErrorMessage(error, "Failed to request governed launch approval.")
      );
    }
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      approveReleaseReadinessApproval(session!, selectedApprovalId!, {
        approvalNote: trimToUndefined(actionNote)
      }),
    onSuccess: async () => {
      setDecisionFlash("Approval recorded.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshData();
    },
    onError: (error) => {
      setActionError(
        readApiErrorMessage(error, "Failed to approve release readiness item.")
      );
    }
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      rejectReleaseReadinessApproval(session!, selectedApprovalId!, {
        rejectionNote: actionNote.trim() || "Rejected from operator console."
      }),
    onSuccess: async () => {
      setDecisionFlash("Rejection recorded.");
      setActionError(null);
      setGovernedConfirm(false);
      await refreshData();
    },
    onError: (error) => {
      setActionError(
        readApiErrorMessage(error, "Failed to reject release readiness item.")
      );
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
  const selectedEvidence =
    evidenceQuery.data!.evidence.find((item) => item.id === selectedEvidenceId) ??
    null;
  const selectedEvidenceCheck =
    summary.requiredChecks.find(
      (check) => check.evidenceType === selectedEvidence?.evidenceType
    ) ?? null;
  const selectedApproval =
    approvalsQuery.data!.approvals.find((approval) => approval.id === selectedApprovalId) ??
    null;
  const gateNotice = buildApprovalGateNotice(selectedApproval);
  const decisionPending = approveMutation.isPending || rejectMutation.isPending;
  const recordEvidenceDisabled =
    !evidenceConfirm ||
    recordEvidenceMutation.isPending ||
    evidenceDraft.summary.trim().length === 0;
  const requestApprovalDisabled =
    !approvalRequestConfirm ||
    requestApprovalMutation.isPending ||
    approvalDraft.releaseIdentifier.trim().length === 0 ||
    approvalDraft.summary.trim().length === 0;

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
        title="Evidence workspace"
        description="Capture proof, inspect the latest evidence, and keep the release gate current."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Required checks">
                <div className="admin-list">
                  {summary.requiredChecks.map((check) => (
                    <div key={check.evidenceType} className="admin-list-row">
                      <strong>{check.label}</strong>
                      <span>{toTitleCase(check.status)}</span>
                      <span>{check.acceptedEnvironments.join(", ")}</span>
                      <AdminStatusBadge
                        label={toTitleCase(check.status)}
                        tone={mapStatusToTone(check.status)}
                      />
                    </div>
                  ))}
                </div>
              </ListCard>

              <ListCard title="Evidence ledger">
                <div className="admin-list">
                  {evidenceQuery.data!.evidence.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedEvidenceId === item.id ? "selected" : ""
                      }`}
                      onClick={() => updateSearchParam("evidence", item.id)}
                    >
                      <strong>{toTitleCase(item.evidenceType)}</strong>
                      <span>{item.environment}</span>
                      <span>{item.releaseIdentifier ?? "No release"}</span>
                      <AdminStatusBadge
                        label={toTitleCase(item.status)}
                        tone={mapStatusToTone(item.status)}
                      />
                    </button>
                  ))}
                </div>
              </ListCard>
            </>
          }
          main={
            selectedEvidence ? (
              <>
                <ListCard title="Selected evidence">
                  <DetailList
                    items={[
                      { label: "Evidence reference", value: selectedEvidence.id, mono: true },
                      {
                        label: "Evidence type",
                        value: toTitleCase(selectedEvidence.evidenceType)
                      },
                      { label: "Environment", value: selectedEvidence.environment },
                      {
                        label: "Status",
                        value: (
                          <AdminStatusBadge
                            label={toTitleCase(selectedEvidence.status)}
                            tone={mapStatusToTone(selectedEvidence.status)}
                          />
                        )
                      },
                      {
                        label: "Release identifier",
                        value: selectedEvidence.releaseIdentifier ?? "None",
                        mono: Boolean(selectedEvidence.releaseIdentifier)
                      },
                      {
                        label: "Rollback release",
                        value: selectedEvidence.rollbackReleaseIdentifier ?? "None",
                        mono: Boolean(selectedEvidence.rollbackReleaseIdentifier)
                      },
                      {
                        label: "Backup reference",
                        value: selectedEvidence.backupReference ?? "None",
                        mono: Boolean(selectedEvidence.backupReference)
                      },
                      {
                        label: "Observed",
                        value: formatDateTime(selectedEvidence.observedAt)
                      },
                      { label: "Recorded by", value: selectedEvidence.operatorId, mono: true }
                    ]}
                  />
                  {selectedEvidenceCheck ? (
                    <InlineNotice
                      title={selectedEvidenceCheck.label}
                      description={`Accepted environments: ${selectedEvidenceCheck.acceptedEnvironments.join(
                        ", "
                      )}. Runbook: ${selectedEvidenceCheck.runbookPath}.`}
                      tone={mapStatusToTone(selectedEvidenceCheck.status)}
                    />
                  ) : null}
                  {selectedEvidence.note ? (
                    <InlineNotice
                      title="Operator note"
                      description={selectedEvidence.note}
                    />
                  ) : null}
                </ListCard>

                {selectedEvidence.evidenceLinks.length > 0 ? (
                  <ListCard title="Evidence links">
                    <div className="admin-list">
                      {selectedEvidence.evidenceLinks.map((link) => (
                        <div key={link} className="admin-list-row">
                          <strong>{link}</strong>
                        </div>
                      ))}
                    </div>
                  </ListCard>
                ) : null}

                <TimelinePanel
                  title="Recent evidence timeline"
                  description="Latest proof artifacts used by the current release workflow."
                  events={mapReleaseEvidenceToTimeline(summary.recentEvidence)}
                  emptyState={{
                    title: "No recent evidence",
                    description:
                      "Evidence artifacts will appear here when proof runners and operators submit them."
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="Select evidence"
                description="Choose an evidence record to inspect the stored proof context."
              />
            )
          }
          rail={
            <ActionRail
              title="Record evidence"
              description="Manual evidence intake should match the accepted environment, runbook, and release scope."
            >
              <div className="admin-field">
                <span>Evidence type</span>
                <select
                  aria-label="Evidence type"
                  value={evidenceDraft.evidenceType}
                  onChange={(event) =>
                    setEvidenceDraft((current) => ({
                      ...current,
                      evidenceType: event.target.value as EvidenceDraft["evidenceType"]
                    }))
                  }
                >
                  {releaseReadinessEvidenceTypes.map((option) => (
                    <option key={option} value={option}>
                      {toTitleCase(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <span>Environment</span>
                <select
                  aria-label="Evidence environment"
                  value={evidenceDraft.environment}
                  onChange={(event) =>
                    setEvidenceDraft((current) => ({
                      ...current,
                      environment: event.target.value as EvidenceDraft["environment"]
                    }))
                  }
                >
                  {releaseReadinessEnvironments.map((option) => (
                    <option key={option} value={option}>
                      {toTitleCase(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <span>Status</span>
                <select
                  aria-label="Evidence status"
                  value={evidenceDraft.status}
                  onChange={(event) =>
                    setEvidenceDraft((current) => ({
                      ...current,
                      status: event.target.value as EvidenceDraft["status"]
                    }))
                  }
                >
                  {releaseReadinessEvidenceStatuses.map((option) => (
                    <option key={option} value={option}>
                      {toTitleCase(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-field">
                <span>Release identifier</span>
                <input
                  aria-label="Evidence release identifier"
                  placeholder="launch-2026.04.13.1"
                  value={evidenceDraft.releaseIdentifier}
                  onChange={(event) =>
                    setEvidenceDraft((current) => ({
                      ...current,
                      releaseIdentifier: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Rollback release identifier</span>
                <input
                  aria-label="Evidence rollback release identifier"
                  placeholder="launch-rollback-2026.04.12.4"
                  value={evidenceDraft.rollbackReleaseIdentifier}
                  onChange={(event) =>
                    setEvidenceDraft((current) => ({
                      ...current,
                      rollbackReleaseIdentifier: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Backup reference</span>
                <input
                  aria-label="Evidence backup reference"
                  placeholder="snapshot-2026-04-13T09:00Z"
                  value={evidenceDraft.backupReference}
                  onChange={(event) =>
                    setEvidenceDraft((current) => ({
                      ...current,
                      backupReference: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Runbook path</span>
                <input
                  aria-label="Evidence runbook path"
                  placeholder="docs/runbooks/phase-12-launch-closure.md"
                  value={evidenceDraft.runbookPath}
                  onChange={(event) =>
                    setEvidenceDraft((current) => ({
                      ...current,
                      runbookPath: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Summary</span>
                <textarea
                  aria-label="Evidence summary"
                  placeholder="Summarize the proof that was collected and what it verified."
                  value={evidenceDraft.summary}
                  onChange={(event) =>
                    setEvidenceDraft((current) => ({
                      ...current,
                      summary: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Operator note</span>
                <textarea
                  aria-label="Evidence note"
                  placeholder="Add drill details, follow-up context, or residual concerns."
                  value={evidenceDraft.note}
                  onChange={(event) =>
                    setEvidenceDraft((current) => ({
                      ...current,
                      note: event.target.value
                    }))
                  }
                />
              </div>

              <div className="admin-field">
                <span>Evidence links</span>
                <textarea
                  aria-label="Evidence links"
                  placeholder="One link per line or comma-separated."
                  value={evidenceDraft.evidenceLinks}
                  onChange={(event) =>
                    setEvidenceDraft((current) => ({
                      ...current,
                      evidenceLinks: event.target.value
                    }))
                  }
                />
              </div>

              <label className="admin-checkbox">
                <input
                  type="checkbox"
                  checked={evidenceConfirm}
                  onChange={(event) => setEvidenceConfirm(event.target.checked)}
                />
                <span>
                  I verified the environment label, summary, and linked evidence before recording this proof.
                </span>
              </label>

              {evidenceFlash ? (
                <InlineNotice
                  title="Latest evidence action"
                  description={evidenceFlash}
                  tone="positive"
                />
              ) : null}
              {evidenceError ? (
                <InlineNotice
                  title="Evidence action failed"
                  description={evidenceError}
                  tone="critical"
                />
              ) : null}

              <div className="admin-action-buttons">
                <button
                  type="button"
                  className="admin-primary-button"
                  disabled={recordEvidenceDisabled}
                  onClick={() => recordEvidenceMutation.mutate()}
                >
                  {recordEvidenceMutation.isPending
                    ? "Recording..."
                    : "Record evidence"}
                </button>
              </div>
            </ActionRail>
          }
        />
      </SectionPanel>

      <SectionPanel
        title="Approval workspace"
        description="Approval-chain detail, checklist attestations, and governed launch decisions."
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
                      onClick={() => updateSearchParam("approval", approval.id)}
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
                      {
                        label: "Release identifier",
                        value: selectedApproval.releaseIdentifier,
                        mono: true
                      },
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
                      { label: "Requested", value: formatDateTime(selectedApproval.requestedAt) },
                      {
                        label: "Requested by",
                        value: selectedApproval.requestedByOperatorId,
                        mono: true
                      }
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

                <ListCard title="Checklist snapshot">
                  <div className="admin-list">
                    {approvalChecklistFields.map((field) => (
                      <div key={field.key} className="admin-list-row">
                        <strong>{field.label}</strong>
                        <AdminStatusBadge
                          label={
                            selectedApproval.checklist[field.key]
                              ? "Complete"
                              : "Incomplete"
                          }
                          tone={
                            selectedApproval.checklist[field.key]
                              ? "positive"
                              : "warning"
                          }
                        />
                      </div>
                    ))}
                    <div className="admin-list-row">
                      <strong>Open blockers</strong>
                      <span>
                        {selectedApproval.checklist.openBlockers.length > 0
                          ? selectedApproval.checklist.openBlockers.join(", ")
                          : "None"}
                      </span>
                    </div>
                    <div className="admin-list-row">
                      <strong>Residual risk note</strong>
                      <span>{selectedApproval.checklist.residualRiskNote ?? "None"}</span>
                    </div>
                  </div>
                </ListCard>

                <ListCard title="Evidence snapshot">
                  <div className="admin-list">
                    {selectedApproval.evidenceSnapshot.requiredChecks.map((check) => {
                      const stale =
                        check.latestEvidenceStatus === "passed" &&
                        isEvidenceStale(
                          check.latestEvidenceObservedAt,
                          selectedApproval.gate.maximumEvidenceAgeHours
                        );

                      return (
                        <div key={check.evidenceType} className="admin-list-row">
                          <strong>{toTitleCase(check.evidenceType)}</strong>
                          <span>{toTitleCase(check.status)}</span>
                          <span>{check.latestEvidenceEnvironment ?? "No environment"}</span>
                          <span>
                            {stale
                              ? "Stale evidence"
                              : formatDateTime(check.latestEvidenceObservedAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ListCard>
              </>
            ) : (
              <EmptyState
                title="Select an approval"
                description="Choose an approval request to inspect gate posture and evidence freshness."
              />
            )
          }
          rail={
            <>
              <ActionRail
                title="Request governed approval"
                description="Submit a launch request only after evidence and checklist attestations reflect the current release candidate."
              >
                <div className="admin-field">
                  <span>Release identifier</span>
                  <input
                    aria-label="Approval release identifier"
                    placeholder="launch-2026.04.13.1"
                    value={approvalDraft.releaseIdentifier}
                    onChange={(event) =>
                      setApprovalDraft((current) => ({
                        ...current,
                        releaseIdentifier: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Environment</span>
                  <select
                    aria-label="Approval environment"
                    value={approvalDraft.environment}
                    onChange={(event) =>
                      setApprovalDraft((current) => ({
                        ...current,
                        environment: event.target.value as ApprovalDraft["environment"]
                      }))
                    }
                  >
                    {releaseReadinessEnvironments.map((option) => (
                      <option key={option} value={option}>
                        {toTitleCase(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="admin-field">
                  <span>Rollback release identifier</span>
                  <input
                    aria-label="Approval rollback release identifier"
                    placeholder="launch-rollback-2026.04.12.4"
                    value={approvalDraft.rollbackReleaseIdentifier}
                    onChange={(event) =>
                      setApprovalDraft((current) => ({
                        ...current,
                        rollbackReleaseIdentifier: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Summary</span>
                  <textarea
                    aria-label="Approval summary"
                    placeholder="Summarize why this release candidate is ready for governed approval."
                    value={approvalDraft.summary}
                    onChange={(event) =>
                      setApprovalDraft((current) => ({
                        ...current,
                        summary: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Request note</span>
                  <textarea
                    aria-label="Approval request note"
                    placeholder="Capture handoff notes for the approver."
                    value={approvalDraft.requestNote}
                    onChange={(event) =>
                      setApprovalDraft((current) => ({
                        ...current,
                        requestNote: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Open blockers</span>
                  <textarea
                    aria-label="Approval open blockers"
                    placeholder="List blockers one per line or leave empty."
                    value={approvalDraft.openBlockers}
                    onChange={(event) =>
                      setApprovalDraft((current) => ({
                        ...current,
                        openBlockers: event.target.value
                      }))
                    }
                  />
                </div>

                <div className="admin-field">
                  <span>Residual risk note</span>
                  <textarea
                    aria-label="Approval residual risk note"
                    placeholder="Describe any accepted risk or leave empty."
                    value={approvalDraft.residualRiskNote}
                    onChange={(event) =>
                      setApprovalDraft((current) => ({
                        ...current,
                        residualRiskNote: event.target.value
                      }))
                    }
                  />
                </div>

                {approvalChecklistFields.map((field) => (
                  <label key={field.key} className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={approvalDraft[field.key]}
                      onChange={(event) =>
                        setApprovalDraft((current) => ({
                          ...current,
                          [field.key]: event.target.checked
                        }))
                      }
                    />
                    <span>{field.label}</span>
                  </label>
                ))}

                <label className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={approvalRequestConfirm}
                    onChange={(event) =>
                      setApprovalRequestConfirm(event.target.checked)
                    }
                  />
                  <span>
                    I verified the checklist attestations and current evidence before requesting approval.
                  </span>
                </label>

                {approvalRequestFlash ? (
                  <InlineNotice
                    title="Latest approval request action"
                    description={approvalRequestFlash}
                    tone="positive"
                  />
                ) : null}
                {approvalRequestError ? (
                  <InlineNotice
                    title="Approval request failed"
                    description={approvalRequestError}
                    tone="critical"
                  />
                ) : null}

                <div className="admin-action-buttons">
                  <button
                    type="button"
                    className="admin-primary-button"
                    disabled={requestApprovalDisabled}
                    onClick={() => requestApprovalMutation.mutate()}
                  >
                    {requestApprovalMutation.isPending
                      ? "Requesting..."
                      : "Request approval"}
                  </button>
                </div>
              </ActionRail>

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

                    {decisionFlash ? (
                      <InlineNotice
                        title="Last decision"
                        description={decisionFlash}
                        tone="positive"
                      />
                    ) : null}
                    {actionError ? (
                      <InlineNotice
                        title="Action failed"
                        description={actionError}
                        tone="critical"
                      />
                    ) : null}

                    <div className="admin-action-buttons">
                      <button
                        type="button"
                        className="admin-primary-button"
                        disabled={!governedConfirm || decisionPending}
                        onClick={() => approveMutation.mutate()}
                      >
                        {approveMutation.isPending ? "Approving..." : "Approve release"}
                      </button>
                      <button
                        type="button"
                        className="admin-danger-button"
                        disabled={!governedConfirm || decisionPending}
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
            </>
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
