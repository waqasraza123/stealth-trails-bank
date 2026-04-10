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
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { OperatorLoanActionDto } from "./dto/operator-loan-action.dto";
import { WorkerListLoansDto } from "./dto/worker-list-loans.dto";
import { LoansService } from "./loans.service";

type InternalWorkerRequest = {
  internalWorker: {
    workerId: string;
  };
};

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("loans/internal/worker")
export class WorkerLoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get("agreements/awaiting-funding")
  async listAwaitingFunding(
    @Query(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
    )
    query: WorkerListLoansDto
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.listAwaitingFunding(query.limit);

    return {
      status: "success",
      message: "Loans awaiting funding retrieved successfully.",
      data: result
    };
  }

  @Post("agreements/:loanAgreementId/fund")
  async fundAgreement(
    @Param("loanAgreementId") loanAgreementId: string,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.fundAgreement(
      loanAgreementId,
      request.internalWorker.workerId
    );

    return {
      status: "success",
      message: "Loan funding processed successfully.",
      data: result
    };
  }

  @Get("installments/due")
  async listDueInstallments(
    @Query(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
    )
    query: WorkerListLoansDto
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.listDueInstallments(query.limit);

    return {
      status: "success",
      message: "Due installments retrieved successfully.",
      data: result
    };
  }

  @Post("agreements/:loanAgreementId/run-autopay")
  async runAutopay(
    @Param("loanAgreementId") loanAgreementId: string,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.runAutopay(
      loanAgreementId,
      request.internalWorker.workerId
    );

    return {
      status: "success",
      message: "Autopay sweep completed successfully.",
      data: result
    };
  }

  @Post("agreements/:loanAgreementId/refresh-valuation")
  async refreshValuation(
    @Param("loanAgreementId") loanAgreementId: string,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.refreshValuation(
      loanAgreementId,
      request.internalWorker.workerId
    );

    return {
      status: "success",
      message: "Loan valuation refreshed successfully.",
      data: result
    };
  }

  @Get("agreements/liquidation-candidates")
  async listLiquidationCandidates(
    @Query(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
    )
    query: WorkerListLoansDto
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.listLiquidationCandidates(query.limit);

    return {
      status: "success",
      message: "Liquidation candidates retrieved successfully.",
      data: result
    };
  }

  @Get("agreements/valuation-monitor")
  async listValuationMonitor(
    @Query(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
    )
    query: WorkerListLoansDto
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.listValuationMonitor(query.limit);

    return {
      status: "success",
      message: "Loans requiring valuation refresh retrieved successfully.",
      data: result
    };
  }

  @Get("agreements/grace-period-expired")
  async listGracePeriodExpired(
    @Query(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
    )
    query: WorkerListLoansDto
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.listGracePeriodExpired(query.limit);

    return {
      status: "success",
      message: "Loans with expired grace periods retrieved successfully.",
      data: result
    };
  }

  @Post("agreements/:loanAgreementId/escalate-default")
  async escalateDefault(
    @Param("loanAgreementId") loanAgreementId: string,
    @Request() request: InternalWorkerRequest,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: OperatorLoanActionDto
  ): Promise<CustomJsonResponse> {
    const result = await this.loansService.escalateDefault(
      loanAgreementId,
      request.internalWorker.workerId,
      dto.note
    );

    return {
      status: "success",
      message: "Loan default escalation completed successfully.",
      data: result
    };
  }
}
