CREATE TYPE "SolvencySnapshotStatus" AS ENUM (
  'healthy',
  'warning',
  'critical',
  'failed'
);

CREATE TYPE "SolvencyEvidenceFreshness" AS ENUM (
  'fresh',
  'stale',
  'missing',
  'unknown'
);

CREATE TYPE "SolvencyIssueClassification" AS ENUM (
  'healthy',
  'informational_drift',
  'stale_evidence',
  'reconciliation_mismatch',
  'reserve_shortfall',
  'unknown_reserve_state',
  'liability_computation_failure',
  'critical_solvency_risk'
);

CREATE TYPE "SolvencyIssueSeverity" AS ENUM (
  'info',
  'warning',
  'critical'
);

CREATE TYPE "SolvencyReserveSourceType" AS ENUM (
  'treasury_wallet',
  'operational_wallet',
  'contract_wallet'
);

CREATE TYPE "SolvencyPolicyStateStatus" AS ENUM (
  'normal',
  'guarded',
  'paused'
);

CREATE TABLE "SolvencySnapshot" (
  "id" TEXT NOT NULL,
  "environment" "WorkerRuntimeEnvironment" NOT NULL,
  "chainId" INTEGER NOT NULL,
  "status" "SolvencySnapshotStatus" NOT NULL,
  "evidenceFreshness" "SolvencyEvidenceFreshness" NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "latestReconciliationScanRunId" TEXT,
  "totalLiabilityAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "totalUsableReserveAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "totalObservedReserveAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "totalEncumberedReserveAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "totalReserveDeltaAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "assetCount" INTEGER NOT NULL DEFAULT 0,
  "issueCount" INTEGER NOT NULL DEFAULT 0,
  "policyActionsTriggered" BOOLEAN NOT NULL DEFAULT false,
  "summarySnapshot" JSONB,
  "policyActionSnapshot" JSONB,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SolvencySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SolvencyAssetSnapshot" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "status" "SolvencySnapshotStatus" NOT NULL,
  "evidenceFreshness" "SolvencyEvidenceFreshness" NOT NULL,
  "liabilityAvailableAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "liabilityReservedAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "pendingCreditAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "totalLiabilityAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "projectionAvailableAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "projectionPendingAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "observedReserveAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "usableReserveAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "encumberedReserveAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "excludedReserveAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "reserveDeltaAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "reserveRatioBps" INTEGER,
  "openReconciliationMismatchCount" INTEGER NOT NULL DEFAULT 0,
  "criticalReconciliationMismatchCount" INTEGER NOT NULL DEFAULT 0,
  "issueCount" INTEGER NOT NULL DEFAULT 0,
  "summarySnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SolvencyAssetSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SolvencyReserveEvidence" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "walletId" TEXT,
  "reserveSourceType" "SolvencyReserveSourceType" NOT NULL,
  "walletAddress" TEXT,
  "walletKind" "WalletKind",
  "custodyType" "WalletCustodyType",
  "evidenceFreshness" "SolvencyEvidenceFreshness" NOT NULL,
  "observedBalanceAmount" DECIMAL(36,18),
  "usableBalanceAmount" DECIMAL(36,18),
  "encumberedBalanceAmount" DECIMAL(36,18),
  "excludedBalanceAmount" DECIMAL(36,18),
  "observedAt" TIMESTAMP(3),
  "staleAfterSeconds" INTEGER NOT NULL,
  "readErrorCode" TEXT,
  "readErrorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SolvencyReserveEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SolvencyIssue" (
  "id" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "assetId" TEXT,
  "classification" "SolvencyIssueClassification" NOT NULL,
  "severity" "SolvencyIssueSeverity" NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "recommendedAction" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SolvencyIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SolvencyPolicyState" (
  "id" TEXT NOT NULL,
  "environment" "WorkerRuntimeEnvironment" NOT NULL,
  "status" "SolvencyPolicyStateStatus" NOT NULL,
  "pauseWithdrawalApprovals" BOOLEAN NOT NULL DEFAULT false,
  "pauseManagedWithdrawalExecution" BOOLEAN NOT NULL DEFAULT false,
  "pauseLoanFunding" BOOLEAN NOT NULL DEFAULT false,
  "pauseStakingWrites" BOOLEAN NOT NULL DEFAULT false,
  "requireManualOperatorReview" BOOLEAN NOT NULL DEFAULT false,
  "latestSnapshotId" TEXT,
  "triggeredAt" TIMESTAMP(3),
  "clearedAt" TIMESTAMP(3),
  "reasonCode" TEXT,
  "reasonSummary" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SolvencyPolicyState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SolvencyAssetSnapshot_snapshotId_assetId_key"
ON "SolvencyAssetSnapshot"("snapshotId", "assetId");

CREATE UNIQUE INDEX "SolvencyPolicyState_environment_key"
ON "SolvencyPolicyState"("environment");

CREATE INDEX "SolvencySnapshot_environment_generatedAt_idx"
ON "SolvencySnapshot"("environment", "generatedAt");

CREATE INDEX "SolvencySnapshot_status_generatedAt_idx"
ON "SolvencySnapshot"("status", "generatedAt");

CREATE INDEX "SolvencySnapshot_evidenceFreshness_generatedAt_idx"
ON "SolvencySnapshot"("evidenceFreshness", "generatedAt");

CREATE INDEX "SolvencySnapshot_latestReconciliationScanRunId_idx"
ON "SolvencySnapshot"("latestReconciliationScanRunId");

CREATE INDEX "SolvencyAssetSnapshot_assetId_createdAt_idx"
ON "SolvencyAssetSnapshot"("assetId", "createdAt");

CREATE INDEX "SolvencyAssetSnapshot_status_createdAt_idx"
ON "SolvencyAssetSnapshot"("status", "createdAt");

CREATE INDEX "SolvencyReserveEvidence_snapshotId_assetId_createdAt_idx"
ON "SolvencyReserveEvidence"("snapshotId", "assetId", "createdAt");

CREATE INDEX "SolvencyReserveEvidence_walletId_assetId_createdAt_idx"
ON "SolvencyReserveEvidence"("walletId", "assetId", "createdAt");

CREATE INDEX "SolvencyReserveEvidence_evidenceFreshness_createdAt_idx"
ON "SolvencyReserveEvidence"("evidenceFreshness", "createdAt");

CREATE INDEX "SolvencyIssue_snapshotId_severity_createdAt_idx"
ON "SolvencyIssue"("snapshotId", "severity", "createdAt");

CREATE INDEX "SolvencyIssue_assetId_classification_createdAt_idx"
ON "SolvencyIssue"("assetId", "classification", "createdAt");

CREATE INDEX "SolvencyIssue_classification_severity_createdAt_idx"
ON "SolvencyIssue"("classification", "severity", "createdAt");

CREATE INDEX "SolvencyPolicyState_status_updatedAt_idx"
ON "SolvencyPolicyState"("status", "updatedAt");

CREATE INDEX "SolvencyPolicyState_latestSnapshotId_idx"
ON "SolvencyPolicyState"("latestSnapshotId");

ALTER TABLE "SolvencySnapshot"
ADD CONSTRAINT "SolvencySnapshot_latestReconciliationScanRunId_fkey"
FOREIGN KEY ("latestReconciliationScanRunId")
REFERENCES "LedgerReconciliationScanRun"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "SolvencyAssetSnapshot"
ADD CONSTRAINT "SolvencyAssetSnapshot_snapshotId_fkey"
FOREIGN KEY ("snapshotId")
REFERENCES "SolvencySnapshot"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "SolvencyAssetSnapshot"
ADD CONSTRAINT "SolvencyAssetSnapshot_assetId_fkey"
FOREIGN KEY ("assetId")
REFERENCES "Asset"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "SolvencyReserveEvidence"
ADD CONSTRAINT "SolvencyReserveEvidence_snapshotId_fkey"
FOREIGN KEY ("snapshotId")
REFERENCES "SolvencySnapshot"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "SolvencyReserveEvidence"
ADD CONSTRAINT "SolvencyReserveEvidence_assetId_fkey"
FOREIGN KEY ("assetId")
REFERENCES "Asset"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "SolvencyReserveEvidence"
ADD CONSTRAINT "SolvencyReserveEvidence_walletId_fkey"
FOREIGN KEY ("walletId")
REFERENCES "Wallet"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "SolvencyIssue"
ADD CONSTRAINT "SolvencyIssue_snapshotId_fkey"
FOREIGN KEY ("snapshotId")
REFERENCES "SolvencySnapshot"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "SolvencyIssue"
ADD CONSTRAINT "SolvencyIssue_assetId_fkey"
FOREIGN KEY ("assetId")
REFERENCES "Asset"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "SolvencyPolicyState"
ADD CONSTRAINT "SolvencyPolicyState_latestSnapshotId_fkey"
FOREIGN KEY ("latestSnapshotId")
REFERENCES "SolvencySnapshot"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
