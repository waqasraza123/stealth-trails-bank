CREATE TYPE "CustomerMfaRecoveryRequestType" AS ENUM (
  'release_lockout',
  'reset_mfa'
);

CREATE TYPE "CustomerMfaRecoveryRequestStatus" AS ENUM (
  'pending_approval',
  'approved',
  'executed',
  'rejected'
);

CREATE TABLE "CustomerMfaRecoveryRequest" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "customerAccountId" TEXT,
  "requestType" "CustomerMfaRecoveryRequestType" NOT NULL,
  "status" "CustomerMfaRecoveryRequestStatus" NOT NULL DEFAULT 'pending_approval',
  "requestedByOperatorId" TEXT NOT NULL,
  "requestedByOperatorRole" TEXT NOT NULL,
  "requestNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedByOperatorId" TEXT,
  "approvedByOperatorRole" TEXT,
  "approvalNote" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedByOperatorId" TEXT,
  "rejectedByOperatorRole" TEXT,
  "rejectionNote" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "executedByOperatorId" TEXT,
  "executedByOperatorRole" TEXT,
  "executionNote" TEXT,
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerMfaRecoveryRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerMfaRecoveryRequest_customerId_requestType_status_requ_idx"
ON "CustomerMfaRecoveryRequest"("customerId", "requestType", "status", "requestedAt");

CREATE INDEX "CustomerMfaRecoveryRequest_customerAccountId_idx"
ON "CustomerMfaRecoveryRequest"("customerAccountId");

CREATE INDEX "CustomerMfaRecoveryRequest_status_requestedAt_idx"
ON "CustomerMfaRecoveryRequest"("status", "requestedAt");

CREATE INDEX "CustomerMfaRecoveryRequest_requestedByOperatorId_requeste_idx"
ON "CustomerMfaRecoveryRequest"("requestedByOperatorId", "requestedAt");

CREATE INDEX "CustomerMfaRecoveryRequest_approvedByOperatorId_approvedA_idx"
ON "CustomerMfaRecoveryRequest"("approvedByOperatorId", "approvedAt");

CREATE INDEX "CustomerMfaRecoveryRequest_rejectedByOperatorId_rejectedA_idx"
ON "CustomerMfaRecoveryRequest"("rejectedByOperatorId", "rejectedAt");

CREATE INDEX "CustomerMfaRecoveryRequest_executedByOperatorId_executedA_idx"
ON "CustomerMfaRecoveryRequest"("executedByOperatorId", "executedAt");

ALTER TABLE "CustomerMfaRecoveryRequest"
ADD CONSTRAINT "CustomerMfaRecoveryRequest_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerMfaRecoveryRequest"
ADD CONSTRAINT "CustomerMfaRecoveryRequest_customerAccountId_fkey"
FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
