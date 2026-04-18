import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesModule } from "../review-cases/review-cases.module";
import { SolvencyController } from "./solvency.controller";
import { SolvencyService } from "./solvency.service";
import { SolvencyWorkerController } from "./solvency-worker.controller";

@Module({
  imports: [ReviewCasesModule],
  controllers: [SolvencyController, SolvencyWorkerController],
  providers: [
    SolvencyService,
    PrismaService,
    InternalOperatorApiKeyGuard,
    InternalWorkerApiKeyGuard
  ],
  exports: [SolvencyService]
})
export class SolvencyModule {}
