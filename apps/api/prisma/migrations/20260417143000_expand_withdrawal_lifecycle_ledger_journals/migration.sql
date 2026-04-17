ALTER TYPE "LedgerAccountType"
ADD VALUE IF NOT EXISTS 'customer_asset_pending_withdrawal_liability';

ALTER TYPE "LedgerJournalType"
ADD VALUE IF NOT EXISTS 'withdrawal_reservation';

ALTER TYPE "LedgerJournalType"
ADD VALUE IF NOT EXISTS 'withdrawal_reservation_release';

DROP INDEX IF EXISTS "LedgerJournal_transactionIntentId_key";

CREATE INDEX IF NOT EXISTS "LedgerJournal_transactionIntentId_idx"
ON "LedgerJournal"("transactionIntentId");

CREATE UNIQUE INDEX IF NOT EXISTS "LedgerJournal_transactionIntentId_journalType_key"
ON "LedgerJournal"("transactionIntentId", "journalType");
