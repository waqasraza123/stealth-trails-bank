import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  approveReleaseReadinessApproval,
  createReleaseReadinessEvidence,
  getLaunchClosureStatus,
  getReleaseReadinessSummary,
  listPendingReleases,
  listReleaseReadinessApprovals,
  listReleaseReadinessEvidence,
  listReleasedReleases,
  rejectReleaseReadinessApproval,
  scaffoldLaunchClosurePack,
  validateLaunchClosureManifest,
  requestReleaseReadinessApproval
} from "@/lib/api";
import type {
  LaunchClosureManifest,
  LaunchClosurePackFile
} from "@/lib/types";
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

function formatLaunchClosureStatusLabel(
  status: "ready" | "blocked" | "approved" | "rejected" | "in_progress"
) {
  return status === "in_progress" ? "In progress" : toTitleCase(status);
}

function formatLaunchClosureCheckStatusLabel(
  status: "passed" | "failed" | "pending" | "stale"
) {
  return status === "passed" ? "Passed" : toTitleCase(status);
}

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

function listRequiredEvidenceMetadataFields(
  evidenceType: EvidenceDraft["evidenceType"]
): string[] {
  switch (evidenceType) {
    case "platform_alert_delivery_slo":
    case "critical_alert_reescalation":
    case "secret_handling_review":
    case "role_review":
      return ["release identifier"];
    case "database_restore_drill":
      return ["release identifier", "backup reference"];
    case "api_rollback_drill":
    case "worker_rollback_drill":
      return ["release identifier", "rollback release identifier"];
    default:
      return [];
  }
}

function listMissingEvidenceMetadataFields(draft: EvidenceDraft): string[] {
  const requiredFields = listRequiredEvidenceMetadataFields(draft.evidenceType);

  return requiredFields.filter((field) => {
    switch (field) {
      case "release identifier":
        return draft.releaseIdentifier.trim().length === 0;
      case "rollback release identifier":
        return draft.rollbackReleaseIdentifier.trim().length === 0;
      case "backup reference":
        return draft.backupReference.trim().length === 0;
      default:
        return false;
    }
  });
}

function listMissingApprovalMetadataFields(draft: ApprovalDraft): string[] {
  return draft.rollbackReleaseIdentifier.trim().length === 0
    ? ["rollback release identifier"]
    : [];
}

function stringifyLaunchClosureManifest(manifest: LaunchClosureManifest): string {
  return JSON.stringify(manifest, null, 2);
}

function buildLaunchClosureManifestTemplate(args: {
  apiBaseUrl?: string;
  releaseIdentifier?: string | null;
  rollbackReleaseIdentifier?: string | null;
  summary?: string | null;
  requesterId?: string;
  requesterRole?: string;
} = {}): LaunchClosureManifest {
  const releaseIdentifier = args.releaseIdentifier?.trim() || "launch-2026.04.13.1";
  const rollbackReleaseIdentifier =
    args.rollbackReleaseIdentifier?.trim() || "launch-rollback-2026.04.12.4";
  const apiBaseUrl = args.apiBaseUrl?.trim() || "https://prodlike-api.example.com";

  return {
    releaseIdentifier,
    environment: "production_like",
    baseUrls: {
      web: "https://prodlike-web.example.com",
      admin: "https://prodlike-admin.example.com",
      api: apiBaseUrl,
      restoreApi: "https://prodlike-restore.example.com"
    },
    worker: {
      identifier: "worker-prodlike-1"
    },
    operator: {
      requesterId: args.requesterId?.trim() || "ops_requester_1",
      requesterRole: args.requesterRole?.trim() || "operations_admin",
      approverId: "ops_approver_1",
      approverRole: "compliance_lead",
      apiKeyEnvironmentVariable: "INTERNAL_OPERATOR_API_KEY"
    },
    artifacts: {
      apiReleaseId: `api-${releaseIdentifier}`,
      workerReleaseId: `worker-${releaseIdentifier}`,
      approvalRollbackReleaseId: rollbackReleaseIdentifier,
      apiRollbackReleaseId: `api-${rollbackReleaseIdentifier}`,
      workerRollbackReleaseId: `worker-${rollbackReleaseIdentifier}`,
      backupReference: "snapshot-2026-04-13T09:00Z"
    },
    alerting: {
      expectedTargetName: "ops-critical",
      expectedTargetHealthStatus: "critical",
      expectedMinReEscalations: 1,
      expectedAlertDedupeKey: "worker:degraded:worker-prodlike-1"
    },
    governance: {
      secretReviewReference: "ticket/SEC-42",
      roleReviewReference: "ticket/GOV-12",
      roleReviewRosterReference: "ticket/GOV-12#launch-roster"
    },
    notes: {
      launchSummary:
        args.summary?.trim() ||
        "Production-like launch candidate ready for final governed review.",
      requestNote: "All accepted evidence is current and checklist attestations are complete.",
      residualRiskNote: "No accepted residual risks remain open at request time."
    }
  };
}

function parseLaunchClosureManifestDraft(
  draft: string
): LaunchClosureManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(draft) as unknown;
  } catch {
    throw new Error("Manifest draft is not valid JSON.");
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Manifest draft must be a JSON object.");
  }

  return parsed as LaunchClosureManifest;
}

function downloadLaunchClosureFile(file: LaunchClosurePackFile) {
  const blob = new Blob([file.content], {
    type: "text/plain;charset=utf-8"
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.relativePath.replace(/[\\/]/g, "__");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export function LaunchReadinessPage() {
  const { session, fallback } = useConfiguredSessionGuard();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEvidenceId = searchParams.get("evidence");
  const selectedApprovalId = searchParams.get("approval");
  const selectedReleaseIdentifier = searchParams.get("release");
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
  const [launchClosureManifestDraft, setLaunchClosureManifestDraft] = useState(
    stringifyLaunchClosureManifest(buildLaunchClosureManifestTemplate())
  );
  const [launchClosureSummary, setLaunchClosureSummary] = useState<string | null>(null);
  const [launchClosureFlash, setLaunchClosureFlash] = useState<string | null>(null);
  const [launchClosureError, setLaunchClosureError] = useState<string | null>(null);
  const [launchClosureOutputSubpath, setLaunchClosureOutputSubpath] = useState<
    string | null
  >(null);
  const [launchClosureFiles, setLaunchClosureFiles] = useState<LaunchClosurePackFile[]>(
    []
  );
  const [selectedLaunchClosureFilePath, setSelectedLaunchClosureFilePath] =
    useState<string | null>(null);

  const releaseSummaryQuery = useQuery({
    queryKey: [
      "launch-release-summary",
      session?.baseUrl,
      selectedReleaseIdentifier ?? "all"
    ],
    queryFn: () =>
      getReleaseReadinessSummary(session!, {
        releaseIdentifier: selectedReleaseIdentifier ?? undefined
      }),
    enabled: Boolean(session)
  });

  const evidenceQuery = useQuery({
    queryKey: [
      "launch-evidence",
      session?.baseUrl,
      selectedReleaseIdentifier ?? "all"
    ],
    queryFn: () =>
      listReleaseReadinessEvidence(session!, {
        limit: 20,
        releaseIdentifier: selectedReleaseIdentifier ?? undefined
      }),
    enabled: Boolean(session)
  });

  const evidenceCatalogQuery = useQuery({
    queryKey: ["launch-evidence-catalog", session?.baseUrl],
    queryFn: () =>
      listReleaseReadinessEvidence(session!, {
        limit: 100
      }),
    enabled: Boolean(session)
  });

  const approvalsQuery = useQuery({
    queryKey: [
      "launch-approvals",
      session?.baseUrl,
      selectedReleaseIdentifier ?? "all"
    ],
    queryFn: () =>
      listReleaseReadinessApprovals(session!, {
        limit: 20,
        releaseIdentifier: selectedReleaseIdentifier ?? undefined
      }),
    enabled: Boolean(session)
  });

  const approvalsCatalogQuery = useQuery({
    queryKey: ["launch-approvals-catalog", session?.baseUrl],
    queryFn: () =>
      listReleaseReadinessApprovals(session!, {
        limit: 100
      }),
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

  const launchClosureStatusQuery = useQuery({
    queryKey: [
      "launch-closure-status",
      session?.baseUrl,
      selectedReleaseIdentifier ?? "all"
    ],
    queryFn: () =>
      getLaunchClosureStatus(session!, {
        releaseIdentifier: selectedReleaseIdentifier ?? undefined
      }),
    enabled: Boolean(session)
  });

  function updateSearchParams(
    updates: Partial<Record<"evidence" | "approval" | "release", string | null>>
  ) {
    const nextParams = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
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
    } else if (selectedEvidenceId) {
      nextParams.delete("evidence");
      changed = true;
    }

    if (approvals.length > 0) {
      const selectedApprovalExists = approvals.some(
        (approval) => approval.id === selectedApprovalId
      );

      if (!selectedApprovalId || !selectedApprovalExists) {
        nextParams.set("approval", approvals[0].id);
        if (!selectedReleaseIdentifier) {
          nextParams.set("release", approvals[0].releaseIdentifier);
        }
        changed = true;
      }
    } else if (selectedApprovalId) {
      nextParams.delete("approval");
      changed = true;
    }

    if (changed) {
      setSearchParams(nextParams);
    }
  }, [
    approvalsQuery.data,
    evidenceQuery.data,
    searchParams,
    selectedReleaseIdentifier,
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
        queryKey: ["launch-evidence-catalog", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["launch-approvals", session?.baseUrl]
      }),
      queryClient.invalidateQueries({
        queryKey: ["launch-approvals-catalog", session?.baseUrl]
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
      updateSearchParams({
        evidence: result.evidence.id,
        release: result.evidence.releaseIdentifier
      });
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
      updateSearchParams({
        approval: result.approval.id,
        release: result.approval.releaseIdentifier
      });
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

  const validateLaunchClosureMutation = useMutation({
    mutationFn: (manifest: LaunchClosureManifest) =>
      validateLaunchClosureManifest(session!, manifest),
    onSuccess: (result) => {
      setLaunchClosureSummary(result.summaryMarkdown);
      setLaunchClosureFlash("Manifest validated.");
      setLaunchClosureError(null);
      setLaunchClosureOutputSubpath(null);
      setLaunchClosureFiles([]);
      setSelectedLaunchClosureFilePath(null);
    },
    onError: (error) => {
      setLaunchClosureError(
        readApiErrorMessage(error, "Failed to validate launch-closure manifest.")
      );
    }
  });

  const scaffoldLaunchClosureMutation = useMutation({
    mutationFn: (manifest: LaunchClosureManifest) =>
      scaffoldLaunchClosurePack(session!, manifest),
    onSuccess: (result) => {
      setLaunchClosureSummary(result.summaryMarkdown);
      setLaunchClosureFlash("Launch-closure pack generated.");
      setLaunchClosureError(null);
      setLaunchClosureOutputSubpath(result.outputSubpath);
      setLaunchClosureFiles(result.files);
      setSelectedLaunchClosureFilePath(result.files[0]?.relativePath ?? null);
    },
    onError: (error) => {
      setLaunchClosureError(
        readApiErrorMessage(error, "Failed to generate launch-closure pack.")
      );
    }
  });

  function runLaunchClosureAction(action: "validate" | "scaffold") {
    try {
      const manifest = parseLaunchClosureManifestDraft(launchClosureManifestDraft);

      setLaunchClosureError(null);
      setLaunchClosureFlash(null);

      if (action === "validate") {
        validateLaunchClosureMutation.mutate(manifest);
        return;
      }

      scaffoldLaunchClosureMutation.mutate(manifest);
    } catch (error) {
      setLaunchClosureError(
        error instanceof Error ? error.message : "Manifest draft must be valid JSON."
      );
    }
  }

  function seedLaunchClosureTemplate() {
    setLaunchClosureManifestDraft(
      stringifyLaunchClosureManifest(
        buildLaunchClosureManifestTemplate({
          apiBaseUrl: session?.baseUrl,
          releaseIdentifier:
            selectedApproval?.releaseIdentifier ?? selectedEvidence?.releaseIdentifier,
          rollbackReleaseIdentifier:
            selectedApproval?.rollbackReleaseIdentifier ??
            selectedEvidence?.rollbackReleaseIdentifier,
          summary: selectedApproval?.summary,
          requesterId: session?.operatorId,
          requesterRole: session?.operatorRole
        })
      )
    );
    setLaunchClosureFlash("Manifest template refreshed from the current release context.");
    setLaunchClosureError(null);
  }

  if (fallback) {
    return fallback;
  }

  if (
    releaseSummaryQuery.isLoading ||
    evidenceQuery.isLoading ||
    evidenceCatalogQuery.isLoading ||
    approvalsQuery.isLoading ||
    approvalsCatalogQuery.isLoading ||
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
    evidenceCatalogQuery.isError ||
    approvalsQuery.isError ||
    approvalsCatalogQuery.isError ||
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
  const scopedApprovals = approvalsQuery.data!.approvals;
  const releaseScopeOptions = [
    ...new Set(
      [
        ...approvalsCatalogQuery.data!.approvals.map(
          (approval) => approval.releaseIdentifier
        ),
        ...evidenceCatalogQuery.data!.evidence
          .map((item) => item.releaseIdentifier)
          .filter((value): value is string => Boolean(value))
      ].filter((value): value is string => Boolean(value))
    )
  ].sort((left, right) => right.localeCompare(left));
  const selectedEvidence =
    evidenceQuery.data!.evidence.find((item) => item.id === selectedEvidenceId) ??
    null;
  const selectedEvidenceCheck =
    summary.requiredChecks.find(
      (check) => check.evidenceType === selectedEvidence?.evidenceType
    ) ?? null;
  const selectedApproval =
    scopedApprovals.find((approval) => approval.id === selectedApprovalId) ?? null;
  const selectedLaunchClosureFile =
    launchClosureFiles.find(
      (file) => file.relativePath === selectedLaunchClosureFilePath
    ) ?? null;
  const gateNotice = buildApprovalGateNotice(selectedApproval);
  const decisionPending = approveMutation.isPending || rejectMutation.isPending;
  const launchClosurePending =
    validateLaunchClosureMutation.isPending ||
    scaffoldLaunchClosureMutation.isPending;
  const requiredEvidenceMetadataFields = listRequiredEvidenceMetadataFields(
    evidenceDraft.evidenceType
  );
  const missingEvidenceMetadataFields = listMissingEvidenceMetadataFields(
    evidenceDraft
  );
  const missingApprovalMetadataFields = listMissingApprovalMetadataFields(
    approvalDraft
  );
  const recordEvidenceDisabled =
    !evidenceConfirm ||
    recordEvidenceMutation.isPending ||
    evidenceDraft.summary.trim().length === 0 ||
    missingEvidenceMetadataFields.length > 0;
  const requestApprovalDisabled =
    !approvalRequestConfirm ||
    requestApprovalMutation.isPending ||
    approvalDraft.releaseIdentifier.trim().length === 0 ||
    approvalDraft.summary.trim().length === 0 ||
    missingApprovalMetadataFields.length > 0;

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
            value={formatCount(scopedApprovals.length)}
            detail={`${formatCount(pendingReleasesQuery.data!.releases.length)} pending releases`}
          />
          <MetricCard
            label="Recorded evidence"
            value={formatCount(evidenceQuery.data!.evidence.length)}
            detail={`${formatCount(releasedReleasesQuery.data!.releases.length)} released artifacts`}
          />
          <MetricCard
            label="Release scope"
            value={selectedReleaseIdentifier ?? "All releases"}
            detail={
              selectedReleaseIdentifier
                ? "Scoped evidence and gate posture"
                : "Global readiness view"
            }
          />
        </div>
        <div className="admin-field">
          <span>Focused release</span>
          <select
            aria-label="Release scope"
            value={selectedReleaseIdentifier ?? ""}
            onChange={(event) =>
              updateSearchParams({
                release: event.target.value || null,
                evidence: null
              })
            }
          >
            <option value="">All releases</option>
            {releaseScopeOptions.map((releaseIdentifier) => (
              <option key={releaseIdentifier} value={releaseIdentifier}>
                {releaseIdentifier}
              </option>
            ))}
          </select>
          <p className="admin-field-help">
            Scope required checks and evidence to one launch candidate before requesting governed approval.
          </p>
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
                      onClick={() =>
                        updateSearchParams({
                          evidence: item.id,
                          release: item.releaseIdentifier
                        })
                      }
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

              {requiredEvidenceMetadataFields.length > 0 ? (
                <InlineNotice
                  title="Evidence metadata required"
                  description={`This evidence type requires ${requiredEvidenceMetadataFields.join(
                    ", "
                  )} before it can be recorded.`}
                  tone={
                    missingEvidenceMetadataFields.length > 0
                      ? "warning"
                      : "positive"
                  }
                />
              ) : null}

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
                  {scopedApprovals.map((approval) => (
                    <button
                      key={approval.id}
                      type="button"
                      className={`admin-list-row selectable ${
                        selectedApprovalId === approval.id ? "selected" : ""
                      }`}
                      onClick={() =>
                        updateSearchParams({
                          approval: approval.id,
                          release: approval.releaseIdentifier
                        })
                      }
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
                      {
                        label: "Rollback release",
                        value: selectedApproval.rollbackReleaseIdentifier ?? "None",
                        mono: Boolean(selectedApproval.rollbackReleaseIdentifier)
                      },
                      { label: "Gate state", value: toTitleCase(selectedApproval.gate.overallStatus) },
                      {
                        label: "Stale evidence",
                        value:
                          selectedApproval.gate.staleEvidenceTypes.length > 0
                            ? selectedApproval.gate.staleEvidenceTypes.join(", ")
                            : "None"
                      },
                      {
                        label: "Metadata mismatches",
                        value:
                          selectedApproval.gate.metadataMismatches.length > 0
                            ? selectedApproval.gate.metadataMismatches
                                .map((item) => toTitleCase(item.evidenceType))
                                .join(", ")
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
                  {selectedApproval.gate.metadataMismatches.length > 0 ? (
                    <InlineNotice
                      title="Evidence metadata mismatches"
                      description={selectedApproval.gate.metadataMismatches
                        .map((item) => item.reason)
                        .join(" ")}
                      tone="critical"
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
                            {check.latestEvidenceRollbackReleaseIdentifier ??
                              check.latestEvidenceBackupReference ??
                              check.latestEvidenceReleaseIdentifier ??
                              "No scoped metadata"}
                          </span>
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

                <InlineNotice
                  title="Rollback target required"
                  description={`Governed launch approval is bound to one rollback release identifier, and the latest rollback drill evidence must match it. Missing fields: ${
                    missingApprovalMetadataFields.join(", ") || "none"
                  }.`}
                  tone={
                    missingApprovalMetadataFields.length > 0 ? "warning" : "positive"
                  }
                />

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
        title="Launch-closure pack"
        description="Validate the Phase 12 manifest and generate the governed execution pack without leaving the console."
      >
        <WorkspaceLayout
          sidebar={
            <>
              <ListCard title="Pack status">
                <div className="admin-detail-stack">
                  {launchClosureStatusQuery.data ? (
                    <>
                      <DetailList
                        items={[
                          {
                            label: "Release scope",
                            value:
                              launchClosureStatusQuery.data.releaseIdentifier ??
                              "All releases"
                          },
                          {
                            label: "Environment",
                            value:
                              launchClosureStatusQuery.data.environment ??
                              "Accepted environments"
                          },
                          {
                            label: "Generated at",
                            value: formatDateTime(
                              launchClosureStatusQuery.data.generatedAt
                            )
                          },
                          {
                            label: "Evidence freshness",
                            value: `${launchClosureStatusQuery.data.maximumEvidenceAgeHours} hours`
                          }
                        ]}
                      />
                      <div className="admin-list-row">
                        <div>
                          <strong>Operational posture</strong>
                          <span>
                            Current governed launch-closure state for the selected
                            scope.
                          </span>
                        </div>
                        <AdminStatusBadge
                          label={formatLaunchClosureStatusLabel(
                            launchClosureStatusQuery.data.overallStatus
                          )}
                          tone={mapStatusToTone(
                            launchClosureStatusQuery.data.overallStatus
                          )}
                        />
                      </div>
                    </>
                  ) : null}

                  <div className="admin-field">
                    <span>External operational checks</span>
                    {launchClosureStatusQuery.data?.externalChecks.length ? (
                      <div className="admin-list">
                        {launchClosureStatusQuery.data.externalChecks.map((check) => (
                          <div key={check.evidenceType} className="admin-list-row">
                            <div>
                              <strong>{check.label}</strong>
                              <span>
                                Accepted in {check.acceptedEnvironments.join(", ")}
                              </span>
                              <span>
                                {check.latestEvidence
                                  ? `Latest evidence ${formatDateTime(
                                      check.latestEvidence.observedAt
                                    )} in ${check.latestEvidence.environment}.`
                                  : "No accepted evidence recorded for this scope."}
                              </span>
                            </div>
                            <AdminStatusBadge
                              label={formatLaunchClosureCheckStatusLabel(check.status)}
                              tone={mapStatusToTone(check.status)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="admin-field-help">
                        No scoped operational checks are available yet.
                      </p>
                    )}
                  </div>

                  <div className="admin-field">
                    <span>Approval blockers</span>
                    {launchClosureStatusQuery.data?.latestApproval ? (
                      <div className="admin-list">
                        <div className="admin-list-row">
                          <div>
                            <strong>Latest approval</strong>
                            <span>
                              {launchClosureStatusQuery.data.latestApproval.releaseIdentifier}
                            </span>
                          </div>
                          <AdminStatusBadge
                            label={toTitleCase(
                              launchClosureStatusQuery.data.latestApproval.status
                            )}
                            tone={mapStatusToTone(
                              launchClosureStatusQuery.data.latestApproval.status
                            )}
                          />
                        </div>
                        <div className="admin-list-row">
                          <div>
                            <strong>Approval gate</strong>
                            <span>
                              Review missing, failed, stale, and open-blocker lists
                              before requesting or approving launch.
                            </span>
                          </div>
                          <AdminStatusBadge
                            label={toTitleCase(
                              launchClosureStatusQuery.data.latestApproval.gate
                                .overallStatus
                            )}
                            tone={mapStatusToTone(
                              launchClosureStatusQuery.data.latestApproval.gate
                                .overallStatus
                            )}
                          />
                        </div>
                        {launchClosureStatusQuery.data.latestApproval.gate
                          .missingEvidenceTypes.length ? (
                          <div className="admin-list-row">
                            <div>
                              <strong>Missing evidence</strong>
                              <span>
                                {launchClosureStatusQuery.data.latestApproval.gate.missingEvidenceTypes.join(
                                  ", "
                                )}
                              </span>
                            </div>
                            <AdminStatusBadge label="Missing" tone="warning" />
                          </div>
                        ) : null}
                        {launchClosureStatusQuery.data.latestApproval.gate
                          .failedEvidenceTypes.length ? (
                          <div className="admin-list-row">
                            <div>
                              <strong>Failed evidence</strong>
                              <span>
                                {launchClosureStatusQuery.data.latestApproval.gate.failedEvidenceTypes.join(
                                  ", "
                                )}
                              </span>
                            </div>
                            <AdminStatusBadge label="Failed" tone="critical" />
                          </div>
                        ) : null}
                        {launchClosureStatusQuery.data.latestApproval.gate
                          .staleEvidenceTypes.length ? (
                          <div className="admin-list-row">
                            <div>
                              <strong>Stale evidence</strong>
                              <span>
                                {launchClosureStatusQuery.data.latestApproval.gate.staleEvidenceTypes.join(
                                  ", "
                                )}
                              </span>
                            </div>
                            <AdminStatusBadge label="Stale" tone="warning" />
                          </div>
                        ) : null}
                        {launchClosureStatusQuery.data.latestApproval.gate.openBlockers
                          .length ? (
                          <div className="admin-list-row">
                            <div>
                              <strong>Open blockers</strong>
                              <span>
                                {launchClosureStatusQuery.data.latestApproval.gate.openBlockers.join(
                                  "; "
                                )}
                              </span>
                            </div>
                            <AdminStatusBadge label="Open" tone="critical" />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="admin-field-help">
                        No governed approval request exists for the selected release
                        scope yet.
                      </p>
                    )}
                  </div>

                  <div className="admin-field">
                    <span>Current status summary</span>
                    <textarea
                      aria-label="Launch-closure status summary"
                      readOnly
                      value={
                        launchClosureStatusQuery.data?.summaryMarkdown ??
                        "Launch-closure status is unavailable."
                      }
                    />
                  </div>
                </div>
              </ListCard>

              <ListCard title="Generated files">
                {launchClosureFiles.length > 0 ? (
                  <div className="admin-list">
                    {launchClosureFiles.map((file) => (
                      <button
                        key={file.relativePath}
                        type="button"
                        className={`admin-list-row selectable ${
                          selectedLaunchClosureFilePath === file.relativePath
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => setSelectedLaunchClosureFilePath(file.relativePath)}
                      >
                        <strong>{file.relativePath}</strong>
                        <span>{formatCount(file.content.length)} chars</span>
                        <span>Generated</span>
                        <AdminStatusBadge label="Ready" tone="positive" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="No pack generated"
                    description="Validate and generate a launch-closure pack to review the execution files."
                  />
                )}
              </ListCard>
            </>
          }
          main={
            <>
              <ListCard title="Manifest validation">
                <div className="admin-detail-stack">
                  {launchClosureStatusQuery.isError ? (
                    <InlineNotice
                      title="Status unavailable"
                      description="The launch-closure status summary could not be loaded."
                      tone="warning"
                    />
                  ) : null}
                  {launchClosureFlash ? (
                    <InlineNotice
                      title="Latest launch-closure action"
                      description={launchClosureFlash}
                      tone="positive"
                    />
                  ) : null}
                  {launchClosureError ? (
                    <InlineNotice
                      title="Launch-closure action failed"
                      description={launchClosureError}
                      tone="critical"
                    />
                  ) : null}
                  {launchClosureOutputSubpath ? (
                    <InlineNotice
                      title="Suggested output directory"
                      description={launchClosureOutputSubpath}
                    />
                  ) : null}
                  <div className="admin-field">
                    <span>Validation summary</span>
                    <textarea
                      aria-label="Launch-closure validation summary"
                      readOnly
                      value={
                        launchClosureSummary ??
                        "Validate a manifest to render the checklist, errors, and warnings."
                      }
                    />
                  </div>
                </div>
              </ListCard>

              {selectedLaunchClosureFile ? (
                <ListCard title="Selected generated file">
                  <div className="admin-detail-stack">
                    <DetailList
                      items={[
                        {
                          label: "Relative path",
                          value: selectedLaunchClosureFile.relativePath,
                          mono: true
                        },
                        {
                          label: "File size",
                          value: `${formatCount(selectedLaunchClosureFile.content.length)} chars`
                        }
                      ]}
                    />
                    <div className="admin-field">
                      <span>Generated content</span>
                      <textarea
                        aria-label="Generated launch-closure file content"
                        readOnly
                        value={selectedLaunchClosureFile.content}
                      />
                    </div>
                    <div className="admin-action-buttons">
                      <button
                        type="button"
                        className="admin-secondary-button"
                        onClick={() => downloadLaunchClosureFile(selectedLaunchClosureFile)}
                      >
                        Download selected file
                      </button>
                    </div>
                  </div>
                </ListCard>
              ) : (
                <EmptyState
                  title="Select a generated file"
                  description="Generate the pack and choose a file to inspect its exact runbook or template content."
                />
              )}
            </>
          }
          rail={
            <ActionRail
              title="Manifest editor"
              description="Keep this draft truthful to the current release candidate. Generation does not write files on the API host."
            >
              <div className="admin-field">
                <span>Launch-closure manifest JSON</span>
                <textarea
                  aria-label="Launch-closure manifest JSON"
                  value={launchClosureManifestDraft}
                  onChange={(event) =>
                    setLaunchClosureManifestDraft(event.target.value)
                  }
                />
                <p className="admin-field-help">
                  Seed from the selected release context, validate the manifest,
                  then generate the full execution pack for browser download.
                </p>
              </div>

              <div className="admin-action-buttons">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={seedLaunchClosureTemplate}
                >
                  Load current template
                </button>
                <button
                  type="button"
                  className="admin-secondary-button"
                  disabled={launchClosurePending}
                  onClick={() => runLaunchClosureAction("validate")}
                >
                  {validateLaunchClosureMutation.isPending
                    ? "Validating..."
                    : "Validate manifest"}
                </button>
                <button
                  type="button"
                  className="admin-primary-button"
                  disabled={launchClosurePending}
                  onClick={() => runLaunchClosureAction("scaffold")}
                >
                  {scaffoldLaunchClosureMutation.isPending
                    ? "Generating..."
                    : "Generate pack"}
                </button>
              </div>
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
