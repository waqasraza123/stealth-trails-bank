import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CustomerAccountOperationsService } from "./customer-account-operations.service";
import { ListCustomerAccountTimelineDto } from "./dto/list-customer-account-timeline.dto";

@UseGuards(InternalOperatorBearerGuard)
@Controller("customer-account-operations/internal")
export class CustomerAccountOperationsController {
  constructor(
    private readonly customerAccountOperationsService: CustomerAccountOperationsService
  ) {}

  @Get("timeline")
  async listCustomerAccountTimeline(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListCustomerAccountTimelineDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountOperationsService.listCustomerAccountTimeline(
        query
      );

    return {
      status: "success",
      message: "Customer account operations timeline retrieved successfully.",
      data: result
    };
  }
}
