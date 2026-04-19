import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { GetManualResolutionSummaryDto } from "./dto/get-manual-resolution-summary.dto";
import { ListManuallyResolvedIntentsDto } from "./dto/list-manually-resolved-intents.dto";
import { ListManuallyResolvedReviewCasesDto } from "./dto/list-manually-resolved-review-cases.dto";
import { ManualResolutionReportingService } from "./manual-resolution-reporting.service";

@UseGuards(InternalOperatorBearerGuard)
@Controller("review-cases/internal/manual-resolutions")
export class ManualResolutionReportingController {
  constructor(
    private readonly manualResolutionReportingService: ManualResolutionReportingService
  ) {}

  @Get("intents")
  async listManuallyResolvedIntents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListManuallyResolvedIntentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.manualResolutionReportingService.listManuallyResolvedIntents(
        query
      );

    return {
      status: "success",
      message: "Manually resolved intents retrieved successfully.",
      data: result
    };
  }

  @Get("review-cases")
  async listManuallyResolvedReviewCases(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListManuallyResolvedReviewCasesDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.manualResolutionReportingService.listManuallyResolvedReviewCases(
        query
      );

    return {
      status: "success",
      message: "Manually resolved review cases retrieved successfully.",
      data: result
    };
  }

  @Get("summary")
  async getManualResolutionSummary(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetManualResolutionSummaryDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.manualResolutionReportingService.getManualResolutionSummary(
        query
      );

    return {
      status: "success",
      message: "Manual resolution summary retrieved successfully.",
      data: result
    };
  }
}
