ALTER TABLE "ReleaseReadinessApproval"
ADD COLUMN "supersedesApprovalId" TEXT,
ADD COLUMN "supersededByApprovalId" TEXT;

CREATE UNIQUE INDEX "ReleaseReadinessApproval_supersedesApprovalId_key"
ON "ReleaseReadinessApproval"("supersedesApprovalId");

CREATE UNIQUE INDEX "ReleaseReadinessApproval_supersededByApprovalId_key"
ON "ReleaseReadinessApproval"("supersededByApprovalId");

CREATE INDEX "ReleaseReadinessApproval_supersedesApprovalId_idx"
ON "ReleaseReadinessApproval"("supersedesApprovalId");

CREATE INDEX "ReleaseReadinessApproval_supersededByApprovalId_idx"
ON "ReleaseReadinessApproval"("supersededByApprovalId");
