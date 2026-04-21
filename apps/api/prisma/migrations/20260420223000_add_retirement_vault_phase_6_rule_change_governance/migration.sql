CREATE TYPE "RetirementVaultRuleChangeRequestStatus" AS ENUM (
  'review_required',
  'cooldown_active',
  'ready_to_apply',
  'applying',
  'rejected',
  'cancelled',
  'applied',
  'failed'
);

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'rule_change_requested';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'rule_change_review_required';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'rule_change_approved';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'rule_change_rejected';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'rule_change_cancelled';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'rule_change_cooldown_started';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'rule_change_cooldown_completed';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'rule_change_applied';

ALTER TYPE "RetirementVaultEventType"
ADD VALUE IF NOT EXISTS 'rule_change_failed';

CREATE TABLE "RetirementVaultRuleChangeRequest" (
  "id" TEXT NOT NULL,
  "retirementVaultId" TEXT NOT NULL,
  "status" "RetirementVaultRuleChangeRequestStatus" NOT NULL,
  "requestedByActorType" TEXT NOT NULL DEFAULT 'customer',
  "requestedByActorId" TEXT,
  "currentUnlockAt" TIMESTAMP(3) NOT NULL,
  "requestedUnlockAt" TIMESTAMP(3) NOT NULL,
  "currentStrictMode" BOOLEAN NOT NULL,
  "requestedStrictMode" BOOLEAN NOT NULL,
  "weakensProtection" BOOLEAN NOT NULL DEFAULT false,
  "reasonCode" TEXT,
  "reasonNote" TEXT,
  "reviewCaseId" TEXT,
  "reviewRequiredAt" TIMESTAMP(3),
  "reviewDecidedAt" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cooldownStartedAt" TIMESTAMP(3),
  "cooldownEndsAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvedByOperatorId" TEXT,
  "approvedByOperatorRole" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectedByOperatorId" TEXT,
  "rejectedByOperatorRole" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledByActorType" TEXT,
  "cancelledByActorId" TEXT,
  "applyStartedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "appliedByWorkerId" TEXT,
  "applyFailureCode" TEXT,
  "applyFailureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RetirementVaultRuleChangeRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RetirementVaultRuleChangeRequest"
ADD CONSTRAINT "RetirementVaultRuleChangeRequest_retirementVaultId_fkey"
FOREIGN KEY ("retirementVaultId") REFERENCES "RetirementVault"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RetirementVaultRuleChangeRequest"
ADD CONSTRAINT "RetirementVaultRuleChangeRequest_reviewCaseId_fkey"
FOREIGN KEY ("reviewCaseId") REFERENCES "ReviewCase"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RetirementVaultRuleChangeRequest_retirementVaultId_status_requestedAt_idx"
ON "RetirementVaultRuleChangeRequest"("retirementVaultId", "status", "requestedAt");

CREATE INDEX "RetirementVaultRuleChangeRequest_status_cooldownEndsAt_idx"
ON "RetirementVaultRuleChangeRequest"("status", "cooldownEndsAt");

CREATE INDEX "RetirementVaultRuleChangeRequest_status_appliedAt_idx"
ON "RetirementVaultRuleChangeRequest"("status", "appliedAt");

CREATE INDEX "RetirementVaultRuleChangeRequest_reviewCaseId_idx"
ON "RetirementVaultRuleChangeRequest"("reviewCaseId");
