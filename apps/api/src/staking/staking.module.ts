import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { AuthService } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { StakingController } from "./staking.controller";
import { StakingService } from "./staking.service";

@Module({
  controllers: [StakingController],
  providers: [
    StakingService,
    PrismaService,
    AuthService,
    InternalOperatorApiKeyGuard
  ],
})
export class StakingPoolModule {}
