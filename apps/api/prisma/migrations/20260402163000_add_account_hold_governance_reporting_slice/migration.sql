CREATE TYPE "CustomerAccountRestrictionStatus" AS ENUM ('active', 'released');

CREATE TABLE "CustomerAccountRestriction" (
  "id" TEXT NOT NULL,
  "customerAccountId" TEXT NOT NULL,
  "oversightIncidentId" TEXT NOT NULL,
  "status" "CustomerAccountRestrictionStatus" NOT NULL DEFAULT 'active',
  "restrictionReasonCode" TEXT NOT NULL,
  "appliedByOperatorId" TEXT NOT NULL,
  "appliedByOperatorRole" TEXT,
  "appliedNote" TEXT,
  "previousStatus" "AccountLifecycleStatus" NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "releasedByOperatorId" TEXT,
  "releasedByOperatorRole" TEXT,
  "releaseNote" TEXT,
  "restoredStatus" "AccountLifecycleStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAccountRestriction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerAccountRestriction_customerAccountId_status_idx"
ON "CustomerAccountRestriction"("customerAccountId", "status");

CREATE INDEX "CustomerAccountRestriction_customerAccountId_oversightIncidentId_status_idx"
ON "CustomerAccountRestriction"("customerAccountId", "oversightIncidentId", "status");

CREATE INDEX "CustomerAccountRestriction_oversightIncidentId_status_idx"
ON "CustomerAccountRestriction"("oversightIncidentId", "status");

CREATE INDEX "CustomerAccountRestriction_restrictionReasonCode_status_idx"
ON "CustomerAccountRestriction"("restrictionReasonCode", "status");

CREATE INDEX "CustomerAccountRestriction_appliedByOperatorId_appliedAt_idx"
ON "CustomerAccountRestriction"("appliedByOperatorId", "appliedAt");

CREATE INDEX "CustomerAccountRestriction_releasedByOperatorId_releasedAt_idx"
ON "CustomerAccountRestriction"("releasedByOperatorId", "releasedAt");

CREATE INDEX "CustomerAccountRestriction_appliedAt_idx"
ON "CustomerAccountRestriction"("appliedAt");

CREATE INDEX "CustomerAccountRestriction_releasedAt_idx"
ON "CustomerAccountRestriction"("releasedAt");

ALTER TABLE "CustomerAccountRestriction"
ADD CONSTRAINT "CustomerAccountRestriction_customerAccountId_fkey"
FOREIGN KEY ("customerAccountId")
REFERENCES "CustomerAccount"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "CustomerAccountRestriction"
ADD CONSTRAINT "CustomerAccountRestriction_oversightIncidentId_fkey"
FOREIGN KEY ("oversightIncidentId")
REFERENCES "OversightIncident"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

INSERT INTO "CustomerAccountRestriction" (
  "id",
  "customerAccountId",
  "oversightIncidentId",
  "status",
  "restrictionReasonCode",
  "appliedByOperatorId",
  "appliedByOperatorRole",
  "appliedNote",
  "previousStatus",
  "appliedAt",
  "releasedAt",
  "releasedByOperatorId",
  "releasedByOperatorRole",
  "releaseNote",
  "restoredStatus",
  "createdAt",
  "updatedAt"
)
SELECT
  'restriction_backfill_' || "id",
  "id",
  "restrictedByOversightIncidentId",
  CASE
    WHEN "status" = 'restricted' AND "restrictionReleasedAt" IS NULL THEN 'active'::"CustomerAccountRestrictionStatus"
    ELSE 'released'::"CustomerAccountRestrictionStatus"
  END,
  "restrictionReasonCode",
  "restrictedByOperatorId",
  NULL,
  NULL,
  COALESCE("restrictedFromStatus", 'registered'::"AccountLifecycleStatus"),
  "restrictedAt",
  "restrictionReleasedAt",
  "restrictionReleasedByOperatorId",
  NULL,
  NULL,
  CASE
    WHEN "restrictionReleasedAt" IS NOT NULL THEN "status"
    ELSE NULL
  END,
  "restrictedAt",
  COALESCE("restrictionReleasedAt", "updatedAt")
FROM "CustomerAccount"
WHERE "restrictedAt" IS NOT NULL
  AND "restrictedByOversightIncidentId" IS NOT NULL
  AND "restrictionReasonCode" IS NOT NULL
  AND "restrictedByOperatorId" IS NOT NULL
  AND (
    "status" = 'restricted'
    OR "restrictionReleasedAt" IS NOT NULL
  );

CREATE UNIQUE INDEX "CustomerAccountRestriction_active_customerAccountId_key"
ON "CustomerAccountRestriction"("customerAccountId")
WHERE "status" = 'active';
