import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { AuthService } from "../auth/auth.service";
import { GovernedExecutionModule } from "../governed-execution/governed-execution.module";
import { PrismaService } from "../prisma/prisma.service";
import { SolvencyModule } from "../solvency/solvency.module";
import { StakingPoolGovernanceController } from "./staking-pool-governance.controller";
import { StakingPoolGovernanceService } from "./staking-pool-governance.service";
import { StakingController } from "./staking.controller";
import { StakingService } from "./staking.service";

@Module({
  imports: [SolvencyModule, GovernedExecutionModule],
  controllers: [StakingController, StakingPoolGovernanceController],
  providers: [
    StakingService,
    StakingPoolGovernanceService,
    PrismaService,
    AuthService,
    InternalOperatorApiKeyGuard
  ],
})
export class StakingPoolModule {}
