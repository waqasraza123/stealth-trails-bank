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
import { CreateReleaseReadinessEvidenceDto } from "./dto/create-release-readiness-evidence.dto";
import { ListReleaseReadinessEvidenceDto } from "./dto/list-release-readiness-evidence.dto";
import { ReleaseReadinessService } from "./release-readiness.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("release-readiness/internal")
export class ReleaseReadinessController {
  constructor(
    private readonly releaseReadinessService: ReleaseReadinessService
  ) {}

  @Get("summary")
  async getSummary(): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getSummary();

    return {
      status: "success",
      message: "Release readiness summary retrieved successfully.",
      data: result
    };
  }

  @Get("evidence")
  async listEvidence(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListReleaseReadinessEvidenceDto
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.listEvidence(query);

    return {
      status: "success",
      message: "Release readiness evidence retrieved successfully.",
      data: result
    };
  }

  @Get("evidence/:evidenceId")
  async getEvidence(
    @Param("evidenceId") evidenceId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getEvidence(evidenceId);

    return {
      status: "success",
      message: "Release readiness evidence retrieved successfully.",
      data: result
    };
  }

  @Post("evidence")
  async recordEvidence(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateReleaseReadinessEvidenceDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.recordEvidence(
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Release readiness evidence recorded successfully.",
      data: result
    };
  }
}
