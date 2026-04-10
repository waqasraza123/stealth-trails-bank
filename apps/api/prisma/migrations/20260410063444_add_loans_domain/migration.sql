-- CreateEnum
CREATE TYPE "LoanJurisdictionCode" AS ENUM ('saudi_arabia', 'uae', 'usa');

-- CreateEnum
CREATE TYPE "LoanLifecycleStatus" AS ENUM ('draft_application', 'submitted', 'under_review', 'approved', 'rejected', 'awaiting_funding', 'active', 'grace_period', 'delinquent', 'defaulted', 'liquidating', 'closed');

-- CreateEnum
CREATE TYPE "LoanCollateralStatus" AS ENUM ('pending_lock', 'locked', 'margin_warning', 'liquidation_review', 'liquidating', 'released', 'seized');

-- CreateEnum
CREATE TYPE "LoanInstallmentStatus" AS ENUM ('scheduled', 'due', 'partial', 'paid', 'missed', 'waived');

-- CreateEnum
CREATE TYPE "LoanRepaymentStatus" AS ENUM ('scheduled', 'processing', 'settled', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "LoanLiquidationStatus" AS ENUM ('review_requested', 'approved', 'executing', 'executed', 'cancelled', 'closed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerAccountType" ADD VALUE 'loan_principal_receivable';
ALTER TYPE "LedgerAccountType" ADD VALUE 'loan_service_fee_receivable';
ALTER TYPE "LedgerAccountType" ADD VALUE 'loan_service_fee_income';
ALTER TYPE "LedgerAccountType" ADD VALUE 'loan_collateral_custody';
ALTER TYPE "LedgerAccountType" ADD VALUE 'loan_liquidation_clearing';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerJournalType" ADD VALUE 'loan_disbursement';
ALTER TYPE "LedgerJournalType" ADD VALUE 'loan_repayment';
ALTER TYPE "LedgerJournalType" ADD VALUE 'loan_service_fee_accrual';
ALTER TYPE "LedgerJournalType" ADD VALUE 'loan_collateral_lock';
ALTER TYPE "LedgerJournalType" ADD VALUE 'loan_collateral_release';
ALTER TYPE "LedgerJournalType" ADD VALUE 'loan_liquidation';

-- DropIndex
DROP INDEX "ReleaseReadinessEvidence_evidenceType_environment_observedAt_id";

-- DropIndex
DROP INDEX "ReleaseReadinessEvidence_operatorId_observedAt_idx";

-- DropIndex
DROP INDEX "ReleaseReadinessEvidence_releaseIdentifier_observedAt_idx";

-- DropIndex
DROP INDEX "ReleaseReadinessEvidence_status_observedAt_idx";

-- AlterTable
ALTER TABLE "CustomerAccountIncidentPackageRelease" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LedgerReconciliationMismatch" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LedgerReconciliationScanRun" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PlatformAlert" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PlatformAlertDelivery" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReleaseReadinessEvidence" ALTER COLUMN "evidenceLinks" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkerRuntimeHeartbeat" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "status" "LoanLifecycleStatus" NOT NULL DEFAULT 'submitted',
    "jurisdiction" "LoanJurisdictionCode" NOT NULL,
    "requestedBorrowAssetId" TEXT NOT NULL,
    "requestedCollateralAssetId" TEXT NOT NULL,
    "requestedBorrowAmount" DECIMAL(36,18) NOT NULL,
    "requestedCollateralAmount" DECIMAL(36,18) NOT NULL,
    "requestedTermMonths" INTEGER NOT NULL,
    "serviceFeeAmount" DECIMAL(36,18) NOT NULL,
    "autopayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByOperatorId" TEXT,
    "reviewedByOperatorRole" TEXT,
    "decisionNote" TEXT,
    "failureReason" TEXT,
    "quoteSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanAgreement" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "status" "LoanLifecycleStatus" NOT NULL DEFAULT 'awaiting_funding',
    "jurisdiction" "LoanJurisdictionCode" NOT NULL,
    "borrowAssetId" TEXT NOT NULL,
    "collateralAssetId" TEXT NOT NULL,
    "principalAmount" DECIMAL(36,18) NOT NULL,
    "collateralAmount" DECIMAL(36,18) NOT NULL,
    "serviceFeeAmount" DECIMAL(36,18) NOT NULL,
    "totalRepayableAmount" DECIMAL(36,18) NOT NULL,
    "outstandingPrincipalAmount" DECIMAL(36,18) NOT NULL,
    "outstandingServiceFeeAmount" DECIMAL(36,18) NOT NULL,
    "outstandingTotalAmount" DECIMAL(36,18) NOT NULL,
    "installmentAmount" DECIMAL(36,18) NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "autopayEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contractLoanId" TEXT,
    "contractAddress" TEXT,
    "activationTransactionHash" TEXT,
    "approvedAt" TIMESTAMP(3),
    "fundedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "delinquentAt" TIMESTAMP(3),
    "defaultedAt" TIMESTAMP(3),
    "liquidationStartedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "disclosureSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanInstallment" (
    "id" TEXT NOT NULL,
    "loanAgreementId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "LoanInstallmentStatus" NOT NULL DEFAULT 'scheduled',
    "scheduledPrincipalAmount" DECIMAL(36,18) NOT NULL,
    "scheduledServiceFeeAmount" DECIMAL(36,18) NOT NULL,
    "scheduledTotalAmount" DECIMAL(36,18) NOT NULL,
    "paidPrincipalAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "paidServiceFeeAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "paidTotalAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "lastAutopayAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRepaymentEvent" (
    "id" TEXT NOT NULL,
    "loanAgreementId" TEXT NOT NULL,
    "installmentId" TEXT,
    "assetId" TEXT NOT NULL,
    "status" "LoanRepaymentStatus" NOT NULL DEFAULT 'scheduled',
    "amount" DECIMAL(36,18) NOT NULL,
    "principalAppliedAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "serviceFeeAppliedAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "autopayAttempted" BOOLEAN NOT NULL DEFAULT false,
    "autopaySucceeded" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "LoanRepaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanCollateralPosition" (
    "id" TEXT NOT NULL,
    "loanAgreementId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "status" "LoanCollateralStatus" NOT NULL DEFAULT 'pending_lock',
    "walletAddress" TEXT,
    "currentValuationUsd" DECIMAL(36,18),
    "latestLtvBps" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "seizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanCollateralPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanValuationSnapshot" (
    "id" TEXT NOT NULL,
    "loanAgreementId" TEXT NOT NULL,
    "collateralPositionId" TEXT,
    "priceUsd" DECIMAL(36,18) NOT NULL,
    "collateralValueUsd" DECIMAL(36,18) NOT NULL,
    "principalValueUsd" DECIMAL(36,18) NOT NULL,
    "ltvBps" INTEGER NOT NULL,
    "warningLtvBps" INTEGER NOT NULL,
    "liquidationLtvBps" INTEGER NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanValuationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanLiquidationCase" (
    "id" TEXT NOT NULL,
    "loanAgreementId" TEXT NOT NULL,
    "status" "LoanLiquidationStatus" NOT NULL DEFAULT 'review_requested',
    "reasonCode" TEXT NOT NULL,
    "requestedByOperatorId" TEXT,
    "approvedByOperatorId" TEXT,
    "executedByOperatorId" TEXT,
    "note" TEXT,
    "executionTransactionHash" TEXT,
    "recoveredAmount" DECIMAL(36,18),
    "shortfallAmount" DECIMAL(36,18),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanLiquidationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanStatement" (
    "id" TEXT NOT NULL,
    "loanAgreementId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "summarySnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanEvent" (
    "id" TEXT NOT NULL,
    "loanApplicationId" TEXT,
    "loanAgreementId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "eventType" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoanApplication_customerAccountId_status_updatedAt_idx" ON "LoanApplication"("customerAccountId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "LoanApplication_jurisdiction_status_updatedAt_idx" ON "LoanApplication"("jurisdiction", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "LoanApplication_requestedBorrowAssetId_status_idx" ON "LoanApplication"("requestedBorrowAssetId", "status");

-- CreateIndex
CREATE INDEX "LoanApplication_requestedCollateralAssetId_status_idx" ON "LoanApplication"("requestedCollateralAssetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LoanAgreement_applicationId_key" ON "LoanAgreement"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "LoanAgreement_contractLoanId_key" ON "LoanAgreement"("contractLoanId");

-- CreateIndex
CREATE INDEX "LoanAgreement_customerAccountId_status_updatedAt_idx" ON "LoanAgreement"("customerAccountId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "LoanAgreement_status_nextDueAt_idx" ON "LoanAgreement"("status", "nextDueAt");

-- CreateIndex
CREATE INDEX "LoanAgreement_jurisdiction_status_updatedAt_idx" ON "LoanAgreement"("jurisdiction", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "LoanAgreement_borrowAssetId_status_idx" ON "LoanAgreement"("borrowAssetId", "status");

-- CreateIndex
CREATE INDEX "LoanAgreement_collateralAssetId_status_idx" ON "LoanAgreement"("collateralAssetId", "status");

-- CreateIndex
CREATE INDEX "LoanInstallment_loanAgreementId_dueAt_idx" ON "LoanInstallment"("loanAgreementId", "dueAt");

-- CreateIndex
CREATE INDEX "LoanInstallment_status_dueAt_idx" ON "LoanInstallment"("status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoanInstallment_loanAgreementId_installmentNumber_key" ON "LoanInstallment"("loanAgreementId", "installmentNumber");

-- CreateIndex
CREATE INDEX "LoanRepaymentEvent_loanAgreementId_createdAt_idx" ON "LoanRepaymentEvent"("loanAgreementId", "createdAt");

-- CreateIndex
CREATE INDEX "LoanRepaymentEvent_installmentId_createdAt_idx" ON "LoanRepaymentEvent"("installmentId", "createdAt");

-- CreateIndex
CREATE INDEX "LoanRepaymentEvent_status_createdAt_idx" ON "LoanRepaymentEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LoanCollateralPosition_loanAgreementId_status_updatedAt_idx" ON "LoanCollateralPosition"("loanAgreementId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "LoanCollateralPosition_assetId_status_idx" ON "LoanCollateralPosition"("assetId", "status");

-- CreateIndex
CREATE INDEX "LoanValuationSnapshot_loanAgreementId_observedAt_idx" ON "LoanValuationSnapshot"("loanAgreementId", "observedAt");

-- CreateIndex
CREATE INDEX "LoanValuationSnapshot_collateralPositionId_observedAt_idx" ON "LoanValuationSnapshot"("collateralPositionId", "observedAt");

-- CreateIndex
CREATE INDEX "LoanLiquidationCase_loanAgreementId_status_updatedAt_idx" ON "LoanLiquidationCase"("loanAgreementId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "LoanLiquidationCase_status_updatedAt_idx" ON "LoanLiquidationCase"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoanStatement_referenceId_key" ON "LoanStatement"("referenceId");

-- CreateIndex
CREATE INDEX "LoanStatement_loanAgreementId_statementDate_idx" ON "LoanStatement"("loanAgreementId", "statementDate");

-- CreateIndex
CREATE INDEX "LoanStatement_customerAccountId_statementDate_idx" ON "LoanStatement"("customerAccountId", "statementDate");

-- CreateIndex
CREATE INDEX "LoanEvent_loanApplicationId_createdAt_idx" ON "LoanEvent"("loanApplicationId", "createdAt");

-- CreateIndex
CREATE INDEX "LoanEvent_loanAgreementId_createdAt_idx" ON "LoanEvent"("loanAgreementId", "createdAt");

-- CreateIndex
CREATE INDEX "LoanEvent_eventType_createdAt_idx" ON "LoanEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "ReleaseReadinessEvidence_evidenceType_environment_observedA_idx" ON "ReleaseReadinessEvidence"("evidenceType", "environment", "observedAt");

-- CreateIndex
CREATE INDEX "ReleaseReadinessEvidence_status_observedAt_idx" ON "ReleaseReadinessEvidence"("status", "observedAt");

-- CreateIndex
CREATE INDEX "ReleaseReadinessEvidence_operatorId_observedAt_idx" ON "ReleaseReadinessEvidence"("operatorId", "observedAt");

-- CreateIndex
CREATE INDEX "ReleaseReadinessEvidence_releaseIdentifier_observedAt_idx" ON "ReleaseReadinessEvidence"("releaseIdentifier", "observedAt");

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_requestedBorrowAssetId_fkey" FOREIGN KEY ("requestedBorrowAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanApplication" ADD CONSTRAINT "LoanApplication_requestedCollateralAssetId_fkey" FOREIGN KEY ("requestedCollateralAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAgreement" ADD CONSTRAINT "LoanAgreement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAgreement" ADD CONSTRAINT "LoanAgreement_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAgreement" ADD CONSTRAINT "LoanAgreement_borrowAssetId_fkey" FOREIGN KEY ("borrowAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAgreement" ADD CONSTRAINT "LoanAgreement_collateralAssetId_fkey" FOREIGN KEY ("collateralAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanInstallment" ADD CONSTRAINT "LoanInstallment_loanAgreementId_fkey" FOREIGN KEY ("loanAgreementId") REFERENCES "LoanAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepaymentEvent" ADD CONSTRAINT "LoanRepaymentEvent_loanAgreementId_fkey" FOREIGN KEY ("loanAgreementId") REFERENCES "LoanAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepaymentEvent" ADD CONSTRAINT "LoanRepaymentEvent_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "LoanInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRepaymentEvent" ADD CONSTRAINT "LoanRepaymentEvent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanCollateralPosition" ADD CONSTRAINT "LoanCollateralPosition_loanAgreementId_fkey" FOREIGN KEY ("loanAgreementId") REFERENCES "LoanAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanCollateralPosition" ADD CONSTRAINT "LoanCollateralPosition_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanValuationSnapshot" ADD CONSTRAINT "LoanValuationSnapshot_loanAgreementId_fkey" FOREIGN KEY ("loanAgreementId") REFERENCES "LoanAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanValuationSnapshot" ADD CONSTRAINT "LoanValuationSnapshot_collateralPositionId_fkey" FOREIGN KEY ("collateralPositionId") REFERENCES "LoanCollateralPosition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanLiquidationCase" ADD CONSTRAINT "LoanLiquidationCase_loanAgreementId_fkey" FOREIGN KEY ("loanAgreementId") REFERENCES "LoanAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanStatement" ADD CONSTRAINT "LoanStatement_loanAgreementId_fkey" FOREIGN KEY ("loanAgreementId") REFERENCES "LoanAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanStatement" ADD CONSTRAINT "LoanStatement_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanEvent" ADD CONSTRAINT "LoanEvent_loanApplicationId_fkey" FOREIGN KEY ("loanApplicationId") REFERENCES "LoanApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanEvent" ADD CONSTRAINT "LoanEvent_loanAgreementId_fkey" FOREIGN KEY ("loanAgreementId") REFERENCES "LoanAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CustomerAccountIncidentPackageRelease_approvedByOperatorId_app_" RENAME TO "CustomerAccountIncidentPackageRelease_approvedByOperatorId__idx";

-- RenameIndex
ALTER INDEX "CustomerAccountIncidentPackageRelease_customerAccountId_status_" RENAME TO "CustomerAccountIncidentPackageRelease_customerAccountId_sta_idx";

-- RenameIndex
ALTER INDEX "CustomerAccountIncidentPackageRelease_releasedByOperatorId_rel_" RENAME TO "CustomerAccountIncidentPackageRelease_releasedByOperatorId__idx";

-- RenameIndex
ALTER INDEX "CustomerAccountIncidentPackageRelease_requestedByOperatorId_req" RENAME TO "CustomerAccountIncidentPackageRelease_requestedByOperatorId_idx";

-- RenameIndex
ALTER INDEX "PlatformAlertDelivery_platformAlertId_escalationLevel_createdAt" RENAME TO "PlatformAlertDelivery_platformAlertId_escalationLevel_creat_idx";

-- RenameIndex
ALTER INDEX "ReleaseReadinessApproval_releaseIdentifier_environment_re_idx" RENAME TO "ReleaseReadinessApproval_releaseIdentifier_environment_requ_idx";

-- RenameIndex
ALTER INDEX "ReleaseReadinessApproval_requestedByOperatorId_requestedA_idx" RENAME TO "ReleaseReadinessApproval_requestedByOperatorId_requestedAt_idx";

-- RenameIndex
ALTER INDEX "StakingPoolGovernanceRequest_approvedByOperatorId_ap_idx" RENAME TO "StakingPoolGovernanceRequest_approvedByOperatorId_approvedA_idx";

-- RenameIndex
ALTER INDEX "StakingPoolGovernanceRequest_executedByOperatorId_ex_idx" RENAME TO "StakingPoolGovernanceRequest_executedByOperatorId_executedA_idx";

-- RenameIndex
ALTER INDEX "StakingPoolGovernanceRequest_requestedByOperatorId_requ_idx" RENAME TO "StakingPoolGovernanceRequest_requestedByOperatorId_requeste_idx";

-- RenameIndex
ALTER INDEX "WorkerRuntimeHeartbeat_lastReconciliationScanStatus_lastHeartbe" RENAME TO "WorkerRuntimeHeartbeat_lastReconciliationScanStatus_lastHea_idx";
