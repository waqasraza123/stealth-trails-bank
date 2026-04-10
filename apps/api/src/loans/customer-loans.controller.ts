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
import { CreateLoanApplicationDto } from "./dto/create-loan-application.dto";
import { OperatorLoanActionDto } from "./dto/operator-loan-action.dto";
import { PreviewLoanQuoteDto } from "./dto/preview-loan-quote.dto";
import { LoansService } from "./loans.service";

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

@UseGuards(JwtAuthGuard)
@Controller("loans")
export class CustomerLoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get("me/dashboard")
  async getMyLoansDashboard(
    @Request() request: AuthenticatedRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.getCustomerDashboard(request.user.id);

    return {
      status: "success",
      message: "Customer loans dashboard retrieved successfully.",
      data: result
    };
  }

  @Post("me/quote-preview")
  async previewQuote(
    @Request() request: AuthenticatedRequest,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: PreviewLoanQuoteDto
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.previewQuote(request.user.id, dto);

    return {
      status: "success",
      message: "Loan quote preview generated successfully.",
      data: result
    };
  }

  @Post("me/applications")
  async createApplication(
    @Request() request: AuthenticatedRequest,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateLoanApplicationDto
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.createApplication(request.user.id, dto);

    return {
      status: "success",
      message: "Loan application submitted successfully.",
      data: result
    };
  }

  @Get("me/:loanAgreementId")
  async getMyLoanAgreement(
    @Request() request: AuthenticatedRequest,
    @Param("loanAgreementId") loanAgreementId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.getCustomerLoanDetail(
      request.user.id,
      loanAgreementId
    );

    return {
      status: "success",
      message: "Loan agreement retrieved successfully.",
      data: result
    };
  }

  @Post("me/:loanAgreementId/autopay")
  async setAutopayPreference(
    @Request() request: AuthenticatedRequest,
    @Param("loanAgreementId") loanAgreementId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: OperatorLoanActionDto
  ): Promise<CustomJsonResponse> {
    const enabled = dto.policyOverride ?? false;
    const result = await this.loansService.setCustomerAutopayPreference(
      request.user.id,
      loanAgreementId,
      enabled,
      dto.note
    );

    return {
      status: "success",
      message: "Autopay preference updated successfully.",
      data: result
    };
  }
}
