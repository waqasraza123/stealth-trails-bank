import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorApiKeyGuard } from "../auth/guards/internal-operator-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ListOperatorLoanAgreementsDto } from "./dto/list-operator-loan-agreements.dto";
import { ListOperatorLoanApplicationsDto } from "./dto/list-operator-loan-applications.dto";
import { OperatorLoanActionDto } from "./dto/operator-loan-action.dto";
import { LoansService } from "./loans.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("loans/internal")
export class OperatorLoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get("summary")
  async getSummary(): Promise<CustomJsonResponse> {
    const result = await this.loansService.getOperatorSummary();

    return {
      status: "success",
      message: "Loan operations summary retrieved successfully.",
      data: result
    };
  }

  @Get("applications")
  async listApplications(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListOperatorLoanApplicationsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.listOperatorApplications(query);

    return {
      status: "success",
      message: "Loan applications retrieved successfully.",
      data: result
    };
  }

  @Get("applications/:loanApplicationId/workspace")
  async getApplicationWorkspace(
    @Param("loanApplicationId") loanApplicationId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.getOperatorApplicationWorkspace(
      loanApplicationId
    );

    return {
      status: "success",
      message: "Loan application workspace retrieved successfully.",
      data: result
    };
  }

  @Post("applications/:loanApplicationId/request-more-evidence")
  async requestMoreEvidence(
    @Param("loanApplicationId") loanApplicationId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: OperatorLoanActionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.requestMoreEvidence(
      loanApplicationId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto
    );

    return {
      status: "success",
      message: "Evidence request recorded successfully.",
      data: result
    };
  }

  @Post("applications/:loanApplicationId/approve")
  async approveApplication(
    @Param("loanApplicationId") loanApplicationId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: OperatorLoanActionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.approveApplication(
      loanApplicationId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto
    );

    return {
      status: "success",
      message: "Loan application approved successfully.",
      data: result
    };
  }

  @Post("applications/:loanApplicationId/reject")
  async rejectApplication(
    @Param("loanApplicationId") loanApplicationId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: OperatorLoanActionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.rejectApplication(
      loanApplicationId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto
    );

    return {
      status: "success",
      message: "Loan application rejected successfully.",
      data: result
    };
  }

  @Post("applications/:loanApplicationId/place-account-restriction")
  async placeAccountRestriction(
    @Param("loanApplicationId") loanApplicationId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: OperatorLoanActionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.placeAccountRestriction(
      loanApplicationId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto
    );

    return {
      status: "success",
      message: "Account restriction applied successfully.",
      data: result
    };
  }

  @Get("agreements")
  async listAgreements(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListOperatorLoanAgreementsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.listOperatorAgreements(query);

    return {
      status: "success",
      message: "Loan agreements retrieved successfully.",
      data: result
    };
  }

  @Get("agreements/:loanAgreementId/workspace")
  async getAgreementWorkspace(
    @Param("loanAgreementId") loanAgreementId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.getOperatorAgreementWorkspace(
      loanAgreementId
    );

    return {
      status: "success",
      message: "Loan agreement workspace retrieved successfully.",
      data: result
    };
  }

  @Post("agreements/:loanAgreementId/start-liquidation-review")
  async startLiquidationReview(
    @Param("loanAgreementId") loanAgreementId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: OperatorLoanActionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.startLiquidationReview(
      loanAgreementId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto
    );

    return {
      status: "success",
      message: "Liquidation review started successfully.",
      data: result
    };
  }

  @Post("agreements/:loanAgreementId/approve-liquidation")
  async approveLiquidation(
    @Param("loanAgreementId") loanAgreementId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: OperatorLoanActionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.approveLiquidation(
      loanAgreementId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto
    );

    return {
      status: "success",
      message: "Liquidation approved successfully.",
      data: result
    };
  }

  @Post("agreements/:loanAgreementId/execute-liquidation")
  async executeLiquidation(
    @Param("loanAgreementId") loanAgreementId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: OperatorLoanActionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.executeLiquidation(
      loanAgreementId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto
    );

    return {
      status: "success",
      message: "Liquidation executed successfully.",
      data: result
    };
  }

  @Post("agreements/:loanAgreementId/close")
  async closeAgreement(
    @Param("loanAgreementId") loanAgreementId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: OperatorLoanActionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.closeAgreement(
      loanAgreementId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto
    );

    return {
      status: "success",
      message: "Loan agreement closed successfully.",
      data: result
    };
  }
}
