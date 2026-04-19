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
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { AccountRestrictionReleaseReviewService } from "./account-restriction-release-review.service";
import { DecideAccountReleaseDto } from "./dto/decide-account-release.dto";
import { ListPendingAccountReleaseReviewsDto } from "./dto/list-pending-account-release-reviews.dto";
import { RequestAccountReleaseDto } from "./dto/request-account-release.dto";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("review-cases/internal")
export class AccountRestrictionReleaseReviewController {
  constructor(
    private readonly accountRestrictionReleaseReviewService: AccountRestrictionReleaseReviewService
  ) {}

  @Post(":reviewCaseId/request-account-release")
  async requestAccountRelease(
    @Param("reviewCaseId") reviewCaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RequestAccountReleaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.accountRestrictionReleaseReviewService.requestAccountRelease(
        reviewCaseId,
        request.internalOperator.operatorId,
        dto
      );

    return {
      status: "success",
      message: result.stateReused
        ? "Account release request state reused successfully."
        : "Account release requested successfully.",
      data: result
    };
  }

  @Get("account-release-requests/pending")
  async listPendingAccountReleaseReviews(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListPendingAccountReleaseReviewsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.accountRestrictionReleaseReviewService.listPendingAccountReleaseReviews(
        query
      );

    return {
      status: "success",
      message: "Pending account release reviews retrieved successfully.",
      data: result
    };
  }

  @Post("account-release-requests/:reviewCaseId/decision")
  async decideAccountRelease(
    @Param("reviewCaseId") reviewCaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: DecideAccountReleaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.accountRestrictionReleaseReviewService.decideAccountRelease(
        reviewCaseId,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole,
        dto
      );

    return {
      status: "success",
      message:
        dto.decision === "approved"
          ? result.stateReused
            ? "Account release approval state reused successfully."
            : "Account release approved successfully."
          : result.stateReused
            ? "Account release denial state reused successfully."
            : "Account release denied successfully.",
      data: result
    };
  }
}
