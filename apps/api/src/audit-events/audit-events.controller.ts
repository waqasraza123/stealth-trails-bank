import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { AuditEventsService } from "./audit-events.service";
import { ListAuditEventsDto } from "./dto/list-audit-events.dto";

@UseGuards(InternalOperatorBearerGuard)
@Controller("audit-events/internal")
export class AuditEventsController {
  constructor(private readonly auditEventsService: AuditEventsService) {}

  @Get()
  async listAuditEvents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListAuditEventsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.auditEventsService.listAuditEvents(query);

    return {
      status: "success",
      message: "Audit events retrieved successfully.",
      data: result
    };
  }
}
