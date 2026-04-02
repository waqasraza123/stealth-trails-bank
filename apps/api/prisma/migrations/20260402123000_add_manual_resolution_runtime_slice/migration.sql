ALTER TABLE "TransactionIntent"
ADD COLUMN IF NOT EXISTS "manuallyResolvedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "manualResolutionReasonCode" TEXT,
ADD COLUMN IF NOT EXISTS "manualResolutionNote" TEXT;

CREATE INDEX IF NOT EXISTS "TransactionIntent_status_manuallyResolvedAt_idx"
ON "TransactionIntent"("status", "manuallyResolvedAt");

ALTER TYPE "ReviewCaseEventType"
ADD VALUE IF NOT EXISTS 'manual_resolution_applied';
