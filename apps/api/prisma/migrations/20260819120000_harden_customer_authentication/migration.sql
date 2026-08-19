CREATE TYPE "CustomerAuthFlowPurpose" AS ENUM ('login', 'password_recovery');
CREATE TYPE "CustomerAuthFlowNextAction" AS ENUM ('verify_email', 'enroll_totp', 'verify_totp', 'setup_recovery_codes', 'upgrade_password', 'complete');
ALTER TYPE "CustomerAuthSessionRevocationReason" ADD VALUE IF NOT EXISTS 'session_expired';
ALTER TYPE "CustomerAuthSessionRevocationReason" ADD VALUE IF NOT EXISTS 'refresh_reuse';
ALTER TYPE "CustomerAuthSessionRevocationReason" ADD VALUE IF NOT EXISTS 'logout';

ALTER TABLE "Customer"
  ADD COLUMN "passwordPolicyVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationCodeHash" TEXT,
  ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationSentAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationFailedAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mfaTotpSecretEncrypted" TEXT,
  ADD COLUMN "mfaTotpSecretKeyVersion" TEXT,
  ADD COLUMN "mfaPendingTotpSecretEncrypted" TEXT,
  ADD COLUMN "mfaPendingTotpSecretKeyVersion" TEXT,
  ADD COLUMN "mfaLastAcceptedTotpCounter" INTEGER;

ALTER TABLE "CustomerAuthSession"
  ADD COLUMN "sessionSecretHash" TEXT,
  ADD COLUMN "refreshTokenHash" TEXT,
  ADD COLUMN "refreshFamilyId" TEXT,
  ADD COLUMN "csrfTokenHash" TEXT,
  ADD COLUMN "idleExpiresAt" TIMESTAMP(3),
  ADD COLUMN "absoluteExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "CustomerAuthSession_sessionSecretHash_key" ON "CustomerAuthSession"("sessionSecretHash");
CREATE UNIQUE INDEX "CustomerAuthSession_refreshTokenHash_key" ON "CustomerAuthSession"("refreshTokenHash");
CREATE INDEX "CustomerAuthSession_refreshFamilyId_revokedAt_idx" ON "CustomerAuthSession"("refreshFamilyId", "revokedAt");

CREATE TABLE "CustomerAuthFlow" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "purpose" "CustomerAuthFlowPurpose" NOT NULL DEFAULT 'login',
  "nextAction" "CustomerAuthFlowNextAction" NOT NULL,
  "clientPlatform" "CustomerAuthSessionPlatform" NOT NULL DEFAULT 'unknown',
  "passwordVerifiedAt" TIMESTAMP(3),
  "mfaVerifiedAt" TIMESTAMP(3),
  "failedAttemptCount" INTEGER NOT NULL DEFAULT 0,
  "ipAddressHash" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAuthFlow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerAuthFlow_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CustomerAuthFlow_customerId_purpose_consumedAt_idx" ON "CustomerAuthFlow"("customerId", "purpose", "consumedAt");
CREATE INDEX "CustomerAuthFlow_expiresAt_consumedAt_idx" ON "CustomerAuthFlow"("expiresAt", "consumedAt");

CREATE TABLE "CustomerRecoveryCode" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerRecoveryCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerRecoveryCode_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerRecoveryCode_codeHash_key" ON "CustomerRecoveryCode"("codeHash");
CREATE INDEX "CustomerRecoveryCode_customerId_consumedAt_idx" ON "CustomerRecoveryCode"("customerId", "consumedAt");

CREATE TABLE "AuthRateLimitBucket" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "subjectHash" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuthRateLimitBucket_action_subjectHash_windowStart_key" ON "AuthRateLimitBucket"("action", "subjectHash", "windowStart");
CREATE INDEX "AuthRateLimitBucket_blockedUntil_idx" ON "AuthRateLimitBucket"("blockedUntil");
