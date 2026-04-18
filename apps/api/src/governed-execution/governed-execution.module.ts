import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { GovernedExecutionController } from "./governed-execution.controller";
import { GovernedExecutionService } from "./governed-execution.service";

@Module({
  controllers: [GovernedExecutionController],
  providers: [GovernedExecutionService, PrismaService, InternalOperatorApiKeyGuard],
  exports: [GovernedExecutionService]
})
export class GovernedExecutionModule {}
