import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { LedgerModule } from "../ledger/ledger.module";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionIntentsController } from "./transaction-intents.controller";
import { TransactionIntentsInternalController } from "./transaction-intents-internal.controller";
import { TransactionIntentsService } from "./transaction-intents.service";
import { TransactionIntentsWorkerController } from "./transaction-intents-worker.controller";

@Module({
  imports: [LedgerModule],
  controllers: [
    TransactionIntentsController,
    TransactionIntentsInternalController,
    TransactionIntentsWorkerController
  ],
  providers: [
    TransactionIntentsService,
    PrismaService,
    InternalOperatorApiKeyGuard,
    InternalWorkerApiKeyGuard
  ]
})
export class TransactionIntentsModule {}
