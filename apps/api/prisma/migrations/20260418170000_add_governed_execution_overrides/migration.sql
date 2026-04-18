CREATE TYPE "GovernedExecutionOverrideRequestStatus" AS ENUM (
  'pending_approval',
  'approved',
  'rejected',
  'expired'
);

CREATE TABLE "GovernedExecutionOverrideRequest" (
  "id" TEXT NOT NULL,
  "environment" "WorkerRuntimeEnvironment" NOT NULL,
  "status" "GovernedExecutionOverrideRequestStatus" NOT NULL,
  "allowUnsafeWithdrawalExecution" BOOLEAN NOT NULL DEFAULT false,
  "allowDirectLoanFunding" BOOLEAN NOT NULL DEFAULT false,
  "allowDirectStakingWrites" BOOLEAN NOT NULL DEFAULT false,
  "reasonCode" TEXT NOT NULL,
  "requestNote" TEXT,
  "requestedByOperatorId" TEXT NOT NULL,
  "requestedByOperatorRole" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedByOperatorId" TEXT,
  "approvedByOperatorRole" TEXT,
  "approvalNote" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedByOperatorId" TEXT,
  "rejectedByOperatorRole" TEXT,
  "rejectionNote" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GovernedExecutionOverrideRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernedExecutionOverrideRequest_environment_status_request_idx"
  ON "GovernedExecutionOverrideRequest"("environment", "status", "requestedAt");

CREATE INDEX "GovernedExecutionOverrideRequest_environment_status_expires_idx"
  ON "GovernedExecutionOverrideRequest"("environment", "status", "expiresAt");
