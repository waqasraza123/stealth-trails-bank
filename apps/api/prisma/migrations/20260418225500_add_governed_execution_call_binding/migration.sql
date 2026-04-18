-- AlterTable
ALTER TABLE "GovernedTreasuryExecutionRequest"
ADD COLUMN     "expectedExecutionCalldata" TEXT,
ADD COLUMN     "expectedExecutionCalldataHash" TEXT,
ADD COLUMN     "expectedExecutionMethodSelector" TEXT;
