import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ApproveGovernedExecutionOverrideDto } from "./dto/approve-governed-execution-override.dto";
import { RecordGovernedTreasuryExecutionFailureDto } from "./dto/record-governed-treasury-execution-failure.dto";
import { RecordGovernedTreasuryExecutionSuccessDto } from "./dto/record-governed-treasury-execution-success.dto";
import { RejectGovernedExecutionOverrideDto } from "./dto/reject-governed-execution-override.dto";
import { RequestGovernedExecutionOverrideDto } from "./dto/request-governed-execution-override.dto";
import { GovernedExecutionService } from "./governed-execution.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
    operatorRole: string | null;
  };
};

@UseGuards(InternalOperatorBearerGuard)
@Controller("governed-execution/internal")
export class GovernedExecutionController {
  constructor(
    private readonly governedExecutionService: GovernedExecutionService
  ) {}

  @Get("workspace")
  async getWorkspace(
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.getWorkspace({
      operatorId: request.internalOperator.operatorId,
      operatorRole: request.internalOperator.operatorRole
    });

    return {
      status: "success",
      message: "Governed execution workspace retrieved successfully.",
      data: result
    };
  }

  @Post("override-requests")
  async requestOverride(
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RequestGovernedExecutionOverrideDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.requestOverride(dto, {
      operatorId: request.internalOperator.operatorId,
      operatorRole: request.internalOperator.operatorRole
    });

    return {
      status: "success",
      message: "Governed execution override requested successfully.",
      data: result
    };
  }

  @Post("override-requests/:requestId/approve")
  async approveOverride(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: ApproveGovernedExecutionOverrideDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.approveOverride(
      requestId,
      dto,
      {
        operatorId: request.internalOperator.operatorId,
        operatorRole: request.internalOperator.operatorRole
      }
    );

    return {
      status: "success",
      message: "Governed execution override approved successfully.",
      data: result
    };
  }

  @Post("override-requests/:requestId/reject")
  async rejectOverride(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RejectGovernedExecutionOverrideDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.rejectOverride(
      requestId,
      dto,
      {
        operatorId: request.internalOperator.operatorId,
        operatorRole: request.internalOperator.operatorRole
      }
    );

    return {
      status: "success",
      message: "Governed execution override rejected successfully.",
      data: result
    };
  }

  @Post("execution-requests/:requestId/record-executed")
  async recordExecutionSuccess(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordGovernedTreasuryExecutionSuccessDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.recordExecutionSuccess(
      requestId,
      dto,
      {
        operatorId: request.internalOperator.operatorId,
        operatorRole: request.internalOperator.operatorRole
      }
    );

    return {
      status: "success",
      message: "Governed treasury execution was recorded successfully.",
      data: result
    };
  }

  @Post("execution-requests/:requestId/publish-package")
  async publishExecutionPackage(
    @Param("requestId") requestId: string,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.publishExecutionPackage(
      requestId,
      {
        operatorId: request.internalOperator.operatorId,
        operatorRole: request.internalOperator.operatorRole
      }
    );

    return {
      status: "success",
      message: "Governed execution package published successfully.",
      data: result
    };
  }

  @Post("execution-requests/:requestId/record-failed")
  async recordExecutionFailure(
    @Param("requestId") requestId: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    dto: RecordGovernedTreasuryExecutionFailureDto,
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.governedExecutionService.recordExecutionFailure(
      requestId,
      dto,
      {
        operatorId: request.internalOperator.operatorId,
        operatorRole: request.internalOperator.operatorRole
      }
    );

    return {
      status: "success",
      message: "Governed treasury execution failure was recorded successfully.",
      data: result
    };
  }
}
