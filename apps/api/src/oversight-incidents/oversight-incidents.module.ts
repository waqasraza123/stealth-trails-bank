import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesModule } from "../review-cases/review-cases.module";
import { AccountHoldReportingController } from "./account-hold-reporting.controller";
import { AccountHoldReportingService } from "./account-hold-reporting.service";
import { OversightIncidentsController } from "./oversight-incidents.controller";
import { OversightIncidentsService } from "./oversight-incidents.service";

@Module({
  imports: [ReviewCasesModule],
  controllers: [OversightIncidentsController, AccountHoldReportingController],
  providers: [
    AccountHoldReportingService,
    OversightIncidentsService,
    PrismaService,
    InternalOperatorApiKeyGuard
  ]
})
export class OversightIncidentsModule {}
