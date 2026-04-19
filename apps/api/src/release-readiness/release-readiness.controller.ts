import {
  BadRequestException,
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
import { CreateReleaseReadinessApprovalDto } from "./dto/create-release-readiness-approval.dto";
import { CreateReleaseReadinessEvidenceDto } from "./dto/create-release-readiness-evidence.dto";
import { GetReleaseReadinessSummaryDto } from "./dto/get-release-readiness-summary.dto";
import {
  GetLaunchClosureStatusDto,
  LaunchClosureManifestDto
} from "./dto/launch-closure.dto";
import { ListReleaseLaunchClosurePacksDto } from "./dto/list-release-launch-closure-packs.dto";
import { ListReleaseReadinessApprovalLineageIncidentsDto } from "./dto/list-release-readiness-approval-lineage-incidents.dto";
import { ListReleaseReadinessApprovalsDto } from "./dto/list-release-readiness-approvals.dto";
import { ListReleaseReadinessEvidenceDto } from "./dto/list-release-readiness-evidence.dto";
import {
  ApproveReleaseReadinessApprovalDto,
  RebindReleaseReadinessApprovalPackDto,
  RejectReleaseReadinessApprovalDto
} from "./dto/release-readiness-approval.dto";
import {
  renderLaunchClosureValidationSummary,
  validateLaunchClosureManifest as validateLaunchClosureManifestPayload
} from "./launch-closure-pack";
import { ReleaseReadinessService } from "./release-readiness.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("release-readiness/internal")
export class ReleaseReadinessController {
  constructor(
    private readonly releaseReadinessService: ReleaseReadinessService
  ) {}

  @Get("summary")
  async getSummary(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetReleaseReadinessSummaryDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getSummary(query, {
      operatorId: request.internalOperator.operatorId,
      operatorRole: request.internalOperator.operatorRole
    });

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

  @Get("approvals/lineage-incidents")
  async listApprovalLineageIncidents(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListReleaseReadinessApprovalLineageIncidentsDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.releaseReadinessService.listApprovalLineageIncidents(query);

    return {
      status: "success",
      message: "Release readiness approval lineage incidents retrieved successfully.",
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

  @Get("approvals/:approvalId/lineage")
  async getApprovalLineage(
    @Param("approvalId") approvalId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getApprovalLineage(
      approvalId
    );

    return {
      status: "success",
      message: "Release readiness approval lineage retrieved successfully.",
      data: result
    };
  }

  @Get("approvals/:approvalId/recovery-target")
  async getApprovalRecoveryTarget(
    @Param("approvalId") approvalId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getApprovalRecoveryTarget(
      approvalId
    );

    return {
      status: "success",
      message: "Release readiness approval recovery target retrieved successfully.",
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

  @Post("approvals/:approvalId/rebind-pack")
  async rebindApprovalPack(
    @Param("approvalId") approvalId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RebindReleaseReadinessApprovalPackDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.rebindApprovalToLaunchClosurePack(
      approvalId,
      dto.launchClosurePackId,
      dto.expectedUpdatedAt,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Release readiness approval pack rebound successfully.",
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

  @Get("launch-closure/status")
  async getLaunchClosureStatus(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetLaunchClosureStatusDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getLaunchClosureStatus(
      query,
      {
        operatorId: request.internalOperator.operatorId,
        operatorRole: request.internalOperator.operatorRole
      }
    );

    return {
      status: "success",
      message: "Launch-closure status retrieved successfully.",
      data: result
    };
  }

  @Get("launch-closure/packs")
  async listLaunchClosurePacks(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListReleaseLaunchClosurePacksDto
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.listLaunchClosurePacks(query);

    return {
      status: "success",
      message: "Launch-closure packs retrieved successfully.",
      data: result
    };
  }

  @Get("launch-closure/packs/:packId")
  async getLaunchClosurePack(
    @Param("packId") packId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.releaseReadinessService.getLaunchClosurePack(packId);

    return {
      status: "success",
      message: "Launch-closure pack retrieved successfully.",
      data: result
    };
  }

  @Post("launch-closure/validate")
  validateLaunchClosureManifest(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: LaunchClosureManifestDto
  ): CustomJsonResponse {
    const validation = validateLaunchClosureManifestPayload(dto.manifest);

    return {
      status: "success",
      message: "Launch-closure manifest validated successfully.",
      data: {
        validation,
        summaryMarkdown: renderLaunchClosureValidationSummary(dto.manifest)
      }
    };
  }

  @Post("launch-closure/scaffold")
  async scaffoldLaunchClosurePack(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: LaunchClosureManifestDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const validation = validateLaunchClosureManifestPayload(dto.manifest);

    if (validation.errors.length > 0) {
      throw new BadRequestException(validation.errors.join(" "));
    }

    const result = await this.releaseReadinessService.storeLaunchClosurePack(
      dto.manifest,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Launch-closure pack generated successfully.",
      data: result
    };
  }
}
