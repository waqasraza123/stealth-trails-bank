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
import { StakingPoolGovernanceService } from "./staking-pool-governance.service";
import { CreateStakingPoolGovernanceRequestDto } from "./dto/create-staking-pool-governance-request.dto";
import { ListStakingPoolGovernanceRequestsDto } from "./dto/list-staking-pool-governance-requests.dto";
import {
  ApproveStakingPoolGovernanceRequestDto,
  ExecuteStakingPoolGovernanceRequestDto,
  RejectStakingPoolGovernanceRequestDto
} from "./dto/staking-pool-governance-request.dto";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole?: string;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("staking/internal/pool-governance-requests")
export class StakingPoolGovernanceController {
  constructor(
    private readonly stakingPoolGovernanceService: StakingPoolGovernanceService
  ) {}

  @Get()
  async listRequests(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: ListStakingPoolGovernanceRequestsDto
  ): Promise<CustomJsonResponse> {
    const result = await this.stakingPoolGovernanceService.listRequests(query);

    return {
      status: "success",
      message: "Staking pool governance requests retrieved successfully.",
      data: result
    };
  }

  @Get(":requestId")
  async getRequest(
    @Param("requestId") requestId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.stakingPoolGovernanceService.getRequest(requestId);

    return {
      status: "success",
      message: "Staking pool governance request retrieved successfully.",
      data: result
    };
  }

  @Post()
  async createRequest(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: CreateStakingPoolGovernanceRequestDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.stakingPoolGovernanceService.createRequest(
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Staking pool governance request created successfully.",
      data: result
    };
  }

  @Post(":requestId/approve")
  async approveRequest(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ApproveStakingPoolGovernanceRequestDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.stakingPoolGovernanceService.approveRequest(
      requestId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Staking pool governance request approved successfully.",
      data: result
    };
  }

  @Post(":requestId/reject")
  async rejectRequest(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RejectStakingPoolGovernanceRequestDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.stakingPoolGovernanceService.rejectRequest(
      requestId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: "Staking pool governance request rejected successfully.",
      data: result
    };
  }

  @Post(":requestId/execute")
  async executeRequest(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ExecuteStakingPoolGovernanceRequestDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.stakingPoolGovernanceService.executeRequest(
      requestId,
      dto,
      request.internalOperator.operatorId,
      request.internalOperator.operatorRole
    );

    return {
      status: "success",
      message: result.stateReused
        ? "Staking pool governance execution state reused successfully."
        : "Staking pool governance request executed successfully.",
      data: result
    };
  }
}
