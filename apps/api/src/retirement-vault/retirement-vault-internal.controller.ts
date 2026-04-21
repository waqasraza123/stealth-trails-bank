import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { GetInternalRetirementVaultWorkspaceDto } from "./dto/get-internal-retirement-vault-workspace.dto";
import { ListInternalRetirementVaultReleaseRequestsDto } from "./dto/list-internal-retirement-vault-release-requests.dto";
import { ListInternalRetirementVaultsDto } from "./dto/list-internal-retirement-vaults.dto";
import { ReleaseRetirementVaultRestrictionDto } from "./dto/release-retirement-vault-restriction.dto";
import { RestrictRetirementVaultDto } from "./dto/restrict-retirement-vault.dto";
import { RetirementVaultOperatorNoteDto } from "./dto/retirement-vault-operator-note.dto";
import { RetirementVaultService } from "./retirement-vault.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("retirement-vault/internal")
export class RetirementVaultInternalController {
  constructor(private readonly retirementVaultService: RetirementVaultService) {}

  @Get("vaults")
  async listVaults(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListInternalRetirementVaultsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.listInternalVaults(query);

    return {
      status: "success",
      message: "Retirement vault overview retrieved successfully.",
      data: result,
    };
  }

  @Get("vaults/:vaultId")
  async getVaultWorkspace(
    @Param("vaultId") vaultId: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: GetInternalRetirementVaultWorkspaceDto
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.getInternalVaultWorkspace(
      vaultId,
      query
    );

    return {
      status: "success",
      message: "Retirement vault workspace retrieved successfully.",
      data: result,
    };
  }

  @Post("vaults/:vaultId/restrict")
  async restrictVault(
    @Param("vaultId") vaultId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RestrictRetirementVaultDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.restrictInternalVault(
      vaultId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Retirement vault restriction state reused successfully."
        : "Retirement vault restricted successfully.",
      data: result,
    };
  }

  @Post("vaults/:vaultId/release-restriction")
  async releaseVaultRestriction(
    @Param("vaultId") vaultId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ReleaseRetirementVaultRestrictionDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.retirementVaultService.releaseInternalVaultRestriction(
        vaultId,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole,
        dto
      );

    return {
      status: "success",
      message: result.stateReused
        ? "Retirement vault restriction release state reused successfully."
        : "Retirement vault restriction released successfully.",
      data: result,
    };
  }

  @Get("release-requests")
  async listReleaseRequests(
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListInternalRetirementVaultReleaseRequestsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.listInternalReleaseRequests(
      query
    );

    return {
      status: "success",
      message: "Retirement vault release requests retrieved successfully.",
      data: result,
    };
  }

  @Get("release-requests/:releaseRequestId")
  async getReleaseRequestWorkspace(
    @Param("releaseRequestId") releaseRequestId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.getInternalReleaseRequestWorkspace(
      releaseRequestId
    );

    return {
      status: "success",
      message: "Retirement vault release workspace retrieved successfully.",
      data: result,
    };
  }

  @Post("release-requests/:releaseRequestId/approve")
  async approveReleaseRequest(
    @Param("releaseRequestId") releaseRequestId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RetirementVaultOperatorNoteDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.approveInternalReleaseRequest(
      releaseRequestId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto.note
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Retirement vault release approval state reused successfully."
        : "Retirement vault release request approved successfully.",
      data: result,
    };
  }

  @Post("release-requests/:releaseRequestId/reject")
  async rejectReleaseRequest(
    @Param("releaseRequestId") releaseRequestId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RetirementVaultOperatorNoteDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.retirementVaultService.rejectInternalReleaseRequest(
      releaseRequestId,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole,
      dto.note
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Retirement vault release rejection state reused successfully."
        : "Retirement vault release request rejected successfully.",
      data: result,
    };
  }

  @Post("rule-change-requests/:ruleChangeRequestId/approve")
  async approveRuleChangeRequest(
    @Param("ruleChangeRequestId") ruleChangeRequestId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RetirementVaultOperatorNoteDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.retirementVaultService.approveInternalRuleChangeRequest(
        ruleChangeRequestId,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole,
        dto.note
      );

    return {
      status: "success",
      message: result.stateReused
        ? "Retirement vault rule change approval state reused successfully."
        : "Retirement vault rule change request approved successfully.",
      data: result,
    };
  }

  @Post("rule-change-requests/:ruleChangeRequestId/reject")
  async rejectRuleChangeRequest(
    @Param("ruleChangeRequestId") ruleChangeRequestId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: RetirementVaultOperatorNoteDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result =
      await this.retirementVaultService.rejectInternalRuleChangeRequest(
        ruleChangeRequestId,
        request.internalOperator.operatorId,
        request.internalOperator.operatorRole,
        dto.note
      );

    return {
      status: "success",
      message: result.stateReused
        ? "Retirement vault rule change rejection state reused successfully."
        : "Retirement vault rule change request rejected successfully.",
      data: result,
    };
  }
}
