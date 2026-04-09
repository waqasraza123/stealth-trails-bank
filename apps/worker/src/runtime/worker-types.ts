export type BlockchainTransactionProjection = {
  id: string;
  txHash: string | null;
  status: string;
  fromAddress: string | null;
  toAddress: string | null;
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
  externalAddress: string | null;
  chainId: number;
  status: string;
  requestedAmount: string;
  latestBlockchainTransaction: BlockchainTransactionProjection | null;
};

export type ListIntentsResult = {
  intents: WorkerIntentProjection[];
  limit: number;
};

export type RecordBroadcastPayload = {
  txHash: string;
  fromAddress?: string;
  toAddress?: string;
};

export type ConfirmIntentPayload = {
  txHash?: string;
};

export type FailIntentPayload = {
  failureCode: string;
  failureReason: string;
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

export type WorkerLogger = {
  info(event: string, metadata: Record<string, unknown>): void;
  warn(event: string, metadata: Record<string, unknown>): void;
  error(event: string, metadata: Record<string, unknown>): void;
};

export type WorkerIterationMetrics = {
  queuedDepositCount: number;
  queuedWithdrawalCount: number;
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
  manualWithdrawalBacklogCount: number;
  reEscalatedCriticalAlertCount: number;
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
