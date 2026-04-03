import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AccountHoldReportingController } from "./account-hold-reporting.controller";
import { AccountHoldReportingService } from "./account-hold-reporting.service";
import { OversightIncidentsController } from "./oversight-incidents.controller";
import { OversightIncidentsService } from "./oversight-incidents.service";

@Module({
  controllers: [OversightIncidentsController, AccountHoldReportingController],
  providers: [
    AccountHoldReportingService,
    OversightIncidentsService,
    PrismaService,
    InternalOperatorApiKeyGuard
  ]
})
export class OversightIncidentsModule {}
