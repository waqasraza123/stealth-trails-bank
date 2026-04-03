CREATE TYPE "CustomerAccountRestrictionReleaseDecisionStatus" AS ENUM (
  'not_requested',
  'pending',
  'approved',
  'denied'
);

ALTER TYPE "ReviewCaseEventType"
ADD VALUE IF NOT EXISTS 'account_release_requested';

ALTER TYPE "ReviewCaseEventType"
ADD VALUE IF NOT EXISTS 'account_release_approved';

ALTER TYPE "ReviewCaseEventType"
ADD VALUE IF NOT EXISTS 'account_release_denied';

ALTER TABLE "CustomerAccountRestriction"
ADD COLUMN "releaseDecisionStatus" "CustomerAccountRestrictionReleaseDecisionStatus" NOT NULL DEFAULT 'not_requested',
ADD COLUMN "releaseRequestedAt" TIMESTAMP(3),
ADD COLUMN "releaseRequestedByOperatorId" TEXT,
ADD COLUMN "releaseRequestNote" TEXT,
ADD COLUMN "releaseDecidedAt" TIMESTAMP(3),
ADD COLUMN "releaseDecidedByOperatorId" TEXT,
ADD COLUMN "releaseDecisionNote" TEXT,
ADD COLUMN "releaseReviewCaseId" TEXT;

UPDATE "CustomerAccountRestriction"
SET
  "releaseDecisionStatus" = CASE
    WHEN "status" = 'released'
      THEN 'approved'::"CustomerAccountRestrictionReleaseDecisionStatus"
    ELSE 'not_requested'::"CustomerAccountRestrictionReleaseDecisionStatus"
  END,
  "releaseDecidedAt" = CASE
    WHEN "status" = 'released'
      THEN COALESCE("releasedAt", "updatedAt")
    ELSE NULL
  END,
  "releaseDecidedByOperatorId" = CASE
    WHEN "status" = 'released'
      THEN "releasedByOperatorId"
    ELSE NULL
  END,
  "releaseDecisionNote" = CASE
    WHEN "status" = 'released'
      THEN "releaseNote"
    ELSE NULL
  END;

WITH reusable_review_cases AS (
  SELECT
    restriction."id" AS "restrictionId",
    (
      SELECT review_case."id"
      FROM "ReviewCase" AS review_case
      WHERE review_case."customerAccountId" = restriction."customerAccountId"
        AND review_case."type" = 'account_review'
        AND review_case."status" IN ('open', 'in_progress')
      ORDER BY review_case."createdAt" DESC
      LIMIT 1
    ) AS "reviewCaseId"
  FROM "CustomerAccountRestriction" AS restriction
  WHERE restriction."status" = 'active'
)
UPDATE "CustomerAccountRestriction" AS restriction
SET "releaseReviewCaseId" = reusable_review_cases."reviewCaseId"
FROM reusable_review_cases
WHERE restriction."id" = reusable_review_cases."restrictionId"
  AND reusable_review_cases."reviewCaseId" IS NOT NULL;

INSERT INTO "ReviewCase" (
  "id",
  "customerId",
  "customerAccountId",
  "transactionIntentId",
  "type",
  "status",
  "reasonCode",
  "notes",
  "assignedOperatorId",
  "startedAt",
  "resolvedAt",
  "dismissedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'restriction_release_review_' || restriction."id",
  customer_account."customerId",
  restriction."customerAccountId",
  NULL,
  'account_review',
  'open',
  NULL,
  restriction."appliedNote",
  NULL,
  NULL,
  NULL,
  NULL,
  restriction."appliedAt",
  restriction."updatedAt"
FROM "CustomerAccountRestriction" AS restriction
INNER JOIN "CustomerAccount" AS customer_account
  ON customer_account."id" = restriction."customerAccountId"
WHERE restriction."status" = 'active'
  AND restriction."releaseReviewCaseId" IS NULL;

UPDATE "CustomerAccountRestriction"
SET "releaseReviewCaseId" = 'restriction_release_review_' || "id"
WHERE "status" = 'active'
  AND "releaseReviewCaseId" IS NULL;

CREATE INDEX "CustomerAccountRestriction_releaseDecisionStatus_releaseRequestedAt_idx"
ON "CustomerAccountRestriction"("releaseDecisionStatus", "releaseRequestedAt");

CREATE INDEX "CustomerAccountRestriction_releaseReviewCaseId_idx"
ON "CustomerAccountRestriction"("releaseReviewCaseId");

ALTER TABLE "CustomerAccountRestriction"
ADD CONSTRAINT "CustomerAccountRestriction_releaseReviewCaseId_fkey"
FOREIGN KEY ("releaseReviewCaseId")
REFERENCES "ReviewCase"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
