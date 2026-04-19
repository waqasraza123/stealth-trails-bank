import { Module } from "@nestjs/common";
import { InternalGovernedExecutorApiKeyGuard } from "../auth/guards/internal-governed-executor-api-key.guard";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { GovernedExecutionController } from "./governed-execution.controller";
import { GovernedExecutionExecutorController } from "./governed-execution-executor.controller";
import { GovernedExecutionService } from "./governed-execution.service";
import { GovernedExecutionWorkerController } from "./governed-execution-worker.controller";

@Module({
  controllers: [
    GovernedExecutionController,
    GovernedExecutionWorkerController,
    GovernedExecutionExecutorController
  ],
  providers: [
    GovernedExecutionService,
    PrismaService,
    InternalGovernedExecutorApiKeyGuard,
    InternalOperatorApiKeyGuard,
    InternalOperatorBearerGuard,
    InternalWorkerApiKeyGuard
  ],
  exports: [GovernedExecutionService]
})
export class GovernedExecutionModule {}
