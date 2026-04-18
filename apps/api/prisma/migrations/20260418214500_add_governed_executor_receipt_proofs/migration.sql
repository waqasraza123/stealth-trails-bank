-- AlterTable
ALTER TABLE "GovernedTreasuryExecutionRequest"
ADD COLUMN     "executorReceiptPayload" JSONB,
ADD COLUMN     "executorReceiptPayloadText" TEXT,
ADD COLUMN     "executorReceiptHash" TEXT,
ADD COLUMN     "executorReceiptChecksumSha256" TEXT,
ADD COLUMN     "executorReceiptSignature" TEXT,
ADD COLUMN     "executorReceiptSignatureAlgorithm" TEXT,
ADD COLUMN     "executorReceiptSignerAddress" TEXT,
ADD COLUMN     "executorReceiptVerificationChecksumSha256" TEXT,
ADD COLUMN     "executorReceiptVerifiedAt" TIMESTAMP(3);
