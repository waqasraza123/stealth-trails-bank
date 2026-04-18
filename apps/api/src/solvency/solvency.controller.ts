import {
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
import { GetSolvencyWorkspaceDto } from "./dto/get-solvency-workspace.dto";
import { SolvencyService } from "./solvency.service";

type InternalOperatorRequest = {
  internalOperator: {
    operatorId: string;
  };
};

@UseGuards(InternalOperatorApiKeyGuard)
@Controller("solvency/internal")
export class SolvencyController {
  constructor(private readonly solvencyService: SolvencyService) {}

  @Get("workspace")
  async getWorkspace(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true
      })
    )
    query: GetSolvencyWorkspaceDto
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.getWorkspace(query.limit);

    return {
      status: "success",
      message: "Solvency workspace retrieved successfully.",
      data: result
    };
  }

  @Get("snapshots/:snapshotId")
  async getSnapshotDetail(
    @Param("snapshotId") snapshotId: string
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.getSnapshotDetail(snapshotId);

    return {
      status: "success",
      message: "Solvency snapshot detail retrieved successfully.",
      data: result
    };
  }

  @Post("snapshots/run")
  async runSnapshot(
    @Request() request: InternalOperatorRequest
  ): Promise<CustomJsonResponse> {
    const result = await this.solvencyService.generateSnapshot({
      actorType: "operator",
      actorId: request.internalOperator.operatorId
    });

    return {
      status: "success",
      message: "Solvency snapshot generated successfully.",
      data: result
    };
  }
}
