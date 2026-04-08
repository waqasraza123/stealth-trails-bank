import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseReadinessController } from "./release-readiness.controller";
import { ReleaseReadinessService } from "./release-readiness.service";

@Module({
  controllers: [ReleaseReadinessController],
  providers: [
    ReleaseReadinessService,
    PrismaService,
    InternalOperatorApiKeyGuard
  ]
})
export class ReleaseReadinessModule {}
