-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('asset_inbound_clearing', 'customer_asset_liability');

-- CreateEnum
CREATE TYPE "LedgerJournalType" AS ENUM ('deposit_settlement');

-- CreateEnum
CREATE TYPE "LedgerPostingDirection" AS ENUM ('debit', 'credit');

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "ledgerKey" TEXT NOT NULL,
    "accountType" "LedgerAccountType" NOT NULL,
    "chainId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "customerAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerJournal" (
    "id" TEXT NOT NULL,
    "transactionIntentId" TEXT NOT NULL,
    "journalType" "LedgerJournalType" NOT NULL,
    "chainId" INTEGER NOT NULL,
    "assetId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerPosting" (
    "id" TEXT NOT NULL,
    "ledgerJournalId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "direction" "LedgerPostingDirection" NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAssetBalance" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "availableBalance" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "pendingBalance" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAssetBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_ledgerKey_key" ON "LedgerAccount"("ledgerKey");

-- CreateIndex
CREATE INDEX "LedgerAccount_accountType_chainId_assetId_idx" ON "LedgerAccount"("accountType", "chainId", "assetId");

-- CreateIndex
CREATE INDEX "LedgerAccount_customerAccountId_assetId_idx" ON "LedgerAccount"("customerAccountId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerJournal_transactionIntentId_key" ON "LedgerJournal"("transactionIntentId");

-- CreateIndex
CREATE INDEX "LedgerJournal_journalType_chainId_idx" ON "LedgerJournal"("journalType", "chainId");

-- CreateIndex
CREATE INDEX "LedgerJournal_assetId_idx" ON "LedgerJournal"("assetId");

-- CreateIndex
CREATE INDEX "LedgerPosting_ledgerJournalId_idx" ON "LedgerPosting"("ledgerJournalId");

-- CreateIndex
CREATE INDEX "LedgerPosting_ledgerAccountId_direction_idx" ON "LedgerPosting"("ledgerAccountId", "direction");

-- CreateIndex
CREATE INDEX "CustomerAssetBalance_assetId_idx" ON "CustomerAssetBalance"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAssetBalance_customerAccountId_assetId_key" ON "CustomerAssetBalance"("customerAccountId", "assetId");

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerJournal" ADD CONSTRAINT "LedgerJournal_transactionIntentId_fkey" FOREIGN KEY ("transactionIntentId") REFERENCES "TransactionIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerJournal" ADD CONSTRAINT "LedgerJournal_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerPosting" ADD CONSTRAINT "LedgerPosting_ledgerJournalId_fkey" FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerPosting" ADD CONSTRAINT "LedgerPosting_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAssetBalance" ADD CONSTRAINT "CustomerAssetBalance_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAssetBalance" ADD CONSTRAINT "CustomerAssetBalance_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
