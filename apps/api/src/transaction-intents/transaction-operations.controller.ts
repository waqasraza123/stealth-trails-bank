import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { GetCustomerOperationsSnapshotDto } from "./dto/get-customer-operations-snapshot.dto";
import { SearchTransactionOperationsDto } from "./dto/search-transaction-operations.dto";
import { TransactionOperationsService } from "./transaction-operations.service";

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("transaction-intents/internal/operations")
export class TransactionOperationsController {
  constructor(
    private readonly transactionOperationsService: TransactionOperationsService
  ) {}

  @Get("search")
  async searchTransactionOperations(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: SearchTransactionOperationsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionOperationsService.searchTransactionOperations(query);

    return {
      status: "success",
      message: "Transaction operations retrieved successfully.",
      data: result
    };
  }

  @Get("customer-snapshot")
  async getCustomerOperationsSnapshot(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetCustomerOperationsSnapshotDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionOperationsService.getCustomerOperationsSnapshot(
        query
      );

    return {
      status: "success",
      message: "Customer operations snapshot retrieved successfully.",
      data: result
    };
  }

  @Get(":intentId/audit-events")
  async getTransactionIntentAuditTimeline(
    @Param("intentId") intentId: string
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionOperationsService.getTransactionIntentAuditTimeline(
        intentId
      );

    return {
      status: "success",
      message: "Transaction intent audit timeline retrieved successfully.",
      data: result
    };
  }
}
