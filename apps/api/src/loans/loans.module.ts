import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuthService } from "../auth/auth.service";
import { GovernedExecutionModule } from "../governed-execution/governed-execution.module";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { SolvencyModule } from "../solvency/solvency.module";
import { CustomerLoansController } from "./customer-loans.controller";
import { LoansService } from "./loans.service";
import { OperatorLoansController } from "./operator-loans.controller";
import { WorkerLoansController } from "./worker-loans.controller";

@Module({
  imports: [SolvencyModule, GovernedExecutionModule],
  controllers: [
    CustomerLoansController,
    OperatorLoansController,
    WorkerLoansController
  ],
  providers: [
    LoansService,
    LedgerService,
    PrismaService,
    AuthService,
    JwtAuthGuard,
    InternalOperatorApiKeyGuard,
    InternalWorkerApiKeyGuard
  ]
})
export class LoansModule {}
