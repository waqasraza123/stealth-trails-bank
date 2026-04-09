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
import { PrismaService } from "../prisma/prisma.service";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ConfirmDepositIntentDto } from "./dto/confirm-deposit-intent.dto";
import { FailDepositIntentExecutionDto } from "./dto/fail-deposit-intent-execution.dto";
import { ListBroadcastDepositIntentsDto } from "./dto/list-broadcast-deposit-intents.dto";
import { ListConfirmedDepositIntentsDto } from "./dto/list-confirmed-deposit-intents.dto";
import { ListQueuedDepositIntentsDto } from "./dto/list-queued-deposit-intents.dto";
import { RecordDepositBroadcastDto } from "./dto/record-deposit-broadcast.dto";
import { SettleConfirmedDepositIntentDto } from "./dto/settle-confirmed-deposit-intent.dto";
import { TransactionIntentsService } from "./transaction-intents.service";

type InternalWorkerRequest = {
  internalWorker: {
    workerId: string;
  };
};

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("transaction-intents/internal/worker")
export class TransactionIntentsWorkerController {
  constructor(
    private readonly transactionIntentsService: TransactionIntentsService,
    private readonly prismaService: PrismaService
  ) {}

  private async attachAssetExecutionMetadata<
    T extends {
      intents: Array<{
        asset: {
          id: string;
          symbol: string;
          displayName: string;
          decimals: number;
          chainId: number;
        };
      }>;
      limit: number;
    }
  >(result: T): Promise<T> {
    const assetIds = Array.from(
      new Set(result.intents.map((intent) => intent.asset.id))
    );

    if (assetIds.length === 0) {
      return result;
    }

    const assets = await this.prismaService.asset.findMany({
      where: {
        id: {
          in: assetIds
        }
      },
      select: {
        id: true,
        assetType: true,
        contractAddress: true
      }
    });

    const assetMap = new Map(
      assets.map((asset) => [
        asset.id,
        {
          assetType: asset.assetType,
          contractAddress: asset.contractAddress
        }
      ])
    );

    return {
      ...result,
      intents: result.intents.map((intent) => {
        const metadata = assetMap.get(intent.asset.id);

        return {
          ...intent,
          asset: {
            ...intent.asset,
            assetType: metadata?.assetType ?? "unknown",
            contractAddress: metadata?.contractAddress ?? null
          }
        };
      })
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
    const result = await this.attachAssetExecutionMetadata(
      await this.transactionIntentsService.listQueuedDepositIntents(query)
    );

    return {
      status: "success",
      message: "Queued deposit requests retrieved successfully.",
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
    const result = await this.attachAssetExecutionMetadata(
      await this.transactionIntentsService.listBroadcastDepositIntents(query)
    );

    return {
      status: "success",
      message: "Broadcast deposit requests retrieved successfully.",
      data: result
    };
  }

  @Get("deposit-requests/confirmed-ready-to-settle")
  async listConfirmedDepositIntentsReadyToSettle(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListConfirmedDepositIntentsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.attachAssetExecutionMetadata(
      await this.transactionIntentsService.listConfirmedDepositIntentsReadyToSettle(
        query
      )
    );

    return {
      status: "success",
      message:
        "Confirmed deposit requests ready to settle retrieved successfully.",
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
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.transactionIntentsService.recordDepositBroadcast(
      intentId,
      request.internalWorker.workerId,
      dto
    );

    return {
      status: "success",
      message: result.broadcastReused
        ? "Deposit broadcast state reused successfully."
        : "Deposit broadcast recorded successfully.",
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
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.transactionIntentsService.confirmDepositIntent(
      intentId,
      request.internalWorker.workerId,
      dto
    );

    return {
      status: "success",
      message: result.confirmReused
        ? "Deposit confirm state reused successfully."
        : "Deposit confirmed successfully.",
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
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.failDepositIntentExecution(
        intentId,
        request.internalWorker.workerId,
        dto
      );

    return {
      status: "success",
      message: result.failureReused
        ? "Deposit execution failure state reused successfully."
        : "Deposit execution failure recorded successfully.",
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
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.transactionIntentsService.settleConfirmedDepositIntent(
        intentId,
        request.internalWorker.workerId,
        dto
      );

    return {
      status: "success",
      message: result.settlementReused
        ? "Deposit settlement state reused successfully."
        : "Deposit settled successfully.",
      data: result
    };
  }
}
