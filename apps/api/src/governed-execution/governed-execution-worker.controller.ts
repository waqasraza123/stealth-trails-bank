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
import { ClaimGovernedExecutionRequestDto } from "./dto/claim-governed-execution-request.dto";
import { DispatchGovernedExecutionRequestDto } from "./dto/dispatch-governed-execution-request.dto";
import { ListGovernedExecutionRequestsDto } from "./dto/list-governed-execution-requests.dto";
import { GovernedExecutionService } from "./governed-execution.service";

type InternalWorkerRequest = {
  internalWorker: {
    workerId: string;
  };
};

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("governed-execution/internal/worker")
export class GovernedExecutionWorkerController {
  constructor(
    private readonly governedExecutionService: GovernedExecutionService
  ) {}

  @Get("execution-requests/claimable")
  async listClaimableExecutionRequests(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListGovernedExecutionRequestsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.listClaimableExecutionRequests(
      query.limit
    );

    return {
      status: "success",
      message: "Claimable governed execution requests retrieved successfully.",
      data: result
    };
  }

  @Post("execution-requests/:requestId/claim")
  async claimExecutionRequest(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ClaimGovernedExecutionRequestDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.claimExecutionRequest(
      requestId,
      request.internalWorker.workerId,
      dto.reclaimStaleAfterMs
    );

    return {
      status: "success",
      message: "Governed execution request claimed successfully.",
      data: result
    };
  }

  @Post("execution-requests/:requestId/dispatch")
  async dispatchExecutionRequest(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: DispatchGovernedExecutionRequestDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.dispatchExecutionRequest(
      requestId,
      dto,
      request.internalWorker.workerId
    );

    return {
      status: "success",
      message: "Governed execution request dispatch recorded successfully.",
      data: result
    };
  }
}
