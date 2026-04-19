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
import { GetLedgerReconciliationWorkspaceDto } from "./dto/get-ledger-reconciliation-workspace.dto";
import { ListLedgerReconciliationRunsDto } from "./dto/list-ledger-reconciliation-runs.dto";
import { ListLedgerReconciliationMismatchesDto } from "./dto/list-ledger-reconciliation-mismatches.dto";
import { ScanLedgerReconciliationDto } from "./dto/scan-ledger-reconciliation.dto";
import { UpdateLedgerReconciliationMismatchDto } from "./dto/update-ledger-reconciliation-mismatch.dto";
import { LedgerReconciliationService } from "./ledger-reconciliation.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("ledger/internal/reconciliation")
export class LedgerReconciliationController {
  constructor(
    private readonly ledgerReconciliationService: LedgerReconciliationService
  ) {}

  @Post("scan")
  async scanMismatches(
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ScanLedgerReconciliationDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.ledgerReconciliationService.runTrackedScan(dto, {
      triggerSource: "operator",
      operatorId: request.internalOperator.operatorId
    });

    return {
      status: "success",
      message: "Ledger reconciliation scan completed successfully.",
      data: result
    };
  }

  @Get("runs")
  async listRuns(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListLedgerReconciliationRunsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.ledgerReconciliationService.listScanRuns(query);

    return {
      status: "success",
      message: "Ledger reconciliation scan runs retrieved successfully.",
      data: result
    };
  }

  @Get("mismatches")
  async listMismatches(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListLedgerReconciliationMismatchesDto
  ): Promise<CustomJsonResponse> {
    const result = await this.ledgerReconciliationService.listMismatches(query);

    return {
      status: "success",
      message: "Ledger reconciliation mismatches retrieved successfully.",
      data: result
    };
  }

  @Get("mismatches/:mismatchId/workspace")
  async getMismatchWorkspace(
    @Param("mismatchId") mismatchId: string,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetLedgerReconciliationWorkspaceDto
  ): Promise<CustomJsonResponse> {
    const result = await this.ledgerReconciliationService.getMismatchWorkspace(
      mismatchId,
      query
    );

    return {
      status: "success",
      message: "Ledger reconciliation mismatch workspace retrieved successfully.",
      data: result
    };
  }

  @Post("mismatches/:mismatchId/replay-confirm")
  async replayConfirm(
    @Param("mismatchId") mismatchId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: UpdateLedgerReconciliationMismatchDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.ledgerReconciliationService.replayConfirmMismatch(
      mismatchId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole ?? null,
      dto.approvalRequestId?.trim() ?? null,
      dto.note?.trim() ?? null
    );

    return {
      status: "success",
      message: "Ledger reconciliation confirm replay completed successfully.",
      data: result
    };
  }

  @Post("mismatches/:mismatchId/replay-settle")
  async replaySettle(
    @Param("mismatchId") mismatchId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: UpdateLedgerReconciliationMismatchDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.ledgerReconciliationService.replaySettleMismatch(
      mismatchId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole ?? null,
      dto.approvalRequestId?.trim() ?? null,
      dto.note?.trim() ?? null
    );

    return {
      status: "success",
      message: "Ledger reconciliation settlement replay completed successfully.",
      data: result
    };
  }

  @Post("mismatches/:mismatchId/open-review-case")
  async openReviewCase(
    @Param("mismatchId") mismatchId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: UpdateLedgerReconciliationMismatchDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.ledgerReconciliationService.openReviewCaseForMismatch(
      mismatchId,
      request.internalOperator.operatorId,
      dto.note?.trim() ?? null
    );

    return {
      status: "success",
      message: "Ledger reconciliation review case opened successfully.",
      data: result
    };
  }

  @Post("mismatches/:mismatchId/repair-balance")
  async repairBalance(
    @Param("mismatchId") mismatchId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: UpdateLedgerReconciliationMismatchDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.ledgerReconciliationService.repairCustomerBalanceMismatch(
        mismatchId,
        request.internalOperator.operatorId,
        dto.note?.trim() ?? null
      );

    return {
      status: "success",
      message: "Customer balance mismatch repaired successfully.",
      data: result
    };
  }

  @Post("mismatches/:mismatchId/dismiss")
  async dismissMismatch(
    @Param("mismatchId") mismatchId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: UpdateLedgerReconciliationMismatchDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.ledgerReconciliationService.dismissMismatch(
      mismatchId,
      request.internalOperator.operatorId,
      dto.note?.trim() ?? null
    );

    return {
      status: "success",
      message: "Ledger reconciliation mismatch dismissed successfully.",
      data: result
    };
  }
}
