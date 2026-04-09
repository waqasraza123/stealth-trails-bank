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
import { ConfirmWithdrawalIntentDto } from "./dto/confirm-withdrawal-intent.dto";
import { FailWithdrawalIntentExecutionDto } from "./dto/fail-withdrawal-intent-execution.dto";
import { ListBroadcastWithdrawalIntentsDto } from "./dto/list-broadcast-withdrawal-intents.dto";
import { ListConfirmedWithdrawalIntentsDto } from "./dto/list-confirmed-withdrawal-intents.dto";
import { ListQueuedWithdrawalIntentsDto } from "./dto/list-queued-withdrawal-intents.dto";
import { RecordWithdrawalBroadcastDto } from "./dto/record-withdrawal-broadcast.dto";
import { SettleConfirmedWithdrawalIntentDto } from "./dto/settle-confirmed-withdrawal-intent.dto";
import { WithdrawalIntentsService } from "./withdrawal-intents.service";

type InternalWorkerRequest = {
  internalWorker: {
    workerId: string;
  };
};

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("transaction-intents/internal/worker")
export class WithdrawalIntentsWorkerController {
  constructor(
    private readonly withdrawalIntentsService: WithdrawalIntentsService
  ) {}

  @Get("withdrawal-requests/queued")
  async listQueuedWithdrawalIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListQueuedWithdrawalIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.listQueuedWithdrawalIntents(query);

    return {
      status: "success",
      message: "Queued withdrawal requests retrieved successfully.",
      data: result
    };
  }

  @Get("withdrawal-requests/broadcast")
  async listBroadcastWithdrawalIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListBroadcastWithdrawalIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.listBroadcastWithdrawalIntents(query);

    return {
      status: "success",
      message: "Broadcast withdrawal requests retrieved successfully.",
      data: result
    };
  }

  @Get("withdrawal-requests/confirmed-ready-to-settle")
  async listConfirmedWithdrawalIntentsReadyToSettle(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListConfirmedWithdrawalIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.listConfirmedWithdrawalIntentsReadyToSettle(
        query
      );

    return {
      status: "success",
      message:
        "Confirmed withdrawal requests ready to settle retrieved successfully.",
      data: result
    };
  }

  @Post("withdrawal-requests/:intentId/broadcast")
  async recordWithdrawalBroadcast(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordWithdrawalBroadcastDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.withdrawalIntentsService.recordWithdrawalBroadcast(
      intentId,
      request.internalWorker.workerId,
      dto
    );

    return {
      status: "success",
      message: result.broadcastReused
        ? "Withdrawal broadcast state reused successfully."
        : "Withdrawal broadcast recorded successfully.",
      data: result
    };
  }

  @Post("withdrawal-requests/:intentId/fail")
  async failWithdrawalIntentExecution(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: FailWithdrawalIntentExecutionDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.failWithdrawalIntentExecution(
        intentId,
        request.internalWorker.workerId,
        dto
      );

    return {
      status: "success",
      message: result.failureReused
        ? "Withdrawal execution failure state reused successfully."
        : "Withdrawal execution failure recorded successfully.",
      data: result
    };
  }

  @Post("withdrawal-requests/:intentId/confirm")
  async confirmWithdrawalIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ConfirmWithdrawalIntentDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.withdrawalIntentsService.confirmWithdrawalIntent(
      intentId,
      request.internalWorker.workerId,
      dto
    );

    return {
      status: "success",
      message: result.confirmReused
        ? "Withdrawal confirm state reused successfully."
        : "Withdrawal confirmed successfully.",
      data: result
    };
  }

  @Post("withdrawal-requests/:intentId/settle")
  async settleConfirmedWithdrawalIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: SettleConfirmedWithdrawalIntentDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.withdrawalIntentsService.settleConfirmedWithdrawalIntent(
        intentId,
        request.internalWorker.workerId,
        dto
      );

    return {
      status: "success",
      message: result.settlementReused
        ? "Withdrawal settlement state reused successfully."
        : "Withdrawal settled successfully.",
      data: result
    };
  }
}
