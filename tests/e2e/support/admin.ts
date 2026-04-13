import type { Page } from "@playwright/test";
import { fulfillJson, isoAt, type MockResponseSpec } from "./common";

export const adminLocaleStorageKey = "stealth-trails-bank.admin.locale";
export const operatorSessionStorageKey = "stealth-trails-bank.admin.operator-session";

const defaultSession = {
  baseUrl: "http://127.0.0.1:9101",
  operatorId: "ops_e2e",
  operatorRole: "operations_admin",
  apiKey: "local-dev-operator-key"
};

function reviewCase(status = "pending_review") {
  return {
    id: "review_case_1",
    type: "deposit_review",
    status,
    reasonCode: "kyc_watch",
    notes: null,
    assignedOperatorId: status === "pending_review" ? null : "ops_e2e",
    startedAt: status === "pending_review" ? null : isoAt(1),
    resolvedAt: null,
    dismissedAt: null,
    createdAt: isoAt(12),
    updatedAt: isoAt(1),
    customer: {
      customerId: "customer_1",
      supabaseUserId: "supabase_1",
      email: "amina@example.com",
      firstName: "Amina",
      lastName: "Rahman"
    },
    customerAccountId: "account_1",
    transactionIntent: {
      id: "intent_admin_1",
      intentType: "deposit",
      status: "queued",
      policyDecision: "pending",
      requestedAmount: "1.25",
      settledAmount: null,
      failureCode: null,
      failureReason: null,
      manuallyResolvedAt: null,
      manualResolutionReasonCode: null,
      manualResolutionNote: null,
      manualResolvedByOperatorId: null,
      manualResolutionOperatorRole: null,
      manualResolutionReviewCaseId: null,
      sourceWalletId: null,
      sourceWalletAddress: null,
      destinationWalletId: "wallet_1",
      destinationWalletAddress: "0x1111222233334444555566667777888899990000",
      externalAddress: null,
      asset: {
        id: "asset_eth",
        symbol: "ETH",
        displayName: "Ether",
        decimals: 18,
        chainId: 1
      },
      latestBlockchainTransaction: {
        id: "chain_tx_admin_1",
        txHash: "0xabc1111222233334444555566667777888899990000aaaabbbbccccdddd0001",
        status: "broadcast",
        fromAddress: "0x9999222233334444555566667777888899990000",
        toAddress: "0x1111222233334444555566667777888899990000",
        createdAt: isoAt(6),
        updatedAt: isoAt(2),
        confirmedAt: null
      },
      createdAt: isoAt(12),
      updatedAt: isoAt(2)
    }
  };
}

function operationsStatus(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: isoAt(0),
    alertSummary: {
      openCount: 3,
      criticalCount: 1,
      warningCount: 2
    },
    workerHealth: {
      status: "healthy",
      staleAfterSeconds: 300,
      totalWorkers: 2,
      healthyWorkers: 2,
      degradedWorkers: 0,
      staleWorkers: 0
    },
    queueHealth: {
      status: "warning",
      queuedDepositCount: 2,
      queuedWithdrawalCount: 1,
      totalQueuedCount: 3,
      agedQueuedCount: 1,
      manualWithdrawalBacklogCount: 1,
      oldestQueuedIntentCreatedAt: isoAt(18)
    },
    withdrawalExecutionHealth: {
      status: "warning",
      queuedManagedWithdrawalCount: 2,
      broadcastingWithdrawalCount: 1,
      pendingConfirmationWithdrawalCount: 1,
      failedManagedWithdrawalCount: 0,
      manualInterventionWithdrawalCount: 1
    },
    chainHealth: {
      status: "healthy",
      laggingBroadcastCount: 0,
      criticalLaggingBroadcastCount: 0,
      recentFailedTransactionCount: 0,
      oldestLaggingBroadcastCreatedAt: isoAt(5)
    },
    treasuryHealth: {
      status: "healthy",
      managedWorkerCount: 2,
      activeTreasuryWalletCount: 2,
      activeOperationalWalletCount: 4,
      missingManagedWalletCoverage: false
    },
    reconciliationHealth: {
      status: "warning",
      openMismatchCount: 2,
      criticalMismatchCount: 1,
      recentFailedScanCount: 0,
      latestScanStatus: "completed",
      latestScanStartedAt: isoAt(2)
    },
    incidentSafety: {
      status: "warning",
      openReviewCaseCount: 2,
      openOversightIncidentCount: 1,
      activeRestrictedAccountCount: 1
    },
    recentAlerts: [
      {
        id: "alert_1",
        dedupeKey: "alert:key:1",
        category: "delivery",
        severity: "critical",
        status: "open",
        routingStatus: "unrouted",
        routingTargetType: null,
        routingTargetId: null,
        routedAt: null,
        routedByOperatorId: null,
        routingNote: null,
        ownerOperatorId: "ops_e2e",
        ownerAssignedAt: isoAt(3),
        ownerAssignedByOperatorId: "ops_lead",
        ownershipNote: null,
        acknowledgedAt: null,
        acknowledgedByOperatorId: null,
        acknowledgementNote: null,
        suppressedUntil: null,
        suppressedByOperatorId: null,
        suppressionNote: null,
        isAcknowledged: false,
        hasActiveSuppression: false,
        deliverySummary: {
          totalCount: 3,
          pendingCount: 1,
          failedCount: 2,
          escalatedCount: 1,
          reEscalationCount: 0,
          highestEscalationLevel: 1,
          lastAttemptedAt: isoAt(1),
          lastEventType: "delivery_failed",
          lastStatus: "failed",
          lastTargetName: "pagerduty-primary",
          lastEscalatedFromTargetName: null,
          lastErrorMessage: "Webhook timeout"
        },
        code: "ALERT_DELIVERY_TIMEOUT",
        summary: "Primary delivery target is timing out.",
        detail: "Two consecutive delivery attempts failed for pagerduty-primary.",
        metadata: null,
        firstDetectedAt: isoAt(12),
        lastDetectedAt: isoAt(1),
        resolvedAt: null,
        createdAt: isoAt(12),
        updatedAt: isoAt(1)
      }
    ],
    ...overrides
  };
}

function releaseSummary(overrides: Record<string, unknown> = {}) {
  const endToEndEvidence = {
    id: "evidence_1",
    evidenceType: "end_to_end_finance_flows",
    environment: "staging",
    status: "passed",
    releaseIdentifier: "2026.04.10-rc1",
    rollbackReleaseIdentifier: "2026.04.09",
    backupReference: "backup-1",
    summary: "Critical mocked and smoke flows passed.",
    note: null,
    operatorId: "ops_e2e",
    operatorRole: "operations_admin",
    runbookPath: "docs/runbooks/release-candidate-verification.md",
    evidenceLinks: [],
    evidencePayload: null,
    startedAt: isoAt(4),
    completedAt: isoAt(3),
    observedAt: isoAt(3),
    createdAt: isoAt(3),
    updatedAt: isoAt(3)
  };

  const deliveryEvidence = {
    ...endToEndEvidence,
    id: "evidence_2",
    evidenceType: "platform_alert_delivery_slo",
    summary: "Delivery target degradation surfaced through operator APIs.",
    runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
    observedAt: isoAt(2),
    createdAt: isoAt(2),
    updatedAt: isoAt(2)
  };

  const rollbackEvidence = {
    ...endToEndEvidence,
    id: "evidence_3",
    evidenceType: "api_rollback_drill",
    status: "failed",
    summary: "API rollback evidence is stale.",
    runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
    observedAt: isoAt(72),
    createdAt: isoAt(72),
    updatedAt: isoAt(72)
  };

  return {
    generatedAt: isoAt(0),
    overallStatus: "warning",
    summary: {
      requiredCheckCount: 4,
      passedCheckCount: 2,
      failedCheckCount: 1,
      pendingCheckCount: 1
    },
    requiredChecks: [
      {
        evidenceType: "end_to_end_finance_flows",
        label: "End-to-end finance flows",
        description: "Repo-owned finance smoke coverage for the current release candidate.",
        runbookPath: "docs/runbooks/release-candidate-verification.md",
        acceptedEnvironments: ["ci", "staging"],
        status: "passed",
        latestEvidence: endToEndEvidence
      },
      {
        evidenceType: "platform_alert_delivery_slo",
        label: "Platform alert delivery SLO",
        description: "Delivery-target degradation must be visible through operator workflows.",
        runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
        acceptedEnvironments: ["staging", "production_like", "production"],
        status: "passed",
        latestEvidence: deliveryEvidence
      },
      {
        evidenceType: "api_rollback_drill",
        label: "API rollback drill",
        description: "Recent API rollback posture validation for an accepted environment.",
        runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
        acceptedEnvironments: ["staging", "production_like", "production"],
        status: "failed",
        latestEvidence: rollbackEvidence
      },
      {
        evidenceType: "role_review",
        label: "Role review",
        description: "Launch roster and operator role mappings must be attested.",
        runbookPath: "docs/security/role-review.md",
        acceptedEnvironments: ["staging", "production_like", "production"],
        status: "pending",
        latestEvidence: null
      }
    ],
    recentEvidence: [
      deliveryEvidence,
      endToEndEvidence,
      rollbackEvidence
    ],
    ...overrides
  };
}

function reviewWorkspace(status = "pending_review") {
  const selectedReviewCase = reviewCase(status);

  return {
    reviewCase: selectedReviewCase,
    manualResolutionEligibility: {
      eligible: false,
      reasonCode: "policy_review_required",
      reason: "Policy review remains required before a manual resolution is allowed.",
      operatorRole: "operations_admin",
      operatorAuthorized: true,
      allowedOperatorRoles: ["operations_admin"],
      currentIntentStatus: "queued",
      currentReviewCaseStatus: selectedReviewCase.status,
      currentReviewCaseType: selectedReviewCase.type,
      recommendedAction: "review_evidence"
    },
    caseEvents: [
      {
        id: "review_event_1",
        actorType: "operator",
        actorId: "ops_lead",
        eventType: "created",
        note: "Case opened from deposit review policy.",
        metadata: {},
        createdAt: isoAt(12)
      }
    ],
    relatedTransactionAuditEvents: [
      {
        id: "audit_1",
        actorType: "system",
        actorId: null,
        action: "intent_recorded",
        targetType: "transaction_intent",
        targetId: "intent_admin_1",
        metadata: {},
        createdAt: isoAt(12)
      }
    ],
    balances: [
      {
        asset: {
          id: "asset_eth",
          symbol: "ETH",
          displayName: "Ether",
          decimals: 18,
          chainId: 1
        },
        availableBalance: "2.5",
        pendingBalance: "1.25",
        updatedAt: isoAt(2)
      }
    ],
    recentIntents: [selectedReviewCase.transactionIntent],
    recentLimit: 10
  };
}

function oversightIncident(status = "open") {
  return {
    id: "incident_1",
    incidentType: "manual_resolution_watch",
    status,
    reasonCode: "repeat_manual_resolution",
    summaryNote: null,
    subjectCustomer: {
      customerId: "customer_1",
      customerAccountId: "account_1",
      supabaseUserId: "supabase_1",
      email: "amina@example.com",
      firstName: "Amina",
      lastName: "Rahman"
    },
    subjectOperatorId: null,
    subjectOperatorRole: null,
    assignedOperatorId: "ops_e2e",
    openedAt: isoAt(10),
    startedAt: status === "open" ? null : isoAt(2),
    resolvedAt: null,
    dismissedAt: null,
    createdAt: isoAt(10),
    updatedAt: isoAt(2)
  };
}

function oversightWorkspace(status = "open", restricted = false) {
  const incident = oversightIncident(status);

  return {
    oversightIncident: incident,
    accountRestriction: {
      active: restricted,
      customerAccountId: "account_1",
      accountStatus: restricted ? "restricted" : "active",
      restrictedAt: restricted ? isoAt(1) : null,
      restrictedFromStatus: restricted ? "active" : null,
      restrictionReasonCode: restricted ? "manual_review_hold" : null,
      restrictedByOperatorId: restricted ? "ops_e2e" : null,
      restrictedByOversightIncidentId: restricted ? incident.id : null,
      restrictionReleasedAt: null,
      restrictionReleasedByOperatorId: null
    },
    accountHoldGovernance: {
      operatorRole: "operations_admin",
      canApplyAccountHold: true,
      canReleaseAccountHold: true,
      allowedApplyOperatorRoles: ["operations_admin"],
      allowedReleaseOperatorRoles: ["operations_admin"]
    },
    events: [
      {
        id: "oversight_event_1",
        actorType: "system",
        actorId: null,
        eventType: "opened",
        note: "Incident opened from oversight alerting.",
        metadata: {},
        createdAt: isoAt(10)
      }
    ],
    recentManuallyResolvedIntents: [
      {
        id: "manual_intent_1",
        customer: {
          customerId: "customer_1",
          customerAccountId: "account_1",
          supabaseUserId: "supabase_1",
          email: "amina@example.com",
          firstName: "Amina",
          lastName: "Rahman"
        },
        asset: {
          id: "asset_eth",
          symbol: "ETH",
          displayName: "Ether",
          decimals: 18,
          chainId: 1
        },
        intentType: "withdrawal",
        requestedAmount: "0.5",
        settledAmount: null,
        failureCode: null,
        failureReason: null,
        sourceWalletAddress: "0x1111222233334444555566667777888899990000",
        destinationWalletAddress: null,
        externalAddress: "0x0000000000000000000000000000000000000fed",
        manuallyResolvedAt: isoAt(24),
        manualResolutionReasonCode: "manual_review_hold",
        manualResolutionNote: "Held pending investigation.",
        manualResolvedByOperatorId: "ops_lead",
        manualResolutionOperatorRole: "risk_manager",
        manualResolutionReviewCaseId: "review_case_older",
        latestBlockchainTransaction: null
      }
    ],
    recentReviewCases: [
      {
        id: "review_case_older",
        type: "withdrawal_review",
        status: "resolved",
        reasonCode: "manual_review",
        assignedOperatorId: "ops_lead",
        transactionIntentId: "intent_older",
        customerAccountId: "account_1",
        updatedAt: isoAt(24),
        resolvedAt: isoAt(23)
      }
    ],
    recentLimit: 8
  };
}

function reconciliationWorkspace() {
  return {
    mismatch: {
      id: "mismatch_1",
      mismatchKey: "account_1:asset_usdc",
      scope: "customer_balance",
      status: "open",
      severity: "critical",
      recommendedAction: "repair_balance",
      reasonCode: "projection_drift",
      summary: "Ledger balance differs from materialized balance by 10 USDC.",
      chainId: 1,
      customer: {
        customerId: "customer_1",
        email: "amina@example.com",
        supabaseUserId: "supabase_1",
        firstName: "Amina",
        lastName: "Rahman"
      },
      customerAccount: {
        customerAccountId: "account_1",
        status: "active"
      },
      asset: {
        assetId: "asset_usdc",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 1
      },
      transactionIntent: {
        transactionIntentId: "intent_withdrawal_1",
        intentType: "withdrawal",
        status: "confirmed",
        policyDecision: "approved",
        requestedAmount: "10",
        settledAmount: "10",
        createdAt: isoAt(20),
        updatedAt: isoAt(18)
      },
      linkedReviewCase: {
        reviewCaseId: "review_case_1",
        type: "withdrawal_review",
        status: "resolved",
        assignedOperatorId: "ops_lead",
        updatedAt: isoAt(18)
      },
      latestSnapshot: {},
      resolutionMetadata: null,
      resolutionNote: null,
      detectionCount: 2,
      firstDetectedAt: isoAt(6),
      lastDetectedAt: isoAt(1),
      resolvedAt: null,
      resolvedByOperatorId: null,
      dismissedAt: null,
      dismissedByOperatorId: null,
      createdAt: isoAt(6),
      updatedAt: isoAt(1)
    },
    currentSnapshot: {},
    recentAuditEvents: [
      {
        id: "audit_recon_1",
        actorType: "worker",
        actorId: "worker_1",
        action: "mismatch_detected",
        targetType: "ledger_reconciliation_mismatch",
        targetId: "mismatch_1",
        metadata: {},
        createdAt: isoAt(1)
      }
    ]
  };
}

function platformAlert() {
  return operationsStatus().recentAlerts[0];
}

function launchApproval(status = "pending_approval") {
  return {
    id: "approval_1",
    releaseIdentifier: "2026.04.10-rc1",
    environment: "staging",
    rollbackReleaseIdentifier: "2026.04.09",
    status,
    summary: "Awaiting final operator signoff.",
    requestNote: "Ready for board review.",
    approvalNote: null,
    rejectionNote: null,
    requestedByOperatorId: "ops_lead",
    requestedByOperatorRole: "compliance_lead",
    approvedByOperatorId: null,
    approvedByOperatorRole: null,
    rejectedByOperatorId: null,
    rejectedByOperatorRole: null,
    checklist: {
      securityConfigurationComplete: true,
      accessAndGovernanceComplete: true,
      dataAndRecoveryComplete: true,
      platformHealthComplete: true,
      functionalProofComplete: true,
      contractAndChainProofComplete: true,
      finalSignoffComplete: false,
      unresolvedRisksAccepted: false,
      openBlockers: ["Rollback evidence is stale."],
      residualRiskNote: null
    },
    evidenceSnapshot: {
      generatedAt: isoAt(0),
      overallStatus: "warning",
      summary: {
        requiredCheckCount: 4,
        passedCheckCount: 2,
        failedCheckCount: 1,
        pendingCheckCount: 1
      },
      requiredChecks: [
        {
          evidenceType: "end_to_end_finance_flows",
          status: "passed",
          latestEvidenceObservedAt: isoAt(3),
          latestEvidenceEnvironment: "staging",
          latestEvidenceStatus: "passed"
        },
        {
          evidenceType: "platform_alert_delivery_slo",
          status: "passed",
          latestEvidenceObservedAt: isoAt(2),
          latestEvidenceEnvironment: "staging",
          latestEvidenceStatus: "passed"
        },
        {
          evidenceType: "api_rollback_drill",
          status: "failed",
          latestEvidenceObservedAt: isoAt(72),
          latestEvidenceEnvironment: "staging",
          latestEvidenceStatus: "failed"
        },
        {
          evidenceType: "role_review",
          status: "pending",
          latestEvidenceObservedAt: null,
          latestEvidenceEnvironment: null,
          latestEvidenceStatus: null
        }
      ]
    },
    gate: {
      overallStatus: "blocked",
      approvalEligible: false,
      missingChecklistItems: ["finalSignoffComplete"],
      missingEvidenceTypes: ["role_review"],
      failedEvidenceTypes: ["api_rollback_drill"],
      staleEvidenceTypes: ["api_rollback_drill"],
      maximumEvidenceAgeHours: 24,
      openBlockers: ["Rollback evidence is stale."],
      generatedAt: isoAt(0)
    },
    requestedAt: isoAt(2),
    approvedAt: null,
    rejectedAt: null,
    createdAt: isoAt(2),
    updatedAt: isoAt(2)
  };
}

export type AdminScenario = {
  operationsStatus: MockResponseSpec<Record<string, unknown>>;
  releaseSummary: MockResponseSpec<Record<string, unknown>>;
  reviewCases: MockResponseSpec<Record<string, unknown>>;
  releaseReviews: MockResponseSpec<Record<string, unknown>>;
  reviewWorkspace: MockResponseSpec<Record<string, unknown>>;
  startReviewCase: MockResponseSpec<Record<string, unknown>>;
  addReviewCaseNote: MockResponseSpec<Record<string, unknown>>;
  requestAccountRelease: MockResponseSpec<Record<string, unknown>>;
  resolveReviewCase: MockResponseSpec<Record<string, unknown>>;
  dismissReviewCase: MockResponseSpec<Record<string, unknown>>;
  oversightIncidents: MockResponseSpec<Record<string, unknown>>;
  activeAccountHolds: MockResponseSpec<Record<string, unknown>>;
  accountHoldSummary: MockResponseSpec<Record<string, unknown>>;
  oversightWorkspace: MockResponseSpec<Record<string, unknown>>;
  startOversightIncident: MockResponseSpec<Record<string, unknown>>;
  addOversightIncidentNote: MockResponseSpec<Record<string, unknown>>;
  applyAccountRestriction: MockResponseSpec<Record<string, unknown>>;
  resolveOversightIncident: MockResponseSpec<Record<string, unknown>>;
  dismissOversightIncident: MockResponseSpec<Record<string, unknown>>;
  reconciliationMismatches: MockResponseSpec<Record<string, unknown>>;
  reconciliationRuns: MockResponseSpec<Record<string, unknown>>;
  reconciliationWorkspace: MockResponseSpec<Record<string, unknown>>;
  replayConfirm: MockResponseSpec<Record<string, unknown>>;
  replaySettle: MockResponseSpec<Record<string, unknown>>;
  openReviewCase: MockResponseSpec<Record<string, unknown>>;
  repairBalance: MockResponseSpec<Record<string, unknown>>;
  dismissMismatch: MockResponseSpec<Record<string, unknown>>;
  platformAlerts: MockResponseSpec<Record<string, unknown>>;
  deliveryHealth: MockResponseSpec<Record<string, unknown>>;
  oversightAlerts: MockResponseSpec<Record<string, unknown>>;
  acknowledgeAlert: MockResponseSpec<Record<string, unknown>>;
  routeAlert: MockResponseSpec<Record<string, unknown>>;
  retryDeliveries: MockResponseSpec<Record<string, unknown>>;
  evidence: MockResponseSpec<Record<string, unknown>>;
  approvals: MockResponseSpec<Record<string, unknown>>;
  pendingReleases: MockResponseSpec<Record<string, unknown>>;
  releasedReleases: MockResponseSpec<Record<string, unknown>>;
  recordEvidence: MockResponseSpec<Record<string, unknown>>;
  requestApproval: MockResponseSpec<Record<string, unknown>>;
  approveRelease: MockResponseSpec<Record<string, unknown>>;
  rejectRelease: MockResponseSpec<Record<string, unknown>>;
};

export function buildAdminScenario(
  kind: "happy" | "empty" | "degraded" | "api_error" = "happy",
  overrides: Partial<AdminScenario> = {}
): AdminScenario {
  const selectedReviewCase = reviewCase();
  const selectedIncident = oversightIncident();
  const selectedAlert = platformAlert();
  const approval = launchApproval();
  const recon = reconciliationWorkspace();

  const base: AdminScenario = {
    operationsStatus: {
      data: operationsStatus()
    },
    releaseSummary: {
      data: releaseSummary()
    },
    reviewCases: {
      data: {
        reviewCases: [selectedReviewCase],
        limit: 20
      }
    },
    releaseReviews: {
      data: {
        reviews: [
          {
            reviewCase: selectedReviewCase,
            customer: selectedReviewCase.customer,
            restriction: {
              releaseDecisionStatus: "pending",
              releaseRequestedAt: isoAt(2)
            },
            oversightIncident: {
              status: "open"
            }
          }
        ],
        limit: 20
      }
    },
    reviewWorkspace: {
      data: reviewWorkspace()
    },
    startReviewCase: {
      data: {
        reviewCase: reviewCase("in_progress"),
        stateReused: false
      }
    },
    addReviewCaseNote: {
      data: {
        reviewCase: selectedReviewCase,
        event: {
          id: "review_note_1",
          actorType: "operator",
          actorId: "ops_e2e",
          eventType: "note_added",
          note: "Escalation reviewed.",
          metadata: {},
          createdAt: isoAt(0)
        }
      }
    },
    requestAccountRelease: {
      data: {
        releaseRequest: {
          reviewCaseId: selectedReviewCase.id
        },
        stateReused: false
      }
    },
    resolveReviewCase: {
      data: {
        reviewCase: reviewCase("resolved"),
        stateReused: false
      }
    },
    dismissReviewCase: {
      data: {
        reviewCase: reviewCase("dismissed"),
        stateReused: false
      }
    },
    oversightIncidents: {
      data: {
        oversightIncidents: [selectedIncident],
        limit: 20
      }
    },
    activeAccountHolds: {
      data: {
        holds: [
          {
            hold: {
              id: "hold_1",
              status: "active",
              restrictionReasonCode: "manual_review_hold",
              appliedByOperatorId: "ops_lead",
              appliedByOperatorRole: "risk_manager",
              appliedNote: "Held pending evidence.",
              previousStatus: "active",
              appliedAt: isoAt(4),
              releasedAt: null,
              releasedByOperatorId: null,
              releasedByOperatorRole: null
            },
            customer: selectedIncident.subjectCustomer,
            releaseReview: {
              decisionStatus: "pending"
            }
          }
        ],
        limit: 20
      }
    },
    accountHoldSummary: {
      data: {
        totalHolds: 1,
        activeHolds: 1,
        releasedHolds: 0,
        byIncidentType: [{ incidentType: "manual_resolution_watch", count: 1 }],
        byReasonCode: [{ restrictionReasonCode: "manual_review_hold", count: 1 }],
        byAppliedOperator: [
          {
            appliedByOperatorId: "ops_lead",
            appliedByOperatorRole: "risk_manager",
            count: 1
          }
        ],
        byReleasedOperator: []
      }
    },
    oversightWorkspace: {
      data: oversightWorkspace()
    },
    startOversightIncident: {
      data: {
        oversightIncident: oversightIncident("in_progress"),
        stateReused: false
      }
    },
    addOversightIncidentNote: {
      data: {
        oversightIncident: selectedIncident,
        event: {
          id: "oversight_note_1",
          actorType: "operator",
          actorId: "ops_e2e",
          eventType: "note_added",
          note: "Additional KYC evidence reviewed.",
          metadata: {},
          createdAt: isoAt(0)
        }
      }
    },
    applyAccountRestriction: {
      data: {
        oversightIncident: selectedIncident,
        accountRestriction: oversightWorkspace("open", true).accountRestriction,
        stateReused: false
      }
    },
    resolveOversightIncident: {
      data: {
        oversightIncident: oversightIncident("resolved"),
        stateReused: false
      }
    },
    dismissOversightIncident: {
      data: {
        oversightIncident: oversightIncident("dismissed"),
        stateReused: false
      }
    },
    reconciliationMismatches: {
      data: {
        mismatches: [recon.mismatch],
        limit: 20,
        totalCount: 1,
        summary: {
          byStatus: [{ status: "open", count: 1 }],
          byScope: [{ scope: "customer_balance", count: 1 }],
          bySeverity: [{ severity: "critical", count: 1 }],
          byRecommendedAction: [{ recommendedAction: "repair_balance", count: 1 }]
        }
      }
    },
    reconciliationRuns: {
      data: {
        runs: [
          {
            id: "scan_run_1",
            triggerSource: "scheduled",
            status: "completed",
            requestedScope: "all",
            customerAccountId: null,
            transactionIntentId: null,
            triggeredByOperatorId: null,
            triggeredByWorkerId: "worker_1",
            startedAt: isoAt(2),
            completedAt: isoAt(2),
            durationMs: 3300,
            createdCount: 1,
            reopenedCount: 0,
            refreshedCount: 0,
            autoResolvedCount: 0,
            activeMismatchCount: 1,
            errorCode: null,
            errorMessage: null,
            resultSnapshot: null,
            createdAt: isoAt(2),
            updatedAt: isoAt(2)
          }
        ],
        limit: 10,
        totalCount: 1
      }
    },
    reconciliationWorkspace: {
      data: recon
    },
    replayConfirm: {
      data: {
        mismatch: recon.mismatch
      }
    },
    replaySettle: {
      data: {
        mismatch: recon.mismatch
      }
    },
    openReviewCase: {
      data: {
        mismatch: recon.mismatch
      }
    },
    repairBalance: {
      data: {
        mismatch: recon.mismatch
      }
    },
    dismissMismatch: {
      data: {
        mismatch: {
          ...recon.mismatch,
          status: "dismissed"
        }
      }
    },
    platformAlerts: {
      data: {
        alerts: [selectedAlert],
        limit: 20,
        totalCount: 1
      }
    },
    deliveryHealth: {
      data: {
        generatedAt: isoAt(0),
        lookbackHours: 24,
        summary: {
          totalTargetCount: 2,
          healthyTargetCount: 1,
          warningTargetCount: 0,
          criticalTargetCount: 1
        },
        targets: [
          {
            targetName: "pagerduty-primary",
            targetUrl: "https://pagerduty.example.com",
            deliveryMode: "direct",
            healthStatus: "critical",
            categories: ["delivery"],
            minimumSeverity: "warning",
            eventTypes: ["delivery_failed"],
            failoverTargetNames: [],
            recentDeliveryCount: 3,
            recentSucceededCount: 1,
            recentFailedCount: 2,
            pendingDeliveryCount: 1,
            highestObservedEscalationLevel: 1,
            lastAttemptedAt: isoAt(1),
            lastDeliveredAt: isoAt(6),
            lastFailureAt: isoAt(1),
            lastErrorMessage: "Webhook timeout",
            recentFailureRatePercent: 66,
            consecutiveFailureCount: 2,
            averageDeliveryLatencyMs: 900,
            maxDeliveryLatencyMs: 1400,
            sloBreaches: ["delivery_latency"]
          }
        ]
      }
    },
    oversightAlerts: {
      data: {
        alerts: [
          {
            incidentType: "manual_resolution_watch",
            subjectCustomer: selectedIncident.subjectCustomer,
            subjectOperatorId: null,
            subjectOperatorRole: null,
            count: 3,
            threshold: 2,
            sinceDays: 7,
            latestManualResolutionAt: isoAt(20),
            reasonCodeBreakdown: [],
            openIncidentId: selectedIncident.id,
            recommendedAction: "monitor_existing_incident"
          }
        ],
        limit: 20,
        sinceDays: 7,
        customerThreshold: 2,
        operatorThreshold: 3
      }
    },
    acknowledgeAlert: {
      data: {
        alert: {
          ...selectedAlert,
          acknowledgedAt: isoAt(0),
          acknowledgementNote: "Acknowledged from e2e."
        },
        stateReused: false
      }
    },
    routeAlert: {
      data: {
        alert: {
          ...selectedAlert,
          routingStatus: "routed",
          routedAt: isoAt(0),
          routingTargetType: "review_case",
          routingTargetId: "review_case_1"
        },
        reviewCase: {
          id: "review_case_1",
          status: "pending_review",
          type: "alert_review",
          reasonCode: "delivery_failure",
          assignedOperatorId: "ops_e2e"
        },
        reviewCaseReused: false,
        routingStateReused: false
      }
    },
    retryDeliveries: {
      data: {
        retriedDeliveryCount: 2
      }
    },
    evidence: {
      data: {
        evidence: releaseSummary().recentEvidence,
        limit: 20,
        totalCount: releaseSummary().recentEvidence.length
      }
    },
    approvals: {
      data: {
        approvals: [approval],
        limit: 20,
        totalCount: 1
      }
    },
    pendingReleases: {
      data: {
        releases: [
          {
            id: "release_1",
            customer: {
              email: "amina@example.com"
            },
            status: "pending",
            releaseTarget: "incident_package",
            requestedAt: isoAt(4)
          }
        ],
        limit: 20
      }
    },
    releasedReleases: {
      data: {
        releases: [
          {
            id: "release_done_1",
            customer: {
              email: "old@example.com"
            },
            status: "released",
            releaseTarget: "incident_package",
            requestedAt: isoAt(50)
          }
        ],
        limit: 20
      }
    },
    recordEvidence: {
      data: {
        evidence: {
          ...releaseSummary().recentEvidence[0],
          id: "evidence_4",
          evidenceType: "secret_handling_review",
          environment: "production_like",
          releaseIdentifier: "launch-2026.04.13.1",
          rollbackReleaseIdentifier: null,
          backupReference: null,
          summary: "Secret handling review recorded for the current launch roster.",
          runbookPath: "docs/security/secret-handling-review.md",
          evidenceLinks: ["ticket/SEC-42"],
          observedAt: isoAt(0),
          createdAt: isoAt(0),
          updatedAt: isoAt(0)
        }
      }
    },
    requestApproval: {
      data: {
        approval: {
          ...approval,
          id: "approval_2",
          releaseIdentifier: "launch-2026.04.13.1",
          environment: "production_like",
          summary: "Launch candidate ready for governed approval.",
          requestNote: "All evidence reviewed from the operator console.",
          checklist: {
            securityConfigurationComplete: true,
            accessAndGovernanceComplete: true,
            dataAndRecoveryComplete: true,
            platformHealthComplete: true,
            functionalProofComplete: true,
            contractAndChainProofComplete: true,
            finalSignoffComplete: true,
            unresolvedRisksAccepted: true,
            openBlockers: [],
            residualRiskNote: "Residual launch risks accepted by the requester."
          },
          gate: {
            overallStatus: "ready",
            approvalEligible: true,
            missingChecklistItems: [],
            missingEvidenceTypes: [],
            failedEvidenceTypes: [],
            staleEvidenceTypes: [],
            maximumEvidenceAgeHours: 24,
            openBlockers: [],
            generatedAt: isoAt(0)
          }
        }
      }
    },
    approveRelease: {
      data: approval
    },
    rejectRelease: {
      data: {
        ...approval,
        status: "rejected",
        rejectionNote: "Evidence is stale."
      }
    }
  };

  if (kind === "empty") {
    base.releaseReviews = {
      data: {
        reviews: [],
        limit: 20
      }
    };
    base.activeAccountHolds = {
      data: {
        holds: [],
        limit: 20
      }
    };
    base.platformAlerts = {
      data: {
        alerts: [],
        limit: 20,
        totalCount: 0
      }
    };
  }

  if (kind === "degraded") {
    base.operationsStatus = {
      data: operationsStatus({
        workerHealth: {
          status: "critical",
          staleAfterSeconds: 300,
          totalWorkers: 2,
          healthyWorkers: 0,
          degradedWorkers: 1,
          staleWorkers: 1
        },
        withdrawalExecutionHealth: {
          status: "critical",
          queuedManagedWithdrawalCount: 4,
          broadcastingWithdrawalCount: 2,
          pendingConfirmationWithdrawalCount: 3,
          failedManagedWithdrawalCount: 1,
          manualInterventionWithdrawalCount: 2
        },
        chainHealth: {
          status: "critical",
          laggingBroadcastCount: 3,
          criticalLaggingBroadcastCount: 2,
          recentFailedTransactionCount: 2,
          oldestLaggingBroadcastCreatedAt: isoAt(24)
        }
      })
    };
    base.releaseSummary = {
      data: releaseSummary({
        overallStatus: "critical"
      })
    };
  }

  if (kind === "api_error") {
    base.operationsStatus = {
      ok: false,
      statusCode: 500,
      message: "Operations status unavailable."
    };
    base.releaseSummary = {
      ok: false,
      statusCode: 500,
      message: "Launch readiness unavailable."
    };
    base.reviewCases = {
      ok: false,
      statusCode: 500,
      message: "Queue state unavailable."
    };
    base.oversightIncidents = {
      ok: false,
      statusCode: 500,
      message: "Account review state unavailable."
    };
    base.reconciliationMismatches = {
      ok: false,
      statusCode: 500,
      message: "Reconciliation data unavailable."
    };
    base.platformAlerts = {
      ok: false,
      statusCode: 500,
      message: "Alert state unavailable."
    };
    base.approvals = {
      ok: false,
      statusCode: 500,
      message: "Launch readiness unavailable."
    };
  }

  return {
    ...base,
    ...overrides
  };
}

export async function seedOperatorSession(
  page: Page,
  session: Partial<typeof defaultSession> = {}
): Promise<void> {
  await page.addInitScript(
    ({ storageKey, value }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    },
    {
      storageKey: operatorSessionStorageKey,
      value: {
        ...defaultSession,
        ...session
      }
    }
  );
}

export async function seedAdminLocale(page: Page, locale: "en" | "ar"): Promise<void> {
  await page.addInitScript(
    ({ storageKey, value }) => {
      window.localStorage.setItem(storageKey, value);
    },
    {
      storageKey: adminLocaleStorageKey,
      value: locale
    }
  );
}

export async function mockAdminApi(
  page: Page,
  scenario: Partial<AdminScenario> = {}
): Promise<void> {
  const resolved = buildAdminScenario("happy", scenario);
  const currentEvidence = [
    ...(((resolved.evidence.data as Record<string, unknown> | undefined)?.[
      "evidence"
    ] as Record<string, unknown>[] | undefined) ?? [])
  ];
  const currentApprovals = [
    ...(((resolved.approvals.data as Record<string, unknown> | undefined)?.[
      "approvals"
    ] as Record<string, unknown>[] | undefined) ?? [])
  ];

  await page.route("**/*", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();

    if (pathname.endsWith("/operations/internal/status") && method === "GET") {
      return fulfillJson(route, resolved.operationsStatus);
    }

    if (pathname.endsWith("/release-readiness/internal/summary") && method === "GET") {
      return fulfillJson(route, resolved.releaseSummary);
    }

    if (pathname.endsWith("/review-cases/internal") && method === "GET") {
      return fulfillJson(route, resolved.reviewCases);
    }

    if (
      pathname.endsWith("/review-cases/internal/account-release-requests/pending") &&
      method === "GET"
    ) {
      return fulfillJson(route, resolved.releaseReviews);
    }

    if (/\/review-cases\/internal\/[^/]+\/workspace$/.test(pathname) && method === "GET") {
      return fulfillJson(route, resolved.reviewWorkspace);
    }

    if (/\/review-cases\/internal\/[^/]+\/start$/.test(pathname) && method === "POST") {
      return fulfillJson(route, resolved.startReviewCase);
    }

    if (/\/review-cases\/internal\/[^/]+\/notes$/.test(pathname) && method === "POST") {
      return fulfillJson(route, resolved.addReviewCaseNote);
    }

    if (
      /\/review-cases\/internal\/[^/]+\/request-account-release$/.test(pathname) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.requestAccountRelease);
    }

    if (/\/review-cases\/internal\/[^/]+\/resolve$/.test(pathname) && method === "POST") {
      return fulfillJson(route, resolved.resolveReviewCase);
    }

    if (/\/review-cases\/internal\/[^/]+\/dismiss$/.test(pathname) && method === "POST") {
      return fulfillJson(route, resolved.dismissReviewCase);
    }

    if (pathname.endsWith("/oversight-incidents/internal") && method === "GET") {
      return fulfillJson(route, resolved.oversightIncidents);
    }

    if (
      pathname.endsWith("/oversight-incidents/internal/account-holds/active") &&
      method === "GET"
    ) {
      return fulfillJson(route, resolved.activeAccountHolds);
    }

    if (
      pathname.endsWith("/oversight-incidents/internal/account-holds/summary") &&
      method === "GET"
    ) {
      return fulfillJson(route, resolved.accountHoldSummary);
    }

    if (
      /\/oversight-incidents\/internal\/[^/]+\/workspace$/.test(pathname) &&
      method === "GET"
    ) {
      return fulfillJson(route, resolved.oversightWorkspace);
    }

    if (/\/oversight-incidents\/internal\/[^/]+\/start$/.test(pathname) && method === "POST") {
      return fulfillJson(route, resolved.startOversightIncident);
    }

    if (/\/oversight-incidents\/internal\/[^/]+\/notes$/.test(pathname) && method === "POST") {
      return fulfillJson(route, resolved.addOversightIncidentNote);
    }

    if (
      /\/oversight-incidents\/internal\/[^/]+\/place-account-hold$/.test(pathname) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.applyAccountRestriction);
    }

    if (/\/oversight-incidents\/internal\/[^/]+\/resolve$/.test(pathname) && method === "POST") {
      return fulfillJson(route, resolved.resolveOversightIncident);
    }

    if (/\/oversight-incidents\/internal\/[^/]+\/dismiss$/.test(pathname) && method === "POST") {
      return fulfillJson(route, resolved.dismissOversightIncident);
    }

    if (
      pathname.endsWith("/ledger/internal/reconciliation/mismatches") &&
      method === "GET"
    ) {
      return fulfillJson(route, resolved.reconciliationMismatches);
    }

    if (pathname.endsWith("/ledger/internal/reconciliation/runs") && method === "GET") {
      return fulfillJson(route, resolved.reconciliationRuns);
    }

    if (
      /\/ledger\/internal\/reconciliation\/mismatches\/[^/]+\/workspace$/.test(pathname) &&
      method === "GET"
    ) {
      return fulfillJson(route, resolved.reconciliationWorkspace);
    }

    if (
      /\/ledger\/internal\/reconciliation\/mismatches\/[^/]+\/replay-confirm$/.test(pathname) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.replayConfirm);
    }

    if (
      /\/ledger\/internal\/reconciliation\/mismatches\/[^/]+\/replay-settle$/.test(pathname) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.replaySettle);
    }

    if (
      /\/ledger\/internal\/reconciliation\/mismatches\/[^/]+\/open-review-case$/.test(
        pathname
      ) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.openReviewCase);
    }

    if (
      /\/ledger\/internal\/reconciliation\/mismatches\/[^/]+\/repair-balance$/.test(
        pathname
      ) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.repairBalance);
    }

    if (
      /\/ledger\/internal\/reconciliation\/mismatches\/[^/]+\/dismiss$/.test(pathname) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.dismissMismatch);
    }

    if (pathname.endsWith("/operations/internal/alerts") && method === "GET") {
      return fulfillJson(route, resolved.platformAlerts);
    }

    if (
      pathname.endsWith("/operations/internal/alerts/delivery-target-health") &&
      method === "GET"
    ) {
      return fulfillJson(route, resolved.deliveryHealth);
    }

    if (pathname.endsWith("/oversight-incidents/internal/alerts") && method === "GET") {
      return fulfillJson(route, resolved.oversightAlerts);
    }

    if (
      /\/operations\/internal\/alerts\/[^/]+\/acknowledge$/.test(pathname) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.acknowledgeAlert);
    }

    if (
      /\/operations\/internal\/alerts\/[^/]+\/route-review-case$/.test(pathname) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.routeAlert);
    }

    if (
      /\/operations\/internal\/alerts\/[^/]+\/retry-deliveries$/.test(pathname) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.retryDeliveries);
    }

    if (pathname.endsWith("/release-readiness/internal/evidence") && method === "GET") {
      return fulfillJson(route, {
        ...resolved.evidence,
        data: {
          ...((resolved.evidence.data as Record<string, unknown> | undefined) ?? {}),
          evidence: currentEvidence,
          totalCount: currentEvidence.length
        }
      });
    }

    if (pathname.endsWith("/release-readiness/internal/evidence") && method === "POST") {
      const newEvidence = (resolved.recordEvidence.data as Record<string, unknown> | undefined)
        ?.["evidence"] as Record<string, unknown> | undefined;

      if (newEvidence) {
        currentEvidence.unshift(newEvidence);
      }

      return fulfillJson(route, resolved.recordEvidence);
    }

    if (pathname.endsWith("/release-readiness/internal/approvals") && method === "GET") {
      return fulfillJson(route, {
        ...resolved.approvals,
        data: {
          ...((resolved.approvals.data as Record<string, unknown> | undefined) ?? {}),
          approvals: currentApprovals,
          totalCount: currentApprovals.length
        }
      });
    }

    if (pathname.endsWith("/release-readiness/internal/approvals") && method === "POST") {
      const newApproval = (resolved.requestApproval.data as Record<string, unknown> | undefined)
        ?.["approval"] as Record<string, unknown> | undefined;

      if (newApproval) {
        currentApprovals.unshift(newApproval);
      }

      return fulfillJson(route, resolved.requestApproval);
    }

    if (
      pathname.endsWith("/customer-account-incident-package/internal/releases/pending") &&
      method === "GET"
    ) {
      return fulfillJson(route, resolved.pendingReleases);
    }

    if (
      pathname.endsWith("/customer-account-incident-package/internal/releases/released") &&
      method === "GET"
    ) {
      return fulfillJson(route, resolved.releasedReleases);
    }

    if (
      /\/release-readiness\/internal\/approvals\/[^/]+\/approve$/.test(pathname) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.approveRelease);
    }

    if (
      /\/release-readiness\/internal\/approvals\/[^/]+\/reject$/.test(pathname) &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.rejectRelease);
    }

    return route.fallback();
  });
}

export function operatorSession() {
  return defaultSession;
}
