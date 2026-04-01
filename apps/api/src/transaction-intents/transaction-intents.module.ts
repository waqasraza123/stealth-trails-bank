import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionIntentsController } from "./transaction-intents.controller";
import { TransactionIntentsInternalController } from "./transaction-intents-internal.controller";
import { TransactionIntentsService } from "./transaction-intents.service";

@Module({
  controllers: [
    TransactionIntentsController,
    TransactionIntentsInternalController
  ],
  providers: [TransactionIntentsService, PrismaService, InternalOperatorApiKeyGuard]
})
export class TransactionIntentsModule {}
