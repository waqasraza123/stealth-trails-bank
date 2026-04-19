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
import { CustomerAccountIncidentPackageReleaseWorkflowService } from "./customer-account-incident-package-release-workflow.service";
import { ApproveCustomerAccountIncidentPackageReleaseDto } from "./dto/approve-customer-account-incident-package-release.dto";
import { CreateCustomerAccountIncidentPackageReleaseRequestDto } from "./dto/create-customer-account-incident-package-release-request.dto";
import { ListPendingCustomerAccountIncidentPackageReleasesDto } from "./dto/list-pending-customer-account-incident-package-releases.dto";
import { ListReleasedCustomerAccountIncidentPackageReleasesDto } from "./dto/list-released-customer-account-incident-package-releases.dto";
import { RejectCustomerAccountIncidentPackageReleaseDto } from "./dto/reject-customer-account-incident-package-release.dto";
import { ReleaseCustomerAccountIncidentPackageReleaseDto } from "./dto/release-customer-account-incident-package-release.dto";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("customer-account-incident-package/internal/releases")
export class CustomerAccountIncidentPackageReleaseWorkflowController {
  constructor(
    private readonly customerAccountIncidentPackageReleaseWorkflowService: CustomerAccountIncidentPackageReleaseWorkflowService
  ) {}

  @Post()
  async createReleaseRequest(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateCustomerAccountIncidentPackageReleaseRequestDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountIncidentPackageReleaseWorkflowService.createReleaseRequest(
        dto,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole
      );

    return {
      status: "success",
      message: "Incident package release request created successfully.",
      data: result
    };
  }

  @Get("pending")
  async listPendingReleases(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListPendingCustomerAccountIncidentPackageReleasesDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountIncidentPackageReleaseWorkflowService.listPendingReleases(
        query
      );

    return {
      status: "success",
      message: "Pending incident package release requests retrieved successfully.",
      data: result
    };
  }

  @Get("released")
  async listReleasedReleases(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListReleasedCustomerAccountIncidentPackageReleasesDto
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountIncidentPackageReleaseWorkflowService.listReleasedReleases(
        query
      );

    return {
      status: "success",
      message: "Released incident package records retrieved successfully.",
      data: result
    };
  }

  @Get(":releaseId")
  async getRelease(
    @Param("releaseId") releaseId: string
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountIncidentPackageReleaseWorkflowService.getRelease(
        releaseId
      );

    return {
      status: "success",
      message: "Incident package release retrieved successfully.",
      data: result
    };
  }

  @Post(":releaseId/approve")
  async approveRelease(
    @Param("releaseId") releaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ApproveCustomerAccountIncidentPackageReleaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountIncidentPackageReleaseWorkflowService.approveRelease(
        releaseId,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole,
        dto
      );

    return {
      status: "success",
      message: result.stateReused
        ? "Incident package release approval state reused successfully."
        : "Incident package release approved successfully.",
      data: result
    };
  }

  @Post(":releaseId/reject")
  async rejectRelease(
    @Param("releaseId") releaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RejectCustomerAccountIncidentPackageReleaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountIncidentPackageReleaseWorkflowService.rejectRelease(
        releaseId,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole,
        dto
      );

    return {
      status: "success",
      message: result.stateReused
        ? "Incident package release rejection state reused successfully."
        : "Incident package release rejected successfully.",
      data: result
    };
  }

  @Post(":releaseId/release")
  async releaseApprovedPackage(
    @Param("releaseId") releaseId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ReleaseCustomerAccountIncidentPackageReleaseDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.customerAccountIncidentPackageReleaseWorkflowService.releaseApprovedPackage(
        releaseId,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole,
        dto
      );

    return {
      status: "success",
      message: result.stateReused
        ? "Incident package release state reused successfully."
        : "Incident package released successfully.",
      data: result
    };
  }
}
