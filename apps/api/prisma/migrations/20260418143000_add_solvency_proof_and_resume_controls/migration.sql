-- CreateEnum
CREATE TYPE "SolvencyPolicyResumeRequestStatus" AS ENUM ('pending_approval', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "SolvencyAssetSnapshot"
ADD COLUMN     "liabilityLeafCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "liabilityMerkleRoot" TEXT,
ADD COLUMN     "liabilitySetChecksumSha256" TEXT;

-- AlterTable
ALTER TABLE "SolvencyPolicyState"
ADD COLUMN     "manualResumeApprovedAt" TIMESTAMP(3),
ADD COLUMN     "manualResumeApprovedByOperatorId" TEXT,
ADD COLUMN     "manualResumeApprovedByOperatorRole" TEXT,
ADD COLUMN     "manualResumeRequestedAt" TIMESTAMP(3),
ADD COLUMN     "manualResumeRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SolvencyLiabilityLeaf" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "leafIndex" INTEGER NOT NULL,
    "availableLiabilityAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "reservedLiabilityAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "pendingCreditAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "totalLiabilityAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "leafHash" TEXT NOT NULL,
    "canonicalPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolvencyLiabilityLeaf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolvencyReport" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "environment" "WorkerRuntimeEnvironment" NOT NULL,
    "chainId" INTEGER NOT NULL,
    "reportVersion" INTEGER NOT NULL DEFAULT 1,
    "reportHash" TEXT NOT NULL,
    "reportChecksumSha256" TEXT NOT NULL,
    "canonicalPayload" JSONB NOT NULL,
    "canonicalPayloadText" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "signatureAlgorithm" TEXT NOT NULL,
    "signerAddress" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolvencyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolvencyPolicyResumeRequest" (
    "id" TEXT NOT NULL,
    "environment" "WorkerRuntimeEnvironment" NOT NULL,
    "policyStateId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "status" "SolvencyPolicyResumeRequestStatus" NOT NULL,
    "requestedByOperatorId" TEXT NOT NULL,
    "requestedByOperatorRole" TEXT NOT NULL,
    "requestNote" TEXT,
    "expectedPolicyUpdatedAt" TIMESTAMP(3) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByOperatorId" TEXT,
    "approvedByOperatorRole" TEXT,
    "approvalNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByOperatorId" TEXT,
    "rejectedByOperatorRole" TEXT,
    "rejectionNote" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolvencyPolicyResumeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolvencyLiabilityLeaf_snapshotId_assetId_customerAccountId_key" ON "SolvencyLiabilityLeaf"("snapshotId", "assetId", "customerAccountId");

-- CreateIndex
CREATE INDEX "SolvencyLiabilityLeaf_snapshotId_assetId_leafIndex_idx" ON "SolvencyLiabilityLeaf"("snapshotId", "assetId", "leafIndex");

-- CreateIndex
CREATE INDEX "SolvencyLiabilityLeaf_customerAccountId_snapshotId_idx" ON "SolvencyLiabilityLeaf"("customerAccountId", "snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "SolvencyReport_snapshotId_key" ON "SolvencyReport"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "SolvencyReport_reportHash_key" ON "SolvencyReport"("reportHash");

-- CreateIndex
CREATE INDEX "SolvencyReport_environment_publishedAt_idx" ON "SolvencyReport"("environment", "publishedAt");

-- CreateIndex
CREATE INDEX "SolvencyPolicyResumeRequest_environment_status_requestedAt_idx" ON "SolvencyPolicyResumeRequest"("environment", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "SolvencyPolicyResumeRequest_policyStateId_status_requestedAt_idx" ON "SolvencyPolicyResumeRequest"("policyStateId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "SolvencyPolicyResumeRequest_snapshotId_status_requestedAt_idx" ON "SolvencyPolicyResumeRequest"("snapshotId", "status", "requestedAt");

-- AddForeignKey
ALTER TABLE "SolvencyLiabilityLeaf" ADD CONSTRAINT "SolvencyLiabilityLeaf_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SolvencySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvencyLiabilityLeaf" ADD CONSTRAINT "SolvencyLiabilityLeaf_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvencyLiabilityLeaf" ADD CONSTRAINT "SolvencyLiabilityLeaf_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvencyReport" ADD CONSTRAINT "SolvencyReport_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SolvencySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvencyPolicyResumeRequest" ADD CONSTRAINT "SolvencyPolicyResumeRequest_policyStateId_fkey" FOREIGN KEY ("policyStateId") REFERENCES "SolvencyPolicyState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvencyPolicyResumeRequest" ADD CONSTRAINT "SolvencyPolicyResumeRequest_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SolvencySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
