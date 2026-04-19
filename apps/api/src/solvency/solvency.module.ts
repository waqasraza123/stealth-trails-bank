import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesModule } from "../review-cases/review-cases.module";
import { CustomerSolvencyController } from "./customer-solvency.controller";
import { SolvencyController } from "./solvency.controller";
import { SolvencyPublicController } from "./solvency-public.controller";
import { SolvencyService } from "./solvency.service";
import { SolvencyWorkerController } from "./solvency-worker.controller";

@Module({
  imports: [ReviewCasesModule],
  controllers: [
    SolvencyController,
    SolvencyWorkerController,
    SolvencyPublicController,
    CustomerSolvencyController
  ],
  providers: [
    SolvencyService,
    PrismaService,
    InternalOperatorApiKeyGuard,
    InternalOperatorBearerGuard,
    InternalWorkerApiKeyGuard
  ],
  exports: [SolvencyService]
})
export class SolvencyModule {}
