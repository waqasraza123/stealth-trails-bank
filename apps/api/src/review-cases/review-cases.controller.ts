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
import { AddReviewCaseNoteDto } from "./dto/add-review-case-note.dto";
import { ApplyManualResolutionDto } from "./dto/apply-manual-resolution.dto";
import { DismissReviewCaseDto } from "./dto/dismiss-review-case.dto";
import { GetReviewCaseWorkspaceDto } from "./dto/get-review-case-workspace.dto";
import { HandoffReviewCaseDto } from "./dto/handoff-review-case.dto";
import { ListReviewCasesDto } from "./dto/list-review-cases.dto";
import { OpenDeniedWithdrawalReviewCaseDto } from "./dto/open-denied-withdrawal-review-case.dto";
import { ResolveReviewCaseDto } from "./dto/resolve-review-case.dto";
import { StartReviewCaseDto } from "./dto/start-review-case.dto";
import { ReviewCasesService } from "./review-cases.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("review-cases/internal")
export class ReviewCasesController {
  constructor(private readonly reviewCasesService: ReviewCasesService) {}

  @Get()
  async listReviewCases(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListReviewCasesDto
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.listReviewCases(query);

    return {
      status: "success",
      message: "Review cases retrieved successfully.",
      data: result
    };
  }

  @Post("withdrawal-intents/:intentId/open")
  async openDeniedWithdrawalReviewCase(
    @Param("intentId") intentId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: OpenDeniedWithdrawalReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.openDeniedWithdrawalReviewCase(
      intentId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.reviewCaseReused
        ? "Withdrawal review case reused successfully."
        : "Withdrawal review case opened successfully.",
      data: result
    };
  }

  @Get(":reviewCaseId")
  async getReviewCase(
    @Param("reviewCaseId") reviewCaseId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.getReviewCase(reviewCaseId);

    return {
      status: "success",
      message: "Review case retrieved successfully.",
      data: result
    };
  }

  @Get(":reviewCaseId/workspace")
  async getReviewCaseWorkspace(
    @Param("reviewCaseId") reviewCaseId: string,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetReviewCaseWorkspaceDto
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.getReviewCaseWorkspace(
      reviewCaseId,
      query
    );

    return {
      status: "success",
      message: "Review case workspace retrieved successfully.",
      data: result
    };
  }

  @Get(":reviewCaseId/manual-resolution-eligibility")
  async getManualResolutionEligibility(
    @Param("reviewCaseId") reviewCaseId: string
  ): Promise<CustomJsonResponse> {
    const result =
      await this.reviewCasesService.getManualResolutionEligibility(reviewCaseId);

    return {
      status: "success",
      message: "Manual resolution eligibility retrieved successfully.",
      data: result
    };
  }

  @Post(":reviewCaseId/start")
  async startReviewCase(
    @Param("reviewCaseId") reviewCaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: StartReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.startReviewCase(
      reviewCaseId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Review case start state reused successfully."
        : "Review case started successfully.",
      data: result
    };
  }

  @Post(":reviewCaseId/notes")
  async addReviewCaseNote(
    @Param("reviewCaseId") reviewCaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: AddReviewCaseNoteDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.addReviewCaseNote(
      reviewCaseId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: "Review case note added successfully.",
      data: result
    };
  }

  @Post(":reviewCaseId/handoff")
  async handoffReviewCase(
    @Param("reviewCaseId") reviewCaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: HandoffReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.handoffReviewCase(
      reviewCaseId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Review case handoff state reused successfully."
        : "Review case handed off successfully.",
      data: result
    };
  }

  @Post(":reviewCaseId/apply-manual-resolution")
  async applyManualResolution(
    @Param("reviewCaseId") reviewCaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ApplyManualResolutionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.applyManualResolution(
      reviewCaseId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Manual resolution state reused successfully."
        : "Manual resolution applied successfully.",
      data: result
    };
  }

  @Post(":reviewCaseId/resolve")
  async resolveReviewCase(
    @Param("reviewCaseId") reviewCaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ResolveReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.resolveReviewCase(
      reviewCaseId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Review case resolve state reused successfully."
        : "Review case resolved successfully.",
      data: result
    };
  }

  @Post(":reviewCaseId/dismiss")
  async dismissReviewCase(
    @Param("reviewCaseId") reviewCaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: DismissReviewCaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.reviewCasesService.dismissReviewCase(
      reviewCaseId,
      request.internalOperator.operatorId,
      dto
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Review case dismiss state reused successfully."
        : "Review case dismissed successfully.",
      data: result
    };
  }
}
