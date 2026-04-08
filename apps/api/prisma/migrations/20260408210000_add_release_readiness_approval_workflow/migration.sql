-- CreateEnum
CREATE TYPE "ReleaseReadinessApprovalStatus" AS ENUM ('pending_approval', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "ReleaseReadinessApproval" (
    "id" TEXT NOT NULL,
    "releaseIdentifier" TEXT NOT NULL,
    "environment" "ReleaseReadinessEnvironment" NOT NULL,
    "rollbackReleaseIdentifier" TEXT,
    "status" "ReleaseReadinessApprovalStatus" NOT NULL DEFAULT 'pending_approval',
    "summary" TEXT NOT NULL,
    "requestNote" TEXT,
    "approvalNote" TEXT,
    "rejectionNote" TEXT,
    "requestedByOperatorId" TEXT NOT NULL,
    "requestedByOperatorRole" TEXT,
    "approvedByOperatorId" TEXT,
    "approvedByOperatorRole" TEXT,
    "rejectedByOperatorId" TEXT,
    "rejectedByOperatorRole" TEXT,
    "securityConfigurationComplete" BOOLEAN NOT NULL DEFAULT false,
    "accessAndGovernanceComplete" BOOLEAN NOT NULL DEFAULT false,
    "dataAndRecoveryComplete" BOOLEAN NOT NULL DEFAULT false,
    "platformHealthComplete" BOOLEAN NOT NULL DEFAULT false,
    "functionalProofComplete" BOOLEAN NOT NULL DEFAULT false,
    "contractAndChainProofComplete" BOOLEAN NOT NULL DEFAULT false,
    "finalSignoffComplete" BOOLEAN NOT NULL DEFAULT false,
    "unresolvedRisksAccepted" BOOLEAN NOT NULL DEFAULT false,
    "openBlockers" TEXT[],
    "residualRiskNote" TEXT,
    "evidenceSnapshot" JSONB NOT NULL,
    "blockerSnapshot" JSONB NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReleaseReadinessApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleaseReadinessApproval_releaseIdentifier_environment_re_idx" ON "ReleaseReadinessApproval"("releaseIdentifier", "environment", "requestedAt");

-- CreateIndex
CREATE INDEX "ReleaseReadinessApproval_status_requestedAt_idx" ON "ReleaseReadinessApproval"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "ReleaseReadinessApproval_requestedByOperatorId_requestedA_idx" ON "ReleaseReadinessApproval"("requestedByOperatorId", "requestedAt");

-- CreateIndex
CREATE INDEX "ReleaseReadinessApproval_approvedByOperatorId_approvedAt_idx" ON "ReleaseReadinessApproval"("approvedByOperatorId", "approvedAt");
