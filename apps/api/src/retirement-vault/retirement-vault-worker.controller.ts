import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { InternalWorkerApiKeyGuard } from "../auth/guards/internal-worker-api-key.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { RetirementVaultService } from "./retirement-vault.service";
import { SweepRetirementVaultReleaseRequestsDto } from "./dto/sweep-retirement-vault-release-requests.dto";

type InternalWorkerRequest = {
  internalWorker: {
    workerId: string;
  };
};

@UseGuards(InternalWorkerApiKeyGuard)
@Controller("retirement-vault/internal/worker")
export class RetirementVaultWorkerController {
  constructor(private readonly retirementVaultService: RetirementVaultService) {}

  @Post("release-requests/sweep")
  async sweepReleaseRequests(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: SweepRetirementVaultReleaseRequestsDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.sweepReleaseRequests(
      request.internalWorker.workerId,
      dto.limit ?? 25
    );

    return {
      status: "success",
      message: "Retirement vault release sweep completed successfully.",
      data: result,
    };
  }

  @Post("rule-change-requests/sweep")
  async sweepRuleChangeRequests(
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: SweepRetirementVaultReleaseRequestsDto,
    @Request() request: InternalWorkerRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.sweepRuleChangeRequests(
      request.internalWorker.workerId,
      dto.limit ?? 25
    );

    return {
      status: "success",
      message: "Retirement vault rule change sweep completed successfully.",
      data: result,
    };
  }
}
