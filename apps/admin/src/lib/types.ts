export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type OperatorSession = {
  baseUrl: string;
  operatorId: string;
  operatorRole: string;
  apiKey: string;
};

export type ApiResponseEnvelope<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
  error?: unknown;
};

export type ManualResolutionSummary = {
  totalIntents: number;
  byIntentType: Array<{
    intentType: string;
    count: number;
  }>;
  byReasonCode: Array<{
    manualResolutionReasonCode: string;
    count: number;
  }>;
  byOperator: Array<{
    manualResolvedByOperatorId: string;
    manualResolutionOperatorRole: string | null;
    count: number;
  }>;
};

export type LatestBlockchainTransaction = {
  id: string;
  txHash: string | null;
  status: string;
  fromAddress: string | null;
  toAddress: string | null;
  broadcastAt: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};

export type TransactionIntent = {
  id: string;
  intentType: string;
  status: string;
  policyDecision: string;
  requestedAmount: string;
  settledAmount: string | null;
  failureCode: string | null;
  failureReason: string | null;
  executionFailureCategory: string | null;
  executionFailureObservedAt: string | null;
  manualInterventionRequiredAt: string | null;
  manualInterventionReviewCaseId: string | null;
  manuallyResolvedAt: string | null;
  manualResolutionReasonCode: string | null;
  manualResolutionNote: string | null;
  manualResolvedByOperatorId: string | null;
  manualResolutionOperatorRole: string | null;
  manualResolutionReviewCaseId: string | null;
  sourceWalletId: string | null;
  sourceWalletAddress: string | null;
  destinationWalletId: string | null;
  destinationWalletAddress: string | null;
  externalAddress: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  latestBlockchainTransaction: LatestBlockchainTransaction | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewCase = {
  id: string;
  type: string;
  status: string;
  reasonCode: string | null;
  notes: string | null;
  assignedOperatorId: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    customerId: string | null;
    supabaseUserId: string | null;
    email: string | null;
    firstName: string;
    lastName: string;
  };
  customerAccountId: string | null;
  transactionIntent: TransactionIntent | null;
};

export type ManualResolutionEligibility = {
  eligible: boolean;
  reasonCode: string;
  reason: string;
  operatorRole: string | null;
  operatorAuthorized: boolean;
  allowedOperatorRoles: string[];
  currentIntentStatus: string | null;
  currentReviewCaseStatus: string;
  currentReviewCaseType: string;
  recommendedAction: string;
};

export type ReviewCaseEvent = {
  id: string;
  actorType: string;
  actorId: string | null;
  eventType: string;
  note: string | null;
  metadata: JsonValue;
  createdAt: string;
};

export type AuditTimelineEntry = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: JsonValue;
  createdAt: string;
};

export type AuditEventListEntry = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: JsonValue | null;
  createdAt: string;
  customer: {
    customerId: string;
    supabaseUserId: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

export type AuditEventList = {
  events: AuditEventListEntry[];
  limit: number;
  totalCount: number;
  filters: {
    search: string | null;
    customerId: string | null;
    email: string | null;
    actorType: string | null;
    actorId: string | null;
    action: string | null;
    targetType: string | null;
    targetId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
};

export type LedgerReconciliationMismatch = {
  id: string;
  mismatchKey: string;
  scope: string;
  status: string;
  severity: string;
  recommendedAction: string;
  reasonCode: string;
  summary: string;
  chainId: number;
  customer: {
    customerId: string | null;
    email: string | null;
    supabaseUserId: string | null;
    firstName: string;
    lastName: string;
  } | null;
  customerAccount: {
    customerAccountId: string | null;
    status: string | null;
  } | null;
  asset: {
    assetId: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  } | null;
  transactionIntent: {
    transactionIntentId: string;
    intentType: string;
    status: string;
    policyDecision: string;
    requestedAmount: string;
    settledAmount: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  linkedReviewCase: {
    reviewCaseId: string;
    type: string;
    status: string;
    assignedOperatorId: string | null;
    updatedAt: string;
  } | null;
  latestSnapshot: JsonValue;
  resolutionMetadata: JsonValue | null;
  resolutionNote: string | null;
  detectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  resolvedByOperatorId: string | null;
  dismissedAt: string | null;
  dismissedByOperatorId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LedgerReconciliationMismatchList = {
  mismatches: LedgerReconciliationMismatch[];
  limit: number;
  totalCount: number;
  summary: {
    byStatus: Array<{
      status: string;
      count: number;
    }>;
    byScope: Array<{
      scope: string;
      count: number;
    }>;
    bySeverity: Array<{
      severity: string;
      count: number;
    }>;
    byRecommendedAction: Array<{
      recommendedAction: string;
      count: number;
    }>;
  };
};

export type ScanLedgerReconciliationResult = {
  scanRun: LedgerReconciliationScanRun;
  result: {
    scannedAt: string;
    createdCount: number;
    reopenedCount: number;
    refreshedCount: number;
    autoResolvedCount: number;
    activeMismatchCount: number;
    mismatches: LedgerReconciliationMismatch[];
  };
};

export type LedgerReconciliationScanRun = {
  id: string;
  triggerSource: string;
  status: string;
  requestedScope: string | null;
  customerAccountId: string | null;
  transactionIntentId: string | null;
  triggeredByOperatorId: string | null;
  triggeredByWorkerId: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  createdCount: number;
  reopenedCount: number;
  refreshedCount: number;
  autoResolvedCount: number;
  activeMismatchCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  resultSnapshot: JsonValue | null;
  createdAt: string;
  updatedAt: string;
};

export type LedgerReconciliationScanRunList = {
  runs: LedgerReconciliationScanRun[];
  limit: number;
  totalCount: number;
};

export type WorkerRuntimeHealth = {
  workerId: string;
  healthStatus: "healthy" | "degraded" | "stale";
  environment: string;
  executionMode: string;
  lastIterationStatus: string;
  lastHeartbeatAt: string;
  lastIterationStartedAt: string | null;
  lastIterationCompletedAt: string | null;
  consecutiveFailureCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastReconciliationScanRunId: string | null;
  lastReconciliationScanStartedAt: string | null;
  lastReconciliationScanCompletedAt: string | null;
  lastReconciliationScanStatus: string | null;
  runtimeMetadata: JsonValue | null;
  latestIterationMetrics: JsonValue | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkerRuntimeHealthList = {
  workers: WorkerRuntimeHealth[];
  limit: number;
  staleAfterSeconds: number;
  totalCount: number;
};

export type PlatformAlert = {
  id: string;
  dedupeKey: string;
  category: string;
  severity: string;
  status: string;
  routingStatus: "unrouted" | "routed";
  routingTargetType: "review_case" | null;
  routingTargetId: string | null;
  routedAt: string | null;
  routedByOperatorId: string | null;
  routingNote: string | null;
  ownerOperatorId: string | null;
  ownerAssignedAt: string | null;
  ownerAssignedByOperatorId: string | null;
  ownershipNote: string | null;
  acknowledgedAt: string | null;
  acknowledgedByOperatorId: string | null;
  acknowledgementNote: string | null;
  suppressedUntil: string | null;
  suppressedByOperatorId: string | null;
  suppressionNote: string | null;
  isAcknowledged: boolean;
  hasActiveSuppression: boolean;
  deliverySummary: {
    totalCount: number;
    pendingCount: number;
    failedCount: number;
    escalatedCount: number;
    reEscalationCount: number;
    highestEscalationLevel: number;
    lastAttemptedAt: string | null;
    lastEventType: string | null;
    lastStatus: "pending" | "succeeded" | "failed" | null;
    lastTargetName: string | null;
    lastEscalatedFromTargetName: string | null;
    lastErrorMessage: string | null;
  };
  code: string;
  summary: string;
  detail: string | null;
  metadata: JsonValue | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformAlertList = {
  alerts: PlatformAlert[];
  limit: number;
  totalCount: number;
};

export type PlatformAlertRouteResult = {
  alert: PlatformAlert;
  reviewCase: {
    id: string;
    status: string;
    type: string;
    reasonCode: string | null;
    assignedOperatorId: string | null;
  };
  reviewCaseReused: boolean;
  routingStateReused: boolean;
};

export type CriticalPlatformAlertRoutingResult = {
  routedAlerts: PlatformAlertRouteResult[];
  limit: number;
  remainingUnroutedCriticalAlertCount: number;
  staleAfterSeconds: number;
};

export type PlatformAlertGovernanceMutationResult = {
  alert: PlatformAlert;
  stateReused: boolean;
};

export type RetryPlatformAlertDeliveriesResult = {
  retriedDeliveryCount: number;
};

export type PlatformAlertDeliveryTargetHealth = {
  targetName: string;
  targetUrl: string;
  deliveryMode: "direct" | "failover_only";
  healthStatus: "healthy" | "warning" | "critical";
  categories: string[];
  minimumSeverity: "warning" | "critical";
  eventTypes: string[];
  failoverTargetNames: string[];
  recentDeliveryCount: number;
  recentSucceededCount: number;
  recentFailedCount: number;
  pendingDeliveryCount: number;
  highestObservedEscalationLevel: number;
  lastAttemptedAt: string | null;
  lastDeliveredAt: string | null;
  lastFailureAt: string | null;
  lastErrorMessage: string | null;
  recentFailureRatePercent: number | null;
  consecutiveFailureCount: number;
  averageDeliveryLatencyMs: number | null;
  maxDeliveryLatencyMs: number | null;
  sloBreaches: string[];
};

export type PlatformAlertDeliveryTargetHealthList = {
  generatedAt: string;
  lookbackHours: number;
  summary: {
    totalTargetCount: number;
    healthyTargetCount: number;
    warningTargetCount: number;
    criticalTargetCount: number;
  };
  targets: PlatformAlertDeliveryTargetHealth[];
};

export type TreasuryOverview = {
  generatedAt: string;
  coverage: {
    status: "healthy" | "warning" | "critical";
    staleAfterSeconds: number;
    managedWorkerCount: number;
    degradedManagedWorkerCount: number;
    staleManagedWorkerCount: number;
    activeTreasuryWalletCount: number;
    activeOperationalWalletCount: number;
    customerLinkedWalletCount: number;
    missingManagedWalletCoverage: boolean;
    openTreasuryAlertCount: number;
  };
  walletSummary: {
    totalWalletCount: number;
    byKind: Array<{
      kind: string;
      count: number;
    }>;
    byStatus: Array<{
      status: string;
      count: number;
    }>;
    byCustodyType: Array<{
      custodyType: string;
      count: number;
    }>;
  };
  managedWorkers: Array<{
    workerId: string;
    healthStatus: "healthy" | "degraded" | "stale";
    environment: string;
    lastIterationStatus: string;
    lastHeartbeatAt: string;
    consecutiveFailureCount: number;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  }>;
  wallets: Array<{
    id: string;
    chainId: number;
    address: string;
    kind: string;
    custodyType: string;
    status: string;
    recentIntentCount: number;
    lastActivityAt: string | null;
    createdAt: string;
    updatedAt: string;
    customerAssignment: {
      customerAccountId: string;
      accountStatus: string;
      email: string | null;
      supabaseUserId: string | null;
      firstName: string | null;
      lastName: string | null;
    } | null;
  }>;
  recentActivity: Array<{
    transactionIntentId: string;
    intentType: string;
    status: string;
    policyDecision: string;
    requestedAmount: string;
    settledAmount: string | null;
    executionFailureCategory: string | null;
    executionFailureObservedAt: string | null;
    manualInterventionRequiredAt: string | null;
    manualInterventionReviewCaseId: string | null;
    externalAddress: string | null;
    createdAt: string;
    updatedAt: string;
    asset: {
      id: string;
      symbol: string;
      displayName: string;
      decimals: number;
      chainId: number;
    };
    sourceWallet: {
      id: string;
      address: string;
      kind: string;
      custodyType: string;
      status: string;
    } | null;
    destinationWallet: {
      id: string;
      address: string;
      kind: string;
      custodyType: string;
      status: string;
    } | null;
    latestBlockchainTransaction: {
      id: string;
      txHash: string | null;
      status: string;
      fromAddress: string | null;
      toAddress: string | null;
      broadcastAt: string | null;
      createdAt: string;
      updatedAt: string;
      confirmedAt: string | null;
    } | null;
  }>;
  recentAlerts: Array<{
    id: string;
    dedupeKey: string;
    severity: string;
    status: string;
    code: string;
    summary: string;
    detail: string | null;
    metadata: JsonValue | null;
    firstDetectedAt: string;
    lastDetectedAt: string;
    resolvedAt: string | null;
  }>;
};

export type LoanOperationsSummary = {
  applicationBacklog: Array<{
    status: string;
    count: number;
  }>;
  agreementStates: Array<{
    status: string;
    count: number;
  }>;
  liquidationStates: Array<{
    status: string;
    count: number;
  }>;
  policyPacks: Array<{
    jurisdiction: string;
    displayName: string;
    disclosureTitle: string;
    disclosureBody: string;
    serviceFeeRateBps: number;
    warningLtvBps: number;
    liquidationLtvBps: number;
    gracePeriodDays: number;
  }>;
};

export type LoanApplicationList = {
  applications: Array<{
    id: string;
    status: string;
    jurisdiction: string;
    requestedBorrowAmount: string;
    requestedCollateralAmount: string;
    requestedTermMonths: number;
    serviceFeeAmount: string;
    customer: {
      customerId: string;
      customerAccountId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
    borrowAsset: {
      symbol: string;
      displayName: string;
    };
    collateralAsset: {
      symbol: string;
      displayName: string;
    };
    linkedLoanAgreementId: string | null;
    submittedAt: string;
    updatedAt: string;
  }>;
  totalCount: number;
  limit: number;
};

export type LoanAgreementList = {
  agreements: Array<{
    id: string;
    status: string;
    jurisdiction: string;
    principalAmount: string;
    collateralAmount: string;
    outstandingTotalAmount: string;
    autopayEnabled: boolean;
    nextDueAt: string | null;
    customer: {
      customerId: string;
      customerAccountId: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
    borrowAsset: string;
    collateralAsset: string;
    collateralStatus: string | null;
    liquidationStatus: string | null;
  }>;
  totalCount: number;
  limit: number;
};

export type LoanApplicationWorkspace = {
  application: {
    id: string;
    status: string;
    jurisdiction: string;
    requestedBorrowAmount: string;
    requestedCollateralAmount: string;
    requestedTermMonths: number;
    serviceFeeAmount: string;
    autopayEnabled: boolean;
    quoteSnapshot: JsonValue;
    submittedAt: string;
    reviewedAt: string | null;
    reviewedByOperatorId: string | null;
    reviewedByOperatorRole: string | null;
    decisionNote: string | null;
    customer: {
      customerId: string;
      customerAccountId: string;
      status: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
    borrowAsset: {
      symbol: string;
      displayName: string;
      chainId: number;
      decimals: number;
    };
    collateralAsset: {
      symbol: string;
      displayName: string;
      chainId: number;
      decimals: number;
    };
  };
  linkedLoanAgreement: {
    id: string;
    status: string;
    principalAmount: string;
    outstandingTotalAmount: string;
    nextDueAt: string | null;
  } | null;
  timeline: Array<{
    id: string;
    label: string;
    tone: "neutral" | "positive" | "warning" | "critical" | "technical";
    timestamp: string;
    description: string;
  }>;
};

export type LoanAgreementWorkspace = {
  agreement: {
    id: string;
    applicationId: string;
    status: string;
    jurisdiction: string;
    principalAmount: string;
    collateralAmount: string;
    serviceFeeAmount: string;
    outstandingTotalAmount: string;
    contractLoanId: string | null;
    contractAddress: string | null;
    activationTransactionHash: string | null;
    autopayEnabled: boolean;
    nextDueAt: string | null;
    gracePeriodEndsAt: string | null;
    delinquentAt: string | null;
    defaultedAt: string | null;
    liquidationStartedAt: string | null;
    customer: {
      customerId: string;
      customerAccountId: string;
      status: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
    };
    borrowAsset: {
      symbol: string;
      displayName: string;
    };
    collateralAsset: {
      symbol: string;
      displayName: string;
    };
  };
  installments: Array<{
    id: string;
    installmentNumber: number;
    dueAt: string;
    status: string;
    scheduledTotalAmount: string;
    paidTotalAmount: string;
    lastAutopayAttemptAt: string | null;
  }>;
  collateralPositions: Array<{
    id: string;
    amount: string;
    status: string;
    walletAddress: string | null;
    currentValuationUsd: string | null;
    latestLtvBps: number | null;
  }>;
  valuations: Array<{
    id: string;
    priceUsd: string;
    collateralValueUsd: string;
    principalValueUsd: string;
    ltvBps: number;
    observedAt: string;
  }>;
  repayments: Array<{
    id: string;
    status: string;
    amount: string;
    principalAppliedAmount: string;
    serviceFeeAppliedAmount: string;
    failureReason: string | null;
    autopayAttempted: boolean;
    autopaySucceeded: boolean;
    createdAt: string;
    settledAt: string | null;
  }>;
  statements: Array<{
    id: string;
    referenceId: string;
    statementDate: string;
  }>;
  liquidationCases: Array<{
    id: string;
    status: string;
    reasonCode: string;
    note: string | null;
    executionTransactionHash: string | null;
    recoveredAmount: string | null;
    shortfallAmount: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  timeline: Array<{
    id: string;
    label: string;
    tone: "neutral" | "positive" | "warning" | "critical" | "technical";
    timestamp: string;
    description: string;
  }>;
};

export type LoanMutationResult =
  | {
      loanApplicationId: string;
      status: string;
      loanAgreementId?: string;
      contractLoanId?: string | null;
      reused?: boolean;
    }
  | {
      customerAccountId: string;
      status: string;
    }
  | {
      liquidationCaseId: string;
      status: string;
    }
  | {
      loanAgreementId: string;
      status: string;
    };

export type StakingPoolGovernanceRequestStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "executed"
  | "execution_failed";

export type StakingPoolGovernanceRequest = {
  id: string;
  rewardRate: number;
  status: StakingPoolGovernanceRequestStatus;
  requestedByOperatorId: string;
  requestedByOperatorRole: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  executedByOperatorId: string | null;
  executedByOperatorRole: string | null;
  requestNote: string | null;
  approvalNote: string | null;
  rejectionNote: string | null;
  executionNote: string | null;
  executionFailureReason: string | null;
  blockchainTransactionHash: string | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stakingPool: {
    id: number;
    blockchainPoolId: number | null;
    rewardRate: number;
    poolStatus: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type StakingPoolGovernanceRequestList = {
  requests: StakingPoolGovernanceRequest[];
  limit: number;
};

export type StakingPoolGovernanceMutationResult = {
  request: StakingPoolGovernanceRequest;
  stateReused: boolean;
};

export type OperationsStatus = {
  generatedAt: string;
  alertSummary: {
    openCount: number;
    criticalCount: number;
    warningCount: number;
  };
  workerHealth: {
    status: "healthy" | "warning" | "critical";
    staleAfterSeconds: number;
    totalWorkers: number;
    healthyWorkers: number;
    degradedWorkers: number;
    staleWorkers: number;
  };
  queueHealth: {
    status: "healthy" | "warning" | "critical";
    queuedDepositCount: number;
    queuedWithdrawalCount: number;
    totalQueuedCount: number;
    agedQueuedCount: number;
    manualWithdrawalBacklogCount: number;
    oldestQueuedIntentCreatedAt: string | null;
  };
  withdrawalExecutionHealth: {
    status: "healthy" | "warning" | "critical";
    queuedManagedWithdrawalCount: number;
    signedWithdrawalCount: number;
    broadcastingWithdrawalCount: number;
    pendingConfirmationWithdrawalCount: number;
    failedManagedWithdrawalCount: number;
    retryableWithdrawalFailureCount: number;
    manualInterventionWithdrawalCount: number;
    unresolvedReserveMismatchCount: number;
  };
  chainHealth: {
    status: "healthy" | "warning" | "critical";
    laggingBroadcastCount: number;
    criticalLaggingBroadcastCount: number;
    recentFailedTransactionCount: number;
    oldestLaggingBroadcastCreatedAt: string | null;
  };
  treasuryHealth: {
    status: "healthy" | "warning" | "critical";
    managedWorkerCount: number;
    activeTreasuryWalletCount: number;
    activeOperationalWalletCount: number;
    missingManagedWalletCoverage: boolean;
  };
  reconciliationHealth: {
    status: "healthy" | "warning" | "critical";
    openMismatchCount: number;
    criticalMismatchCount: number;
    recentFailedScanCount: number;
    latestScanStatus: string | null;
    latestScanStartedAt: string | null;
  };
  incidentSafety: {
    status: "healthy" | "warning" | "critical";
    openReviewCaseCount: number;
    openOversightIncidentCount: number;
    activeRestrictedAccountCount: number;
  };
  recentAlerts: PlatformAlert[];
};

export type ReleaseReadinessEvidence = {
  id: string;
  evidenceType: string;
  environment: string;
  status: "pending" | "passed" | "failed";
  releaseIdentifier: string | null;
  rollbackReleaseIdentifier: string | null;
  backupReference: string | null;
  summary: string;
  note: string | null;
  operatorId: string;
  operatorRole: string | null;
  runbookPath: string | null;
  evidenceLinks: string[];
  evidencePayload: JsonValue | null;
  startedAt: string | null;
  completedAt: string | null;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ReleaseReadinessEvidenceList = {
  evidence: ReleaseReadinessEvidence[];
  limit: number;
  totalCount: number;
};

export type ReleaseReadinessSummary = {
  generatedAt: string;
  releaseIdentifier: string | null;
  environment: string | null;
  approvalPolicy: {
    requestAllowedOperatorRoles: string[];
    approverAllowedOperatorRoles: string[];
    maximumEvidenceAgeHours: number;
    currentOperator: {
      operatorId: string | null;
      operatorRole: string | null;
      canRequestApproval: boolean;
      canApproveOrReject: boolean;
    };
  };
  overallStatus: "healthy" | "warning" | "critical";
  summary: {
    requiredCheckCount: number;
    passedCheckCount: number;
    failedCheckCount: number;
    pendingCheckCount: number;
  };
  requiredChecks: Array<{
    evidenceType: string;
    label: string;
    description: string;
    runbookPath: string;
    acceptedEnvironments: string[];
    status: "passed" | "failed" | "pending";
    latestEvidence: ReleaseReadinessEvidence | null;
  }>;
  recentEvidence: ReleaseReadinessEvidence[];
};

export type ReleaseReadinessApprovalChecklist = {
  securityConfigurationComplete: boolean;
  accessAndGovernanceComplete: boolean;
  dataAndRecoveryComplete: boolean;
  platformHealthComplete: boolean;
  functionalProofComplete: boolean;
  contractAndChainProofComplete: boolean;
  finalSignoffComplete: boolean;
  unresolvedRisksAccepted: boolean;
  openBlockers: string[];
  residualRiskNote: string | null;
};

export type ReleaseReadinessApprovalEvidenceSnapshot = {
  generatedAt: string;
  overallStatus: "healthy" | "warning" | "critical";
  summary: {
    requiredCheckCount: number;
    passedCheckCount: number;
    failedCheckCount: number;
    pendingCheckCount: number;
  };
  requiredChecks: Array<{
    evidenceType: string;
    status: "passed" | "failed" | "pending";
    latestEvidenceObservedAt: string | null;
    latestEvidenceEnvironment: string | null;
    latestEvidenceStatus: string | null;
    latestEvidenceReleaseIdentifier: string | null;
    latestEvidenceRollbackReleaseIdentifier: string | null;
    latestEvidenceBackupReference: string | null;
  }>;
};

export type ReleaseReadinessApprovalMetadataMismatch = {
  evidenceType: string;
  reason: string;
};

export type ReleaseReadinessApprovalGate = {
  overallStatus: "ready" | "blocked" | "approved" | "rejected";
  approvalEligible: boolean;
  missingChecklistItems: string[];
  missingEvidenceTypes: string[];
  failedEvidenceTypes: string[];
  staleEvidenceTypes: string[];
  metadataMismatches: ReleaseReadinessApprovalMetadataMismatch[];
  maximumEvidenceAgeHours: number;
  openBlockers: string[];
  generatedAt: string;
};

export type ReleaseReadinessApproval = {
  id: string;
  supersedesApprovalId: string | null;
  supersededByApprovalId: string | null;
  releaseIdentifier: string;
  environment: string;
  launchClosurePack: {
    id: string;
    version: number;
    artifactChecksumSha256: string;
  } | null;
  rollbackReleaseIdentifier: string | null;
  status: "pending_approval" | "approved" | "rejected" | "superseded";
  summary: string;
  requestNote: string | null;
  approvalNote: string | null;
  rejectionNote: string | null;
  requestedByOperatorId: string;
  requestedByOperatorRole: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  supersededByOperatorId: string | null;
  supersededByOperatorRole: string | null;
  checklist: ReleaseReadinessApprovalChecklist;
  evidenceSnapshot: ReleaseReadinessApprovalEvidenceSnapshot;
  gate: ReleaseReadinessApprovalGate;
  launchClosureDrift: {
    changed: boolean;
    critical: boolean;
    blockingReasons: string[];
    currentOverallStatus: "ready" | "blocked" | "approved" | "rejected" | "in_progress";
    summaryDelta: {
      passedCheckCount: number;
      failedCheckCount: number;
      pendingCheckCount: number;
    };
    missingEvidenceTypesAdded: string[];
    missingEvidenceTypesResolved: string[];
    failedEvidenceTypesAdded: string[];
    failedEvidenceTypesResolved: string[];
    staleEvidenceTypesAdded: string[];
    staleEvidenceTypesResolved: string[];
    openBlockersAdded: string[];
    openBlockersResolved: string[];
    newerPackAvailable: boolean;
    latestPack: {
      id: string;
      version: number;
      artifactChecksumSha256: string;
    } | null;
  } | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReleaseReadinessApprovalList = {
  approvals: ReleaseReadinessApproval[];
  limit: number;
  totalCount: number;
};

export type LaunchClosureManifest = {
  releaseIdentifier: string;
  environment: "staging" | "production_like" | "production";
  baseUrls: {
    web: string;
    admin: string;
    api: string;
    restoreApi: string;
  };
  worker: {
    identifier: string;
  };
  operator: {
    requesterId: string;
    requesterRole: string;
    approverId: string;
    approverRole: string;
    apiKeyEnvironmentVariable: string;
  };
  artifacts: {
    apiReleaseId: string;
    workerReleaseId: string;
    approvalRollbackReleaseId: string;
    apiRollbackReleaseId: string;
    workerRollbackReleaseId: string;
    backupReference: string;
  };
  alerting: {
    expectedTargetName: string;
    expectedTargetHealthStatus: "warning" | "critical";
    expectedMinReEscalations: number;
    expectedAlertId?: string;
    expectedAlertDedupeKey?: string;
  };
  governance: {
    secretReviewReference: string;
    roleReviewReference: string;
    roleReviewRosterReference: string;
  };
  notes: {
    launchSummary: string;
    requestNote?: string;
    residualRiskNote?: string;
  };
};

export type LaunchClosureValidationResult = {
  errors: string[];
  warnings: string[];
};

export type LaunchClosurePackFile = {
  relativePath: string;
  content: string;
};

export type LaunchClosureStatus = {
  generatedAt: string;
  releaseIdentifier: string | null;
  environment: string | null;
  overallStatus: "ready" | "blocked" | "approved" | "rejected" | "in_progress";
  maximumEvidenceAgeHours: number;
  externalChecks: Array<{
    evidenceType: string;
    label: string;
    status: "passed" | "failed" | "pending" | "stale";
    acceptedEnvironments: string[];
    latestEvidence: ReleaseReadinessEvidence | null;
  }>;
  latestApproval: ReleaseReadinessApproval | null;
  summaryMarkdown: string;
};

export type LaunchClosureValidationResponse = {
  validation: LaunchClosureValidationResult;
  summaryMarkdown: string;
};

export type LaunchClosureScaffoldResponse = LaunchClosureValidationResponse & {
  outputSubpath: string;
  files: LaunchClosurePackFile[];
  pack: {
    id: string;
    releaseIdentifier: string;
    environment: string;
    version: number;
    generatedByOperatorId: string;
    generatedByOperatorRole: string | null;
    artifactChecksumSha256: string;
    artifactPayload: JsonValue;
    createdAt: string;
    updatedAt: string;
  };
};

export type ReleaseLaunchClosurePack = LaunchClosureScaffoldResponse["pack"];

export type ReleaseLaunchClosurePackList = {
  packs: ReleaseLaunchClosurePack[];
  limit: number;
  totalCount: number;
};

export type LedgerReconciliationWorkspace = {
  mismatch: LedgerReconciliationMismatch;
  currentSnapshot: JsonValue;
  recentAuditEvents: AuditTimelineEntry[];
};

export type LedgerReconciliationMutationResult = {
  mismatch: LedgerReconciliationMismatch;
};

export type CustomerBalance = {
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  availableBalance: string;
  pendingBalance: string;
  updatedAt: string;
};

export type ReviewCaseWorkspace = {
  reviewCase: ReviewCase;
  manualResolutionEligibility: ManualResolutionEligibility;
  caseEvents: ReviewCaseEvent[];
  relatedTransactionAuditEvents: AuditTimelineEntry[];
  balances: CustomerBalance[];
  recentIntents: TransactionIntent[];
  recentLimit: number;
};

export type ReviewCaseList = {
  reviewCases: ReviewCase[];
  limit: number;
};

export type ReviewCaseMutationResult = {
  reviewCase: ReviewCase;
  stateReused: boolean;
};

export type ReviewCaseNoteMutationResult = {
  reviewCase: ReviewCase;
  event: ReviewCaseEvent;
};

export type ApplyManualResolutionResult = {
  reviewCase: ReviewCase;
  transactionIntent: TransactionIntent;
  stateReused: boolean;
};

export type OversightIncident = {
  id: string;
  incidentType: string;
  status: string;
  reasonCode: string | null;
  summaryNote: string | null;
  subjectCustomer: {
    customerId: string | null;
    customerAccountId: string | null;
    supabaseUserId: string | null;
    email: string | null;
    firstName: string;
    lastName: string;
  };
  subjectOperatorId: string | null;
  subjectOperatorRole: string | null;
  assignedOperatorId: string | null;
  openedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OversightIncidentEvent = {
  id: string;
  actorType: string;
  actorId: string | null;
  eventType: string;
  note: string | null;
  metadata: JsonValue;
  createdAt: string;
};

export type ManuallyResolvedIntent = {
  id: string;
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  intentType: string;
  requestedAmount: string;
  settledAmount: string | null;
  failureCode: string | null;
  failureReason: string | null;
  sourceWalletAddress: string | null;
  destinationWalletAddress: string | null;
  externalAddress: string | null;
  manuallyResolvedAt: string;
  manualResolutionReasonCode: string | null;
  manualResolutionNote: string | null;
  manualResolvedByOperatorId: string | null;
  manualResolutionOperatorRole: string | null;
  manualResolutionReviewCaseId: string | null;
  latestBlockchainTransaction: LatestBlockchainTransaction | null;
};

export type OversightReviewCaseSummary = {
  id: string;
  type: string;
  status: string;
  reasonCode: string | null;
  assignedOperatorId: string | null;
  transactionIntentId: string | null;
  customerAccountId: string | null;
  updatedAt: string;
  resolvedAt: string | null;
};

export type OversightAccountRestriction = {
  active: boolean;
  customerAccountId: string | null;
  accountStatus: string | null;
  restrictedAt: string | null;
  restrictedFromStatus: string | null;
  restrictionReasonCode: string | null;
  restrictedByOperatorId: string | null;
  restrictedByOversightIncidentId: string | null;
  restrictionReleasedAt: string | null;
  restrictionReleasedByOperatorId: string | null;
};

export type OversightAccountHoldGovernance = {
  operatorRole: string | null;
  canApplyAccountHold: boolean;
  canReleaseAccountHold: boolean;
  allowedApplyOperatorRoles: string[];
  allowedReleaseOperatorRoles: string[];
};

export type OversightWorkspace = {
  oversightIncident: OversightIncident;
  accountRestriction: OversightAccountRestriction;
  accountHoldGovernance: OversightAccountHoldGovernance;
  events: OversightIncidentEvent[];
  recentManuallyResolvedIntents: ManuallyResolvedIntent[];
  recentReviewCases: OversightReviewCaseSummary[];
  recentLimit: number;
};

export type OversightIncidentList = {
  oversightIncidents: OversightIncident[];
  limit: number;
};

export type OversightMutationResult = {
  oversightIncident: OversightIncident;
  stateReused: boolean;
};

export type OversightNoteMutationResult = {
  oversightIncident: OversightIncident;
  event: OversightIncidentEvent;
};

export type OversightRestrictionMutationResult = {
  oversightIncident: OversightIncident;
  accountRestriction: OversightAccountRestriction;
  stateReused: boolean;
};

export type CustomerAccountOperationsSummary = {
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  accountStatus: string;
  currentRestriction: {
    active: boolean;
    restrictedAt: string | null;
    restrictedFromStatus: string | null;
    restrictionReasonCode: string | null;
    restrictedByOperatorId: string | null;
    restrictedByOversightIncidentId: string | null;
    restrictionReleasedAt: string | null;
    restrictionReleasedByOperatorId: string | null;
  };
  counts: {
    totalTransactionIntents: number;
    manuallyResolvedTransactionIntents: number;
    openReviewCases: number;
    openOversightIncidents: number;
    activeAccountHolds: number;
  };
};

export type CustomerAccountTimelineEntry = {
  id: string;
  eventType: string;
  occurredAt: string;
  actorType: string | null;
  actorId: string | null;
  customerAccountId: string;
  transactionIntentId: string | null;
  reviewCaseId: string | null;
  oversightIncidentId: string | null;
  accountRestrictionId: string | null;
  metadata: JsonValue;
};

export type CustomerAccountOperationsTimeline = {
  summary: CustomerAccountOperationsSummary;
  timeline: CustomerAccountTimelineEntry[];
  limit: number;
  filters: {
    eventType: string | null;
    actorId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
};

export type OversightAlert = {
  incidentType: string;
  subjectCustomer: {
    customerId: string | null;
    customerAccountId: string | null;
    supabaseUserId: string | null;
    email: string | null;
    firstName: string;
    lastName: string;
  } | null;
  subjectOperatorId: string | null;
  subjectOperatorRole: string | null;
  count: number;
  threshold: number;
  sinceDays: number;
  latestManualResolutionAt: string;
  reasonCodeBreakdown: Array<{
    manualResolutionReasonCode: string;
    count: number;
  }>;
  openIncidentId: string | null;
  recommendedAction: "open_incident" | "monitor_existing_incident";
};

export type OversightAlertList = {
  alerts: OversightAlert[];
  limit: number;
  sinceDays: number;
  customerThreshold: number;
  operatorThreshold: number;
};

export type AccountHold = {
  hold: {
    id: string;
    status: string;
    restrictionReasonCode: string;
    appliedByOperatorId: string;
    appliedByOperatorRole: string | null;
    appliedNote: string | null;
    previousStatus: string;
    appliedAt: string;
    releasedAt: string | null;
    releasedByOperatorId: string | null;
    releasedByOperatorRole: string | null;
    releaseNote: string | null;
    restoredStatus: string | null;
    holdDurationMs: number | null;
  };
  customer: {
    customerId: string;
    customerAccountId: string;
    status: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  oversightIncident: {
    id: string;
    incidentType: string;
    status: string;
    reasonCode: string | null;
    summaryNote: string | null;
    assignedOperatorId: string | null;
    openedAt: string;
    updatedAt: string;
  };
  releaseReview: {
    reviewCaseId: string | null;
    reviewCaseStatus: string | null;
    reviewCaseAssignedOperatorId: string | null;
    decisionStatus: string;
    requestedAt: string | null;
    requestedByOperatorId: string | null;
    requestNote: string | null;
    decidedAt: string | null;
    decidedByOperatorId: string | null;
    decisionNote: string | null;
  };
};

export type AccountHoldList = {
  holds: AccountHold[];
  limit: number;
};

export type AccountHoldSummary = {
  totalHolds: number;
  activeHolds: number;
  releasedHolds: number;
  byIncidentType: Array<{
    incidentType: string;
    count: number;
  }>;
  byReasonCode: Array<{
    restrictionReasonCode: string;
    count: number;
  }>;
  byAppliedOperator: Array<{
    appliedByOperatorId: string;
    appliedByOperatorRole: string | null;
    count: number;
  }>;
  byReleasedOperator: Array<{
    releasedByOperatorId: string;
    releasedByOperatorRole: string | null;
    count: number;
  }>;
};

export type AccountReleaseReview = {
  reviewCase: {
    id: string;
    type: string;
    status: string;
    reasonCode: string | null;
    notes: string | null;
    assignedOperatorId: string | null;
    startedAt: string | null;
    resolvedAt: string | null;
    dismissedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  restriction: {
    id: string;
    status: string;
    restrictionReasonCode: string;
    appliedByOperatorId: string;
    appliedByOperatorRole: string | null;
    appliedNote: string | null;
    previousStatus: string;
    appliedAt: string;
    releasedAt: string | null;
    releasedByOperatorId: string | null;
    releasedByOperatorRole: string | null;
    releaseNote: string | null;
    restoredStatus: string | null;
    releaseDecisionStatus: string;
    releaseRequestedAt: string | null;
    releaseRequestedByOperatorId: string | null;
    releaseRequestNote: string | null;
    releaseDecidedAt: string | null;
    releaseDecidedByOperatorId: string | null;
    releaseDecisionNote: string | null;
    releaseReviewCaseId: string | null;
  };
  customer: {
    customerId: string;
    customerAccountId: string;
    status: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  oversightIncident: {
    id: string;
    incidentType: string;
    status: string;
    reasonCode: string | null;
    summaryNote: string | null;
    assignedOperatorId: string | null;
    openedAt: string;
    updatedAt: string;
  };
};

export type AccountReleaseReviewList = {
  reviews: AccountReleaseReview[];
  limit: number;
};

export type AccountReleaseReviewMutationResult = {
  accountReleaseReview: AccountReleaseReview;
  stateReused: boolean;
};

export type IncidentPackageRelease = {
  id: string;
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    accountStatus: string;
  };
  status: string;
  exportMode: string;
  releaseTarget: string;
  releaseReasonCode: string;
  requestedByOperatorId: string;
  requestedByOperatorRole: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  releasedByOperatorId: string | null;
  releasedByOperatorRole: string | null;
  requestNote: string | null;
  approvalNote: string | null;
  rejectionNote: string | null;
  releaseNote: string | null;
  artifactChecksumSha256: string;
  artifactPayload: JsonValue;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  releasedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncidentPackageReleaseList = {
  releases: IncidentPackageRelease[];
  limit: number;
};

export type IncidentPackageReleaseMutationResult = {
  release: IncidentPackageRelease;
  stateReused?: boolean;
};

export type GovernedIncidentPackageExport = {
  exportMetadata: {
    exportMode: string;
    generatedAt: string;
    generatedByOperatorId: string;
    generatedByOperatorRole: string | null;
    redactionsApplied: boolean;
    recentLimitRequested: number | null;
    recentLimitApplied: number;
    timelineLimitRequested: number | null;
    timelineLimitApplied: number;
    sinceDaysRequested: number | null;
    sinceDaysApplied: number | null;
    packageChecksumSha256: string;
  };
  complianceSummary: {
    accountStatus: string;
    activeRestriction: boolean;
    activeRestrictionReasonCode: string | null;
    openReviewCases: number;
    openOversightIncidents: number;
    activeAccountHolds: number;
    manuallyResolvedTransactionIntents: number;
    releaseReviewDecisionStates: Array<{
      decisionStatus: string;
      count: number;
    }>;
    timelineEventBreakdown: Array<{
      eventType: string;
      count: number;
    }>;
  };
  narrative: {
    executiveSummary: string;
    controlPosture: string;
    investigationSummary: string;
    complianceObservations: string;
  };
  package: JsonValue;
};

export type IncidentPackageSnapshot = {
  generatedAt: string;
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  accountStatus: string;
  currentRestriction: JsonValue;
  balances: JsonValue[];
  activeHolds: JsonValue[];
  holdHistory: JsonValue[];
  reviewCases: JsonValue[];
  oversightIncidents: JsonValue[];
  recentTransactionIntents: JsonValue[];
  timeline: JsonValue[];
  limits: {
    recentLimit: number;
    timelineLimit: number;
  };
};
