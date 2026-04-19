-- CreateEnum
CREATE TYPE "OperatorStatus" AS ENUM ('active', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "OperatorAssignmentStatus" AS ENUM ('active', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "OperatorSessionAuthSource" AS ENUM ('supabase_jwt', 'legacy_api_key');

-- CreateEnum
CREATE TYPE "ApprovalAuthorityScope" AS ENUM ('release_readiness', 'governed_execution', 'staking_governance', 'loan_governance', 'treasury_execution', 'incident_package_release');

-- CreateEnum
CREATE TYPE "ApprovalAuthorityLevel" AS ENUM ('request', 'approve', 'execute');

-- CreateEnum
CREATE TYPE "GovernanceAuthorityType" AS ENUM ('governance_safe', 'treasury_safe', 'emergency_safe');

-- CreateEnum
CREATE TYPE "GovernanceManifestStatus" AS ENUM ('draft', 'active', 'retired');

-- CreateEnum
CREATE TYPE "GovernedSignerScope" AS ENUM ('staking_execution', 'loan_execution', 'policy_withdrawal_authorization', 'policy_withdrawal_executor', 'governed_execution_package');

-- CreateEnum
CREATE TYPE "GovernedSignerBackendKind" AS ENUM ('kms', 'hsm', 'external_managed');

-- CreateEnum
CREATE TYPE "ContractProductSurface" AS ENUM ('staking_v1', 'loan_book_v1');

-- CreateEnum
CREATE TYPE "ContractDeploymentStatus" AS ENUM ('draft', 'active', 'retired');

-- DropForeignKey
ALTER TABLE "ReleaseReadinessApproval" DROP CONSTRAINT "ReleaseReadinessApproval_launchClosurePackId_fkey";

-- DropForeignKey
ALTER TABLE "SolvencyAssetSnapshot" DROP CONSTRAINT "SolvencyAssetSnapshot_snapshotId_fkey";

-- DropForeignKey
ALTER TABLE "SolvencyIssue" DROP CONSTRAINT "SolvencyIssue_snapshotId_fkey";

-- DropForeignKey
ALTER TABLE "SolvencyReserveEvidence" DROP CONSTRAINT "SolvencyReserveEvidence_snapshotId_fkey";

-- AlterTable
ALTER TABLE "ReleaseLaunchClosurePack" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SolvencyPolicyResumeRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SolvencyPolicyState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SolvencySnapshot" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "OperatorStatus" NOT NULL DEFAULT 'active',
    "mfaRequired" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorRoleAssignment" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" "OperatorAssignmentStatus" NOT NULL DEFAULT 'active',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "grantedByOperatorId" TEXT,
    "note" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorEnvironmentAccess" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "environment" "ReleaseReadinessEnvironment" NOT NULL,
    "status" "OperatorAssignmentStatus" NOT NULL DEFAULT 'active',
    "grantedByOperatorId" TEXT,
    "note" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorEnvironmentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorApprovalAuthority" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "scope" "ApprovalAuthorityScope" NOT NULL,
    "level" "ApprovalAuthorityLevel" NOT NULL,
    "environment" "ReleaseReadinessEnvironment" NOT NULL,
    "status" "OperatorAssignmentStatus" NOT NULL DEFAULT 'active',
    "grantedByOperatorId" TEXT,
    "note" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorApprovalAuthority_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorSessionAudit" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "authSource" "OperatorSessionAuthSource" NOT NULL,
    "environment" "ReleaseReadinessEnvironment" NOT NULL,
    "requestPath" TEXT,
    "requestId" TEXT,
    "sessionCorrelationId" TEXT,
    "userAgent" TEXT,
    "origin" TEXT,
    "remoteAddress" TEXT,
    "tokenAal" TEXT,
    "roleSnapshot" TEXT[],
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorSessionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceAuthorityManifest" (
    "id" TEXT NOT NULL,
    "environment" "ReleaseReadinessEnvironment" NOT NULL,
    "chainId" INTEGER NOT NULL,
    "authorityType" "GovernanceAuthorityType" NOT NULL,
    "address" TEXT NOT NULL,
    "ownerLabel" TEXT,
    "manifestStatus" "GovernanceManifestStatus" NOT NULL DEFAULT 'active',
    "manifestPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceAuthorityManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernedSignerInventory" (
    "id" TEXT NOT NULL,
    "environment" "ReleaseReadinessEnvironment" NOT NULL,
    "chainId" INTEGER NOT NULL,
    "signerScope" "GovernedSignerScope" NOT NULL,
    "backendKind" "GovernedSignerBackendKind" NOT NULL,
    "keyReference" TEXT NOT NULL,
    "signerAddress" TEXT NOT NULL,
    "allowedMethods" TEXT[],
    "manifestVersion" TEXT,
    "environmentBinding" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernedSignerInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDeploymentManifest" (
    "id" TEXT NOT NULL,
    "environment" "ReleaseReadinessEnvironment" NOT NULL,
    "chainId" INTEGER NOT NULL,
    "productSurface" "ContractProductSurface" NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "abiChecksumSha256" TEXT NOT NULL,
    "manifestStatus" "ContractDeploymentStatus" NOT NULL DEFAULT 'active',
    "legacyPath" BOOLEAN NOT NULL DEFAULT false,
    "governanceAuthorityId" TEXT,
    "treasuryAuthorityId" TEXT,
    "emergencyAuthorityId" TEXT,
    "deploymentManifestPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractDeploymentManifest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Operator_operatorId_key" ON "Operator"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Operator_supabaseUserId_key" ON "Operator"("supabaseUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");

-- CreateIndex
CREATE INDEX "Operator_status_createdAt_idx" ON "Operator"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Operator_email_status_idx" ON "Operator"("email", "status");

-- CreateIndex
CREATE INDEX "Operator_supabaseUserId_status_idx" ON "Operator"("supabaseUserId", "status");

-- CreateIndex
CREATE INDEX "OperatorRoleAssignment_operatorId_status_grantedAt_idx" ON "OperatorRoleAssignment"("operatorId", "status", "grantedAt");

-- CreateIndex
CREATE INDEX "OperatorRoleAssignment_role_status_grantedAt_idx" ON "OperatorRoleAssignment"("role", "status", "grantedAt");

-- CreateIndex
CREATE INDEX "OperatorRoleAssignment_isPrimary_status_idx" ON "OperatorRoleAssignment"("isPrimary", "status");

-- CreateIndex
CREATE INDEX "OperatorEnvironmentAccess_environment_status_grantedAt_idx" ON "OperatorEnvironmentAccess"("environment", "status", "grantedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorEnvironmentAccess_operatorId_environment_key" ON "OperatorEnvironmentAccess"("operatorId", "environment");

-- CreateIndex
CREATE INDEX "OperatorApprovalAuthority_operatorId_scope_level_status_idx" ON "OperatorApprovalAuthority"("operatorId", "scope", "level", "status");

-- CreateIndex
CREATE INDEX "OperatorApprovalAuthority_scope_level_environment_status_idx" ON "OperatorApprovalAuthority"("scope", "level", "environment", "status");

-- CreateIndex
CREATE INDEX "OperatorSessionAudit_operatorId_observedAt_idx" ON "OperatorSessionAudit"("operatorId", "observedAt");

-- CreateIndex
CREATE INDEX "OperatorSessionAudit_environment_observedAt_idx" ON "OperatorSessionAudit"("environment", "observedAt");

-- CreateIndex
CREATE INDEX "OperatorSessionAudit_requestId_observedAt_idx" ON "OperatorSessionAudit"("requestId", "observedAt");

-- CreateIndex
CREATE INDEX "OperatorSessionAudit_sessionCorrelationId_observedAt_idx" ON "OperatorSessionAudit"("sessionCorrelationId", "observedAt");

-- CreateIndex
CREATE INDEX "GovernanceAuthorityManifest_environment_chainId_manifestSta_idx" ON "GovernanceAuthorityManifest"("environment", "chainId", "manifestStatus");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceAuthorityManifest_environment_chainId_authorityTy_key" ON "GovernanceAuthorityManifest"("environment", "chainId", "authorityType", "address");

-- CreateIndex
CREATE INDEX "GovernedSignerInventory_environment_chainId_signerScope_act_idx" ON "GovernedSignerInventory"("environment", "chainId", "signerScope", "active");

-- CreateIndex
CREATE UNIQUE INDEX "GovernedSignerInventory_environment_chainId_signerScope_sig_key" ON "GovernedSignerInventory"("environment", "chainId", "signerScope", "signerAddress");

-- CreateIndex
CREATE INDEX "ContractDeploymentManifest_environment_chainId_productSurfa_idx" ON "ContractDeploymentManifest"("environment", "chainId", "productSurface", "manifestStatus");

-- CreateIndex
CREATE INDEX "ContractDeploymentManifest_contractVersion_manifestStatus_idx" ON "ContractDeploymentManifest"("contractVersion", "manifestStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ContractDeploymentManifest_environment_chainId_productSurfa_key" ON "ContractDeploymentManifest"("environment", "chainId", "productSurface", "contractAddress");

-- RenameForeignKey
ALTER TABLE "GovernedTreasuryExecutionRequest" RENAME CONSTRAINT "GovernedTreasuryExecutionRequest_stakingPoolGovernanceRequestId" TO "GovernedTreasuryExecutionRequest_stakingPoolGovernanceRequ_fkey";

-- AddForeignKey
ALTER TABLE "SolvencyAssetSnapshot" ADD CONSTRAINT "SolvencyAssetSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SolvencySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvencyReserveEvidence" ADD CONSTRAINT "SolvencyReserveEvidence_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SolvencySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvencyIssue" ADD CONSTRAINT "SolvencyIssue_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SolvencySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorRoleAssignment" ADD CONSTRAINT "OperatorRoleAssignment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorEnvironmentAccess" ADD CONSTRAINT "OperatorEnvironmentAccess_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorApprovalAuthority" ADD CONSTRAINT "OperatorApprovalAuthority_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorSessionAudit" ADD CONSTRAINT "OperatorSessionAudit_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseReadinessApproval" ADD CONSTRAINT "ReleaseReadinessApproval_launchClosurePackId_fkey" FOREIGN KEY ("launchClosurePackId") REFERENCES "ReleaseLaunchClosurePack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "GovernedTreasuryExecutionRequest_asset_requested_idx" RENAME TO "GovernedTreasuryExecutionRequest_assetId_requestedAt_idx";

-- RenameIndex
ALTER INDEX "GovernedTreasuryExecutionRequest_environment_claimExpiry_reques" RENAME TO "GovernedTreasuryExecutionRequest_environment_claimExpiresAt_idx";

-- RenameIndex
ALTER INDEX "GovernedTreasuryExecutionRequest_environment_deliveryStatus_req" RENAME TO "GovernedTreasuryExecutionRequest_environment_deliveryStatus_idx";

-- RenameIndex
ALTER INDEX "GovernedTreasuryExecutionRequest_environment_dispatchStatus_req" RENAME TO "GovernedTreasuryExecutionRequest_environment_dispatchStatus_idx";

-- RenameIndex
ALTER INDEX "GovernedTreasuryExecutionRequest_environment_executorClaimExpir" RENAME TO "GovernedTreasuryExecutionRequest_environment_executorClaimE_idx";

-- RenameIndex
ALTER INDEX "GovernedTreasuryExecutionRequest_environment_published_requeste" RENAME TO "GovernedTreasuryExecutionRequest_environment_executionPacka_idx";

-- RenameIndex
ALTER INDEX "GovernedTreasuryExecutionRequest_environment_status_requested_i" RENAME TO "GovernedTreasuryExecutionRequest_environment_status_request_idx";

-- RenameIndex
ALTER INDEX "GovernedTreasuryExecutionRequest_loanAgreement_requested_idx" RENAME TO "GovernedTreasuryExecutionRequest_loanAgreementId_requestedA_idx";

-- RenameIndex
ALTER INDEX "GovernedTreasuryExecutionRequest_stakingRequest_requested_idx" RENAME TO "GovernedTreasuryExecutionRequest_stakingPoolGovernanceReque_idx";

-- RenameIndex
ALTER INDEX "GovernedTreasuryExecutionRequest_type_target_requested_idx" RENAME TO "GovernedTreasuryExecutionRequest_executionType_targetType_t_idx";

-- RenameIndex
ALTER INDEX "ReleaseLaunchClosurePack_releaseIdentifier_environment_createdA" RENAME TO "ReleaseLaunchClosurePack_releaseIdentifier_environment_crea_idx";

-- RenameIndex
ALTER INDEX "ReleaseLaunchClosurePack_releaseIdentifier_environment_version_" RENAME TO "ReleaseLaunchClosurePack_releaseIdentifier_environment_vers_key";

-- RenameIndex
ALTER INDEX "SolvencyPolicyResumeRequest_policyStateId_status_requestedAt_id" RENAME TO "SolvencyPolicyResumeRequest_policyStateId_status_requestedA_idx";
