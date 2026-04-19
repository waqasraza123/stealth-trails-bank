import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AuditEventsController } from "./audit-events.controller";
import { AuditEventsService } from "./audit-events.service";

@Module({
  controllers: [AuditEventsController],
  providers: [
    AuditEventsService,
    PrismaService,
    InternalOperatorApiKeyGuard,
    InternalOperatorBearerGuard
  ],
  exports: [AuditEventsService]
})
export class AuditEventsModule {}
