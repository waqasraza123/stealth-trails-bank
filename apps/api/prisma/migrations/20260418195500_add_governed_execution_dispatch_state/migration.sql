CREATE TYPE "GovernedTreasuryExecutionDispatchStatus" AS ENUM (
  'not_dispatched',
  'dispatched',
  'dispatch_failed'
);

ALTER TABLE "GovernedTreasuryExecutionRequest"
ADD COLUMN "dispatchStatus" "GovernedTreasuryExecutionDispatchStatus" NOT NULL DEFAULT 'not_dispatched',
ADD COLUMN "dispatchPreparedAt" TIMESTAMP(3),
ADD COLUMN "dispatchedByWorkerId" TEXT,
ADD COLUMN "dispatchReference" TEXT,
ADD COLUMN "dispatchVerificationChecksumSha256" TEXT,
ADD COLUMN "dispatchFailureReason" TEXT;

CREATE INDEX "GovernedTreasuryExecutionRequest_environment_dispatchStatus_requestedAt_idx"
ON "GovernedTreasuryExecutionRequest"("environment", "dispatchStatus", "requestedAt");
