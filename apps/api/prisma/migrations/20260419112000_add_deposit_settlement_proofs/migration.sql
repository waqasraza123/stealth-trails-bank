-- CreateTable
CREATE TABLE "DepositSettlementProof" (
    "id" TEXT NOT NULL,
    "transactionIntentId" TEXT NOT NULL,
    "blockchainTransactionId" TEXT NOT NULL,
    "ledgerJournalId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "settledAmount" DECIMAL(36,18) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositSettlementProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositSettlementProof_transactionIntentId_key" ON "DepositSettlementProof"("transactionIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositSettlementProof_blockchainTransactionId_key" ON "DepositSettlementProof"("blockchainTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositSettlementProof_ledgerJournalId_key" ON "DepositSettlementProof"("ledgerJournalId");

-- CreateIndex
CREATE UNIQUE INDEX "DepositSettlementProof_chainId_txHash_key" ON "DepositSettlementProof"("chainId", "txHash");

-- CreateIndex
CREATE INDEX "DepositSettlementProof_assetId_idx" ON "DepositSettlementProof"("assetId");

-- AddForeignKey
ALTER TABLE "DepositSettlementProof" ADD CONSTRAINT "DepositSettlementProof_transactionIntentId_fkey" FOREIGN KEY ("transactionIntentId") REFERENCES "TransactionIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositSettlementProof" ADD CONSTRAINT "DepositSettlementProof_blockchainTransactionId_fkey" FOREIGN KEY ("blockchainTransactionId") REFERENCES "BlockchainTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositSettlementProof" ADD CONSTRAINT "DepositSettlementProof_ledgerJournalId_fkey" FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositSettlementProof" ADD CONSTRAINT "DepositSettlementProof_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
