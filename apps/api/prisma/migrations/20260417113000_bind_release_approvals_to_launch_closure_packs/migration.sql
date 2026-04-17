ALTER TABLE "ReleaseReadinessApproval"
ADD COLUMN "launchClosurePackId" TEXT,
ADD COLUMN "launchClosurePackVersion" INTEGER,
ADD COLUMN "launchClosurePackChecksumSha256" TEXT;

ALTER TABLE "ReleaseReadinessApproval"
ADD CONSTRAINT "ReleaseReadinessApproval_launchClosurePackId_fkey"
FOREIGN KEY ("launchClosurePackId") REFERENCES "ReleaseLaunchClosurePack"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ReleaseReadinessApproval_launchClosurePackId_idx"
ON "ReleaseReadinessApproval"("launchClosurePackId");
