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
import { CreateReleaseReadinessApprovalDto } from "./dto/create-release-readiness-approval.dto";
import { CreateReleaseReadinessEvidenceDto } from "./dto/create-release-readiness-evidence.dto";
import { ListReleaseReadinessApprovalsDto } from "./dto/list-release-readiness-approvals.dto";
import { ListReleaseReadinessEvidenceDto } from "./dto/list-release-readiness-evidence.dto";
import {
  ApproveReleaseReadinessApprovalDto,
  RejectReleaseReadinessApprovalDto
} from "./dto/release-readiness-approval.dto";
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

  @Get("approvals")
  async listApprovals(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListReleaseReadinessApprovalsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.listApprovals(query);

    return {
      status: "success",
      message: "Release readiness approvals retrieved successfully.",
      data: result
    };
  }

  @Get("approvals/:approvalId")
  async getApproval(
    @Param("approvalId") approvalId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getApproval(approvalId);

    return {
      status: "success",
      message: "Release readiness approval retrieved successfully.",
      data: result
    };
  }

  @Post("approvals")
  async requestApproval(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateReleaseReadinessApprovalDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.requestApproval(
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Release readiness approval requested successfully.",
      data: result
    };
  }

  @Post("approvals/:approvalId/approve")
  async approveApproval(
    @Param("approvalId") approvalId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ApproveReleaseReadinessApprovalDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.approveApproval(
      approvalId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Release readiness approval completed successfully.",
      data: result
    };
  }

  @Post("approvals/:approvalId/reject")
  async rejectApproval(
    @Param("approvalId") approvalId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RejectReleaseReadinessApprovalDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.rejectApproval(
      approvalId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Release readiness approval rejected successfully.",
      data: result
    };
  }
}
