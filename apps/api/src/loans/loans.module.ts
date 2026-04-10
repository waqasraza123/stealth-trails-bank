import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { CustomerLoansController } from "./customer-loans.controller";
import { LoansService } from "./loans.service";
import { OperatorLoansController } from "./operator-loans.controller";
import { WorkerLoansController } from "./worker-loans.controller";

@Module({
  controllers: [
    CustomerLoansController,
    OperatorLoansController,
    WorkerLoansController
  ],
  providers: [
    LoansService,
    PrismaService,
    AuthService,
    JwtAuthGuard,
    InternalOperatorApiKeyGuard,
    InternalWorkerApiKeyGuard
  ]
})
export class LoansModule {}
