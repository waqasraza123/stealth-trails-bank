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
import { ConfirmDepositIntentDto } from "./dto/confirm-deposit-intent.dto";
import { DecideDepositIntentDto } from "./dto/decide-deposit-intent.dto";
import { FailDepositIntentExecutionDto } from "./dto/fail-deposit-intent-execution.dto";
import { ListApprovedDepositIntentsDto } from "./dto/list-approved-deposit-intents.dto";
import { ListBroadcastDepositIntentsDto } from "./dto/list-broadcast-deposit-intents.dto";
import { ListPendingDepositIntentsDto } from "./dto/list-pending-deposit-intents.dto";
import { ListQueuedDepositIntentsDto } from "./dto/list-queued-deposit-intents.dto";
import { QueueApprovedDepositIntentDto } from "./dto/queue-approved-deposit-intent.dto";
import { RecordDepositBroadcastDto } from "./dto/record-deposit-broadcast.dto";
import { SettleConfirmedDepositIntentDto } from "./dto/settle-confirmed-deposit-intent.dto";
import { TransactionIntentsService } from "./transaction-intents.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("transaction-intents/internal")
export class TransactionIntentsInternalController {
  constructor(
    private readonly transactionIntentsService: TransactionIntentsService
  ) {}

  @Get("deposit-requests/pending")
  async listPendingDepositIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListPendingDepositIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.listPendingDepositIntents(query);

    return {
      status: "success",
      message: "Pending deposit requests retrieved successfully.",
      data: result
    };
  }

  @Post("deposit-requests/:intentId/decision")
  async decideDepositIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: DecideDepositIntentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.transactionIntentsService.decideDepositIntent(
      intentId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message:
        dto.decision === "approved"
          ? "Deposit request approved successfully."
          : "Deposit request denied successfully.",
      data: result
    };
  }

  @Get("deposit-requests/approved")
  async listApprovedDepositIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListApprovedDepositIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.listApprovedDepositIntents(query);

    return {
      status: "success",
      message: "Approved deposit requests retrieved successfully.",
      data: result
    };
  }

  @Post("deposit-requests/:intentId/queue")
  async queueApprovedDepositIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: QueueApprovedDepositIntentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.queueApprovedDepositIntent(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.queueReused
        ? "Deposit request queue state reused successfully."
        : "Deposit request queued successfully.",
      data: result
    };
  }

  @Get("deposit-requests/queued")
  async listQueuedDepositIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListQueuedDepositIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.listQueuedDepositIntents(query);

    return {
      status: "success",
      message: "Queued deposit custody operations retrieved successfully.",
      data: result
    };
  }

  @Get("deposit-requests/broadcast")
  async listBroadcastDepositIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListBroadcastDepositIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.listBroadcastDepositIntents(query);

    return {
      status: "success",
      message: "Broadcast deposit custody operations retrieved successfully.",
      data: result
    };
  }

  @Post("deposit-requests/:intentId/broadcast")
  async recordDepositBroadcast(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordDepositBroadcastDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.recordDepositBroadcastByOperator(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.broadcastReused
        ? "Deposit custody broadcast state reused successfully."
        : "Deposit custody broadcast recorded successfully.",
      data: result
    };
  }

  @Post("deposit-requests/:intentId/fail")
  async failDepositIntentExecution(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: FailDepositIntentExecutionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.failDepositIntentExecutionByOperator(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.failureReused
        ? "Deposit custody failure state reused successfully."
        : "Deposit custody failure recorded successfully.",
      data: result
    };
  }

  @Post("deposit-requests/:intentId/confirm")
  async confirmDepositIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ConfirmDepositIntentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.confirmDepositIntentByOperator(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.confirmReused
        ? "Deposit custody confirm state reused successfully."
        : "Deposit custody confirmation recorded successfully.",
      data: result
    };
  }

  @Post("deposit-requests/:intentId/settle")
  async settleConfirmedDepositIntent(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: SettleConfirmedDepositIntentDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.settleConfirmedDepositIntentByOperator(
        intentId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.settlementReused
        ? "Deposit custody settlement state reused successfully."
        : "Deposit custody settlement recorded successfully.",
      data: result
    };
  }
}
