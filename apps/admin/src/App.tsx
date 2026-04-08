import { loadWebRuntimeConfig } from "@stealth-trails-bank/config/web";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
  type FormEvent
} from "react";
import {
  acknowledgePlatformAlert,
  addOversightIncidentNote,
  addReviewCaseNote,
  assignPlatformAlertOwner,
  applyAccountRestriction,
  applyManualResolution,
  approveRelease,
  clearPlatformAlertSuppression,
  createReleaseReadinessEvidence,
  createIncidentPackageReleaseRequest,
  decideAccountRelease,
  dismissLedgerReconciliationMismatch,
  dismissOversightIncident,
  dismissReviewCase,
  listAuditEvents,
  getTreasuryOverview,
  getAccountHoldSummary,
  getOperationsStatus,
  getReleaseReadinessSummary,
  getGovernedIncidentPackageExport,
  getIncidentPackage,
  getLedgerReconciliationWorkspace,
  getOversightIncidentWorkspace,
  getRelease,
  getManualResolutionSummary,
  getReviewCaseWorkspace,
  handoffReviewCase,
  listActiveAccountHolds,
  listLedgerReconciliationMismatches,
  listLedgerReconciliationRuns,
  listOversightAlerts,
  listOversightIncidents,
  listPendingAccountReleaseReviews,
  listPendingReleases,
  listPlatformAlertDeliveryTargetHealth,
  listPlatformAlerts,
  listReleasedReleases,
  listReleaseReadinessEvidence,
  listReviewCases,
  listWorkerRuntimeHealth,
  openLedgerReconciliationReviewCase,
  repairLedgerCustomerBalance,
  replayConfirmMismatch,
  replaySettleMismatch,
  releaseApprovedPackage,
  requestAccountRelease,
  resolveOversightIncident,
  resolveReviewCase,
  rejectRelease,
  retryPlatformAlertDeliveries,
  routeCriticalPlatformAlerts,
  routePlatformAlertToReviewCase,
  scanLedgerReconciliation,
  suppressPlatformAlert,
  startOversightIncident,
  startReviewCase
} from "./lib/api";
import {
  formatCount,
  formatDateTime,
  formatDuration,
  formatName,
  readApiErrorMessage,
  shortenValue,
  toTitleCase,
  trimToUndefined
} from "./lib/format";
import type {
  GovernedIncidentPackageExport,
  IncidentPackageSnapshot,
  OperatorSession
} from "./lib/types";

const runtimeConfig = loadWebRuntimeConfig(import.meta.env);
const operatorSessionStorageKey = "stealth-trails-bank.admin.operator-session";
const operatorRoleOptions = [
  "operations_admin",
  "risk_manager",
  "senior_operator",
  "compliance_lead"
];
const auditActorTypeOptions = ["", "customer", "operator", "worker", "system"];
const auditTargetTypeOptions = [
  "",
  "CustomerAccount",
  "CustomerAccountIncidentPackageRelease",
  "LedgerReconciliationMismatch",
  "LedgerReconciliationScanRun",
  "OversightIncident",
  "ReleaseReadinessEvidence",
  "ReviewCase",
  "TransactionIntent"
];
const exportModes = [
  "internal_full",
  "redaction_ready",
  "compliance_focused"
] as const;
const releaseTargets = [
  "internal_casefile",
  "compliance_handoff",
  "regulator_response",
  "external_counsel"
] as const;
const releaseReadinessEvidenceTypeOptions = [
  "platform_alert_delivery_slo",
  "critical_alert_reescalation",
  "database_restore_drill",
  "api_rollback_drill",
  "worker_rollback_drill"
] as const;
const releaseReadinessEnvironmentOptions = [
  "staging",
  "production_like",
  "production"
] as const;
const releaseReadinessEvidenceStatusOptions = [
  "pending",
  "passed",
  "failed"
] as const;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

type SessionDraft = OperatorSession;

type FlashState = {
  tone: "success" | "error";
  message: string;
};

type PackageRequestDraft = {
  customerAccountId: string;
  supabaseUserId: string;
  mode: (typeof exportModes)[number];
  releaseTarget: (typeof releaseTargets)[number];
  releaseReasonCode: string;
  requestNote: string;
  recentLimit: string;
  timelineLimit: string;
  sinceDays: string;
};

type ReleaseReadinessDraft = {
  evidenceType: (typeof releaseReadinessEvidenceTypeOptions)[number];
  environment: (typeof releaseReadinessEnvironmentOptions)[number];
  status: (typeof releaseReadinessEvidenceStatusOptions)[number];
  releaseIdentifier: string;
  rollbackReleaseIdentifier: string;
  backupReference: string;
  summary: string;
  note: string;
  evidenceLinksText: string;
  evidencePayloadText: string;
};

function loadStoredSession(serverUrl: string): SessionDraft {
  if (typeof window === "undefined") {
    return {
      baseUrl: serverUrl,
      operatorId: "",
      operatorRole: "operations_admin",
      apiKey: ""
    };
  }

  const serializedSession = window.localStorage.getItem(operatorSessionStorageKey);

  if (!serializedSession) {
    return {
      baseUrl: serverUrl,
      operatorId: "",
      operatorRole: "operations_admin",
      apiKey: ""
    };
  }

  try {
    const parsedSession = JSON.parse(serializedSession) as Partial<SessionDraft>;

    return {
      baseUrl: parsedSession.baseUrl || serverUrl,
      operatorId: parsedSession.operatorId || "",
      operatorRole: parsedSession.operatorRole || "operations_admin",
      apiKey: parsedSession.apiKey || ""
    };
  } catch {
    return {
      baseUrl: serverUrl,
      operatorId: "",
      operatorRole: "operations_admin",
      apiKey: ""
    };
  }
}

function saveStoredSession(session: SessionDraft): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(operatorSessionStorageKey, JSON.stringify(session));
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminConsole />
    </QueryClientProvider>
  );
}

function AdminConsole() {
  const queryClient = useQueryClient();
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [sessionDraft, setSessionDraft] = useState(() =>
    loadStoredSession(runtimeConfig.serverUrl)
  );
  const [savedSession, setSavedSession] = useState(() =>
    loadStoredSession(runtimeConfig.serverUrl)
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const deferredCustomerSearch = useDeferredValue(customerSearch.trim());
  const [auditSearch, setAuditSearch] = useState("");
  const deferredAuditSearch = useDeferredValue(auditSearch.trim());
  const [auditActorType, setAuditActorType] = useState("");
  const [auditTargetType, setAuditTargetType] = useState("");

  const [selectedReviewCaseId, setSelectedReviewCaseId] = useState<string | null>(
    null
  );
  const [selectedMismatchId, setSelectedMismatchId] = useState<string | null>(null);
  const [selectedOversightIncidentId, setSelectedOversightIncidentId] =
    useState<string | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [selectedAccountReleaseReviewId, setSelectedAccountReleaseReviewId] =
    useState<string | null>(null);

  const [reviewNote, setReviewNote] = useState("");
  const [handoffOperatorId, setHandoffOperatorId] = useState("");
  const [handoffNote, setHandoffNote] = useState("");
  const [manualResolutionReasonCode, setManualResolutionReasonCode] =
    useState("support_case_closed");
  const [manualResolutionNote, setManualResolutionNote] = useState("");
  const [reviewResolutionNote, setReviewResolutionNote] = useState("");
  const [reviewDismissNote, setReviewDismissNote] = useState("");
  const [releaseRequestNote, setReleaseRequestNote] = useState("");
  const [accountReleaseDecisionNote, setAccountReleaseDecisionNote] = useState("");
  const [mismatchActionNote, setMismatchActionNote] = useState("");
  const [scanScope, setScanScope] = useState<
    "" | "transaction_intent" | "customer_balance"
  >("");
  const [scanCustomerAccountId, setScanCustomerAccountId] = useState("");
  const [scanTransactionIntentId, setScanTransactionIntentId] = useState("");

  const [oversightNote, setOversightNote] = useState("");
  const [holdReasonCode, setHoldReasonCode] = useState("oversight_risk_hold");
  const [holdNote, setHoldNote] = useState("");
  const [oversightResolutionNote, setOversightResolutionNote] = useState("");
  const [oversightDismissNote, setOversightDismissNote] = useState("");

  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionNote, setRejectionNote] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const [packageDraft, setPackageDraft] = useState<PackageRequestDraft>({
    customerAccountId: "",
    supabaseUserId: "",
    mode: "internal_full",
    releaseTarget: "internal_casefile",
    releaseReasonCode: "case_support_review",
    requestNote: "",
    recentLimit: "20",
    timelineLimit: "100",
    sinceDays: "30"
  });
  const [packagePreview, setPackagePreview] =
    useState<GovernedIncidentPackageExport | null>(null);
  const [rawIncidentPackage, setRawIncidentPackage] =
    useState<IncidentPackageSnapshot | null>(null);
  const [releaseReadinessDraft, setReleaseReadinessDraft] =
    useState<ReleaseReadinessDraft>({
      evidenceType: "platform_alert_delivery_slo",
      environment: "staging",
      status: "passed",
      releaseIdentifier: "",
      rollbackReleaseIdentifier: "",
      backupReference: "",
      summary: "",
      note: "",
      evidenceLinksText: "",
      evidencePayloadText: ""
    });

  const isSessionReady =
    savedSession.baseUrl.trim().length > 0 &&
    savedSession.operatorId.trim().length > 0 &&
    savedSession.apiKey.trim().length > 0;
  const operatorSession = isSessionReady ? savedSession : null;

  const ledgerReconciliationMismatchesQuery = useQuery({
    queryKey: [
      "ledgerReconciliationMismatches",
      operatorSession?.baseUrl,
      deferredCustomerSearch
    ],
    queryFn: () =>
      listLedgerReconciliationMismatches(operatorSession!, {
        limit: 12,
        status: "open",
        email: trimToUndefined(deferredCustomerSearch)
      }),
    enabled: Boolean(operatorSession)
  });

  const ledgerReconciliationWorkspaceQuery = useQuery({
    queryKey: [
      "ledgerReconciliationWorkspace",
      operatorSession?.baseUrl,
      selectedMismatchId
    ],
    queryFn: () =>
      getLedgerReconciliationWorkspace(operatorSession!, selectedMismatchId!, 12),
    enabled: Boolean(operatorSession && selectedMismatchId)
  });

  const ledgerReconciliationRunsQuery = useQuery({
    queryKey: ["ledgerReconciliationRuns", operatorSession?.baseUrl],
    queryFn: () =>
      listLedgerReconciliationRuns(operatorSession!, {
        limit: 10
      }),
    enabled: Boolean(operatorSession),
    refetchInterval: 30000
  });

  const workerRuntimeHealthQuery = useQuery({
    queryKey: ["workerRuntimeHealth", operatorSession?.baseUrl],
    queryFn: () =>
      listWorkerRuntimeHealth(operatorSession!, {
        limit: 10,
        staleAfterSeconds: 180
      }),
    enabled: Boolean(operatorSession),
    refetchInterval: 30000
  });

  const operationsStatusQuery = useQuery({
    queryKey: ["operationsStatus", operatorSession?.baseUrl],
    queryFn: () =>
      getOperationsStatus(operatorSession!, {
        staleAfterSeconds: 180,
        recentAlertLimit: 8
      }),
    enabled: Boolean(operatorSession),
    refetchInterval: 30000
  });

  const platformAlertsQuery = useQuery({
    queryKey: ["platformAlerts", operatorSession?.baseUrl],
    queryFn: () =>
      listPlatformAlerts(operatorSession!, {
        limit: 12,
        staleAfterSeconds: 180,
        status: "open"
      }),
    enabled: Boolean(operatorSession),
    refetchInterval: 30000
  });

  const releaseReadinessSummaryQuery = useQuery({
    queryKey: ["releaseReadinessSummary", operatorSession?.baseUrl],
    queryFn: () => getReleaseReadinessSummary(operatorSession!),
    enabled: Boolean(operatorSession),
    refetchInterval: 30000
  });

  const releaseReadinessEvidenceQuery = useQuery({
    queryKey: ["releaseReadinessEvidence", operatorSession?.baseUrl],
    queryFn: () =>
      listReleaseReadinessEvidence(operatorSession!, {
        limit: 10,
        sinceDays: 90
      }),
    enabled: Boolean(operatorSession),
    refetchInterval: 30000
  });

  const platformAlertTargetHealthQuery = useQuery({
    queryKey: ["platformAlertTargetHealth", operatorSession?.baseUrl],
    queryFn: () =>
      listPlatformAlertDeliveryTargetHealth(operatorSession!, {
        lookbackHours: 24
      }),
    enabled: Boolean(operatorSession),
    refetchInterval: 30000
  });

  const treasuryOverviewQuery = useQuery({
    queryKey: ["treasuryOverview", operatorSession?.baseUrl],
    queryFn: () =>
      getTreasuryOverview(operatorSession!, {
        walletLimit: 8,
        activityLimit: 8,
        alertLimit: 6,
        staleAfterSeconds: 180
      }),
    enabled: Boolean(operatorSession),
    refetchInterval: 30000
  });

  const auditEventsQuery = useQuery({
    queryKey: [
      "auditEvents",
      operatorSession?.baseUrl,
      deferredAuditSearch,
      auditActorType,
      auditTargetType
    ],
    queryFn: () =>
      listAuditEvents(operatorSession!, {
        limit: 12,
        search: trimToUndefined(deferredAuditSearch),
        actorType: trimToUndefined(auditActorType),
        targetType: trimToUndefined(auditTargetType)
      }),
    enabled: Boolean(operatorSession)
  });

  const reviewCasesQuery = useQuery({
    queryKey: [
      "reviewCases",
      operatorSession?.baseUrl,
      operatorSession?.operatorId,
      deferredCustomerSearch
    ],
    queryFn: () =>
      listReviewCases(operatorSession!, {
        limit: 12,
        email: trimToUndefined(deferredCustomerSearch)
      }),
    enabled: Boolean(operatorSession)
  });

  const manualResolutionSummaryQuery = useQuery({
    queryKey: ["manualResolutionSummary", operatorSession?.baseUrl],
    queryFn: () =>
      getManualResolutionSummary(operatorSession!, {
        sinceDays: 30
      }),
    enabled: Boolean(operatorSession)
  });

  const reviewWorkspaceQuery = useQuery({
    queryKey: ["reviewWorkspace", operatorSession?.baseUrl, selectedReviewCaseId],
    queryFn: () => getReviewCaseWorkspace(operatorSession!, selectedReviewCaseId!, 10),
    enabled: Boolean(operatorSession && selectedReviewCaseId)
  });

  const accountReleaseReviewsQuery = useQuery({
    queryKey: [
      "accountReleaseReviews",
      operatorSession?.baseUrl,
      deferredCustomerSearch
    ],
    queryFn: () =>
      listPendingAccountReleaseReviews(operatorSession!, {
        limit: 10,
        email: trimToUndefined(deferredCustomerSearch)
      }),
    enabled: Boolean(operatorSession)
  });

  const oversightAlertsQuery = useQuery({
    queryKey: ["oversightAlerts", operatorSession?.baseUrl],
    queryFn: () =>
      listOversightAlerts(operatorSession!, {
        limit: 8,
        sinceDays: 30
      }),
    enabled: Boolean(operatorSession)
  });

  const oversightIncidentsQuery = useQuery({
    queryKey: [
      "oversightIncidents",
      operatorSession?.baseUrl,
      deferredCustomerSearch
    ],
    queryFn: () =>
      listOversightIncidents(operatorSession!, {
        limit: 10,
        email: trimToUndefined(deferredCustomerSearch)
      }),
    enabled: Boolean(operatorSession)
  });

  const oversightWorkspaceQuery = useQuery({
    queryKey: [
      "oversightWorkspace",
      operatorSession?.baseUrl,
      selectedOversightIncidentId
    ],
    queryFn: () =>
      getOversightIncidentWorkspace(operatorSession!, selectedOversightIncidentId!, 8),
    enabled: Boolean(operatorSession && selectedOversightIncidentId)
  });

  const accountHoldSummaryQuery = useQuery({
    queryKey: ["accountHoldSummary", operatorSession?.baseUrl],
    queryFn: () =>
      getAccountHoldSummary(operatorSession!, {
        sinceDays: 30
      }),
    enabled: Boolean(operatorSession)
  });

  const activeHoldsQuery = useQuery({
    queryKey: ["activeHolds", operatorSession?.baseUrl, deferredCustomerSearch],
    queryFn: () =>
      listActiveAccountHolds(operatorSession!, {
        limit: 10,
        email: trimToUndefined(deferredCustomerSearch)
      }),
    enabled: Boolean(operatorSession)
  });

  const pendingReleasesQuery = useQuery({
    queryKey: ["pendingReleases", operatorSession?.baseUrl],
    queryFn: () =>
      listPendingReleases(operatorSession!, {
        limit: 10
      }),
    enabled: Boolean(operatorSession)
  });

  const releasedReleasesQuery = useQuery({
    queryKey: ["releasedReleases", operatorSession?.baseUrl],
    queryFn: () =>
      listReleasedReleases(operatorSession!, {
        limit: 6,
        sinceDays: 30
      }),
    enabled: Boolean(operatorSession)
  });

  const selectedReleaseQuery = useQuery({
    queryKey: ["releaseDetail", operatorSession?.baseUrl, selectedReleaseId],
    queryFn: () => getRelease(operatorSession!, selectedReleaseId!),
    enabled: Boolean(operatorSession && selectedReleaseId)
  });

  useEffect(() => {
    const mismatches = ledgerReconciliationMismatchesQuery.data?.mismatches ?? [];
    const nextSelectedMismatch =
      mismatches.find((mismatch) => mismatch.id === selectedMismatchId)?.id ??
      mismatches[0]?.id ??
      null;

    if (selectedMismatchId !== nextSelectedMismatch) {
      startTransition(() => {
        setSelectedMismatchId(nextSelectedMismatch);
      });
    }
  }, [ledgerReconciliationMismatchesQuery.data, selectedMismatchId]);

  useEffect(() => {
    const firstReviewCase = reviewCasesQuery.data?.reviewCases[0]?.id ?? null;

    if (!selectedReviewCaseId && firstReviewCase) {
      startTransition(() => {
        setSelectedReviewCaseId(firstReviewCase);
      });
    }
  }, [reviewCasesQuery.data, selectedReviewCaseId]);

  useEffect(() => {
    const firstOversightIncident =
      oversightIncidentsQuery.data?.oversightIncidents[0]?.id ?? null;

    if (!selectedOversightIncidentId && firstOversightIncident) {
      startTransition(() => {
        setSelectedOversightIncidentId(firstOversightIncident);
      });
    }
  }, [oversightIncidentsQuery.data, selectedOversightIncidentId]);

  useEffect(() => {
    const firstRelease =
      pendingReleasesQuery.data?.releases[0]?.id ??
      releasedReleasesQuery.data?.releases[0]?.id ??
      null;

    if (!selectedReleaseId && firstRelease) {
      startTransition(() => {
        setSelectedReleaseId(firstRelease);
      });
    }
  }, [pendingReleasesQuery.data, releasedReleasesQuery.data, selectedReleaseId]);

  useEffect(() => {
    const firstReleaseReview =
      accountReleaseReviewsQuery.data?.reviews[0]?.reviewCase.id ?? null;

    if (!selectedAccountReleaseReviewId && firstReleaseReview) {
      startTransition(() => {
        setSelectedAccountReleaseReviewId(firstReleaseReview);
      });
    }
  }, [accountReleaseReviewsQuery.data, selectedAccountReleaseReviewId]);

  async function refreshAllData(): Promise<void> {
    await queryClient.invalidateQueries();
  }

  async function executeAction(
    actionKey: string,
    successMessage: string,
    operation: () => Promise<void>
  ): Promise<void> {
    setPendingAction(actionKey);
    setFlash(null);

    try {
      await operation();
      await refreshAllData();
      setFlash({
        tone: "success",
        message: successMessage
      });
    } catch (error) {
      setFlash({
        tone: "error",
        message: readApiErrorMessage(error)
      });
    } finally {
      setPendingAction(null);
    }
  }

  function handleSaveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextSession = {
      baseUrl: sessionDraft.baseUrl.trim(),
      operatorId: sessionDraft.operatorId.trim(),
      operatorRole: sessionDraft.operatorRole.trim(),
      apiKey: sessionDraft.apiKey.trim()
    };

    setSavedSession(nextSession);
    saveStoredSession(nextSession);
    setFlash({
      tone: "success",
      message: "Operator session saved locally."
    });
  }

  async function handleLoadPackagePreview(): Promise<void> {
    if (!operatorSession) {
      return;
    }

    await executeAction(
      "preview-package",
      "Governed export preview refreshed.",
      async () => {
        const params = {
          customerAccountId: trimToUndefined(packageDraft.customerAccountId),
          supabaseUserId: trimToUndefined(packageDraft.supabaseUserId),
          mode: packageDraft.mode,
          recentLimit: Number(packageDraft.recentLimit),
          timelineLimit: Number(packageDraft.timelineLimit),
          sinceDays: Number(packageDraft.sinceDays)
        };

        const [preview, rawPackage] = await Promise.all([
          getGovernedIncidentPackageExport(operatorSession, params),
          getIncidentPackage(operatorSession, {
            customerAccountId: trimToUndefined(packageDraft.customerAccountId),
            supabaseUserId: trimToUndefined(packageDraft.supabaseUserId),
            recentLimit: Number(packageDraft.recentLimit),
            timelineLimit: Number(packageDraft.timelineLimit)
          })
        ]);

        setPackagePreview(preview);
        setRawIncidentPackage(rawPackage);
      }
    );
  }

  async function handleRunReconciliationScan(): Promise<void> {
    if (!operatorSession) {
      return;
    }

    await executeAction(
      "scan-ledger-reconciliation",
      "Ledger reconciliation scan completed.",
      async () => {
        const result = await scanLedgerReconciliation(operatorSession, {
          scope: scanScope || undefined,
          customerAccountId: trimToUndefined(scanCustomerAccountId),
          transactionIntentId: trimToUndefined(scanTransactionIntentId)
        });

        setSelectedMismatchId(result.result.mismatches[0]?.id ?? null);
      }
    );
  }

  async function handleRecordReleaseReadinessEvidence(): Promise<void> {
    if (!operatorSession) {
      return;
    }

    const summary = releaseReadinessDraft.summary.trim();

    if (summary.length === 0) {
      setFlash({
        tone: "error",
        message: "Release readiness evidence summary is required."
      });
      return;
    }

    let parsedEvidencePayload: Record<string, unknown> | undefined;
    const trimmedEvidencePayload = trimToUndefined(
      releaseReadinessDraft.evidencePayloadText
    );

    if (trimmedEvidencePayload) {
      try {
        const parsedValue = JSON.parse(trimmedEvidencePayload);

        if (
          parsedValue === null ||
          Array.isArray(parsedValue) ||
          typeof parsedValue !== "object"
        ) {
          setFlash({
            tone: "error",
            message: "Evidence payload JSON must be an object."
          });
          return;
        }

        parsedEvidencePayload = parsedValue as Record<string, unknown>;
      } catch {
        setFlash({
          tone: "error",
          message: "Evidence payload JSON is invalid."
        });
        return;
      }
    }

    const evidenceLinks = releaseReadinessDraft.evidenceLinksText
      .split("\n")
      .map((link) => link.trim())
      .filter(Boolean);

    await executeAction(
      "record-release-readiness-evidence",
      "Release readiness evidence recorded.",
      async () => {
        await createReleaseReadinessEvidence(operatorSession, {
          evidenceType: releaseReadinessDraft.evidenceType,
          environment: releaseReadinessDraft.environment,
          status: releaseReadinessDraft.status,
          releaseIdentifier: trimToUndefined(
            releaseReadinessDraft.releaseIdentifier
          ),
          rollbackReleaseIdentifier: trimToUndefined(
            releaseReadinessDraft.rollbackReleaseIdentifier
          ),
          backupReference: trimToUndefined(releaseReadinessDraft.backupReference),
          summary,
          note: trimToUndefined(releaseReadinessDraft.note),
          ...(evidenceLinks.length > 0 ? { evidenceLinks } : {}),
          ...(parsedEvidencePayload ? { evidencePayload: parsedEvidencePayload } : {})
        });

        setReleaseReadinessDraft((current) => ({
          ...current,
          summary: "",
          note: "",
          evidenceLinksText: "",
          evidencePayloadText: ""
        }));
      }
    );
  }

  const selectedReleaseReview =
    accountReleaseReviewsQuery.data?.reviews.find(
      (review) => review.reviewCase.id === selectedAccountReleaseReviewId
    ) ?? null;

  const selectedRelease = selectedReleaseQuery.data?.release ?? null;
  const unroutedCriticalPlatformAlertCount =
    platformAlertsQuery.data?.alerts.filter(
      (alert) =>
        alert.severity === "critical" && alert.routingStatus === "unrouted"
    ).length ?? 0;

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Stealth Trails Bank</p>
          <h1>Operator Console</h1>
          <p className="hero-copy">
            Internal review queues, oversight incidents, account holds, and
            governed incident package release workflows in one surface.
          </p>
        </div>
        <div className="hero-status">
          <span className={`status-pill ${isSessionReady ? "ok" : "warn"}`}>
            {isSessionReady ? "Operator session active" : "Credentials required"}
          </span>
          <span className="hero-meta">
            Base URL: {savedSession.baseUrl || runtimeConfig.serverUrl}
          </span>
        </div>
      </header>

      {flash ? (
        <section className={`flash ${flash.tone}`}>
          <strong>{flash.tone === "success" ? "Updated." : "Blocked."}</strong>
          <span>{flash.message}</span>
        </section>
      ) : null}

      <section className="panel panel-accent">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Operator Credentials</p>
            <h2>Local session</h2>
          </div>
          <p className="section-copy">
            The internal API guard requires `x-operator-api-key`,
            `x-operator-id`, and optionally `x-operator-role`. This console stores
            those values only in local browser storage.
          </p>
        </div>

        <form className="credentials-grid" onSubmit={handleSaveSession}>
          <label>
            API Base URL
            <input
              value={sessionDraft.baseUrl}
              onChange={(event) =>
                setSessionDraft((current) => ({
                  ...current,
                  baseUrl: event.target.value
                }))
              }
              placeholder="http://localhost:9001"
            />
          </label>
          <label>
            Operator ID
            <input
              value={sessionDraft.operatorId}
              onChange={(event) =>
                setSessionDraft((current) => ({
                  ...current,
                  operatorId: event.target.value
                }))
              }
              placeholder="ops_1"
            />
          </label>
          <label>
            Operator Role
            <select
              value={sessionDraft.operatorRole}
              onChange={(event) =>
                setSessionDraft((current) => ({
                  ...current,
                  operatorRole: event.target.value
                }))
              }
            >
              {operatorRoleOptions.map((role) => (
                <option key={role} value={role}>
                  {toTitleCase(role)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Operator API Key
            <input
              type="password"
              value={sessionDraft.apiKey}
              onChange={(event) =>
                setSessionDraft((current) => ({
                  ...current,
                  apiKey: event.target.value
                }))
              }
              placeholder="local-dev-operator-key"
            />
          </label>
          <div className="credentials-actions">
            <button className="button primary" type="submit">
              Save Session
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Alert Delivery</p>
            <h2>Delivery target health</h2>
          </div>
          <p className="section-copy">
            {platformAlertTargetHealthQuery.data
              ? `External alert delivery posture over the last ${platformAlertTargetHealthQuery.data.lookbackHours} hours.`
              : "External alert delivery posture over the configured SLO window."}
          </p>
        </div>

        {platformAlertTargetHealthQuery.isLoading ? (
          <p>Loading delivery target health...</p>
        ) : null}

        {platformAlertTargetHealthQuery.data ? (
          <div className="list-stack">
            {platformAlertTargetHealthQuery.data.targets.map((target) => (
              <article className="list-card" key={target.targetName}>
                <div className="list-card-topline">
                  <strong>{target.targetName}</strong>
                  <span className={`status-pill ${target.healthStatus}`}>
                    {toTitleCase(target.healthStatus)}
                  </span>
                </div>
                <p className="muted">
                  {target.deliveryMode === "failover_only"
                    ? "Failover-only delivery target"
                    : "Direct delivery target"}
                  {" | "}
                  {shortenValue(target.targetUrl, 72)}
                </p>
                <p className="muted">
                  Deliveries {target.recentDeliveryCount} total | succeeded{" "}
                  {target.recentSucceededCount} | failed {target.recentFailedCount} |
                  pending {target.pendingDeliveryCount}
                  {" | "}failure rate{" "}
                  {target.recentFailureRatePercent !== null
                    ? `${target.recentFailureRatePercent}%`
                    : "n/a"}
                  {" | "}consecutive failures {target.consecutiveFailureCount}
                </p>
                <p className="muted">
                  Latency avg{" "}
                  {target.averageDeliveryLatencyMs !== null
                    ? formatDuration(target.averageDeliveryLatencyMs)
                    : "n/a"}
                  {" | "}max{" "}
                  {target.maxDeliveryLatencyMs !== null
                    ? formatDuration(target.maxDeliveryLatencyMs)
                    : "n/a"}
                  {" | "}highest escalation level {target.highestObservedEscalationLevel}
                </p>
                <p className="muted">
                  Last delivered{" "}
                  {target.lastDeliveredAt ? formatDateTime(target.lastDeliveredAt) : "n/a"}
                  {" | "}last failure{" "}
                  {target.lastFailureAt ? formatDateTime(target.lastFailureAt) : "n/a"}
                </p>
                <p className="muted">
                  Events {target.eventTypes.join(", ")}
                  {target.failoverTargetNames.length > 0
                    ? ` | Fails over to ${target.failoverTargetNames.join(", ")}`
                    : ""}
                </p>
                {target.lastErrorMessage ? (
                  <p className="muted">Latest error {target.lastErrorMessage}</p>
                ) : null}
                {target.sloBreaches.length > 0 ? (
                  <p className="muted">
                    SLO breaches {target.sloBreaches.join(" | ")}
                  </p>
                ) : null}
              </article>
            ))}
            {platformAlertTargetHealthQuery.data.targets.length === 0 ? (
              <p>No delivery targets configured.</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Phase 12</p>
            <h2>Release readiness evidence</h2>
          </div>
          <p className="section-copy">
            {releaseReadinessSummaryQuery.data
              ? `Generated ${formatDateTime(releaseReadinessSummaryQuery.data.generatedAt)}`
              : "Record staging or production-like proof for alert-delivery SLOs, re-escalation cadence, and restore or rollback drills."}
          </p>
        </div>

        {releaseReadinessSummaryQuery.isLoading ? (
          <p>Loading release readiness summary...</p>
        ) : null}

        {releaseReadinessSummaryQuery.data ? (
          <>
            <div className="metrics-grid">
              <HealthStatusCard
                label="Readiness"
                status={releaseReadinessSummaryQuery.data.overallStatus}
                detail={`${releaseReadinessSummaryQuery.data.summary.passedCheckCount}/${releaseReadinessSummaryQuery.data.summary.requiredCheckCount} required checks passed`}
              />
              <MetricCard
                label="Passed proofs"
                value={releaseReadinessSummaryQuery.data.summary.passedCheckCount}
                detail="Latest proof status is passed"
              />
              <MetricCard
                label="Pending proofs"
                value={releaseReadinessSummaryQuery.data.summary.pendingCheckCount}
                detail="No accepted evidence recorded yet"
              />
              <MetricCard
                label="Failed proofs"
                value={releaseReadinessSummaryQuery.data.summary.failedCheckCount}
                detail="Latest evidence is failed and blocks launch posture"
              />
            </div>

            <div className="workspace-grid">
              <section className="panel">
                <div className="section-heading compact">
                  <div>
                    <p className="section-kicker">Required Proofs</p>
                    <h2>Checklist coverage</h2>
                  </div>
                </div>

                <div className="list-stack">
                  {releaseReadinessSummaryQuery.data.requiredChecks.map((check) => (
                    <article className="list-card" key={check.evidenceType}>
                      <div className="list-card-topline">
                        <strong>{check.label}</strong>
                        <span className={`status-pill ${check.status}`}>
                          {toTitleCase(check.status)}
                        </span>
                      </div>
                      <p>{check.description}</p>
                      <p className="muted">
                        Accepted environments {check.acceptedEnvironments.join(", ")}
                      </p>
                      <p className="muted">Runbook {check.runbookPath}</p>
                      {check.latestEvidence ? (
                        <>
                          <p className="muted">
                            Latest evidence {formatDateTime(check.latestEvidence.observedAt)} |{" "}
                            {toTitleCase(check.latestEvidence.environment)} |{" "}
                            {toTitleCase(check.latestEvidence.status)}
                          </p>
                          <p className="muted">
                            {check.latestEvidence.summary}
                            {check.latestEvidence.releaseIdentifier
                              ? ` | Release ${check.latestEvidence.releaseIdentifier}`
                              : ""}
                            {check.latestEvidence.backupReference
                              ? ` | Backup ${check.latestEvidence.backupReference}`
                              : ""}
                          </p>
                        </>
                      ) : (
                        <p className="muted">
                          No accepted evidence is recorded yet for this proof.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="section-heading compact">
                  <div>
                    <p className="section-kicker">Record Evidence</p>
                    <h2>Attach staging or production-like proof</h2>
                  </div>
                </div>

                <div className="form-grid">
                  <label>
                    Evidence type
                    <select
                      value={releaseReadinessDraft.evidenceType}
                      onChange={(event) =>
                        setReleaseReadinessDraft((current) => ({
                          ...current,
                          evidenceType: event.target.value as ReleaseReadinessDraft["evidenceType"]
                        }))
                      }
                    >
                      {releaseReadinessEvidenceTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {toTitleCase(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Environment
                    <select
                      value={releaseReadinessDraft.environment}
                      onChange={(event) =>
                        setReleaseReadinessDraft((current) => ({
                          ...current,
                          environment: event.target.value as ReleaseReadinessDraft["environment"]
                        }))
                      }
                    >
                      {releaseReadinessEnvironmentOptions.map((option) => (
                        <option key={option} value={option}>
                          {toTitleCase(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Result
                    <select
                      value={releaseReadinessDraft.status}
                      onChange={(event) =>
                        setReleaseReadinessDraft((current) => ({
                          ...current,
                          status: event.target.value as ReleaseReadinessDraft["status"]
                        }))
                      }
                    >
                      {releaseReadinessEvidenceStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {toTitleCase(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="split-form">
                  <label>
                    Release identifier
                    <input
                      value={releaseReadinessDraft.releaseIdentifier}
                      onChange={(event) =>
                        setReleaseReadinessDraft((current) => ({
                          ...current,
                          releaseIdentifier: event.target.value
                        }))
                      }
                      placeholder="api-2026.04.08.1"
                    />
                  </label>
                  <label>
                    Rollback release identifier
                    <input
                      value={releaseReadinessDraft.rollbackReleaseIdentifier}
                      onChange={(event) =>
                        setReleaseReadinessDraft((current) => ({
                          ...current,
                          rollbackReleaseIdentifier: event.target.value
                        }))
                      }
                      placeholder="api-2026.04.07.3"
                    />
                  </label>
                  <label>
                    Backup reference
                    <input
                      value={releaseReadinessDraft.backupReference}
                      onChange={(event) =>
                        setReleaseReadinessDraft((current) => ({
                          ...current,
                          backupReference: event.target.value
                        }))
                      }
                      placeholder="snapshot-2026-04-08T09:00Z"
                    />
                  </label>
                </div>

                <label>
                  Summary
                  <textarea
                    value={releaseReadinessDraft.summary}
                    onChange={(event) =>
                      setReleaseReadinessDraft((current) => ({
                        ...current,
                        summary: event.target.value
                      }))
                    }
                    placeholder="What was proven, against which traffic profile, and whether the result passed."
                  />
                </label>

                <label>
                  Operator note
                  <textarea
                    value={releaseReadinessDraft.note}
                    onChange={(event) =>
                      setReleaseReadinessDraft((current) => ({
                        ...current,
                        note: event.target.value
                      }))
                    }
                    placeholder="Threshold decisions, discovered gaps, or remediation ownership."
                  />
                </label>

                <div className="two-column">
                  <label>
                    Evidence links
                    <textarea
                      value={releaseReadinessDraft.evidenceLinksText}
                      onChange={(event) =>
                        setReleaseReadinessDraft((current) => ({
                          ...current,
                          evidenceLinksText: event.target.value
                        }))
                      }
                      placeholder={"One URL or artifact reference per line"}
                    />
                  </label>
                  <label>
                    Evidence payload JSON
                    <textarea
                      value={releaseReadinessDraft.evidencePayloadText}
                      onChange={(event) =>
                        setReleaseReadinessDraft((current) => ({
                          ...current,
                          evidencePayloadText: event.target.value
                        }))
                      }
                      placeholder='{"alertId":"alert_1","targetName":"ops-critical"}'
                    />
                  </label>
                </div>

                <button
                  className="button primary"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() => void handleRecordReleaseReadinessEvidence()}
                  type="button"
                >
                  Record evidence
                </button>
              </section>
            </div>

            <div className="list-stack">
              {releaseReadinessEvidenceQuery.isLoading ? (
                <p>Loading recent release readiness evidence...</p>
              ) : null}
              {releaseReadinessEvidenceQuery.data?.evidence.map((evidence) => (
                <article className="list-card" key={evidence.id}>
                  <div className="list-card-topline">
                    <strong>{toTitleCase(evidence.evidenceType)}</strong>
                    <span className={`status-pill ${evidence.status}`}>
                      {toTitleCase(evidence.status)}
                    </span>
                  </div>
                  <p>{evidence.summary}</p>
                  <p className="muted">
                    {toTitleCase(evidence.environment)} | Recorded by {evidence.operatorId} |{" "}
                    {formatDateTime(evidence.observedAt)}
                  </p>
                  <p className="muted">
                    {evidence.releaseIdentifier
                      ? `Release ${evidence.releaseIdentifier}`
                      : "No release identifier"}
                    {evidence.rollbackReleaseIdentifier
                      ? ` | Rollback ${evidence.rollbackReleaseIdentifier}`
                      : ""}
                    {evidence.backupReference
                      ? ` | Backup ${evidence.backupReference}`
                      : ""}
                  </p>
                  {evidence.note ? <p className="muted">{evidence.note}</p> : null}
                  {evidence.runbookPath ? (
                    <p className="muted">Runbook {evidence.runbookPath}</p>
                  ) : null}
                  {evidence.evidenceLinks.length > 0 ? (
                    <p className="muted">
                      Evidence {evidence.evidenceLinks.join(" | ")}
                    </p>
                  ) : null}
                </article>
              ))}
              {releaseReadinessEvidenceQuery.data &&
              releaseReadinessEvidenceQuery.data.evidence.length === 0 ? (
                <p>No release readiness evidence has been recorded yet.</p>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Phase 11</p>
            <h2>Platform health</h2>
          </div>
          <p className="section-copy">
            {operationsStatusQuery.data
              ? `Generated ${formatDateTime(operationsStatusQuery.data.generatedAt)}`
              : "Aggregated worker, queue, chain, treasury, and reconciliation health."}
          </p>
        </div>

        {operationsStatusQuery.isLoading ? <p>Loading operations status...</p> : null}

        {operationsStatusQuery.data ? (
          <div className="metrics-grid">
            <HealthStatusCard
              label="Workers"
              status={operationsStatusQuery.data.workerHealth.status}
              detail={`${operationsStatusQuery.data.workerHealth.healthyWorkers}/${operationsStatusQuery.data.workerHealth.totalWorkers} healthy`}
            />
            <HealthStatusCard
              label="Queues"
              status={operationsStatusQuery.data.queueHealth.status}
              detail={`${operationsStatusQuery.data.queueHealth.totalQueuedCount} queued`}
            />
            <HealthStatusCard
              label="Chain"
              status={operationsStatusQuery.data.chainHealth.status}
              detail={`${operationsStatusQuery.data.chainHealth.laggingBroadcastCount} lagging broadcasts`}
            />
            <HealthStatusCard
              label="Treasury"
              status={operationsStatusQuery.data.treasuryHealth.status}
              detail={`${operationsStatusQuery.data.treasuryHealth.activeTreasuryWalletCount} treasury / ${operationsStatusQuery.data.treasuryHealth.activeOperationalWalletCount} operational`}
            />
            <HealthStatusCard
              label="Reconciliation"
              status={operationsStatusQuery.data.reconciliationHealth.status}
              detail={`${operationsStatusQuery.data.reconciliationHealth.openMismatchCount} open mismatches`}
            />
            <HealthStatusCard
              label="Incident safety"
              status={operationsStatusQuery.data.incidentSafety.status}
              detail={`${operationsStatusQuery.data.incidentSafety.openReviewCaseCount} review cases`}
            />
            <MetricCard
              label="Open alerts"
              value={operationsStatusQuery.data.alertSummary.openCount}
              detail={`${operationsStatusQuery.data.alertSummary.criticalCount} critical / ${operationsStatusQuery.data.alertSummary.warningCount} warning`}
            />
            <MetricCard
              label="Restricted accounts"
              value={operationsStatusQuery.data.incidentSafety.activeRestrictedAccountCount}
              detail="Accounts under active restriction"
            />
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Queue Snapshot</p>
            <h2>What needs attention</h2>
          </div>
          <label className="search-field">
            <span>Customer search</span>
            <input
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Filter by customer email"
            />
          </label>
        </div>

        <div className="metrics-grid">
          <MetricCard
            label="Review cases"
            value={reviewCasesQuery.data?.reviewCases.length ?? 0}
            detail="Loaded open review queue"
          />
          <MetricCard
            label="Open mismatches"
            value={
              ledgerReconciliationMismatchesQuery.data?.summary.byStatus.find(
                (entry) => entry.status === "open"
              )?.count ??
              ledgerReconciliationMismatchesQuery.data?.mismatches.length ??
              0
            }
            detail="Ledger reconciliation exceptions"
          />
          <MetricCard
            label="Degraded workers"
            value={
              workerRuntimeHealthQuery.data?.workers.filter(
                (worker) => worker.healthStatus !== "healthy"
              ).length ?? 0
            }
            detail="Workers needing operator attention"
          />
          <MetricCard
            label="Oversight incidents"
            value={oversightIncidentsQuery.data?.oversightIncidents.length ?? 0}
            detail="Loaded incident queue"
          />
          <MetricCard
            label="Active holds"
            value={accountHoldSummaryQuery.data?.activeHolds ?? 0}
            detail="Rolling 30-day summary"
          />
          <MetricCard
            label="Pending exports"
            value={pendingReleasesQuery.data?.releases.length ?? 0}
            detail="Release requests awaiting action"
          />
          <MetricCard
            label="Manual resolutions"
            value={manualResolutionSummaryQuery.data?.totalIntents ?? 0}
            detail="Resolved intents in the rolling window"
          />
          <MetricCard
            label="Oversight alerts"
            value={oversightAlertsQuery.data?.alerts.length ?? 0}
            detail="Spike alerts detected"
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Treasury</p>
            <h2>Treasury visibility</h2>
          </div>
          <p className="section-copy">
            {treasuryOverviewQuery.data
              ? `Generated ${formatDateTime(treasuryOverviewQuery.data.generatedAt)}`
              : "Operational wallet inventory, managed coverage, recent treasury activity, and treasury alerts."}
          </p>
        </div>

        {treasuryOverviewQuery.isLoading ? <p>Loading treasury overview...</p> : null}

        {treasuryOverviewQuery.data ? (
          <>
            <div className="metrics-grid">
              <HealthStatusCard
                label="Coverage"
                status={treasuryOverviewQuery.data.coverage.status}
                detail={`${treasuryOverviewQuery.data.coverage.managedWorkerCount} managed workers`}
              />
              <MetricCard
                label="Treasury wallets"
                value={treasuryOverviewQuery.data.coverage.activeTreasuryWalletCount}
                detail="Active treasury wallets"
              />
              <MetricCard
                label="Operational wallets"
                value={treasuryOverviewQuery.data.coverage.activeOperationalWalletCount}
                detail="Active operational wallets"
              />
              <MetricCard
                label="Customer-linked wallets"
                value={treasuryOverviewQuery.data.coverage.customerLinkedWalletCount}
                detail="Treasury or operational wallets linked to a customer account"
              />
              <MetricCard
                label="Treasury alerts"
                value={treasuryOverviewQuery.data.coverage.openTreasuryAlertCount}
                detail="Open treasury-scoped platform alerts"
              />
              <MetricCard
                label="Wallet inventory"
                value={treasuryOverviewQuery.data.walletSummary.totalWalletCount}
                detail="Treasury and operational wallets on the product chain"
              />
            </div>

            <div className="workspace-grid">
              <section className="panel">
                <div className="section-heading compact">
                  <div>
                    <p className="section-kicker">Wallet Inventory</p>
                    <h2>Treasury and operational wallets</h2>
                  </div>
                </div>
                <div className="list-stack">
                  {treasuryOverviewQuery.data.wallets.map((wallet) => (
                    <article className="list-card" key={wallet.id}>
                      <div className="list-card-topline">
                        <strong>{toTitleCase(wallet.kind)}</strong>
                        <span className={`status-pill ${wallet.status}`}>
                          {toTitleCase(wallet.status)}
                        </span>
                      </div>
                      <p>{wallet.address}</p>
                      <p className="muted">
                        {toTitleCase(wallet.custodyType)} | {wallet.recentIntentCount} linked
                        intents
                      </p>
                      <p className="muted">
                        Last activity{" "}
                        {wallet.lastActivityAt
                          ? formatDateTime(wallet.lastActivityAt)
                          : "No linked activity"}
                      </p>
                      {wallet.customerAssignment ? (
                        <p className="muted">
                          Linked customer {wallet.customerAssignment.email ?? "No email"} |{" "}
                          {wallet.customerAssignment.customerAccountId}
                        </p>
                      ) : null}
                    </article>
                  ))}
                  {treasuryOverviewQuery.data.wallets.length === 0 ? (
                    <p>No treasury wallets were found on the product chain.</p>
                  ) : null}
                </div>
              </section>

              <section className="panel">
                <div className="section-heading compact">
                  <div>
                    <p className="section-kicker">Recent Activity</p>
                    <h2>Treasury-linked transaction activity</h2>
                  </div>
                </div>
                <div className="list-stack">
                  {treasuryOverviewQuery.data.recentActivity.map((activity) => (
                    <article className="list-card" key={activity.transactionIntentId}>
                      <div className="list-card-topline">
                        <strong>{toTitleCase(activity.intentType)}</strong>
                        <span className={`status-pill ${activity.status}`}>
                          {toTitleCase(activity.status)}
                        </span>
                      </div>
                      <p>
                        {activity.asset.symbol} {activity.requestedAmount}
                        {activity.settledAmount
                          ? ` | Settled ${activity.settledAmount}`
                          : ""}
                      </p>
                      <p className="muted">
                        Source {activity.sourceWallet?.address ?? "None"} | Destination{" "}
                        {activity.destinationWallet?.address ??
                          activity.externalAddress ??
                          "None"}
                      </p>
                      <p className="muted">
                        Created {formatDateTime(activity.createdAt)} | Policy{" "}
                        {toTitleCase(activity.policyDecision)}
                      </p>
                      {activity.latestBlockchainTransaction ? (
                        <p className="muted">
                          Tx {activity.latestBlockchainTransaction.txHash ?? "Pending hash"} |{" "}
                          {toTitleCase(activity.latestBlockchainTransaction.status)}
                        </p>
                      ) : null}
                    </article>
                  ))}
                  {treasuryOverviewQuery.data.recentActivity.length === 0 ? (
                    <p>No treasury-linked activity was found in recent intents.</p>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="workspace-grid">
              <section className="panel">
                <div className="section-heading compact">
                  <div>
                    <p className="section-kicker">Managed Workers</p>
                    <h2>Managed execution coverage</h2>
                  </div>
                </div>
                <div className="list-stack">
                  {treasuryOverviewQuery.data.managedWorkers.map((worker) => (
                    <article className="list-card" key={worker.workerId}>
                      <div className="list-card-topline">
                        <strong>{worker.workerId}</strong>
                        <span className={`status-pill ${worker.healthStatus}`}>
                          {toTitleCase(worker.healthStatus)}
                        </span>
                      </div>
                      <p>
                        {toTitleCase(worker.environment)} | Last heartbeat{" "}
                        {formatDateTime(worker.lastHeartbeatAt)}
                      </p>
                      <p className="muted">
                        Iteration {toTitleCase(worker.lastIterationStatus)} | Failures{" "}
                        {worker.consecutiveFailureCount}
                      </p>
                      {worker.lastErrorMessage ? (
                        <p className="muted">{worker.lastErrorMessage}</p>
                      ) : null}
                    </article>
                  ))}
                  {treasuryOverviewQuery.data.managedWorkers.length === 0 ? (
                    <p>No managed workers are currently registered.</p>
                  ) : null}
                </div>
              </section>

              <section className="panel">
                <div className="section-heading compact">
                  <div>
                    <p className="section-kicker">Treasury Alerts</p>
                    <h2>Open treasury alerts</h2>
                  </div>
                </div>
                <div className="list-stack">
                  {treasuryOverviewQuery.data.recentAlerts.map((alert) => (
                    <article className="list-card" key={alert.id}>
                      <div className="list-card-topline">
                        <strong>{alert.code}</strong>
                        <span className={`status-pill ${alert.severity}`}>
                          {toTitleCase(alert.severity)}
                        </span>
                      </div>
                      <p>{alert.summary}</p>
                      <p className="muted">
                        Last detected {formatDateTime(alert.lastDetectedAt)}
                      </p>
                      {alert.detail ? <p className="muted">{alert.detail}</p> : null}
                    </article>
                  ))}
                  {treasuryOverviewQuery.data.recentAlerts.length === 0 ? (
                    <p>No open treasury alerts.</p>
                  ) : null}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </section>

      <div className="workspace-grid">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Ledger Repair</p>
              <h2>Ledger reconciliation</h2>
            </div>
          </div>

          <div className="split-form">
            <label>
              Scan scope
              <select
                value={scanScope}
                onChange={(event) =>
                  setScanScope(
                    event.target.value as "" | "transaction_intent" | "customer_balance"
                  )
                }
              >
                <option value="">All scopes</option>
                <option value="transaction_intent">Transaction intent</option>
                <option value="customer_balance">Customer balance</option>
              </select>
            </label>
            <label>
              Customer account id
              <input
                value={scanCustomerAccountId}
                onChange={(event) => setScanCustomerAccountId(event.target.value)}
                placeholder="account_1"
              />
            </label>
            <label>
              Transaction intent id
              <input
                value={scanTransactionIntentId}
                onChange={(event) => setScanTransactionIntentId(event.target.value)}
                placeholder="intent_1"
              />
            </label>
            <button
              className="button primary"
              disabled={!operatorSession || pendingAction !== null}
              onClick={() => void handleRunReconciliationScan()}
              type="button"
            >
              Run scan
            </button>
          </div>

          <div className="list-stack">
            {ledgerReconciliationMismatchesQuery.isLoading ? (
              <p>Loading mismatches...</p>
            ) : null}
            {ledgerReconciliationMismatchesQuery.data?.mismatches.map((mismatch) => (
              <button
                key={mismatch.id}
                className={`list-card ${
                  selectedMismatchId === mismatch.id ? "selected" : ""
                }`}
                onClick={() => setSelectedMismatchId(mismatch.id)}
                type="button"
              >
                <div className="list-card-topline">
                  <strong>{toTitleCase(mismatch.scope)}</strong>
                  <span className={`status-pill ${mismatch.severity}`}>
                    {toTitleCase(mismatch.severity)}
                  </span>
                </div>
                <p>{mismatch.summary}</p>
                <p className="muted">
                  Action {toTitleCase(mismatch.recommendedAction)} |{" "}
                  {mismatch.asset?.symbol ?? "No asset"} |{" "}
                  {mismatch.customer?.email ?? mismatch.customerAccount?.customerAccountId ?? "No customer"}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Mismatch Workspace</p>
              <h2>Selected mismatch</h2>
            </div>
          </div>

          {!selectedMismatchId ? (
            <p>Select a mismatch to inspect current evidence and repair options.</p>
          ) : null}
          {ledgerReconciliationWorkspaceQuery.isLoading ? (
            <p>Loading mismatch workspace...</p>
          ) : null}
          {ledgerReconciliationWorkspaceQuery.data ? (
            <div className="detail-stack">
              <SummaryGrid
                items={[
                  ["Mismatch", ledgerReconciliationWorkspaceQuery.data.mismatch.id],
                  ["Scope", toTitleCase(ledgerReconciliationWorkspaceQuery.data.mismatch.scope)],
                  ["Status", toTitleCase(ledgerReconciliationWorkspaceQuery.data.mismatch.status)],
                  ["Severity", toTitleCase(ledgerReconciliationWorkspaceQuery.data.mismatch.severity)],
                  [
                    "Customer",
                    formatName(
                      ledgerReconciliationWorkspaceQuery.data.mismatch.customer?.firstName,
                      ledgerReconciliationWorkspaceQuery.data.mismatch.customer?.lastName
                    ) || "Unknown"
                  ],
                  [
                    "Email",
                    ledgerReconciliationWorkspaceQuery.data.mismatch.customer?.email ??
                      "Not available"
                  ],
                  [
                    "Asset",
                    ledgerReconciliationWorkspaceQuery.data.mismatch.asset?.symbol ??
                      "Not available"
                  ],
                  [
                    "Linked review",
                    ledgerReconciliationWorkspaceQuery.data.mismatch.linkedReviewCase
                      ?.reviewCaseId ?? "None"
                  ]
                ]}
              />

              <div className="action-grid four-up">
                <button
                  className="button"
                  disabled={
                    !operatorSession ||
                    pendingAction !== null ||
                    ledgerReconciliationWorkspaceQuery.data.mismatch.recommendedAction !==
                      "replay_confirm"
                  }
                  onClick={() =>
                    executeAction(
                      "replay-confirm-mismatch",
                      "Confirm replay completed.",
                      async () => {
                        await replayConfirmMismatch(
                          operatorSession!,
                          selectedMismatchId!,
                          trimToUndefined(mismatchActionNote)
                        );
                        setMismatchActionNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Replay confirm
                </button>
                <button
                  className="button"
                  disabled={
                    !operatorSession ||
                    pendingAction !== null ||
                    ledgerReconciliationWorkspaceQuery.data.mismatch.recommendedAction !==
                      "replay_settle"
                  }
                  onClick={() =>
                    executeAction(
                      "replay-settle-mismatch",
                      "Settlement replay completed.",
                      async () => {
                        await replaySettleMismatch(
                          operatorSession!,
                          selectedMismatchId!,
                          trimToUndefined(mismatchActionNote)
                        );
                        setMismatchActionNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Replay settle
                </button>
                <button
                  className="button primary"
                  disabled={
                    !operatorSession ||
                    pendingAction !== null ||
                    ledgerReconciliationWorkspaceQuery.data.mismatch.recommendedAction !==
                      "open_review_case"
                  }
                  onClick={() =>
                    executeAction(
                      "open-mismatch-review-case",
                      "Reconciliation review case opened.",
                      async () => {
                        await openLedgerReconciliationReviewCase(
                          operatorSession!,
                          selectedMismatchId!,
                          trimToUndefined(mismatchActionNote)
                        );
                        setMismatchActionNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Open review case
                </button>
                <button
                  className="button"
                  disabled={
                    !operatorSession ||
                    pendingAction !== null ||
                    ledgerReconciliationWorkspaceQuery.data.mismatch.recommendedAction !==
                      "repair_customer_balance"
                  }
                  onClick={() =>
                    executeAction(
                      "repair-customer-balance",
                      "Customer balance projection repaired.",
                      async () => {
                        await repairLedgerCustomerBalance(
                          operatorSession!,
                          selectedMismatchId!,
                          trimToUndefined(mismatchActionNote)
                        );
                        setMismatchActionNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Repair balance
                </button>
              </div>

              <div className="form-grid">
                <label>
                  Action note
                  <textarea
                    value={mismatchActionNote}
                    onChange={(event) => setMismatchActionNote(event.target.value)}
                    placeholder="Capture repair rationale, verification notes, or why the mismatch was dismissed."
                  />
                </label>
                <button
                  className="button danger"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction(
                      "dismiss-ledger-mismatch",
                      "Mismatch dismissed.",
                      async () => {
                        await dismissLedgerReconciliationMismatch(
                          operatorSession!,
                          selectedMismatchId!,
                          trimToUndefined(mismatchActionNote)
                        );
                        setMismatchActionNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Dismiss mismatch
                </button>
              </div>

              <div className="detail-note">
                <strong>Recommended action</strong>
                <p>
                  {toTitleCase(
                    ledgerReconciliationWorkspaceQuery.data.mismatch.recommendedAction
                  )}
                </p>
                <p className="muted">
                  Reason code {ledgerReconciliationWorkspaceQuery.data.mismatch.reasonCode} |
                  Detected {formatDateTime(
                    ledgerReconciliationWorkspaceQuery.data.mismatch.lastDetectedAt
                  )}
                </p>
              </div>

              <div className="two-column">
                <JsonPanel
                  title="Stored mismatch snapshot"
                  value={ledgerReconciliationWorkspaceQuery.data.mismatch.latestSnapshot}
                />
                <JsonPanel
                  title="Current live snapshot"
                  value={ledgerReconciliationWorkspaceQuery.data.currentSnapshot}
                />
                <ListBlock
                  title="Recent audit events"
                  emptyLabel="No audit events linked to this mismatch."
                  items={ledgerReconciliationWorkspaceQuery.data.recentAuditEvents.map(
                    (event) => (
                      <li key={event.id}>
                        <strong>{toTitleCase(event.action)}</strong>
                        <span>
                          {event.actorId ?? event.actorType} |{" "}
                          {formatDateTime(event.createdAt)}
                        </span>
                      </li>
                    )
                  )}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Audit Trail</p>
            <h2>Platform audit log</h2>
          </div>
          <p className="section-copy">
            Cross-domain operator, worker, customer, and system events without
            direct database access.
          </p>
        </div>

        <div className="split-form">
          <label>
            Search
            <input
              value={auditSearch}
              onChange={(event) => setAuditSearch(event.target.value)}
              placeholder="Action, actor id, target id, or customer email"
            />
          </label>
          <label>
            Actor type
            <select
              value={auditActorType}
              onChange={(event) => setAuditActorType(event.target.value)}
            >
              {auditActorTypeOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option ? toTitleCase(option) : "All actors"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target type
            <select
              value={auditTargetType}
              onChange={(event) => setAuditTargetType(event.target.value)}
            >
              {auditTargetTypeOptions.map((option) => (
                <option key={option || "all"} value={option}>
                  {option ? option : "All targets"}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="list-stack">
          {auditEventsQuery.isLoading ? <p>Loading audit log...</p> : null}
          {auditEventsQuery.data?.events.map((event) => {
            const customerLabel = event.customer
              ? event.customer.email ??
                formatName(event.customer.firstName, event.customer.lastName) ??
                event.customer.supabaseUserId ??
                event.customer.customerId
              : "No linked customer";
            const metadataPreview = event.metadata
              ? shortenValue(JSON.stringify(event.metadata), 220)
              : null;

            return (
              <article className="list-card" key={event.id}>
                <div className="list-card-topline">
                  <strong>{event.action}</strong>
                  <span>{formatDateTime(event.createdAt)}</span>
                </div>
                <p>
                  {event.targetType}
                  {event.targetId ? ` ${shortenValue(event.targetId, 30)}` : ""}
                </p>
                <p className="muted">
                  Actor {event.actorType}
                  {event.actorId ? `:${event.actorId}` : ""} | Customer{" "}
                  {customerLabel}
                </p>
                {metadataPreview ? <p className="muted">{metadataPreview}</p> : null}
                {event.metadata ? (
                  <details>
                    <summary>Metadata</summary>
                    <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                  </details>
                ) : null}
              </article>
            );
          })}
          {auditEventsQuery.data && auditEventsQuery.data.events.length === 0 ? (
            <p>No audit events matched the current filters.</p>
          ) : null}
        </div>
      </section>

      <div className="workspace-grid">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Platform Alerts</p>
              <h2>Open operational alerts</h2>
            </div>
            <button
              className="button primary"
              disabled={
                !operatorSession ||
                pendingAction !== null ||
                unroutedCriticalPlatformAlertCount === 0
              }
              onClick={() =>
                executeAction(
                  "route-critical-platform-alerts",
                  "Critical platform alerts routed.",
                  async () => {
                    const result = await routeCriticalPlatformAlerts(operatorSession!, {
                      limit: 10,
                      staleAfterSeconds: 180
                    });
                    setSelectedReviewCaseId(result.routedAlerts[0]?.reviewCase.id ?? null);
                  }
                )
              }
              type="button"
            >
              Route critical alerts
            </button>
          </div>

          <div className="list-stack">
            {platformAlertsQuery.isLoading ? <p>Loading platform alerts...</p> : null}
            {platformAlertsQuery.data?.alerts.map((alert) => {
              const runbookPath =
                alert.metadata &&
                typeof alert.metadata === "object" &&
                !Array.isArray(alert.metadata) &&
                typeof alert.metadata.runbookPath === "string"
                  ? alert.metadata.runbookPath
                  : null;

              return (
                <article className="list-card" key={alert.id}>
                  <div className="list-card-topline">
                    <strong>{toTitleCase(alert.category)}</strong>
                    <span className={`status-pill ${alert.severity}`}>
                      {toTitleCase(alert.severity)}
                    </span>
                  </div>
                  <p>{alert.summary}</p>
                  <p className="muted">
                    Code {alert.code} | Last detected {formatDateTime(alert.lastDetectedAt)}
                  </p>
                  {alert.detail ? <p className="muted">{alert.detail}</p> : null}
                  <p className="muted">
                    Routing{" "}
                    {alert.routingStatus === "routed"
                      ? `routed${
                          alert.routedAt
                            ? ` ${formatDateTime(alert.routedAt)}`
                            : ""
                        }${
                          alert.routedByOperatorId
                            ? ` by ${alert.routedByOperatorId}`
                            : " automatically"
                        }`
                      : "pending"}
                    {alert.routingTargetId ? ` | Review case ${alert.routingTargetId}` : ""}
                  </p>
                  {alert.routingNote ? (
                    <p className="muted">Routing note {alert.routingNote}</p>
                  ) : null}
                  <p className="muted">
                    Owner{" "}
                    {alert.ownerOperatorId
                      ? `${alert.ownerOperatorId}${
                          alert.ownerAssignedAt
                            ? ` since ${formatDateTime(alert.ownerAssignedAt)}`
                            : ""
                        }`
                      : "unassigned"}
                  </p>
                  <p className="muted">
                    Acknowledgement{" "}
                    {alert.isAcknowledged
                      ? `acknowledged${
                          alert.acknowledgedAt
                            ? ` ${formatDateTime(alert.acknowledgedAt)}`
                            : ""
                        }${alert.acknowledgedByOperatorId ? ` by ${alert.acknowledgedByOperatorId}` : ""}`
                      : "pending"}
                  </p>
                  <p className="muted">
                    Suppression{" "}
                    {alert.hasActiveSuppression && alert.suppressedUntil
                      ? `active until ${formatDateTime(alert.suppressedUntil)}${
                          alert.suppressedByOperatorId
                            ? ` by ${alert.suppressedByOperatorId}`
                            : ""
                        }`
                      : "inactive"}
                  </p>
                  <p className="muted">
                    External delivery{" "}
                    {alert.deliverySummary.totalCount > 0
                      ? `${alert.deliverySummary.lastEventType ?? "opened"} ${
                          alert.deliverySummary.lastStatus ?? "pending"
                        }${
                          alert.deliverySummary.lastTargetName
                            ? ` via ${alert.deliverySummary.lastTargetName}`
                            : ""
                        } | failed ${alert.deliverySummary.failedCount} | pending ${
                          alert.deliverySummary.pendingCount
                        } | failover escalations ${alert.deliverySummary.escalatedCount} | re-escalations ${
                          alert.deliverySummary.reEscalationCount
                        } | highest level ${
                          alert.deliverySummary.highestEscalationLevel
                        }`
                      : "no matching targets configured"}
                  </p>
                  {alert.deliverySummary.lastEscalatedFromTargetName ? (
                    <p className="muted">
                      Latest failover came from{" "}
                      {alert.deliverySummary.lastEscalatedFromTargetName}
                    </p>
                  ) : null}
                  {alert.deliverySummary.lastErrorMessage ? (
                    <p className="muted">
                      Delivery error {alert.deliverySummary.lastErrorMessage}
                    </p>
                  ) : null}
                  {runbookPath ? <p className="muted">Runbook {runbookPath}</p> : null}
                  <div className="action-grid">
                    <button
                      className="button"
                      disabled={!operatorSession || pendingAction !== null}
                      onClick={() =>
                        executeAction(
                          `claim-platform-alert-${alert.id}`,
                          "Platform alert owner assigned.",
                          async () => {
                            await assignPlatformAlertOwner(
                              operatorSession!,
                              alert.id,
                              operatorSession!.operatorId
                            );
                          }
                        )
                      }
                      type="button"
                    >
                      Claim owner
                    </button>
                    <button
                      className="button"
                      disabled={!operatorSession || pendingAction !== null}
                      onClick={() =>
                        executeAction(
                          `ack-platform-alert-${alert.id}`,
                          "Platform alert acknowledged.",
                          async () => {
                            await acknowledgePlatformAlert(operatorSession!, alert.id);
                          }
                        )
                      }
                      type="button"
                    >
                      Acknowledge
                    </button>
                    <button
                      className="button"
                      disabled={!operatorSession || pendingAction !== null}
                      onClick={() =>
                        executeAction(
                          `suppress-platform-alert-${alert.id}`,
                          "Platform alert suppressed for one hour.",
                          async () => {
                            await suppressPlatformAlert(
                              operatorSession!,
                              alert.id,
                              new Date(Date.now() + 60 * 60 * 1000).toISOString()
                            );
                          }
                        )
                      }
                      type="button"
                    >
                      Suppress 1h
                    </button>
                    <button
                      className="button"
                      disabled={!operatorSession || pendingAction !== null}
                      onClick={() =>
                        executeAction(
                          `clear-platform-alert-suppression-${alert.id}`,
                          "Platform alert suppression cleared.",
                          async () => {
                            await clearPlatformAlertSuppression(
                              operatorSession!,
                              alert.id
                            );
                          }
                        )
                      }
                      type="button"
                    >
                      Clear suppression
                    </button>
                    <button
                      className="button"
                      disabled={!operatorSession || pendingAction !== null}
                      onClick={() =>
                        executeAction(
                          `retry-platform-alert-deliveries-${alert.id}`,
                          "Failed platform alert deliveries queued for retry.",
                          async () => {
                            await retryPlatformAlertDeliveries(
                              operatorSession!,
                              alert.id
                            );
                          }
                        )
                      }
                      type="button"
                    >
                      Retry deliveries
                    </button>
                    <button
                      className="button primary"
                      disabled={!operatorSession || pendingAction !== null}
                      onClick={() =>
                        executeAction(
                          `route-platform-alert-${alert.id}`,
                          alert.routingStatus === "routed"
                            ? "Platform alert rerouted to review case."
                            : "Platform alert routed to review case.",
                          async () => {
                            const result = await routePlatformAlertToReviewCase(
                              operatorSession!,
                              alert.id
                            );
                            setSelectedReviewCaseId(result.reviewCase.id);
                          }
                        )
                      }
                      type="button"
                    >
                      {alert.routingStatus === "routed"
                        ? "Route again"
                        : "Route review case"}
                    </button>
                    <button
                      className="button"
                      disabled={
                        !alert.routingTargetId || !operatorSession || pendingAction !== null
                      }
                      onClick={() => {
                        startTransition(() => {
                          setSelectedReviewCaseId(alert.routingTargetId);
                        });
                      }}
                      type="button"
                    >
                      Inspect review case
                    </button>
                  </div>
                </article>
              );
            })}
            {platformAlertsQuery.data &&
            platformAlertsQuery.data.alerts.length === 0 ? (
              <p>No open platform alerts.</p>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Worker Health</p>
              <h2>Worker runtime status</h2>
            </div>
          </div>

          <div className="list-stack">
            {workerRuntimeHealthQuery.isLoading ? <p>Loading worker health...</p> : null}
            {workerRuntimeHealthQuery.data?.workers.map((worker) => (
              <article className="list-card" key={worker.workerId}>
                <div className="list-card-topline">
                  <strong>{worker.workerId}</strong>
                  <span className={`status-pill ${worker.healthStatus}`}>
                    {toTitleCase(worker.healthStatus)}
                  </span>
                </div>
                <p>
                  {toTitleCase(worker.executionMode)} | Last heartbeat{" "}
                  {formatDateTime(worker.lastHeartbeatAt)}
                </p>
                <p className="muted">
                  Iteration {toTitleCase(worker.lastIterationStatus)} | Failures{" "}
                  {worker.consecutiveFailureCount}
                </p>
                <p className="muted">
                  Latest scan {toTitleCase(worker.lastReconciliationScanStatus)} | Run{" "}
                  {worker.lastReconciliationScanRunId ?? "None"}
                </p>
                <p className="muted">
                  Queued deposits{" "}
                  {typeof worker.latestIterationMetrics === "object" &&
                  worker.latestIterationMetrics &&
                  !Array.isArray(worker.latestIterationMetrics) &&
                  typeof worker.latestIterationMetrics.queuedDepositCount ===
                    "number"
                    ? worker.latestIterationMetrics.queuedDepositCount
                    : 0}{" "}
                  | Manual withdrawals{" "}
                  {typeof worker.latestIterationMetrics === "object" &&
                  worker.latestIterationMetrics &&
                  !Array.isArray(worker.latestIterationMetrics) &&
                  typeof worker.latestIterationMetrics
                    .manualWithdrawalBacklogCount === "number"
                    ? worker.latestIterationMetrics.manualWithdrawalBacklogCount
                    : 0}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Scan History</p>
              <h2>Recent reconciliation runs</h2>
            </div>
          </div>

          <div className="list-stack">
            {ledgerReconciliationRunsQuery.isLoading ? <p>Loading scan history...</p> : null}
            {ledgerReconciliationRunsQuery.data?.runs.map((run) => (
              <article className="list-card" key={run.id}>
                <div className="list-card-topline">
                  <strong>{run.id}</strong>
                  <span className={`status-pill ${run.status}`}>
                    {toTitleCase(run.status)}
                  </span>
                </div>
                <p>
                  {toTitleCase(run.triggerSource)} | Scope{" "}
                  {toTitleCase(run.requestedScope ?? "all_scopes")}
                </p>
                <p className="muted">
                  Started {formatDateTime(run.startedAt)} | Duration{" "}
                  {run.durationMs ? formatDuration(run.durationMs) : "Open"}
                </p>
                <p className="muted">
                  Created {run.createdCount} | Reopened {run.reopenedCount} | Active{" "}
                  {run.activeMismatchCount}
                </p>
                {run.errorMessage ? (
                  <p className="muted">Failure: {run.errorMessage}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="workspace-grid">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Review Queue</p>
              <h2>Review cases</h2>
            </div>
          </div>
          <div className="list-stack">
            {reviewCasesQuery.isLoading ? <p>Loading review cases...</p> : null}
            {reviewCasesQuery.data?.reviewCases.map((reviewCase) => (
              <button
                key={reviewCase.id}
                className={`list-card ${
                  selectedReviewCaseId === reviewCase.id ? "selected" : ""
                }`}
                onClick={() => setSelectedReviewCaseId(reviewCase.id)}
                type="button"
              >
                <div className="list-card-topline">
                  <strong>{toTitleCase(reviewCase.type)}</strong>
                  <span className={`status-pill ${reviewCase.status}`}>
                    {toTitleCase(reviewCase.status)}
                  </span>
                </div>
                <p>{formatName(reviewCase.customer.firstName, reviewCase.customer.lastName)}</p>
                <p className="muted">{reviewCase.customer.email ?? "No email"}</p>
                <p className="muted">Intent: {reviewCase.transactionIntent?.id ?? "None"}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Review Workspace</p>
              <h2>Selected review case</h2>
            </div>
          </div>

          {!selectedReviewCaseId ? <p>Select a review case to inspect its workspace.</p> : null}
          {reviewWorkspaceQuery.isLoading ? <p>Loading review workspace...</p> : null}
          {reviewWorkspaceQuery.data ? (
            <div className="detail-stack">
              <SummaryGrid
                items={[
                  ["Case", reviewWorkspaceQuery.data.reviewCase.id],
                  ["Customer", formatName(reviewWorkspaceQuery.data.reviewCase.customer.firstName, reviewWorkspaceQuery.data.reviewCase.customer.lastName)],
                  ["Email", reviewWorkspaceQuery.data.reviewCase.customer.email ?? "Not available"],
                  ["Status", toTitleCase(reviewWorkspaceQuery.data.reviewCase.status)],
                  ["Reason", toTitleCase(reviewWorkspaceQuery.data.reviewCase.reasonCode)],
                  ["Assigned", reviewWorkspaceQuery.data.reviewCase.assignedOperatorId ?? "Unassigned"],
                  ["Opened", formatDateTime(reviewWorkspaceQuery.data.reviewCase.createdAt)],
                  ["Started", formatDateTime(reviewWorkspaceQuery.data.reviewCase.startedAt)]
                ]}
              />

              <div className="action-grid">
                <button
                  className="button primary"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction("start-review", "Review case started.", async () => {
                      await startReviewCase(operatorSession!, selectedReviewCaseId!);
                    })
                  }
                  type="button"
                >
                  Start
                </button>
                <button
                  className="button"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction("resolve-review", "Review case resolved.", async () => {
                      await resolveReviewCase(
                        operatorSession!,
                        selectedReviewCaseId!,
                        trimToUndefined(reviewResolutionNote)
                      );
                      setReviewResolutionNote("");
                    })
                  }
                  type="button"
                >
                  Resolve
                </button>
                <button
                  className="button danger"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction("dismiss-review", "Review case dismissed.", async () => {
                      await dismissReviewCase(
                        operatorSession!,
                        selectedReviewCaseId!,
                        trimToUndefined(reviewDismissNote)
                      );
                      setReviewDismissNote("");
                    })
                  }
                  type="button"
                >
                  Dismiss
                </button>
              </div>

              <div className="form-grid">
                <label>
                  Add note
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="Capture the investigation trail."
                  />
                </label>
                <button
                  className="button primary"
                  disabled={!operatorSession || pendingAction !== null || reviewNote.trim().length === 0}
                  onClick={() =>
                    executeAction("note-review", "Review note added.", async () => {
                      await addReviewCaseNote(
                        operatorSession!,
                        selectedReviewCaseId!,
                        reviewNote.trim()
                      );
                      setReviewNote("");
                    })
                  }
                  type="button"
                >
                  Save note
                </button>
              </div>

              <div className="split-form">
                <label>
                  Handoff to operator
                  <input
                    value={handoffOperatorId}
                    onChange={(event) => setHandoffOperatorId(event.target.value)}
                    placeholder="ops_2"
                  />
                </label>
                <label>
                  Handoff note
                  <input
                    value={handoffNote}
                    onChange={(event) => setHandoffNote(event.target.value)}
                    placeholder="Why ownership is moving"
                  />
                </label>
                <button
                  className="button"
                  disabled={
                    !operatorSession ||
                    pendingAction !== null ||
                    handoffOperatorId.trim().length === 0
                  }
                  onClick={() =>
                    executeAction("handoff-review", "Review case handed off.", async () => {
                      await handoffReviewCase(
                        operatorSession!,
                        selectedReviewCaseId!,
                        handoffOperatorId.trim(),
                        trimToUndefined(handoffNote)
                      );
                      setHandoffOperatorId("");
                      setHandoffNote("");
                    })
                  }
                  type="button"
                >
                  Handoff
                </button>
              </div>

              <div className="split-form">
                <label>
                  Manual resolution reason
                  <input
                    value={manualResolutionReasonCode}
                    onChange={(event) =>
                      setManualResolutionReasonCode(event.target.value)
                    }
                  />
                </label>
                <label>
                  Manual resolution note
                  <input
                    value={manualResolutionNote}
                    onChange={(event) => setManualResolutionNote(event.target.value)}
                    placeholder="Document the off-platform resolution"
                  />
                </label>
                <button
                  className="button"
                  disabled={
                    !operatorSession ||
                    pendingAction !== null ||
                    manualResolutionReasonCode.trim().length === 0
                  }
                  onClick={() =>
                    executeAction(
                      "manual-resolution",
                      "Manual resolution applied.",
                      async () => {
                        await applyManualResolution(
                          operatorSession!,
                          selectedReviewCaseId!,
                          manualResolutionReasonCode.trim(),
                          trimToUndefined(manualResolutionNote)
                        );
                        setManualResolutionNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Apply manual resolution
                </button>
              </div>

              <div className="detail-note">
                <strong>Manual resolution eligibility</strong>
                <p>
                  {reviewWorkspaceQuery.data.manualResolutionEligibility.reason}
                </p>
                <p className="muted">
                  Recommended action:{" "}
                  {toTitleCase(
                    reviewWorkspaceQuery.data.manualResolutionEligibility.recommendedAction
                  )}{" "}
                  | Allowed roles:{" "}
                  {reviewWorkspaceQuery.data.manualResolutionEligibility.allowedOperatorRoles
                    .map(toTitleCase)
                    .join(", ")}
                </p>
              </div>

              <div className="split-form">
                <label>
                  Account release request note
                  <input
                    value={releaseRequestNote}
                    onChange={(event) => setReleaseRequestNote(event.target.value)}
                    placeholder="Why the hold should be reviewed"
                  />
                </label>
                <button
                  className="button"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction(
                      "request-account-release",
                      "Account release request submitted.",
                      async () => {
                        await requestAccountRelease(
                          operatorSession!,
                          selectedReviewCaseId!,
                          trimToUndefined(releaseRequestNote)
                        );
                        setReleaseRequestNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Request account release
                </button>
              </div>

              <div className="two-column">
                <ListBlock
                  title="Customer balances"
                  emptyLabel="No balance projections attached."
                  items={reviewWorkspaceQuery.data.balances.map((balance) => (
                    <li key={balance.asset.id}>
                      <strong>{balance.asset.symbol}</strong>
                      <span>
                        Available {balance.availableBalance} | Pending{" "}
                        {balance.pendingBalance}
                      </span>
                    </li>
                  ))}
                />
                <ListBlock
                  title="Recent intents"
                  emptyLabel="No recent intents available."
                  items={reviewWorkspaceQuery.data.recentIntents.map((intent) => (
                    <li key={intent.id}>
                      <strong>{toTitleCase(intent.intentType)}</strong>
                      <span>
                        {intent.asset.symbol} {intent.requestedAmount} |{" "}
                        {toTitleCase(intent.status)}
                      </span>
                    </li>
                  ))}
                />
                <ListBlock
                  title="Case events"
                  emptyLabel="No case events yet."
                  items={reviewWorkspaceQuery.data.caseEvents.map((event) => (
                    <li key={event.id}>
                      <strong>{toTitleCase(event.eventType)}</strong>
                      <span>
                        {event.actorId ?? "system"} | {formatDateTime(event.createdAt)}
                      </span>
                    </li>
                  ))}
                />
                <ListBlock
                  title="Related audit events"
                  emptyLabel="No audit trail entries linked."
                  items={reviewWorkspaceQuery.data.relatedTransactionAuditEvents.map(
                    (event) => (
                      <li key={event.id}>
                        <strong>{toTitleCase(event.action)}</strong>
                        <span>
                          {event.actorId ?? "system"} | {formatDateTime(event.createdAt)}
                        </span>
                      </li>
                    )
                  )}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="workspace-grid">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Oversight Queue</p>
              <h2>Oversight incidents</h2>
            </div>
          </div>
          <div className="list-stack">
            {oversightIncidentsQuery.isLoading ? <p>Loading oversight incidents...</p> : null}
            {oversightIncidentsQuery.data?.oversightIncidents.map((incident) => (
              <button
                key={incident.id}
                className={`list-card ${
                  selectedOversightIncidentId === incident.id ? "selected" : ""
                }`}
                onClick={() => setSelectedOversightIncidentId(incident.id)}
                type="button"
              >
                <div className="list-card-topline">
                  <strong>{toTitleCase(incident.incidentType)}</strong>
                  <span className={`status-pill ${incident.status}`}>
                    {toTitleCase(incident.status)}
                  </span>
                </div>
                <p>{formatName(incident.subjectCustomer.firstName, incident.subjectCustomer.lastName)}</p>
                <p className="muted">
                  {incident.subjectCustomer.email ?? incident.subjectOperatorId ?? "No subject"}
                </p>
              </button>
            ))}
          </div>

          <ListBlock
            title="Oversight alerts"
            emptyLabel="No oversight alerts in the current window."
            items={
              oversightAlertsQuery.data?.alerts.map((alert, index) => (
                <li key={`${alert.incidentType}-${index}`}>
                  <strong>{toTitleCase(alert.incidentType)}</strong>
                  <span>
                    Count {formatCount(alert.count)} / Threshold {formatCount(alert.threshold)}
                  </span>
                </li>
              )) ?? []
            }
          />
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Oversight Workspace</p>
              <h2>Selected incident</h2>
            </div>
          </div>

          {!selectedOversightIncidentId ? (
            <p>Select an oversight incident to inspect governance and history.</p>
          ) : null}
          {oversightWorkspaceQuery.isLoading ? <p>Loading oversight workspace...</p> : null}
          {oversightWorkspaceQuery.data ? (
            <div className="detail-stack">
              <SummaryGrid
                items={[
                  ["Incident", oversightWorkspaceQuery.data.oversightIncident.id],
                  ["Type", toTitleCase(oversightWorkspaceQuery.data.oversightIncident.incidentType)],
                  ["Status", toTitleCase(oversightWorkspaceQuery.data.oversightIncident.status)],
                  ["Customer", formatName(oversightWorkspaceQuery.data.oversightIncident.subjectCustomer.firstName, oversightWorkspaceQuery.data.oversightIncident.subjectCustomer.lastName)],
                  ["Email", oversightWorkspaceQuery.data.oversightIncident.subjectCustomer.email ?? "Not available"],
                  ["Assigned", oversightWorkspaceQuery.data.oversightIncident.assignedOperatorId ?? "Unassigned"],
                  ["Opened", formatDateTime(oversightWorkspaceQuery.data.oversightIncident.openedAt)],
                  ["Hold active", oversightWorkspaceQuery.data.accountRestriction.active ? "Yes" : "No"]
                ]}
              />

              <div className="action-grid">
                <button
                  className="button primary"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction("start-incident", "Oversight incident started.", async () => {
                      await startOversightIncident(
                        operatorSession!,
                        selectedOversightIncidentId!
                      );
                    })
                  }
                  type="button"
                >
                  Start
                </button>
                <button
                  className="button"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction(
                      "resolve-incident",
                      "Oversight incident resolved.",
                      async () => {
                        await resolveOversightIncident(
                          operatorSession!,
                          selectedOversightIncidentId!,
                          trimToUndefined(oversightResolutionNote)
                        );
                        setOversightResolutionNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Resolve
                </button>
                <button
                  className="button danger"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction(
                      "dismiss-incident",
                      "Oversight incident dismissed.",
                      async () => {
                        await dismissOversightIncident(
                          operatorSession!,
                          selectedOversightIncidentId!,
                          trimToUndefined(oversightDismissNote)
                        );
                        setOversightDismissNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Dismiss
                </button>
              </div>

              <div className="form-grid">
                <label>
                  Oversight note
                  <textarea
                    value={oversightNote}
                    onChange={(event) => setOversightNote(event.target.value)}
                    placeholder="Capture risk rationale and next checks."
                  />
                </label>
                <button
                  className="button primary"
                  disabled={!operatorSession || pendingAction !== null || oversightNote.trim().length === 0}
                  onClick={() =>
                    executeAction("note-incident", "Oversight note added.", async () => {
                      await addOversightIncidentNote(
                        operatorSession!,
                        selectedOversightIncidentId!,
                        oversightNote.trim()
                      );
                      setOversightNote("");
                    })
                  }
                  type="button"
                >
                  Save note
                </button>
              </div>

              <div className="split-form">
                <label>
                  Hold reason code
                  <input
                    value={holdReasonCode}
                    onChange={(event) => setHoldReasonCode(event.target.value)}
                  />
                </label>
                <label>
                  Hold note
                  <input
                    value={holdNote}
                    onChange={(event) => setHoldNote(event.target.value)}
                    placeholder="Temporary risk hold rationale"
                  />
                </label>
                <button
                  className="button"
                  disabled={
                    !operatorSession ||
                    pendingAction !== null ||
                    holdReasonCode.trim().length === 0
                  }
                  onClick={() =>
                    executeAction("apply-hold", "Account hold applied.", async () => {
                      await applyAccountRestriction(
                        operatorSession!,
                        selectedOversightIncidentId!,
                        holdReasonCode.trim(),
                        trimToUndefined(holdNote)
                      );
                      setHoldNote("");
                    })
                  }
                  type="button"
                >
                  Apply hold
                </button>
              </div>

              <div className="detail-note">
                <strong>Hold governance</strong>
                <p>
                  Apply hold:{" "}
                  {oversightWorkspaceQuery.data.accountHoldGovernance.canApplyAccountHold
                    ? "Allowed"
                    : "Blocked"}{" "}
                  | Release hold:{" "}
                  {oversightWorkspaceQuery.data.accountHoldGovernance.canReleaseAccountHold
                    ? "Allowed"
                    : "Blocked"}
                </p>
                <p className="muted">
                  Apply roles:{" "}
                  {oversightWorkspaceQuery.data.accountHoldGovernance.allowedApplyOperatorRoles
                    .map(toTitleCase)
                    .join(", ")}
                </p>
              </div>

              <div className="two-column">
                <ListBlock
                  title="Incident events"
                  emptyLabel="No incident events yet."
                  items={oversightWorkspaceQuery.data.events.map((event) => (
                    <li key={event.id}>
                      <strong>{toTitleCase(event.eventType)}</strong>
                      <span>
                        {event.actorId ?? "system"} | {formatDateTime(event.createdAt)}
                      </span>
                    </li>
                  ))}
                />
                <ListBlock
                  title="Recent manual resolutions"
                  emptyLabel="No manually resolved intents linked."
                  items={oversightWorkspaceQuery.data.recentManuallyResolvedIntents.map(
                    (intent) => (
                      <li key={intent.id}>
                        <strong>{intent.customer.email}</strong>
                        <span>
                          {toTitleCase(intent.intentType)} | {intent.asset.symbol}{" "}
                          {intent.requestedAmount}
                        </span>
                      </li>
                    )
                  )}
                />
                <ListBlock
                  title="Related review cases"
                  emptyLabel="No related review cases."
                  items={oversightWorkspaceQuery.data.recentReviewCases.map((reviewCase) => (
                    <li key={reviewCase.id}>
                      <strong>{reviewCase.id}</strong>
                      <span>
                        {toTitleCase(reviewCase.type)} | {toTitleCase(reviewCase.status)}
                      </span>
                    </li>
                  ))}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="workspace-grid">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Hold Reporting</p>
              <h2>Account holds</h2>
            </div>
          </div>

          <div className="metrics-grid compact">
            <MetricCard
              label="Total holds"
              value={accountHoldSummaryQuery.data?.totalHolds ?? 0}
              detail="Rolling window total"
            />
            <MetricCard
              label="Active"
              value={accountHoldSummaryQuery.data?.activeHolds ?? 0}
              detail="Still restricted"
            />
            <MetricCard
              label="Released"
              value={accountHoldSummaryQuery.data?.releasedHolds ?? 0}
              detail="Released via review"
            />
          </div>

          <ListBlock
            title="Active holds"
            emptyLabel="No active holds found."
            items={
              activeHoldsQuery.data?.holds.map((entry) => (
                <li key={entry.hold.id}>
                  <strong>{entry.customer.email}</strong>
                  <span>
                    {entry.hold.restrictionReasonCode} | Applied{" "}
                    {formatDateTime(entry.hold.appliedAt)}
                  </span>
                </li>
              )) ?? []
            }
          />
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Release Reviews</p>
              <h2>Pending account release decisions</h2>
            </div>
          </div>

          <div className="list-stack">
            {accountReleaseReviewsQuery.data?.reviews.map((review) => (
              <button
                key={review.reviewCase.id}
                className={`list-card ${
                  selectedAccountReleaseReviewId === review.reviewCase.id
                    ? "selected"
                    : ""
                }`}
                onClick={() => setSelectedAccountReleaseReviewId(review.reviewCase.id)}
                type="button"
              >
                <div className="list-card-topline">
                  <strong>{review.customer.email}</strong>
                  <span className="status-pill pending">
                    {toTitleCase(review.restriction.releaseDecisionStatus)}
                  </span>
                </div>
                <p>{review.reviewCase.id}</p>
                <p className="muted">
                  Hold {review.restriction.restrictionReasonCode} | Incident{" "}
                  {toTitleCase(review.oversightIncident.incidentType)}
                </p>
              </button>
            ))}
          </div>

          {selectedReleaseReview ? (
            <div className="detail-stack">
              <SummaryGrid
                items={[
                  ["Review case", selectedReleaseReview.reviewCase.id],
                  ["Customer", selectedReleaseReview.customer.email],
                  ["Hold", selectedReleaseReview.restriction.restrictionReasonCode],
                  ["Requested by", selectedReleaseReview.restriction.releaseRequestedByOperatorId ?? "Unknown"],
                  ["Decision status", toTitleCase(selectedReleaseReview.restriction.releaseDecisionStatus)],
                  ["Incident", selectedReleaseReview.oversightIncident.id]
                ]}
              />

              <label>
                Decision note
                <textarea
                  value={accountReleaseDecisionNote}
                  onChange={(event) => setAccountReleaseDecisionNote(event.target.value)}
                  placeholder="Reason for approving or denying the release"
                />
              </label>

              <div className="action-grid">
                <button
                  className="button primary"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction(
                      "approve-account-release",
                      "Account release approved.",
                      async () => {
                        await decideAccountRelease(
                          operatorSession!,
                          selectedReleaseReview.reviewCase.id,
                          "approved",
                          trimToUndefined(accountReleaseDecisionNote)
                        );
                        setAccountReleaseDecisionNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Approve release
                </button>
                <button
                  className="button danger"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction(
                      "deny-account-release",
                      "Account release denied.",
                      async () => {
                        await decideAccountRelease(
                          operatorSession!,
                          selectedReleaseReview.reviewCase.id,
                          "denied",
                          trimToUndefined(accountReleaseDecisionNote)
                        );
                        setAccountReleaseDecisionNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Deny release
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <div className="workspace-grid">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Export Governance</p>
              <h2>Create and inspect incident package exports</h2>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Customer account id
              <input
                value={packageDraft.customerAccountId}
                onChange={(event) =>
                  setPackageDraft((current) => ({
                    ...current,
                    customerAccountId: event.target.value
                  }))
                }
                placeholder="account_1"
              />
            </label>
            <label>
              Supabase user id
              <input
                value={packageDraft.supabaseUserId}
                onChange={(event) =>
                  setPackageDraft((current) => ({
                    ...current,
                    supabaseUserId: event.target.value
                  }))
                }
                placeholder="shared-login-admin"
              />
            </label>
          </div>

          <div className="split-form">
            <label>
              Export mode
              <select
                value={packageDraft.mode}
                onChange={(event) =>
                  setPackageDraft((current) => ({
                    ...current,
                    mode: event.target.value as PackageRequestDraft["mode"]
                  }))
                }
              >
                {exportModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {toTitleCase(mode)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Release target
              <select
                value={packageDraft.releaseTarget}
                onChange={(event) =>
                  setPackageDraft((current) => ({
                    ...current,
                    releaseTarget: event.target.value as PackageRequestDraft["releaseTarget"]
                  }))
                }
              >
                {releaseTargets.map((target) => (
                  <option key={target} value={target}>
                    {toTitleCase(target)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Release reason code
              <input
                value={packageDraft.releaseReasonCode}
                onChange={(event) =>
                  setPackageDraft((current) => ({
                    ...current,
                    releaseReasonCode: event.target.value
                  }))
                }
                placeholder="case_support_review"
              />
            </label>
          </div>

          <div className="split-form">
            <label>
              Recent limit
              <input
                value={packageDraft.recentLimit}
                onChange={(event) =>
                  setPackageDraft((current) => ({
                    ...current,
                    recentLimit: event.target.value
                  }))
                }
              />
            </label>
            <label>
              Timeline limit
              <input
                value={packageDraft.timelineLimit}
                onChange={(event) =>
                  setPackageDraft((current) => ({
                    ...current,
                    timelineLimit: event.target.value
                  }))
                }
              />
            </label>
            <label>
              Since days
              <input
                value={packageDraft.sinceDays}
                onChange={(event) =>
                  setPackageDraft((current) => ({
                    ...current,
                    sinceDays: event.target.value
                  }))
                }
              />
            </label>
          </div>

          <label>
            Request note
            <textarea
              value={packageDraft.requestNote}
              onChange={(event) =>
                setPackageDraft((current) => ({
                  ...current,
                  requestNote: event.target.value
                }))
              }
              placeholder="Why this export is needed"
            />
          </label>

          <div className="action-grid">
            <button
              className="button primary"
              disabled={!operatorSession || pendingAction !== null}
              onClick={() => void handleLoadPackagePreview()}
              type="button"
            >
              Preview governed export
            </button>
            <button
              className="button"
              disabled={
                !operatorSession ||
                pendingAction !== null ||
                packageDraft.releaseReasonCode.trim().length === 0
              }
              onClick={() =>
                executeAction(
                  "create-release-request",
                  "Incident package release request created.",
                  async () => {
                    await createIncidentPackageReleaseRequest(operatorSession!, {
                      customerAccountId: trimToUndefined(packageDraft.customerAccountId),
                      supabaseUserId: trimToUndefined(packageDraft.supabaseUserId),
                      mode: packageDraft.mode,
                      releaseTarget: packageDraft.releaseTarget,
                      releaseReasonCode: packageDraft.releaseReasonCode.trim(),
                      requestNote: trimToUndefined(packageDraft.requestNote),
                      recentLimit: Number(packageDraft.recentLimit),
                      timelineLimit: Number(packageDraft.timelineLimit),
                      sinceDays: Number(packageDraft.sinceDays)
                    });
                  }
                )
              }
              type="button"
            >
              Create release request
            </button>
          </div>

          {packagePreview ? (
            <div className="two-column">
              <div className="detail-note">
                <strong>Governed export narrative</strong>
                <p>{packagePreview.narrative.executiveSummary}</p>
                <p className="muted">
                  Checksum {shortenValue(packagePreview.exportMetadata.packageChecksumSha256)}
                </p>
              </div>
              <div className="detail-note">
                <strong>Compliance summary</strong>
                <p>
                  Open review cases {packagePreview.complianceSummary.openReviewCases} | Open
                  oversight incidents {packagePreview.complianceSummary.openOversightIncidents}
                </p>
                <p className="muted">
                  Active holds {packagePreview.complianceSummary.activeAccountHolds} | Manual
                  resolutions {packagePreview.complianceSummary.manuallyResolvedTransactionIntents}
                </p>
              </div>
              <JsonPanel
                title="Governed export payload"
                value={packagePreview}
              />
              <JsonPanel
                title="Raw incident package"
                value={rawIncidentPackage}
              />
            </div>
          ) : null}
        </section>

        <section className="panel">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Release Workflow</p>
              <h2>Pending and released export records</h2>
            </div>
          </div>

          <div className="two-column">
            <ListBlock
              title="Pending approvals"
              emptyLabel="No pending release approvals."
              items={
                pendingReleasesQuery.data?.releases.map((release) => (
                  <li key={release.id}>
                    <button
                      className="inline-select"
                      onClick={() => setSelectedReleaseId(release.id)}
                      type="button"
                    >
                      <strong>{release.customer.email}</strong>
                      <span>{toTitleCase(release.status)}</span>
                    </button>
                  </li>
                )) ?? []
              }
            />
            <ListBlock
              title="Recently released"
              emptyLabel="No recent released artifacts."
              items={
                releasedReleasesQuery.data?.releases.map((release) => (
                  <li key={release.id}>
                    <button
                      className="inline-select"
                      onClick={() => setSelectedReleaseId(release.id)}
                      type="button"
                    >
                      <strong>{release.customer.email}</strong>
                      <span>{toTitleCase(release.status)}</span>
                    </button>
                  </li>
                )) ?? []
              }
            />
          </div>

          {selectedRelease ? (
            <div className="detail-stack">
              <SummaryGrid
                items={[
                  ["Release", selectedRelease.id],
                  ["Customer", selectedRelease.customer.email],
                  ["Status", toTitleCase(selectedRelease.status)],
                  ["Mode", toTitleCase(selectedRelease.exportMode)],
                  ["Target", toTitleCase(selectedRelease.releaseTarget)],
                  ["Requested", formatDateTime(selectedRelease.requestedAt)],
                  ["Approver", selectedRelease.approvedByOperatorId ?? "Not approved"],
                  ["Releaser", selectedRelease.releasedByOperatorId ?? "Not released"]
                ]}
              />

              <div className="split-form">
                <label>
                  Approval note
                  <input
                    value={approvalNote}
                    onChange={(event) => setApprovalNote(event.target.value)}
                    placeholder="Why the export is approved"
                  />
                </label>
                <button
                  className="button primary"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction(
                      "approve-release",
                      "Release approved.",
                      async () => {
                        await approveRelease(
                          operatorSession!,
                          selectedRelease.id,
                          trimToUndefined(approvalNote)
                        );
                        setApprovalNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Approve
                </button>
              </div>

              <div className="split-form">
                <label>
                  Rejection note
                  <input
                    value={rejectionNote}
                    onChange={(event) => setRejectionNote(event.target.value)}
                    placeholder="Why the export is rejected"
                  />
                </label>
                <button
                  className="button danger"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction(
                      "reject-release",
                      "Release rejected.",
                      async () => {
                        await rejectRelease(
                          operatorSession!,
                          selectedRelease.id,
                          trimToUndefined(rejectionNote)
                        );
                        setRejectionNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Reject
                </button>
              </div>

              <div className="split-form">
                <label>
                  Release note
                  <input
                    value={releaseNote}
                    onChange={(event) => setReleaseNote(event.target.value)}
                    placeholder="Delivery and retention notes"
                  />
                </label>
                <button
                  className="button"
                  disabled={!operatorSession || pendingAction !== null}
                  onClick={() =>
                    executeAction(
                      "release-package",
                      "Approved package released.",
                      async () => {
                        await releaseApprovedPackage(
                          operatorSession!,
                          selectedRelease.id,
                          trimToUndefined(releaseNote)
                        );
                        setReleaseNote("");
                      }
                    )
                  }
                  type="button"
                >
                  Mark released
                </button>
              </div>

              <JsonPanel title="Artifact payload" value={selectedRelease.artifactPayload} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function MetricCard(props: { label: string; value: number; detail: string }) {
  return (
    <article className="metric-card">
      <span>{props.label}</span>
      <strong>{formatCount(props.value)}</strong>
      <p>{props.detail}</p>
    </article>
  );
}

function HealthStatusCard(props: {
  label: string;
  status: "healthy" | "warning" | "critical";
  detail: string;
}) {
  return (
    <article className="metric-card">
      <span>{props.label}</span>
      <strong>{toTitleCase(props.status)}</strong>
      <p>{props.detail}</p>
    </article>
  );
}

function SummaryGrid(props: { items: Array<[string, string]> }) {
  return (
    <dl className="summary-grid">
      {props.items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ListBlock(props: {
  title: string;
  emptyLabel: string;
  items: JSX.Element[];
}) {
  return (
    <div className="list-block">
      <h3>{props.title}</h3>
      {props.items.length === 0 ? (
        <p className="muted">{props.emptyLabel}</p>
      ) : (
        <ul className="bulleted-list">{props.items}</ul>
      )}
    </div>
  );
}

function JsonPanel(props: {
  title: string;
  value: unknown;
}) {
  return (
    <div className="json-panel">
      <h3>{props.title}</h3>
      <pre>{JSON.stringify(props.value, null, 2)}</pre>
    </div>
  );
}

export default App;
