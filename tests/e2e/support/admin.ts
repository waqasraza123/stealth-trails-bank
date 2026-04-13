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

function launchClosureStatus() {
  return {
    summaryMarkdown: [
      "# Launch-Closure Status",
      "",
      "- local dry-runs are diagnostic only",
      "- accepted launch proof must be recorded through release-readiness evidence",
      "- governed approval remains the final dual-control gate"
    ].join("\n")
  };
}

function launchClosureValidation() {
  return {
    validation: {
      errors: [],
      warnings: [
        "database_restore_drill local dry-runs are diagnostic only and do not satisfy accepted proof."
      ]
    },
    summaryMarkdown: [
      "# Launch-Closure Manifest Validation",
      "",
      "- Release identifier: 2026.04.10-rc1",
      "- Environment: production_like",
      "",
      "## Errors",
      "- none",
      "",
      "## Warnings",
      "- database_restore_drill local dry-runs are diagnostic only and do not satisfy accepted proof."
    ].join("\n")
  };
}

function launchClosureScaffold() {
  return {
    ...launchClosureValidation(),
    outputSubpath: "artifacts/release-launch/2026.04.10-rc1-production_like",
    files: [
      {
        relativePath: "README.md",
        content: "# Phase 12 Launch-Closure Pack\n"
      },
      {
        relativePath: "execution-plan.md",
        content: "pnpm release:readiness:probe -- \\\n  --probe platform_alert_delivery_slo\n"
      },
      {
        relativePath: "approval-request.template.json",
        content: '{\n  "releaseIdentifier": "2026.04.10-rc1"\n}\n'
      },
      {
        relativePath: "evidence/08-final-governed-launch-approval.md",
        content: "# Final Governed Launch Approval\n"
      }
    ]
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

function cloneAdminData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loanTimelineEvent(
  id: string,
  label: string,
  tone: "neutral" | "positive" | "warning" | "critical" | "technical",
  description: string,
  hoursAgo = 0
) {
  return {
    id,
    label,
    tone,
    timestamp: isoAt(hoursAgo),
    description
  };
}

function loanCustomer(status = "active") {
  return {
    customerId: "customer_1",
    customerAccountId: "account_1",
    status,
    email: "amina@example.com",
    firstName: "Amina",
    lastName: "Rahman"
  };
}

function loanPolicyPacks() {
  return [
    {
      jurisdiction: "usa",
      displayName: "United States",
      disclosureTitle: "US managed lending disclosure",
      disclosureBody:
        "Collateralized lending uses a fixed service fee, explicit grace periods, and governed servicing actions.",
      serviceFeeRateBps: 275,
      warningLtvBps: 6800,
      liquidationLtvBps: 8000,
      gracePeriodDays: 10
    },
    {
      jurisdiction: "uae",
      displayName: "United Arab Emirates",
      disclosureTitle: "UAE managed lending disclosure",
      disclosureBody:
        "Requests remain asset-backed with fixed disclosed fees and operator approval before activation.",
      serviceFeeRateBps: 250,
      warningLtvBps: 6700,
      liquidationLtvBps: 7900,
      gracePeriodDays: 7
    }
  ];
}

function buildLoanApplicationList(status = "pending_review", linkedLoanAgreementId: string | null = null) {
  return {
    applications: [
      {
        id: "loan_application_1",
        status,
        jurisdiction: "usa",
        requestedBorrowAmount: "1500",
        requestedCollateralAmount: "2400",
        requestedTermMonths: 12,
        serviceFeeAmount: "41.25",
        customer: loanCustomer(),
        borrowAsset: {
          symbol: "USDC",
          displayName: "USD Coin"
        },
        collateralAsset: {
          symbol: "ETH",
          displayName: "Ethereum"
        },
        linkedLoanAgreementId,
        submittedAt: isoAt(24),
        updatedAt: isoAt(2)
      },
      {
        id: "loan_application_2",
        status: "evidence_requested",
        jurisdiction: "usa",
        requestedBorrowAmount: "500",
        requestedCollateralAmount: "900",
        requestedTermMonths: 6,
        serviceFeeAmount: "13.75",
        customer: {
          ...loanCustomer(),
          email: "sameh@example.com",
          firstName: "Sameh",
          lastName: "Naseem"
        },
        borrowAsset: {
          symbol: "USDC",
          displayName: "USD Coin"
        },
        collateralAsset: {
          symbol: "ETH",
          displayName: "Ethereum"
        },
        linkedLoanAgreementId: null,
        submittedAt: isoAt(30),
        updatedAt: isoAt(6)
      }
    ],
    totalCount: 2,
    limit: 20
  };
}

function buildLoanApplicationWorkspace(status = "pending_review", linkedLoanAgreementId: string | null = null) {
  return {
    application: {
      id: "loan_application_1",
      status,
      jurisdiction: "usa",
      requestedBorrowAmount: "1500",
      requestedCollateralAmount: "2400",
      requestedTermMonths: 12,
      serviceFeeAmount: "41.25",
      autopayEnabled: true,
      quoteSnapshot: {
        principalAmount: "1500",
        collateralAmount: "2400",
        serviceFeeAmount: "41.25",
        totalRepayableAmount: "1541.25",
        installmentAmount: "128.44"
      },
      submittedAt: isoAt(24),
      reviewedAt: status === "pending_review" ? null : isoAt(1),
      reviewedByOperatorId: status === "pending_review" ? null : "ops_e2e",
      reviewedByOperatorRole: status === "pending_review" ? null : "operations_admin",
      decisionNote:
        status === "pending_review"
          ? null
          : "Operator decision captured for the lending workflow.",
      customer: loanCustomer(),
      borrowAsset: {
        symbol: "USDC",
        displayName: "USD Coin",
        chainId: 1,
        decimals: 6
      },
      collateralAsset: {
        symbol: "ETH",
        displayName: "Ethereum",
        chainId: 1,
        decimals: 18
      }
    },
    linkedLoanAgreement: linkedLoanAgreementId
      ? {
          id: linkedLoanAgreementId,
          status: "active",
          principalAmount: "1500",
          outstandingTotalAmount: "1541.25",
          nextDueAt: isoAt(-24 * 14)
        }
      : null,
    timeline: [
      loanTimelineEvent(
        "loan_application_event_1",
        "Application submitted",
        "technical",
        "Customer submitted the lending request with governed disclosures.",
        24
      ),
      loanTimelineEvent(
        "loan_application_event_2",
        status === "evidence_requested"
          ? "Evidence requested"
          : status === "approved"
            ? "Application approved"
            : status === "rejected"
              ? "Application rejected"
              : "Pending review",
        status === "approved"
          ? "positive"
          : status === "rejected"
            ? "critical"
            : "warning",
        status === "evidence_requested"
          ? "Operator requested additional evidence before a decision."
          : status === "approved"
            ? "Operator approved the application and allowed the agreement workflow to continue."
            : status === "rejected"
              ? "Operator rejected the application after review."
              : "Application is waiting for an operator decision.",
        2
      )
    ]
  };
}

function buildLoanAgreementList(status = "active", liquidationStatus: string | null = null) {
  return {
    agreements: [
      {
        id: "loan_agreement_1",
        status,
        jurisdiction: "usa",
        principalAmount: "900",
        collateralAmount: "1600",
        outstandingTotalAmount: "924.75",
        autopayEnabled: true,
        nextDueAt: isoAt(-24 * 14),
        customer: loanCustomer(),
        borrowAsset: "USDC",
        collateralAsset: "ETH",
        collateralStatus: "healthy",
        liquidationStatus
      }
    ],
    totalCount: 1,
    limit: 20
  };
}

function buildLoanAgreementWorkspace(status = "active", liquidationStatus: string | null = null) {
  return {
    agreement: {
      id: "loan_agreement_1",
      applicationId: "loan_application_legacy",
      status,
      jurisdiction: "usa",
      principalAmount: "900",
      collateralAmount: "1600",
      serviceFeeAmount: "24.75",
      outstandingTotalAmount: "924.75",
      contractLoanId: "contract_loan_1",
      contractAddress: "0x0000000000000000000000000000000000000def",
      activationTransactionHash:
        "0xabc1111222233334444555566667777888899990000aaaabbbbccccdddd9999",
      autopayEnabled: true,
      nextDueAt: isoAt(-24 * 14),
      gracePeriodEndsAt: null,
      delinquentAt: null,
      defaultedAt: null,
      liquidationStartedAt:
        liquidationStatus === null ? null : isoAt(1),
      customer: loanCustomer(),
      borrowAsset: {
        symbol: "USDC",
        displayName: "USD Coin"
      },
      collateralAsset: {
        symbol: "ETH",
        displayName: "Ethereum"
      }
    },
    installments: [
      {
        id: "agreement_installment_1",
        installmentNumber: 1,
        dueAt: isoAt(-24 * 14),
        status: "due",
        scheduledTotalAmount: "102.75",
        paidTotalAmount: "0",
        lastAutopayAttemptAt: isoAt(2)
      }
    ],
    collateralPositions: [
      {
        id: "agreement_collateral_1",
        amount: "1600",
        status: "active",
        walletAddress: "0x1111222233334444555566667777888899990000",
        currentValuationUsd: "1625",
        latestLtvBps: 5691
      }
    ],
    valuations: [
      {
        id: "agreement_valuation_1",
        priceUsd: "1.01",
        collateralValueUsd: "1625",
        principalValueUsd: "924.75",
        ltvBps: 5691,
        observedAt: isoAt(1)
      }
    ],
    repayments: [
      {
        id: "agreement_repayment_1",
        status: "scheduled",
        amount: "102.75",
        principalAppliedAmount: "100",
        serviceFeeAppliedAmount: "2.75",
        failureReason: null,
        autopayAttempted: true,
        autopaySucceeded: false,
        createdAt: isoAt(2),
        settledAt: null
      }
    ],
    statements: [
      {
        id: "statement_1",
        referenceId: "loan-statement-2026-04",
        statementDate: "2026-04-01"
      }
    ],
    liquidationCases:
      liquidationStatus === null
        ? []
        : [
            {
              id: "liquidation_case_1",
              status: liquidationStatus,
              reasonCode: "ltv_breach",
              note: "Collateral health crossed the liquidation threshold.",
              executionTransactionHash:
                liquidationStatus === "executed"
                  ? "0xfeed1111222233334444555566667777888899990000aaaabbbbccccdddd9999"
                  : null,
              recoveredAmount:
                liquidationStatus === "executed" ? "924.75" : null,
              shortfallAmount: liquidationStatus === "executed" ? "0" : null,
              createdAt: isoAt(1),
              updatedAt: isoAt(0)
            }
          ],
    timeline: [
      loanTimelineEvent(
        "loan_agreement_event_1",
        "Agreement active",
        "positive",
        "Funding completed and the agreement entered servicing.",
        48
      ),
      ...(liquidationStatus === null
        ? []
        : [
            loanTimelineEvent(
              "loan_agreement_event_2",
              liquidationStatus === "approved"
                ? "Liquidation approved"
                : liquidationStatus === "executed"
                  ? "Liquidation executed"
                  : "Liquidation review started",
              liquidationStatus === "executed" ? "critical" : "warning",
              liquidationStatus === "approved"
                ? "Governed approval was recorded for the liquidation case."
                : liquidationStatus === "executed"
                  ? "Collateral liquidation completed and recovery was recorded."
                  : "Collateral distress triggered a governed liquidation review.",
              1
            )
          ])
    ]
  };
}

export type AdminScenario = {
  operationsStatus: MockResponseSpec<Record<string, unknown>>;
  loanSummary: MockResponseSpec<Record<string, unknown>>;
  loanApplications: MockResponseSpec<Record<string, unknown>>;
  loanApplicationWorkspace: MockResponseSpec<Record<string, unknown>>;
  requestLoanEvidence: MockResponseSpec<Record<string, unknown>>;
  approveLoanApplication: MockResponseSpec<Record<string, unknown>>;
  rejectLoanApplication: MockResponseSpec<Record<string, unknown>>;
  placeLoanAccountRestriction: MockResponseSpec<Record<string, unknown>>;
  loanAgreements: MockResponseSpec<Record<string, unknown>>;
  loanAgreementWorkspace: MockResponseSpec<Record<string, unknown>>;
  startLoanLiquidationReview: MockResponseSpec<Record<string, unknown>>;
  approveLoanLiquidation: MockResponseSpec<Record<string, unknown>>;
  executeLoanLiquidation: MockResponseSpec<Record<string, unknown>>;
  closeLoanAgreement: MockResponseSpec<Record<string, unknown>>;
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
  launchClosureStatus: MockResponseSpec<Record<string, unknown>>;
  validateLaunchClosure: MockResponseSpec<Record<string, unknown>>;
  scaffoldLaunchClosure: MockResponseSpec<Record<string, unknown>>;
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
  const loanApplications = buildLoanApplicationList();
  const loanAgreements = buildLoanAgreementList();

  const base: AdminScenario = {
    operationsStatus: {
      data: operationsStatus()
    },
    loanSummary: {
      data: {
        applicationBacklog: [
          { status: "pending_review", count: 1 },
          { status: "evidence_requested", count: 1 }
        ],
        agreementStates: [{ status: "active", count: 1 }],
        liquidationStates: [],
        policyPacks: loanPolicyPacks()
      }
    },
    loanApplications: {
      data: loanApplications
    },
    loanApplicationWorkspace: {
      data: buildLoanApplicationWorkspace()
    },
    requestLoanEvidence: {
      data: {
        loanApplicationId: "loan_application_1",
        status: "evidence_requested"
      }
    },
    approveLoanApplication: {
      data: {
        loanApplicationId: "loan_application_1",
        status: "approved",
        loanAgreementId: "loan_agreement_approved_1",
        contractLoanId: "contract_loan_approved_1"
      }
    },
    rejectLoanApplication: {
      data: {
        loanApplicationId: "loan_application_1",
        status: "rejected"
      }
    },
    placeLoanAccountRestriction: {
      data: {
        customerAccountId: "account_1",
        status: "restricted"
      }
    },
    loanAgreements: {
      data: loanAgreements
    },
    loanAgreementWorkspace: {
      data: buildLoanAgreementWorkspace()
    },
    startLoanLiquidationReview: {
      data: {
        liquidationCaseId: "liquidation_case_1",
        status: "review_started"
      }
    },
    approveLoanLiquidation: {
      data: {
        liquidationCaseId: "liquidation_case_1",
        status: "approved"
      }
    },
    executeLoanLiquidation: {
      data: {
        liquidationCaseId: "liquidation_case_1",
        status: "executed"
      }
    },
    closeLoanAgreement: {
      data: {
        loanAgreementId: "loan_agreement_1",
        status: "closed"
      }
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
    },
    launchClosureStatus: {
      data: launchClosureStatus()
    },
    validateLaunchClosure: {
      data: launchClosureValidation()
    },
    scaffoldLaunchClosure: {
      data: launchClosureScaffold()
    }
  };

  if (kind === "empty") {
    base.loanSummary = {
      data: {
        applicationBacklog: [],
        agreementStates: [],
        liquidationStates: [],
        policyPacks: loanPolicyPacks()
      }
    };
    base.loanApplications = {
      data: {
        applications: [],
        totalCount: 0,
        limit: 20
      }
    };
    base.loanAgreements = {
      data: {
        agreements: [],
        totalCount: 0,
        limit: 20
      }
    };
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
    base.loanSummary = {
      ok: false,
      statusCode: 500,
      message: "Failed to load loan operations summary."
    };
    base.loanApplications = {
      ok: false,
      statusCode: 500,
      message: "Failed to load loan applications."
    };
    base.loanAgreements = {
      ok: false,
      statusCode: 500,
      message: "Failed to load loan agreements."
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
  const currentLoanApplications = cloneAdminData(
    (((resolved.loanApplications.data as Record<string, unknown> | undefined)?.[
      "applications"
    ] as Array<Record<string, any>> | undefined) ?? [])
  ) as Array<Record<string, any>>;
  const currentLoanAgreements = cloneAdminData(
    (((resolved.loanAgreements.data as Record<string, unknown> | undefined)?.[
      "agreements"
    ] as Array<Record<string, any>> | undefined) ?? [])
  ) as Array<Record<string, any>>;
  const currentLoanApplicationWorkspace = cloneAdminData(
    ((resolved.loanApplicationWorkspace.data as Record<string, unknown> | undefined) ??
      buildLoanApplicationWorkspace()) as Record<string, any>
  ) as any;
  const currentLoanAgreementWorkspace = cloneAdminData(
    ((resolved.loanAgreementWorkspace.data as Record<string, unknown> | undefined) ??
      buildLoanAgreementWorkspace()) as Record<string, any>
  ) as any;

  function currentLoanPolicyPacks() {
    return (
      ((resolved.loanSummary.data as Record<string, unknown> | undefined)?.[
        "policyPacks"
      ] as Record<string, unknown>[] | undefined) ?? loanPolicyPacks()
    );
  }

  function buildLoanSummaryState() {
    const applicationCounts = new Map<string, number>();
    const agreementCounts = new Map<string, number>();
    const liquidationCounts = new Map<string, number>();

    for (const application of currentLoanApplications) {
      const status = String(application.status ?? "unknown");
      applicationCounts.set(status, (applicationCounts.get(status) ?? 0) + 1);
    }

    for (const agreement of currentLoanAgreements) {
      const status = String(agreement.status ?? "unknown");
      agreementCounts.set(status, (agreementCounts.get(status) ?? 0) + 1);
      const liquidationStatus = agreement.liquidationStatus;
      if (typeof liquidationStatus === "string" && liquidationStatus.length > 0) {
        liquidationCounts.set(
          liquidationStatus,
          (liquidationCounts.get(liquidationStatus) ?? 0) + 1
        );
      }
    }

    return {
      applicationBacklog: Array.from(applicationCounts.entries()).map(([status, count]) => ({
        status,
        count
      })),
      agreementStates: Array.from(agreementCounts.entries()).map(([status, count]) => ({
        status,
        count
      })),
      liquidationStates: Array.from(liquidationCounts.entries()).map(([status, count]) => ({
        status,
        count
      })),
      policyPacks: currentLoanPolicyPacks()
    };
  }

  await page.route("**/*", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();

    if (pathname.endsWith("/operations/internal/status") && method === "GET") {
      return fulfillJson(route, resolved.operationsStatus);
    }

    if (pathname.endsWith("/loans/internal/summary") && method === "GET") {
      if (resolved.loanSummary.ok === false) {
        return fulfillJson(route, resolved.loanSummary);
      }

      return fulfillJson(route, {
        ...resolved.loanSummary,
        data: buildLoanSummaryState()
      });
    }

    if (pathname.endsWith("/loans/internal/applications") && method === "GET") {
      if (resolved.loanApplications.ok === false) {
        return fulfillJson(route, resolved.loanApplications);
      }

      return fulfillJson(route, {
        ...resolved.loanApplications,
        data: {
          applications: currentLoanApplications,
          totalCount: currentLoanApplications.length,
          limit:
            ((resolved.loanApplications.data as Record<string, unknown> | undefined)?.[
              "limit"
            ] as number | undefined) ?? 20
        }
      });
    }

    if (/\/loans\/internal\/applications\/[^/]+\/workspace$/.test(pathname) && method === "GET") {
      const loanApplicationId = pathname.split("/").slice(-2)[0];

      if (resolved.loanApplicationWorkspace.ok === false) {
        return fulfillJson(route, resolved.loanApplicationWorkspace);
      }

      if (
        currentLoanApplicationWorkspace.application &&
        currentLoanApplicationWorkspace.application.id === loanApplicationId
      ) {
        return fulfillJson(route, {
          ...resolved.loanApplicationWorkspace,
          data: currentLoanApplicationWorkspace
        });
      }

      const selectedApplication = currentLoanApplications.find(
        (application) => application.id === loanApplicationId
      );

      return fulfillJson(route, {
        ...resolved.loanApplicationWorkspace,
        data: {
          application: selectedApplication ?? currentLoanApplicationWorkspace.application,
          linkedLoanAgreement: null,
          timeline: []
        }
      });
    }

    if (
      /\/loans\/internal\/applications\/[^/]+\/request-more-evidence$/.test(pathname) &&
      method === "POST"
    ) {
      if (resolved.requestLoanEvidence.ok === false) {
        return fulfillJson(route, resolved.requestLoanEvidence);
      }

      const note =
        ((request.postDataJSON() as Record<string, unknown> | null)?.note as string | undefined) ??
        null;

      currentLoanApplicationWorkspace.application.status = "evidence_requested";
      currentLoanApplicationWorkspace.application.reviewedAt = isoAt(0);
      currentLoanApplicationWorkspace.application.reviewedByOperatorId = "ops_e2e";
      currentLoanApplicationWorkspace.application.reviewedByOperatorRole = "operations_admin";
      currentLoanApplicationWorkspace.application.decisionNote = note;
      currentLoanApplicationWorkspace.timeline.unshift(
        loanTimelineEvent(
          "loan_application_event_evidence",
          "Evidence requested",
          "warning",
          note ?? "Operator requested additional evidence before continuing."
        )
      );

      const currentApplication = currentLoanApplications.find(
        (application) => application.id === "loan_application_1"
      );
      if (currentApplication) {
        currentApplication.status = "evidence_requested";
        currentApplication.updatedAt = isoAt(0);
      }

      return fulfillJson(route, {
        ...resolved.requestLoanEvidence,
        data: {
          loanApplicationId: "loan_application_1",
          status: "evidence_requested"
        }
      });
    }

    if (
      /\/loans\/internal\/applications\/[^/]+\/approve$/.test(pathname) &&
      method === "POST"
    ) {
      if (resolved.approveLoanApplication.ok === false) {
        return fulfillJson(route, resolved.approveLoanApplication);
      }

      const note =
        ((request.postDataJSON() as Record<string, unknown> | null)?.note as string | undefined) ??
        null;
      const newAgreementId =
        ((resolved.approveLoanApplication.data as Record<string, unknown> | undefined)?.[
          "loanAgreementId"
        ] as string | undefined) ?? "loan_agreement_approved_1";

      currentLoanApplicationWorkspace.application.status = "approved";
      currentLoanApplicationWorkspace.application.reviewedAt = isoAt(0);
      currentLoanApplicationWorkspace.application.reviewedByOperatorId = "ops_e2e";
      currentLoanApplicationWorkspace.application.reviewedByOperatorRole = "operations_admin";
      currentLoanApplicationWorkspace.application.decisionNote = note;
      currentLoanApplicationWorkspace.linkedLoanAgreement = {
        id: newAgreementId,
        status: "active",
        principalAmount: "1500",
        outstandingTotalAmount: "1541.25",
        nextDueAt: isoAt(-24 * 30)
      };
      currentLoanApplicationWorkspace.timeline.unshift(
        loanTimelineEvent(
          "loan_application_event_approved",
          "Application approved",
          "positive",
          note ?? "Operator approved the application."
        )
      );

      const currentApplication = currentLoanApplications.find(
        (application) => application.id === "loan_application_1"
      );
      if (currentApplication) {
        currentApplication.status = "approved";
        currentApplication.updatedAt = isoAt(0);
        currentApplication.linkedLoanAgreementId = newAgreementId;
      }

      currentLoanAgreements.unshift({
        id: newAgreementId,
        status: "active",
        jurisdiction: "usa",
        principalAmount: "1500",
        collateralAmount: "2400",
        outstandingTotalAmount: "1541.25",
        autopayEnabled: true,
        nextDueAt: isoAt(-24 * 30),
        customer: loanCustomer(),
        borrowAsset: "USDC",
        collateralAsset: "ETH",
        collateralStatus: "healthy",
        liquidationStatus: null
      });

      return fulfillJson(route, {
        ...resolved.approveLoanApplication,
        data: {
          loanApplicationId: "loan_application_1",
          status: "approved",
          loanAgreementId: newAgreementId,
          contractLoanId:
            ((resolved.approveLoanApplication.data as Record<string, unknown> | undefined)?.[
              "contractLoanId"
            ] as string | undefined) ?? "contract_loan_approved_1"
        }
      });
    }

    if (
      /\/loans\/internal\/applications\/[^/]+\/reject$/.test(pathname) &&
      method === "POST"
    ) {
      if (resolved.rejectLoanApplication.ok === false) {
        return fulfillJson(route, resolved.rejectLoanApplication);
      }

      const note =
        ((request.postDataJSON() as Record<string, unknown> | null)?.note as string | undefined) ??
        null;

      currentLoanApplicationWorkspace.application.status = "rejected";
      currentLoanApplicationWorkspace.application.reviewedAt = isoAt(0);
      currentLoanApplicationWorkspace.application.reviewedByOperatorId = "ops_e2e";
      currentLoanApplicationWorkspace.application.reviewedByOperatorRole = "operations_admin";
      currentLoanApplicationWorkspace.application.decisionNote = note;
      currentLoanApplicationWorkspace.timeline.unshift(
        loanTimelineEvent(
          "loan_application_event_rejected",
          "Application rejected",
          "critical",
          note ?? "Operator rejected the application."
        )
      );

      const currentApplication = currentLoanApplications.find(
        (application) => application.id === "loan_application_1"
      );
      if (currentApplication) {
        currentApplication.status = "rejected";
        currentApplication.updatedAt = isoAt(0);
      }

      return fulfillJson(route, {
        ...resolved.rejectLoanApplication,
        data: {
          loanApplicationId: "loan_application_1",
          status: "rejected"
        }
      });
    }

    if (
      /\/loans\/internal\/applications\/[^/]+\/place-account-restriction$/.test(pathname) &&
      method === "POST"
    ) {
      if (resolved.placeLoanAccountRestriction.ok === false) {
        return fulfillJson(route, resolved.placeLoanAccountRestriction);
      }

      currentLoanApplicationWorkspace.application.customer.status = "restricted";
      currentLoanApplicationWorkspace.timeline.unshift(
        loanTimelineEvent(
          "loan_application_event_restricted",
          "Account restricted",
          "critical",
          "Governed account restriction was recorded against the customer account."
        )
      );

      for (const application of currentLoanApplications) {
        if (application.customer?.customerAccountId === "account_1") {
          application.customer = {
            ...application.customer,
            status: "restricted"
          };
        }
      }

      return fulfillJson(route, {
        ...resolved.placeLoanAccountRestriction,
        data: {
          customerAccountId: "account_1",
          status: "restricted"
        }
      });
    }

    if (pathname.endsWith("/loans/internal/agreements") && method === "GET") {
      if (resolved.loanAgreements.ok === false) {
        return fulfillJson(route, resolved.loanAgreements);
      }

      return fulfillJson(route, {
        ...resolved.loanAgreements,
        data: {
          agreements: currentLoanAgreements,
          totalCount: currentLoanAgreements.length,
          limit:
            ((resolved.loanAgreements.data as Record<string, unknown> | undefined)?.[
              "limit"
            ] as number | undefined) ?? 20
        }
      });
    }

    if (/\/loans\/internal\/agreements\/[^/]+\/workspace$/.test(pathname) && method === "GET") {
      const loanAgreementId = pathname.split("/").slice(-2)[0];

      if (resolved.loanAgreementWorkspace.ok === false) {
        return fulfillJson(route, resolved.loanAgreementWorkspace);
      }

      if (
        currentLoanAgreementWorkspace.agreement &&
        currentLoanAgreementWorkspace.agreement.id === loanAgreementId
      ) {
        return fulfillJson(route, {
          ...resolved.loanAgreementWorkspace,
          data: currentLoanAgreementWorkspace
        });
      }

      const selectedAgreement = currentLoanAgreements.find(
        (agreement) => agreement.id === loanAgreementId
      );

      return fulfillJson(route, {
        ...resolved.loanAgreementWorkspace,
        data: {
          agreement: selectedAgreement ?? currentLoanAgreementWorkspace.agreement,
          installments: [],
          collateralPositions: [],
          valuations: [],
          repayments: [],
          statements: [],
          liquidationCases: [],
          timeline: []
        }
      });
    }

    if (
      /\/loans\/internal\/agreements\/[^/]+\/start-liquidation-review$/.test(pathname) &&
      method === "POST"
    ) {
      if (resolved.startLoanLiquidationReview.ok === false) {
        return fulfillJson(route, resolved.startLoanLiquidationReview);
      }

      currentLoanAgreementWorkspace.agreement.status = "liquidation_review";
      currentLoanAgreementWorkspace.agreement.liquidationStartedAt = isoAt(0);
      currentLoanAgreementWorkspace.liquidationCases = [
        {
          id: "liquidation_case_1",
          status: "review_started",
          reasonCode: "ltv_breach",
          note: "Collateral health crossed the liquidation threshold.",
          executionTransactionHash: null,
          recoveredAmount: null,
          shortfallAmount: null,
          createdAt: isoAt(0),
          updatedAt: isoAt(0)
        }
      ];
      currentLoanAgreementWorkspace.timeline.unshift(
        loanTimelineEvent(
          "loan_agreement_event_liquidation_review",
          "Liquidation review started",
          "warning",
          "Collateral distress triggered a governed liquidation review."
        )
      );

      const currentAgreement = currentLoanAgreements.find(
        (agreement) => agreement.id === "loan_agreement_1"
      );
      if (currentAgreement) {
        currentAgreement.status = "liquidation_review";
        currentAgreement.liquidationStatus = "review_started";
      }

      return fulfillJson(route, {
        ...resolved.startLoanLiquidationReview,
        data: {
          liquidationCaseId: "liquidation_case_1",
          status: "review_started"
        }
      });
    }

    if (
      /\/loans\/internal\/agreements\/[^/]+\/approve-liquidation$/.test(pathname) &&
      method === "POST"
    ) {
      if (resolved.approveLoanLiquidation.ok === false) {
        return fulfillJson(route, resolved.approveLoanLiquidation);
      }

      currentLoanAgreementWorkspace.agreement.status = "liquidation_approved";
      if (currentLoanAgreementWorkspace.liquidationCases[0]) {
        currentLoanAgreementWorkspace.liquidationCases[0].status = "approved";
        currentLoanAgreementWorkspace.liquidationCases[0].updatedAt = isoAt(0);
      }
      currentLoanAgreementWorkspace.timeline.unshift(
        loanTimelineEvent(
          "loan_agreement_event_liquidation_approved",
          "Liquidation approved",
          "warning",
          "Governed approval was recorded for the liquidation case."
        )
      );

      const currentAgreement = currentLoanAgreements.find(
        (agreement) => agreement.id === "loan_agreement_1"
      );
      if (currentAgreement) {
        currentAgreement.status = "liquidation_approved";
        currentAgreement.liquidationStatus = "approved";
      }

      return fulfillJson(route, {
        ...resolved.approveLoanLiquidation,
        data: {
          liquidationCaseId: "liquidation_case_1",
          status: "approved"
        }
      });
    }

    if (
      /\/loans\/internal\/agreements\/[^/]+\/execute-liquidation$/.test(pathname) &&
      method === "POST"
    ) {
      if (resolved.executeLoanLiquidation.ok === false) {
        return fulfillJson(route, resolved.executeLoanLiquidation);
      }

      currentLoanAgreementWorkspace.agreement.status = "liquidated";
      if (currentLoanAgreementWorkspace.liquidationCases[0]) {
        currentLoanAgreementWorkspace.liquidationCases[0].status = "executed";
        currentLoanAgreementWorkspace.liquidationCases[0].executionTransactionHash =
          "0xfeed1111222233334444555566667777888899990000aaaabbbbccccdddd9999";
        currentLoanAgreementWorkspace.liquidationCases[0].recoveredAmount = "924.75";
        currentLoanAgreementWorkspace.liquidationCases[0].shortfallAmount = "0";
        currentLoanAgreementWorkspace.liquidationCases[0].updatedAt = isoAt(0);
      }
      currentLoanAgreementWorkspace.timeline.unshift(
        loanTimelineEvent(
          "loan_agreement_event_liquidation_executed",
          "Liquidation executed",
          "critical",
          "Collateral liquidation completed and recovery was recorded."
        )
      );

      const currentAgreement = currentLoanAgreements.find(
        (agreement) => agreement.id === "loan_agreement_1"
      );
      if (currentAgreement) {
        currentAgreement.status = "liquidated";
        currentAgreement.liquidationStatus = "executed";
      }

      return fulfillJson(route, {
        ...resolved.executeLoanLiquidation,
        data: {
          liquidationCaseId: "liquidation_case_1",
          status: "executed"
        }
      });
    }

    if (/\/loans\/internal\/agreements\/[^/]+\/close$/.test(pathname) && method === "POST") {
      if (resolved.closeLoanAgreement.ok === false) {
        return fulfillJson(route, resolved.closeLoanAgreement);
      }

      currentLoanAgreementWorkspace.agreement.status = "closed";
      currentLoanAgreementWorkspace.agreement.nextDueAt = null;
      currentLoanAgreementWorkspace.timeline.unshift(
        loanTimelineEvent(
          "loan_agreement_event_closed",
          "Agreement closed",
          "positive",
          "Loan agreement servicing is complete and the agreement was closed."
        )
      );

      const currentAgreement = currentLoanAgreements.find(
        (agreement) => agreement.id === "loan_agreement_1"
      );
      if (currentAgreement) {
        currentAgreement.status = "closed";
        currentAgreement.nextDueAt = null;
      }

      return fulfillJson(route, {
        ...resolved.closeLoanAgreement,
        data: {
          loanAgreementId: "loan_agreement_1",
          status: "closed"
        }
      });
    }

    if (pathname.endsWith("/release-readiness/internal/summary") && method === "GET") {
      return fulfillJson(route, resolved.releaseSummary);
    }

    if (
      pathname.endsWith("/release-readiness/internal/launch-closure/status") &&
      method === "GET"
    ) {
      return fulfillJson(route, resolved.launchClosureStatus);
    }

    if (
      pathname.endsWith("/release-readiness/internal/launch-closure/validate") &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.validateLaunchClosure);
    }

    if (
      pathname.endsWith("/release-readiness/internal/launch-closure/scaffold") &&
      method === "POST"
    ) {
      return fulfillJson(route, resolved.scaffoldLaunchClosure);
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
