import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { CreateRetirementVaultDto } from "./dto/create-retirement-vault.dto";
import { FundRetirementVaultDto } from "./dto/fund-retirement-vault.dto";
import { RequestRetirementVaultReleaseDto } from "./dto/request-retirement-vault-release.dto";
import { RequestRetirementVaultRuleChangeDto } from "./dto/request-retirement-vault-rule-change.dto";
import { RetirementVaultService } from "./retirement-vault.service";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller("retirement-vault")
export class RetirementVaultController {
  constructor(private readonly retirementVaultService: RetirementVaultService) {}

  @Get("me")
  async listMyRetirementVaults(
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.listMyRetirementVaults(
      request.user.id
    );

    return {
      status: "success",
      message: "Retirement vault snapshot retrieved successfully.",
      data: result
    };
  }

  @Post("me")
  async createMyRetirementVault(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateRetirementVaultDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.createMyRetirementVault(
      request.user.id,
      dto
    );

    return {
      status: "success",
      message: result.created
        ? "Retirement vault created successfully."
        : "Retirement vault already exists for this asset.",
      data: result
    };
  }

  @Post("me/funding-requests")
  async fundMyRetirementVault(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: FundRetirementVaultDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.fundMyRetirementVault(
      request.user.id,
      dto
    );

    return {
      status: "success",
      message: result.idempotencyReused
        ? "Retirement vault funding request reused successfully."
        : "Retirement vault funded successfully.",
      data: result
    };
  }

  @Post("me/release-requests")
  async requestMyRetirementVaultRelease(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RequestRetirementVaultReleaseDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.requestMyRetirementVaultRelease(
      request.user.id,
      dto
    );

    return {
      status: "success",
      message: "Retirement vault unlock request recorded successfully.",
      data: result
    };
  }

  @Post("me/release-requests/:releaseRequestId/cancel")
  async cancelMyRetirementVaultRelease(
    @Param("releaseRequestId") releaseRequestId: string,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.cancelMyRetirementVaultRelease(
      request.user.id,
      releaseRequestId
    );

    return {
      status: "success",
      message: "Retirement vault unlock request cancelled successfully.",
      data: result
    };
  }

  @Post("me/rule-change-requests")
  async requestMyRetirementVaultRuleChange(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RequestRetirementVaultRuleChangeDto,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.retirementVaultService.requestMyRetirementVaultRuleChange(
        request.user.id,
        dto
      );

    return {
      status: "success",
      message: result.appliedImmediately
        ? "Retirement vault rule change applied successfully."
        : "Retirement vault rule change request recorded successfully.",
      data: result
    };
  }

  @Post("me/rule-change-requests/:ruleChangeRequestId/cancel")
  async cancelMyRetirementVaultRuleChange(
    @Param("ruleChangeRequestId") ruleChangeRequestId: string,
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.retirementVaultService.cancelMyRetirementVaultRuleChange(
        request.user.id,
        ruleChangeRequestId
      );

    return {
      status: "success",
      message: "Retirement vault rule change request cancelled successfully.",
      data: result
    };
  }
}
