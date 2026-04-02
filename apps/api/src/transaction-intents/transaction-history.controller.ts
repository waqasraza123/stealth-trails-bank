import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ListMyTransactionHistoryDto } from "./dto/list-my-transaction-history.dto";
import { TransactionOperationsService } from "./transaction-operations.service";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller("transaction-intents")
export class TransactionHistoryController {
  constructor(
    private readonly transactionOperationsService: TransactionOperationsService
  ) {}

  @Get("me/history")
  async listMyTransactionHistory(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListMyTransactionHistoryDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.transactionOperationsService.listMyTransactionHistory(
      request.user.id,
      query
    );

    return {
      status: "success",
      message: "Transaction history retrieved successfully.",
      data: result
    };
  }
}
