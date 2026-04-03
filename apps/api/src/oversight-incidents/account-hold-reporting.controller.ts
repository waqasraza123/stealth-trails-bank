import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { AccountHoldReportingService } from "./account-hold-reporting.service";
import { GetAccountHoldSummaryDto } from "./dto/get-account-hold-summary.dto";
import { ListActiveAccountHoldsDto } from "./dto/list-active-account-holds.dto";
import { ListReleasedAccountHoldsDto } from "./dto/list-released-account-holds.dto";

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("oversight-incidents/internal/account-holds")
export class AccountHoldReportingController {
  constructor(
    private readonly accountHoldReportingService: AccountHoldReportingService
  ) {}

  @Get("active")
  async listActiveAccountHolds(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListActiveAccountHoldsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.accountHoldReportingService.listActiveAccountHolds(
      query
    );

    return {
      status: "success",
      message: "Active account holds retrieved successfully.",
      data: result
    };
  }

  @Get("released")
  async listReleasedAccountHolds(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListReleasedAccountHoldsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.accountHoldReportingService.listReleasedAccountHolds(query);

    return {
      status: "success",
      message: "Released account holds retrieved successfully.",
      data: result
    };
  }

  @Get("summary")
  async getAccountHoldSummary(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetAccountHoldSummaryDto
  ): Promise<CustomJsonResponse> {
    const result = await this.accountHoldReportingService.getAccountHoldSummary(
      query
    );

    return {
      status: "success",
      message: "Account hold summary retrieved successfully.",
      data: result
    };
  }
}
