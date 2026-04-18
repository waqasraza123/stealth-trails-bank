import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { LedgerModule } from "../ledger/ledger.module";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesModule } from "../review-cases/review-cases.module";
import { SolvencyModule } from "../solvency/solvency.module";
import { DepositSettlementReconciliationController } from "./deposit-settlement-reconciliation.controller";
import { DepositSettlementReconciliationService } from "./deposit-settlement-reconciliation.service";
import { TransactionHistoryController } from "./transaction-history.controller";
import { TransactionIntentsController } from "./transaction-intents.controller";
import { TransactionIntentsInternalController } from "./transaction-intents-internal.controller";
import { TransactionIntentsService } from "./transaction-intents.service";
import { TransactionIntentsWorkerController } from "./transaction-intents-worker.controller";
import { TransactionOperationsController } from "./transaction-operations.controller";
import { TransactionOperationsService } from "./transaction-operations.service";
import { WithdrawalIntentsController } from "./withdrawal-intents.controller";
import { WithdrawalIntentsInternalController } from "./withdrawal-intents-internal.controller";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";
import { WithdrawalIntentsWorkerController } from "./withdrawal-intents-worker.controller";
import { WithdrawalSettlementReconciliationController } from "./withdrawal-settlement-reconciliation.controller";
import { WithdrawalSettlementReconciliationService } from "./withdrawal-settlement-reconciliation.service";

@Module({
  imports: [LedgerModule, ReviewCasesModule, SolvencyModule],
  controllers: [
    TransactionIntentsController,
    TransactionHistoryController,
    WithdrawalIntentsController,
    TransactionIntentsInternalController,
    WithdrawalIntentsInternalController,
    TransactionOperationsController,
    TransactionIntentsWorkerController,
    WithdrawalIntentsWorkerController,
    DepositSettlementReconciliationController,
    WithdrawalSettlementReconciliationController
  ],
  providers: [
    TransactionIntentsService,
    WithdrawalIntentsService,
    TransactionOperationsService,
    DepositSettlementReconciliationService,
    WithdrawalSettlementReconciliationService,
    PrismaService,
    InternalOperatorApiKeyGuard,
    InternalWorkerApiKeyGuard
  ],
  exports: [TransactionIntentsService, WithdrawalIntentsService]
})
export class TransactionIntentsModule {}
