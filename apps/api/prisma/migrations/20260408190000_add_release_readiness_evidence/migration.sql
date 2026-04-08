-- CreateEnum
CREATE TYPE "ReleaseReadinessEvidenceType" AS ENUM (
  'platform_alert_delivery_slo',
  'critical_alert_reescalation',
  'database_restore_drill',
  'api_rollback_drill',
  'worker_rollback_drill'
);

-- CreateEnum
CREATE TYPE "ReleaseReadinessEnvironment" AS ENUM (
  'staging',
  'production_like',
  'production'
);

-- CreateEnum
CREATE TYPE "ReleaseReadinessEvidenceStatus" AS ENUM (
  'pending',
  'passed',
  'failed'
);

-- CreateTable
CREATE TABLE "ReleaseReadinessEvidence" (
  "id" TEXT NOT NULL,
  "evidenceType" "ReleaseReadinessEvidenceType" NOT NULL,
  "environment" "ReleaseReadinessEnvironment" NOT NULL,
  "status" "ReleaseReadinessEvidenceStatus" NOT NULL,
  "releaseIdentifier" TEXT,
  "rollbackReleaseIdentifier" TEXT,
  "backupReference" TEXT,
  "summary" TEXT NOT NULL,
  "note" TEXT,
  "operatorId" TEXT NOT NULL,
  "operatorRole" TEXT,
  "runbookPath" TEXT,
  "evidenceLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "evidencePayload" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReleaseReadinessEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleaseReadinessEvidence_evidenceType_environment_observedAt_idx"
ON "ReleaseReadinessEvidence"("evidenceType", "environment", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "ReleaseReadinessEvidence_status_observedAt_idx"
ON "ReleaseReadinessEvidence"("status", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "ReleaseReadinessEvidence_operatorId_observedAt_idx"
ON "ReleaseReadinessEvidence"("operatorId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "ReleaseReadinessEvidence_releaseIdentifier_observedAt_idx"
ON "ReleaseReadinessEvidence"("releaseIdentifier", "observedAt" DESC);
