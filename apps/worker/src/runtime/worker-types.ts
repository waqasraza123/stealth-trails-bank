export type BlockchainTransactionProjection = {
  id: string;
  txHash: string | null;
  nonce: number | null;
  serializedTransaction: string | null;
  status: string;
  fromAddress: string | null;
  toAddress: string | null;
  broadcastAt?: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};

export type WorkerIntentAssetProjection = {
  id: string;
  symbol: string;
  displayName: string;
  decimals: number;
  chainId: number;
  assetType: string;
  contractAddress: string | null;
};

export type WorkerIntentProjection = {
  id: string;
  customerAccountId: string | null;
  asset: WorkerIntentAssetProjection;
  destinationWalletAddress: string | null;
  sourceWalletAddress: string | null;
  sourceWalletCustodyType: string | null;
  externalAddress: string | null;
  chainId: number;
  status: string;
  requestedAmount: string;
  executionFailureCategory?: string | null;
  executionFailureObservedAt?: string | null;
  manualInterventionRequiredAt?: string | null;
  manualInterventionReviewCaseId?: string | null;
  latestBlockchainTransaction: BlockchainTransactionProjection | null;
};

export type ListIntentsResult = {
  intents: WorkerIntentProjection[];
  limit: number;
};

export type WorkerLoanAgreementProjection = {
  loanAgreementId: string;
  customerEmail: string;
  status: string;
  collateralStatus: string | null;
  latestLtvBps?: number | null;
  gracePeriodEndsAt?: string | null;
};

export type ListWorkerLoanAgreementsResult = {
  agreements: WorkerLoanAgreementProjection[];
  limit: number;
};

export type WorkerLoanInstallmentProjection = {
  id: string;
  loanAgreementId: string;
  installmentNumber: number;
  dueAt: string;
  status: string;
  amount: string;
  assetSymbol: string;
  customerEmail: string;
};

export type ListWorkerLoanInstallmentsResult = {
  installments: WorkerLoanInstallmentProjection[];
  limit: number;
};

export type RecordBroadcastPayload = {
  txHash: string;
  fromAddress?: string;
  toAddress?: string;
};

export type StartManagedWithdrawalExecutionPayload = {
  reclaimStaleAfterMs: number;
};

export type RecordSignedWithdrawalPayload = {
  txHash: string;
  nonce: number;
  serializedTransaction: string;
  fromAddress?: string;
  toAddress?: string;
};

export type StartManagedWithdrawalExecutionResult = {
  intent: WorkerIntentProjection;
  executionClaimed: boolean;
  executionReused: boolean;
};

export type RecordSignedWithdrawalResult = {
  intent: WorkerIntentProjection;
  signedStateReused: boolean;
};

export type ConfirmIntentPayload = {
  txHash?: string;
};

export type FailIntentPayload = {
  failureCode: string;
  failureReason: string;
  failureCategory?: "retryable" | "permanent" | "manual_intervention_required";
  txHash?: string;
  fromAddress?: string;
  toAddress?: string;
};

export type SettleIntentPayload = {
  note?: string;
};

export type BroadcastReceipt = {
  txHash: string;
  fromAddress: string | null;
  toAddress: string | null;
  blockNumber: bigint;
  succeeded: boolean;
};

export type DepositBroadcastResult = {
  txHash: string;
  fromAddress: string;
  toAddress: string;
};

export type PreparedManagedWithdrawalTransaction = {
  txHash: string;
  nonce: number;
  serializedTransaction: string;
  fromAddress: string;
  toAddress: string;
};

export type ManagedExecutionFailure = {
  failureCode: string;
  failureReason: string;
  fromAddress?: string;
  toAddress?: string;
};

export type ManagedDepositBroadcaster = {
  readonly signerAddress: string;
  broadcast(intent: WorkerIntentProjection): Promise<DepositBroadcastResult>;
};

export type ManagedWithdrawalBroadcaster = {
  canManageWallet(walletAddress: string | null | undefined): boolean;
  prepare(intent: WorkerIntentProjection): Promise<PreparedManagedWithdrawalTransaction>;
  broadcastSignedTransaction(
    signedTransaction: string
  ): Promise<DepositBroadcastResult>;
};

export type PolicyControlledWithdrawalBroadcaster = {
  prepare(intent: WorkerIntentProjection): Promise<PreparedManagedWithdrawalTransaction>;
  broadcastSignedTransaction(
    signedTransaction: string
  ): Promise<DepositBroadcastResult>;
};

export type WorkerLogger = {
  info(event: string, metadata: Record<string, unknown>): void;
  warn(event: string, metadata: Record<string, unknown>): void;
  error(event: string, metadata: Record<string, unknown>): void;
};

export type WorkerIterationMetrics = {
  queuedDepositCount: number;
  queuedWithdrawalCount: number;
  retirementVaultCooldownCompletedCount: number;
  retirementVaultReleasedCount: number;
  retirementVaultReleaseFailureCount: number;
  retirementVaultRuleChangeReadyCount: number;
  retirementVaultRuleChangeAppliedCount: number;
  retirementVaultRuleChangeFailureCount: number;
  claimableGovernedExecutionRequestCount: number;
  claimedGovernedExecutionRequestCount: number;
  dispatchedGovernedExecutionRequestCount: number;
  governedExecutionDispatchFailureCount: number;
  governedExecutionDeliveryAcceptedCount: number;
  governedExecutionDeliveryFailureCount: number;
  signedWithdrawalCount: number;
  broadcastDepositCount: number;
  broadcastWithdrawalCount: number;
  confirmedDepositReadyToSettleCount: number;
  confirmedWithdrawalReadyToSettleCount: number;
  depositBroadcastRecordedCount: number;
  withdrawalBroadcastRecordedCount: number;
  depositConfirmedCount: number;
  withdrawalConfirmedCount: number;
  depositSettledCount: number;
  withdrawalSettledCount: number;
  depositFailedCount: number;
  withdrawalFailedCount: number;
  retryableWithdrawalFailureCount: number;
  manualWithdrawalBacklogCount: number;
  awaitingFundingLoanCount: number;
  fundedLoanCount: number;
  dueLoanInstallmentCount: number;
  autopayLoanSweepCount: number;
  autopayLoanSuccessCount: number;
  autopayLoanFailureCount: number;
  valuationRefreshCandidateCount: number;
  valuationRefreshCount: number;
  graceExpiredLoanCount: number;
  defaultEscalatedLoanCount: number;
  liquidationCandidateCount: number;
  reEscalatedCriticalAlertCount: number;
};

export type SweepRetirementVaultReleaseRequestsResult = {
  limit: number;
  readyForReleaseCount: number;
  releasedCount: number;
  failedCount: number;
  blockedReleaseCount: number;
  staleReviewRequiredCount: number;
  staleCooldownCount: number;
  staleReadyForReleaseCount: number;
  staleExecutingCount: number;
  processedReleaseRequestIds: string[];
};

export type SweepRetirementVaultRuleChangeRequestsResult = {
  limit: number;
  readyToApplyCount: number;
  appliedCount: number;
  failedCount: number;
  blockedRuleChangeCount: number;
  staleReviewRequiredCount: number;
  staleCooldownCount: number;
  staleReadyToApplyCount: number;
  staleApplyingCount: number;
  processedRuleChangeRequestIds: string[];
};

export type CriticalAlertReEscalationSweepResult = {
  evaluatedAlertCount: number;
  reEscalatedAlertCount: number;
  skippedPendingDeliveryCount: number;
  remainingDueAlertCount: number;
  limit: number;
  reEscalatedAlerts: Array<{
    alertId: string;
    dedupeKey: string;
    reasons: Array<"unacknowledged" | "unowned">;
    dueAt: string;
    lastReEscalatedAt: string | null;
    queuedDeliveryCount: number;
  }>;
};

export type GovernedExecutionRequestProjection = {
  id: string;
  environment: string;
  chainId: number;
  executionType: string;
  status: string;
  targetType: string;
  targetId: string;
  loanAgreementId: string | null;
  stakingPoolGovernanceRequestId: string | null;
  contractAddress: string | null;
  contractMethod: string;
  walletAddress: string | null;
  requestNote: string | null;
  requestedByActorType: string;
  requestedByActorId: string;
  requestedByActorRole: string | null;
  requestedAt: string;
  executedByActorType: string | null;
  executedByActorId: string | null;
  executedByActorRole: string | null;
  executedAt: string | null;
  blockchainTransactionHash: string | null;
  externalExecutionReference: string | null;
  failureReason: string | null;
  failedAt: string | null;
  metadata: Record<string, unknown> | null;
  executionPayload: Record<string, unknown>;
  executionResult: Record<string, unknown> | null;
  canonicalExecutionPayload: Record<string, unknown> | null;
  canonicalExecutionPayloadText: string | null;
  executionPackageHash: string | null;
  executionPackageChecksumSha256: string | null;
  executionPackageSignature: string | null;
  executionPackageSignatureAlgorithm: string | null;
  executionPackageSignerAddress: string | null;
  executionPackagePublishedAt: string | null;
  claimedByWorkerId: string | null;
  claimedAt: string | null;
  claimExpiresAt: string | null;
  dispatchStatus: string;
  dispatchPreparedAt: string | null;
  dispatchedByWorkerId: string | null;
  dispatchReference: string | null;
  dispatchVerificationChecksumSha256: string | null;
  dispatchFailureReason: string | null;
  deliveryStatus: string;
  deliveryAttemptedAt: string | null;
  deliveryAcceptedAt: string | null;
  deliveredByWorkerId: string | null;
  deliveryBackendType: string | null;
  deliveryBackendReference: string | null;
  deliveryHttpStatus: number | null;
  deliveryFailureReason: string | null;
  expectedExecutionCalldataHash: string | null;
  expectedExecutionMethodSelector: string | null;
  updatedAt: string;
};

export type ListClaimableGovernedExecutionRequestsResult = {
  requests: GovernedExecutionRequestProjection[];
  limit: number;
  generatedAt: string;
};

export type ClaimGovernedExecutionRequestPayload = {
  reclaimStaleAfterMs?: number;
};

export type ClaimGovernedExecutionRequestResult = {
  request: GovernedExecutionRequestProjection;
  claimReused: boolean;
};

export type DispatchGovernedExecutionRequestPayload = {
  dispatchReference?: string;
  dispatchNote?: string;
};

export type DispatchGovernedExecutionRequestResult = {
  request: GovernedExecutionRequestProjection;
  dispatchRecorded: boolean;
  verificationSucceeded: boolean;
  verificationFailureReason: string | null;
};

export type RecordGovernedExecutionDeliveryAcceptedPayload = {
  dispatchReference: string;
  deliveryBackendType: string;
  deliveryBackendReference?: string;
  deliveryHttpStatus?: number;
  deliveryNote?: string;
};

export type RecordGovernedExecutionDeliveryAcceptedResult = {
  request: GovernedExecutionRequestProjection;
  deliveryRecorded: boolean;
  stateReused: boolean;
};

export type RecordGovernedExecutionDeliveryFailedPayload = {
  dispatchReference: string;
  deliveryBackendType: string;
  deliveryFailureReason: string;
  deliveryHttpStatus?: number;
  deliveryBackendReference?: string;
  deliveryNote?: string;
};

export type RecordGovernedExecutionDeliveryFailedResult = {
  request: GovernedExecutionRequestProjection;
  deliveryRecorded: boolean;
};

export type TrackedLedgerReconciliationScanRun = {
  id: string;
  status: string;
  triggerSource: string;
  requestedScope: string | null;
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
};

export type TrackedLedgerReconciliationScanResult = {
  scanRun: TrackedLedgerReconciliationScanRun;
  result: {
    scannedAt: string;
    createdCount: number;
    reopenedCount: number;
    refreshedCount: number;
    autoResolvedCount: number;
    activeMismatchCount: number;
  };
};

export type GeneratedSolvencySnapshotResult = {
  snapshot: {
    id: string;
    environment: "development" | "test" | "production";
    status: string;
    evidenceFreshness: string;
    generatedAt: string;
    completedAt: string | null;
    totalLiabilityAmount: string;
    totalObservedReserveAmount: string;
    totalUsableReserveAmount: string;
    totalEncumberedReserveAmount: string;
    totalReserveDeltaAmount: string;
    assetCount: number;
    issueCount: number;
    policyActionsTriggered: boolean;
    failureCode: string | null;
    failureMessage: string | null;
  };
  policyState: {
    environment: "development" | "test" | "production";
    status: string;
    pauseWithdrawalApprovals: boolean;
    pauseManagedWithdrawalExecution: boolean;
    pauseLoanFunding: boolean;
    pauseStakingWrites: boolean;
    requireManualOperatorReview: boolean;
    latestSnapshotId: string | null;
    triggeredAt: string | null;
    clearedAt: string | null;
    reasonCode: string | null;
    reasonSummary: string | null;
    metadata: unknown;
    updatedAt: string;
  };
  issueCount: number;
  criticalIssueCount: number;
};

export type WorkerHeartbeatPayload = {
  environment: "development" | "test" | "production";
  executionMode: "monitor" | "synthetic" | "managed";
  lastIterationStatus: "running" | "succeeded" | "failed";
  lastIterationStartedAt?: string;
  lastIterationCompletedAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  lastReconciliationScanRunId?: string;
  lastReconciliationScanStartedAt?: string;
  lastReconciliationScanCompletedAt?: string;
  lastReconciliationScanStatus?: "running" | "succeeded" | "failed";
  runtimeMetadata?: Record<string, unknown>;
  latestIterationMetrics?: Record<string, unknown>;
  lastIterationDurationMs?: number;
};
