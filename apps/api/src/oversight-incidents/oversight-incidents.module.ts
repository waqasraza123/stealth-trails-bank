import { Module } from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { PrismaService } from "../prisma/prisma.service";
import { OversightIncidentsController } from "./oversight-incidents.controller";
import { OversightIncidentsService } from "./oversight-incidents.service";

@Module({
  controllers: [OversightIncidentsController],
  providers: [
    OversightIncidentsService,
    PrismaService,
    InternalOperatorApiKeyGuard
  ]
})
export class OversightIncidentsModule {}
