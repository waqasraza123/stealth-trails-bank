ALTER TABLE "DepositSettlementReplayApprovalRequest"
ADD COLUMN "rejectedByOperatorId" TEXT,
ADD COLUMN "rejectedByOperatorRole" TEXT,
ADD COLUMN "rejectionNote" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3);

CREATE INDEX "DepositSettlementReplayApprovalRequest_rejectedByOperatorId_idx"
ON "DepositSettlementReplayApprovalRequest"("rejectedByOperatorId", "rejectedAt");

ALTER TABLE "WithdrawalSettlementReplayApprovalRequest"
ADD COLUMN "rejectedByOperatorId" TEXT,
ADD COLUMN "rejectedByOperatorRole" TEXT,
ADD COLUMN "rejectionNote" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3);

CREATE INDEX "WithdrawalSettlementReplayApprovalRequest_rejectedByOperatorId_idx"
ON "WithdrawalSettlementReplayApprovalRequest"("rejectedByOperatorId", "rejectedAt");
