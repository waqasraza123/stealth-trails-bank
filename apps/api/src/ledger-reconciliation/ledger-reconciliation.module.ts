import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesModule } from "../review-cases/review-cases.module";
import { TransactionIntentsModule } from "../transaction-intents/transaction-intents.module";
import { LedgerReconciliationController } from "./ledger-reconciliation.controller";
import { LedgerReconciliationService } from "./ledger-reconciliation.service";
import { LedgerReconciliationWorkerController } from "./ledger-reconciliation-worker.controller";

@Module({
  imports: [TransactionIntentsModule, ReviewCasesModule],
  controllers: [LedgerReconciliationController, LedgerReconciliationWorkerController],
  providers: [
    LedgerReconciliationService,
    PrismaService,
    InternalOperatorApiKeyGuard,
    InternalOperatorBearerGuard,
    InternalWorkerApiKeyGuard
  ],
  exports: [LedgerReconciliationService]
})
export class LedgerReconciliationModule {}
