import axios, { type AxiosRequestConfig } from "axios";
import { buildInternalOperatorHeaders } from "@stealth-trails-bank/security";
import type {
  AccountHoldList,
  AccountHoldSummary,
  AccountReleaseReviewList,
  AuditEventList,
  ApiResponseEnvelope,
  ApplyManualResolutionResult,
  CriticalPlatformAlertRoutingResult,
  GovernedIncidentPackageExport,
  IncidentPackageReleaseList,
  IncidentPackageReleaseMutationResult,
  IncidentPackageSnapshot,
  LedgerReconciliationMismatchList,
  LedgerReconciliationMutationResult,
  LedgerReconciliationScanRunList,
  LedgerReconciliationWorkspace,
  LaunchClosureManifest,
  LaunchClosureScaffoldResponse,
  LaunchClosureStatus,
  LaunchClosureValidationResponse,
  ManualResolutionSummary,
  OperationsStatus,
  OperatorSession,
  OversightAlertList,
  OversightIncidentList,
  PlatformAlertDeliveryTargetHealthList,
  PlatformAlertList,
  ReleaseReadinessApprovalList,
  ReleaseReadinessEvidenceList,
  ReleaseReadinessSummary,
  PlatformAlertGovernanceMutationResult,
  PlatformAlertRouteResult,
  RetryPlatformAlertDeliveriesResult,
  LoanAgreementList,
  LoanAgreementWorkspace,
  LoanApplicationList,
  LoanApplicationWorkspace,
  LoanMutationResult,
  LoanOperationsSummary,
  OversightMutationResult,
  OversightNoteMutationResult,
  OversightRestrictionMutationResult,
  OversightWorkspace,
  ReviewCaseList,
  ReviewCaseMutationResult,
  ReviewCaseNoteMutationResult,
  ReviewCaseWorkspace,
  ScanLedgerReconciliationResult,
  TreasuryOverview,
  WorkerRuntimeHealthList
} from "./types";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function createClient(session: OperatorSession) {
  return axios.create({
    baseURL: normalizeBaseUrl(session.baseUrl),
    headers: buildInternalOperatorHeaders({
      apiKey: session.apiKey,
      operatorId: session.operatorId,
      operatorRole: session.operatorRole
    })
  });
}

async function requestData<T>(
  session: OperatorSession,
  config: AxiosRequestConfig
): Promise<T> {
  const response = await createClient(session).request<ApiResponseEnvelope<T>>(config);

  if (response.data.data === undefined) {
    throw new Error(response.data.message || "API response did not include data.");
  }

  return response.data.data;
}

export async function listReviewCases(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<ReviewCaseList> {
  return requestData(session, {
    method: "GET",
    url: "/review-cases/internal",
    params
  });
}

export async function listAuditEvents(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<AuditEventList> {
  return requestData(session, {
    method: "GET",
    url: "/audit-events/internal",
    params
  });
}

export async function getTreasuryOverview(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<TreasuryOverview> {
  return requestData(session, {
    method: "GET",
    url: "/treasury/internal/overview",
    params
  });
}

export async function getLoanOperationsSummary(
  session: OperatorSession
): Promise<LoanOperationsSummary> {
  return requestData(session, {
    method: "GET",
    url: "/loans/internal/summary"
  });
}

export async function listLoanApplications(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<LoanApplicationList> {
  return requestData(session, {
    method: "GET",
    url: "/loans/internal/applications",
    params
  });
}

export async function getLoanApplicationWorkspace(
  session: OperatorSession,
  loanApplicationId: string
): Promise<LoanApplicationWorkspace> {
  return requestData(session, {
    method: "GET",
    url: `/loans/internal/applications/${loanApplicationId}/workspace`
  });
}

export async function requestLoanEvidence(
  session: OperatorSession,
  loanApplicationId: string,
  note?: string
): Promise<LoanMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/loans/internal/applications/${loanApplicationId}/request-more-evidence`,
    data: note ? { note } : {}
  });
}

export async function approveLoanApplication(
  session: OperatorSession,
  loanApplicationId: string,
  note?: string
): Promise<LoanMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/loans/internal/applications/${loanApplicationId}/approve`,
    data: note ? { note } : {}
  });
}

export async function rejectLoanApplication(
  session: OperatorSession,
  loanApplicationId: string,
  note?: string
): Promise<LoanMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/loans/internal/applications/${loanApplicationId}/reject`,
    data: note ? { note } : {}
  });
}

export async function placeLoanAccountRestriction(
  session: OperatorSession,
  loanApplicationId: string,
  note?: string,
  reasonCode?: string
): Promise<LoanMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/loans/internal/applications/${loanApplicationId}/place-account-restriction`,
    data: {
      ...(note ? { note } : {}),
      ...(reasonCode ? { reasonCode } : {})
    }
  });
}

export async function listLoanAgreements(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<LoanAgreementList> {
  return requestData(session, {
    method: "GET",
    url: "/loans/internal/agreements",
    params
  });
}

export async function getLoanAgreementWorkspace(
  session: OperatorSession,
  loanAgreementId: string
): Promise<LoanAgreementWorkspace> {
  return requestData(session, {
    method: "GET",
    url: `/loans/internal/agreements/${loanAgreementId}/workspace`
  });
}

export async function startLoanLiquidationReview(
  session: OperatorSession,
  loanAgreementId: string,
  note?: string
): Promise<LoanMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/loans/internal/agreements/${loanAgreementId}/start-liquidation-review`,
    data: note ? { note } : {}
  });
}

export async function approveLoanLiquidation(
  session: OperatorSession,
  loanAgreementId: string,
  note?: string
): Promise<LoanMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/loans/internal/agreements/${loanAgreementId}/approve-liquidation`,
    data: note ? { note } : {}
  });
}

export async function executeLoanLiquidation(
  session: OperatorSession,
  loanAgreementId: string,
  note?: string
): Promise<LoanMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/loans/internal/agreements/${loanAgreementId}/execute-liquidation`,
    data: note ? { note } : {}
  });
}

export async function closeLoanAgreement(
  session: OperatorSession,
  loanAgreementId: string,
  note?: string
): Promise<LoanMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/loans/internal/agreements/${loanAgreementId}/close`,
    data: note ? { note } : {}
  });
}

export async function scanLedgerReconciliation(
  session: OperatorSession,
  payload: Record<string, string | number | undefined>
): Promise<ScanLedgerReconciliationResult> {
  return requestData(session, {
    method: "POST",
    url: "/ledger/internal/reconciliation/scan",
    data: payload
  });
}

export async function listLedgerReconciliationMismatches(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<LedgerReconciliationMismatchList> {
  return requestData(session, {
    method: "GET",
    url: "/ledger/internal/reconciliation/mismatches",
    params
  });
}

export async function listLedgerReconciliationRuns(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<LedgerReconciliationScanRunList> {
  return requestData(session, {
    method: "GET",
    url: "/ledger/internal/reconciliation/runs",
    params
  });
}

export async function getLedgerReconciliationWorkspace(
  session: OperatorSession,
  mismatchId: string,
  recentAuditLimit = 12
): Promise<LedgerReconciliationWorkspace> {
  return requestData(session, {
    method: "GET",
    url: `/ledger/internal/reconciliation/mismatches/${mismatchId}/workspace`,
    params: {
      recentAuditLimit
    }
  });
}

export async function replayConfirmMismatch(
  session: OperatorSession,
  mismatchId: string,
  note?: string
): Promise<LedgerReconciliationMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/ledger/internal/reconciliation/mismatches/${mismatchId}/replay-confirm`,
    data: note ? { note } : {}
  });
}

export async function replaySettleMismatch(
  session: OperatorSession,
  mismatchId: string,
  note?: string
): Promise<LedgerReconciliationMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/ledger/internal/reconciliation/mismatches/${mismatchId}/replay-settle`,
    data: note ? { note } : {}
  });
}

export async function openLedgerReconciliationReviewCase(
  session: OperatorSession,
  mismatchId: string,
  note?: string
): Promise<LedgerReconciliationMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/ledger/internal/reconciliation/mismatches/${mismatchId}/open-review-case`,
    data: note ? { note } : {}
  });
}

export async function repairLedgerCustomerBalance(
  session: OperatorSession,
  mismatchId: string,
  note?: string
): Promise<LedgerReconciliationMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/ledger/internal/reconciliation/mismatches/${mismatchId}/repair-balance`,
    data: note ? { note } : {}
  });
}

export async function dismissLedgerReconciliationMismatch(
  session: OperatorSession,
  mismatchId: string,
  note?: string
): Promise<LedgerReconciliationMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/ledger/internal/reconciliation/mismatches/${mismatchId}/dismiss`,
    data: note ? { note } : {}
  });
}

export async function listWorkerRuntimeHealth(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<WorkerRuntimeHealthList> {
  return requestData(session, {
    method: "GET",
    url: "/operations/internal/workers/health",
    params
  });
}

export async function getOperationsStatus(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<OperationsStatus> {
  return requestData(session, {
    method: "GET",
    url: "/operations/internal/status",
    params
  });
}

export async function getReleaseReadinessSummary(
  session: OperatorSession
): Promise<ReleaseReadinessSummary> {
  return requestData(session, {
    method: "GET",
    url: "/release-readiness/internal/summary"
  });
}

export async function listReleaseReadinessEvidence(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<ReleaseReadinessEvidenceList> {
  return requestData(session, {
    method: "GET",
    url: "/release-readiness/internal/evidence",
    params
  });
}

export async function createReleaseReadinessEvidence(
  session: OperatorSession,
  payload: Record<string, unknown>
): Promise<{ evidence: ReleaseReadinessSummary["recentEvidence"][number] }> {
  return requestData(session, {
    method: "POST",
    url: "/release-readiness/internal/evidence",
    data: payload
  });
}

export async function listReleaseReadinessApprovals(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<ReleaseReadinessApprovalList> {
  return requestData(session, {
    method: "GET",
    url: "/release-readiness/internal/approvals",
    params
  });
}

export async function requestReleaseReadinessApproval(
  session: OperatorSession,
  payload: Record<string, unknown>
): Promise<{ approval: ReleaseReadinessApprovalList["approvals"][number] }> {
  return requestData(session, {
    method: "POST",
    url: "/release-readiness/internal/approvals",
    data: payload
  });
}

export async function approveReleaseReadinessApproval(
  session: OperatorSession,
  approvalId: string,
  payload: {
    approvalNote?: string;
  } = {}
): Promise<{ approval: ReleaseReadinessApprovalList["approvals"][number] }> {
  return requestData(session, {
    method: "POST",
    url: `/release-readiness/internal/approvals/${approvalId}/approve`,
    data: payload
  });
}

export async function rejectReleaseReadinessApproval(
  session: OperatorSession,
  approvalId: string,
  payload: {
    rejectionNote: string;
  }
): Promise<{ approval: ReleaseReadinessApprovalList["approvals"][number] }> {
  return requestData(session, {
    method: "POST",
    url: `/release-readiness/internal/approvals/${approvalId}/reject`,
    data: payload
  });
}

export async function getLaunchClosureStatus(
  session: OperatorSession
): Promise<LaunchClosureStatus> {
  return requestData(session, {
    method: "GET",
    url: "/release-readiness/internal/launch-closure/status"
  });
}

export async function validateLaunchClosureManifest(
  session: OperatorSession,
  manifest: LaunchClosureManifest
): Promise<LaunchClosureValidationResponse> {
  return requestData(session, {
    method: "POST",
    url: "/release-readiness/internal/launch-closure/validate",
    data: {
      manifest
    }
  });
}

export async function scaffoldLaunchClosurePack(
  session: OperatorSession,
  manifest: LaunchClosureManifest
): Promise<LaunchClosureScaffoldResponse> {
  return requestData(session, {
    method: "POST",
    url: "/release-readiness/internal/launch-closure/scaffold",
    data: {
      manifest
    }
  });
}

export async function listPlatformAlerts(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<PlatformAlertList> {
  return requestData(session, {
    method: "GET",
    url: "/operations/internal/alerts",
    params
  });
}

export async function listPlatformAlertDeliveryTargetHealth(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<PlatformAlertDeliveryTargetHealthList> {
  return requestData(session, {
    method: "GET",
    url: "/operations/internal/alerts/delivery-target-health",
    params
  });
}

export async function routePlatformAlertToReviewCase(
  session: OperatorSession,
  alertId: string,
  note?: string
): Promise<PlatformAlertRouteResult> {
  return requestData(session, {
    method: "POST",
    url: `/operations/internal/alerts/${alertId}/route-review-case`,
    data: note ? { note } : {}
  });
}

export async function routeCriticalPlatformAlerts(
  session: OperatorSession,
  payload: {
    limit?: number;
    staleAfterSeconds?: number;
    note?: string;
  } = {}
): Promise<CriticalPlatformAlertRoutingResult> {
  return requestData(session, {
    method: "POST",
    url: "/operations/internal/alerts/route-critical",
    data: payload
  });
}

export async function assignPlatformAlertOwner(
  session: OperatorSession,
  alertId: string,
  ownerOperatorId: string,
  note?: string
): Promise<PlatformAlertGovernanceMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/operations/internal/alerts/${alertId}/assign-owner`,
    data: {
      ownerOperatorId,
      ...(note ? { note } : {})
    }
  });
}

export async function acknowledgePlatformAlert(
  session: OperatorSession,
  alertId: string,
  note?: string
): Promise<PlatformAlertGovernanceMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/operations/internal/alerts/${alertId}/acknowledge`,
    data: note ? { note } : {}
  });
}

export async function suppressPlatformAlert(
  session: OperatorSession,
  alertId: string,
  suppressedUntil: string,
  note?: string
): Promise<PlatformAlertGovernanceMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/operations/internal/alerts/${alertId}/suppress`,
    data: {
      suppressedUntil,
      ...(note ? { note } : {})
    }
  });
}

export async function clearPlatformAlertSuppression(
  session: OperatorSession,
  alertId: string,
  note?: string
): Promise<PlatformAlertGovernanceMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/operations/internal/alerts/${alertId}/clear-suppression`,
    data: note ? { note } : {}
  });
}

export async function retryPlatformAlertDeliveries(
  session: OperatorSession,
  alertId: string,
  note?: string
): Promise<RetryPlatformAlertDeliveriesResult> {
  return requestData(session, {
    method: "POST",
    url: `/operations/internal/alerts/${alertId}/retry-deliveries`,
    data: note ? { note } : {}
  });
}

export async function getReviewCaseWorkspace(
  session: OperatorSession,
  reviewCaseId: string,
  recentLimit = 12
): Promise<ReviewCaseWorkspace> {
  return requestData(session, {
    method: "GET",
    url: `/review-cases/internal/${reviewCaseId}/workspace`,
    params: {
      recentLimit
    }
  });
}

export async function startReviewCase(
  session: OperatorSession,
  reviewCaseId: string,
  note?: string
): Promise<ReviewCaseMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/review-cases/internal/${reviewCaseId}/start`,
    data: note ? { note } : {}
  });
}

export async function addReviewCaseNote(
  session: OperatorSession,
  reviewCaseId: string,
  note: string
): Promise<ReviewCaseNoteMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/review-cases/internal/${reviewCaseId}/notes`,
    data: {
      note
    }
  });
}

export async function handoffReviewCase(
  session: OperatorSession,
  reviewCaseId: string,
  nextOperatorId: string,
  note?: string
): Promise<ReviewCaseMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/review-cases/internal/${reviewCaseId}/handoff`,
    data: {
      nextOperatorId,
      ...(note ? { note } : {})
    }
  });
}

export async function applyManualResolution(
  session: OperatorSession,
  reviewCaseId: string,
  manualResolutionReasonCode: string,
  note?: string
): Promise<ApplyManualResolutionResult> {
  return requestData(session, {
    method: "POST",
    url: `/review-cases/internal/${reviewCaseId}/apply-manual-resolution`,
    data: {
      manualResolutionReasonCode,
      ...(note ? { note } : {})
    }
  });
}

export async function requestAccountRelease(
  session: OperatorSession,
  reviewCaseId: string,
  note?: string
): Promise<IncidentPackageReleaseMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/review-cases/internal/${reviewCaseId}/request-account-release`,
    data: note ? { note } : {}
  });
}

export async function decideAccountRelease(
  session: OperatorSession,
  reviewCaseId: string,
  decision: "approved" | "denied",
  note?: string
): Promise<IncidentPackageReleaseMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/review-cases/internal/account-release-requests/${reviewCaseId}/decision`,
    data: {
      decision,
      ...(note ? { note } : {})
    }
  });
}

export async function resolveReviewCase(
  session: OperatorSession,
  reviewCaseId: string,
  note?: string
): Promise<ReviewCaseMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/review-cases/internal/${reviewCaseId}/resolve`,
    data: note ? { note } : {}
  });
}

export async function dismissReviewCase(
  session: OperatorSession,
  reviewCaseId: string,
  note?: string
): Promise<ReviewCaseMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/review-cases/internal/${reviewCaseId}/dismiss`,
    data: note ? { note } : {}
  });
}

export async function getManualResolutionSummary(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<ManualResolutionSummary> {
  return requestData(session, {
    method: "GET",
    url: "/review-cases/internal/manual-resolutions/summary",
    params
  });
}

export async function listPendingAccountReleaseReviews(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<AccountReleaseReviewList> {
  return requestData(session, {
    method: "GET",
    url: "/review-cases/internal/account-release-requests/pending",
    params
  });
}

export async function listOversightIncidents(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<OversightIncidentList> {
  return requestData(session, {
    method: "GET",
    url: "/oversight-incidents/internal",
    params
  });
}

export async function getOversightIncidentWorkspace(
  session: OperatorSession,
  oversightIncidentId: string,
  recentLimit = 10
): Promise<OversightWorkspace> {
  return requestData(session, {
    method: "GET",
    url: `/oversight-incidents/internal/${oversightIncidentId}/workspace`,
    params: {
      recentLimit
    }
  });
}

export async function startOversightIncident(
  session: OperatorSession,
  oversightIncidentId: string,
  note?: string
): Promise<OversightMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/oversight-incidents/internal/${oversightIncidentId}/start`,
    data: note ? { note } : {}
  });
}

export async function addOversightIncidentNote(
  session: OperatorSession,
  oversightIncidentId: string,
  note: string
): Promise<OversightNoteMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/oversight-incidents/internal/${oversightIncidentId}/notes`,
    data: {
      note
    }
  });
}

export async function applyAccountRestriction(
  session: OperatorSession,
  oversightIncidentId: string,
  restrictionReasonCode: string,
  note?: string
): Promise<OversightRestrictionMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/oversight-incidents/internal/${oversightIncidentId}/place-account-hold`,
    data: {
      restrictionReasonCode,
      ...(note ? { note } : {})
    }
  });
}

export async function resolveOversightIncident(
  session: OperatorSession,
  oversightIncidentId: string,
  note?: string
): Promise<OversightMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/oversight-incidents/internal/${oversightIncidentId}/resolve`,
    data: note ? { note } : {}
  });
}

export async function dismissOversightIncident(
  session: OperatorSession,
  oversightIncidentId: string,
  note?: string
): Promise<OversightMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/oversight-incidents/internal/${oversightIncidentId}/dismiss`,
    data: note ? { note } : {}
  });
}

export async function listOversightAlerts(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<OversightAlertList> {
  return requestData(session, {
    method: "GET",
    url: "/oversight-incidents/internal/alerts",
    params
  });
}

export async function listActiveAccountHolds(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<AccountHoldList> {
  return requestData(session, {
    method: "GET",
    url: "/oversight-incidents/internal/account-holds/active",
    params
  });
}

export async function getAccountHoldSummary(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<AccountHoldSummary> {
  return requestData(session, {
    method: "GET",
    url: "/oversight-incidents/internal/account-holds/summary",
    params
  });
}

export async function getIncidentPackage(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<IncidentPackageSnapshot> {
  return requestData(session, {
    method: "GET",
    url: "/customer-account-incident-package/internal",
    params
  });
}

export async function getGovernedIncidentPackageExport(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<GovernedIncidentPackageExport> {
  return requestData(session, {
    method: "GET",
    url: "/customer-account-incident-package/internal/export",
    params
  });
}

export async function createIncidentPackageReleaseRequest(
  session: OperatorSession,
  payload: Record<string, string | number | undefined>
): Promise<IncidentPackageReleaseMutationResult> {
  return requestData(session, {
    method: "POST",
    url: "/customer-account-incident-package/internal/releases",
    data: payload
  });
}

export async function listPendingReleases(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<IncidentPackageReleaseList> {
  return requestData(session, {
    method: "GET",
    url: "/customer-account-incident-package/internal/releases/pending",
    params
  });
}

export async function listReleasedReleases(
  session: OperatorSession,
  params: Record<string, string | number | undefined>
): Promise<IncidentPackageReleaseList> {
  return requestData(session, {
    method: "GET",
    url: "/customer-account-incident-package/internal/releases/released",
    params
  });
}

export async function getRelease(
  session: OperatorSession,
  releaseId: string
): Promise<IncidentPackageReleaseMutationResult> {
  return requestData(session, {
    method: "GET",
    url: `/customer-account-incident-package/internal/releases/${releaseId}`
  });
}

export async function approveRelease(
  session: OperatorSession,
  releaseId: string,
  approvalNote?: string
): Promise<IncidentPackageReleaseMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/customer-account-incident-package/internal/releases/${releaseId}/approve`,
    data: approvalNote ? { approvalNote } : {}
  });
}

export async function rejectRelease(
  session: OperatorSession,
  releaseId: string,
  rejectionNote?: string
): Promise<IncidentPackageReleaseMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/customer-account-incident-package/internal/releases/${releaseId}/reject`,
    data: rejectionNote ? { rejectionNote } : {}
  });
}

export async function releaseApprovedPackage(
  session: OperatorSession,
  releaseId: string,
  releaseNote?: string
): Promise<IncidentPackageReleaseMutationResult> {
  return requestData(session, {
    method: "POST",
    url: `/customer-account-incident-package/internal/releases/${releaseId}/release`,
    data: releaseNote ? { releaseNote } : {}
  });
}
